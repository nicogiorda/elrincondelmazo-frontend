import assert from 'node:assert/strict'
import { test } from 'node:test'
import { updateProfile, deactivateAccount } from '../src/services/accountApi.js'

const user = { id: 1, firstName: 'Ana', lastName: 'Prueba', email: 'ana@example.invalid', role: 'USUARIO', active: true }
const body = { firstName: 'Nuevo', lastName: 'Apellido', email: 'nuevo@example.invalid' }
const options = () => ({ userId: 1, token: 'fixture', signal: new AbortController().signal })
for (const deactivate of [false, true]) {
  const name = deactivate ? 'desactivación' : 'perfil'
  const call = o => deactivate ? deactivateAccount(o) : updateProfile({ ...body, role: 'ADMIN', id: 99 }, o)
  const valid = { ...user, active: !deactivate }
  test(name + ': PUT, JWT, señal, cuerpo exacto y respuesta 200', async t => {
    const o = options()
    const mock = t.mock.method(globalThis, 'fetch', async (url, init) => {
      assert.equal(url, 'http://localhost:8080/users/me' + (deactivate ? '/deactivate' : ''))
      assert.equal(init.method, 'PUT'); assert.equal(init.signal, o.signal)
      assert.ok(init.headers.Authorization === 'Bearer ' + o.token, 'JWT del llamador')
      assert.deepEqual(init.body && JSON.parse(init.body), deactivate ? undefined : body)
      return Response.json(valid)
    })
    assert.deepEqual(await call(o), valid); assert.equal(mock.mock.callCount(), 1)
  })
  for (const status of [401, 403, 409, 500]) test(name + ': HTTP ' + status, async t => {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'Error controlado' }, { status }))
    await assert.rejects(call(options()), error => error.status === status && error.message ===
      (status === 401 ? 'Tu sesión venció. Volvé a ingresar.' : 'Error controlado'))
  })
  for (const status of [201, 202, 204]) test(name + ': éxito inesperado ' + status, async t => {
    t.mock.method(globalThis, 'fetch', async () => status === 204 ? new Response(null, { status }) : Response.json(valid, { status }))
    await assert.rejects(call(options()), { code: 'ACCOUNT_UNCONFIRMED' })
  })
  for (const [label, data] of [['identidad', { ...valid, id: 2 }], ['null', null], ['email', { ...valid, email: {} }],
    ['nombre', { ...valid, firstName: null }], ['apellido', { ...valid, lastName: 3 }], ['rol', { ...valid, role: 'OTHER' }],
    ['estado', { ...valid, active: deactivate }], ['tipo de estado', { ...valid, active: 'false' }],
    ['estado omitido', { ...valid, active: undefined }], ['estado nulo', { ...valid, active: null }]]) {
    test(name + ': rechaza ' + label, async t => {
      t.mock.method(globalThis, 'fetch', async () => Response.json(data))
      await assert.rejects(call(options()), { code: 'ACCOUNT_UNCONFIRMED' })
    })
  }
  test(name + ': JSON inválido, fallo de red y aborto sin reintentos', async t => {
    const mock = t.mock.method(globalThis, 'fetch', async () => new Response('{', { status: 200 }))
    await assert.rejects(call(options()), { code: 'ACCOUNT_UNCONFIRMED' })
    const network = new TypeError('Failed to fetch'), abort = new DOMException('Cancelado', 'AbortError')
    for (const error of [network, abort]) {
      mock.mock.mockImplementation(async () => { throw error })
      await assert.rejects(call(options()), e => e === error)
    }
    assert.equal(mock.mock.callCount(), 3)
  })
}
test('desactivación exige active false explícito', async t => {
  const { active: _active, ...missing } = user
  t.mock.method(globalThis, 'fetch', async () => Response.json(missing))
  await assert.rejects(deactivateAccount(options()), { code: 'ACCOUNT_UNCONFIRMED' })
})
