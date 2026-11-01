import assert from 'node:assert/strict'
import { test } from 'node:test'
import { authenticate, register, getCurrentUser } from '../src/services/authApi.js'

const candidate = 'fixture-candidate'
const user = { id: 1, firstName: 'QA', lastName: 'Cuenta', email: 'qa@example.invalid', role: 'USUARIO', active: true }
const credentials = { email: user.email, password: 'fixture-password' }

for (const [name, operation, path, body] of [
  ['login', authenticate, '/api/v1/auth/authenticate', credentials],
  ['registro', register, '/api/v1/auth/register', { firstname: 'QA', lastname: 'Cuenta', ...credentials }],
]) {
  test(`${name}: contrato exacto, verificación de identidad y misma señal en ambos requests`, async (t) => {
    const signal = new AbortController().signal
    const calls = []
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      calls.push(url)
      assert.equal(options.signal, signal)
      if (url.endsWith(path)) {
        assert.equal(options.method, 'POST')
        assert.ok(JSON.stringify(body) === options.body, 'El cuerpo debe conservar el contrato')
        assert.equal(options.headers['Content-Type'], 'application/json')
        assert.ok(!options.headers.Authorization, 'Autenticación anónima')
        return Response.json({ access_token: candidate })
      }
      assert.equal(url, 'http://localhost:8080/users/me')
      assert.equal(options.method, 'GET')
      assert.ok(options.headers.Authorization === 'Bearer ' + candidate, 'Debe verificar el token candidato')
      return Response.json(user)
    })
    const result = await operation(body, { signal })
    assert.ok(result.token === candidate, 'Conserva el token sin modificarlo')
    assert.deepEqual(result.user, user)
    assert.equal(calls.length, 2)
  })

  for (const invalid of [null, {}, { ...user, id: 0 }, { ...user, role: 'UNKNOWN' }, { ...user, active: false }]) {
    test(`${name}: rechaza identidad inválida ${JSON.stringify(invalid)}`, async (t) => {
      t.mock.method(globalThis, 'fetch', async url => Response.json(url.endsWith('/users/me') ? invalid : { access_token: candidate }))
      await assert.rejects(operation(body), { code: 'INVALID_USER', message: 'El servidor devolvió datos de usuario inválidos.' })
    })
  }

  test(`${name}: no consulta identidad si la autenticación no devuelve token`, async (t) => {
    const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({}))
    await assert.rejects(operation(body), /token válido/)
    assert.equal(fetch.mock.callCount(), 1)
  })

  test(`${name}: explica una respuesta de autenticación que no es JSON`, async (t) => {
    t.mock.method(globalThis, 'fetch', async () => new Response('invalid'))
    await assert.rejects(operation(body), { message: 'El servidor devolvió una respuesta de autenticación inválida.' })
  })

  test(`${name}: aborto tras el POST impide enviar GET de identidad aunque el transporte responda`, async (t) => {
    const controller = new AbortController()
    const fetch = t.mock.method(globalThis, 'fetch', async () => {
      controller.abort()
      return Response.json({ access_token: candidate })
    })
    await assert.rejects(operation(body, { signal: controller.signal }), { name: 'AbortError' })
    assert.equal(fetch.mock.callCount(), 1)
  })

  test(`${name}: propaga errores de red sin registrar credenciales`, async (t) => {
    const failure = new TypeError('Network failed')
    t.mock.method(globalThis, 'fetch', async () => { throw failure })
    await assert.rejects(operation(body), error => error === failure)
  })
}

for (const [operation, status, message] of [
  [authenticate, 401, 'El correo o la contraseña son incorrectos'],
  [authenticate, 503, 'No pudimos iniciar sesión (HTTP 503). Volvé a intentar.'],
  [register, 409, 'Ya existe un usuario con este correo'],
  [register, 500, 'No se pudo registrar el usuario'],
]) {
  test(`error de autenticación ${status}: mensaje y código HTTP conservados`, async (t) => {
    const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status }))
    await assert.rejects(operation(credentials), { status, message })
    assert.equal(fetch.mock.callCount(), 1)
  })
}

for (const status of [401, 403]) {
  test(`recuperación: HTTP ${status} se propaga para invalidar la sesión`, async (t) => {
    t.mock.method(globalThis, 'fetch', async () => Response.json({}, { status }))
    await assert.rejects(getCurrentUser({ token: candidate }), { status })
  })
}

test('verificación: conserva mensajes de login y registro ante HTTP fallido de /users/me', async (t) => {
  t.mock.method(globalThis, 'fetch', async url => url.endsWith('/users/me')
    ? Response.json({}, { status: 403 }) : Response.json({ access_token: candidate }))
  await assert.rejects(authenticate(credentials), { status: 403, message: 'No pudimos verificar tu cuenta (HTTP 403). Volvé a ingresar.' })
  await assert.rejects(register(credentials), { status: 403, message: 'No se pudo obtener el usuario' })
})

test('verificación: JSON inválido o vacío no permite una sesión', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('invalid'))
  await assert.rejects(getCurrentUser({ token: candidate }), { code: 'INVALID_USER' })
})
