import './fixtures/axios-verb-test-bridge.mjs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import axios from 'axios'
import { authenticate, register, getCurrentUser } from '../src/services/authApi.js'

const candidate = 'fixture-candidate'
const user = { id: 1, firstName: 'QA', lastName: 'Cuenta', email: 'qa@example.invalid', role: 'USUARIO', active: true }
const credentials = { email: user.email, password: 'fixture-password' }

for (const [name, operation, path, body] of [
  ['login', authenticate, '/api/v1/auth/authenticate', credentials],
  ['registro', register, '/api/v1/auth/register', { firstname: 'QA', lastname: 'Cuenta', ...credentials }],
]) {
  test(`${name}: Axios hace POST, valida identidad mediante GET y conserva AbortSignal`, async (t) => {
    const signal = new AbortController().signal, calls = []
    t.mock.method(axios, 'request', async config => {
      calls.push(config.url)
      assert.equal(config.signal, signal)
      if (config.url.endsWith(path)) {
        assert.equal(config.method, 'POST')
        assert.deepEqual(config.data, body)
        assert.equal(config.headers, undefined, 'Autenticación anónima')
        return { data: { access_token: candidate }, status: 200 }
      }
      assert.equal(config.url, 'http://localhost:8080/users/me')
      assert.equal(config.method, 'GET')
      assert.equal(config.headers.Authorization, 'Bearer ' + candidate)
      return { data: user, status: 200 }
    })
    assert.deepEqual(await operation(body, { signal }), { token: candidate, user })
    assert.equal(calls.length, 2)
  })

  for (const invalid of [null, {}, { ...user, id: 0 }, { ...user, role: 'UNKNOWN' }, { ...user, active: false }]) {
    test(`${name}: rechaza identidad inválida ${JSON.stringify(invalid)}`, async t => {
      t.mock.method(axios, 'request', async config => ({
        data: config.url.endsWith('/users/me') ? invalid : { access_token: candidate },
        status: 200,
      }))
      await assert.rejects(operation(body), { code: 'INVALID_USER', message: 'El servidor devolvió datos de usuario inválidos.' })
    })
  }

  test(`${name}: no consulta identidad si falta el token`, async t => {
    const request = t.mock.method(axios, 'request', async () => ({ data: {}, status: 200 }))
    await assert.rejects(operation(body), /token válido/)
    assert.equal(request.mock.callCount(), 1)
  })

  test(`${name}: rechaza una respuesta de autenticación que no es JSON`, async t => {
    t.mock.method(axios, 'request', async () => ({ data: 'invalid', status: 200 }))
    await assert.rejects(operation(body), { message: 'El servidor devolvió una respuesta de autenticación inválida.' })
  })

  test(`${name}: abortar después del POST impide consultar el usuario`, async t => {
    const controller = new AbortController()
    const request = t.mock.method(axios, 'request', async () => {
      controller.abort()
      return { data: { access_token: candidate }, status: 200 }
    })
    await assert.rejects(operation(body, { signal: controller.signal }), { name: 'AbortError' })
    assert.equal(request.mock.callCount(), 1)
  })

  test(`${name}: un fallo de red se propaga sin registrar credenciales`, async t => {
    const failure = new TypeError('Network failed')
    t.mock.method(axios, 'request', async () => { throw failure })
    await assert.rejects(operation(body), error => error === failure)
  })
}

for (const [operation, status, message] of [
  [authenticate, 401, 'El correo o la contraseña son incorrectos'],
  [authenticate, 503, 'No pudimos iniciar sesión (HTTP 503). Volvé a intentar.'],
  [register, 409, 'Ya existe un usuario con este correo'],
  [register, 500, 'No se pudo registrar el usuario'],
]) {
  test(`error de autenticación HTTP ${status}: conserva mensaje y status`, async t => {
    const request = t.mock.method(axios, 'request', async () => {
      throw { response: { status, data: {} } }
    })
    await assert.rejects(operation(credentials), { status, message })
    assert.equal(request.mock.callCount(), 1)
  })
}

for (const status of [401, 403]) {
  test(`recuperación HTTP ${status} invalida sesión`, async t => {
    t.mock.method(axios, 'request', async () => {
      throw { response: { status, data: {} } }
    })
    await assert.rejects(getCurrentUser({ token: candidate }), { status })
  })
}

test('verificación de identidad: conserva mensajes de login y registro al fallar GET', async t => {
  t.mock.method(axios, 'request', async config => {
    if (config.url.endsWith('/users/me')) throw { response: { status: 403, data: {} } }
    return { data: { access_token: candidate }, status: 200 }
  })
  await assert.rejects(authenticate(credentials), { status: 403, message: 'No pudimos verificar tu cuenta (HTTP 403). Volvé a ingresar.' })
  await assert.rejects(register(credentials), { status: 403, message: 'No se pudo obtener el usuario' })
})

test('respuesta no JSON o vacía de /users/me nunca habilita sesión', async t => {
  t.mock.method(axios, 'request', async () => ({ data: 'invalid', status: 200 }))
  await assert.rejects(getCurrentUser({ token: candidate }), { code: 'INVALID_USER' })
})

test('Axios cancela y propaga fallos de red con las mismas semánticas de UI', async t => {
  const mock = t.mock.method(axios, 'request')
  mock.mock.mockImplementation(async () => { throw { code: 'ERR_NETWORK', message: 'Network Error' } })
  await assert.rejects(getCurrentUser({ token: candidate }), TypeError)
  mock.mock.mockImplementation(async () => { throw { code: 'ERR_CANCELED' } })
  await assert.rejects(getCurrentUser({ token: candidate }), { name: 'AbortError' })
})
