import './fixtures/axios-verb-test-bridge.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import axios from 'axios'
import { configureStore } from '@reduxjs/toolkit'
import reducer, {
  fetchAdminPromotions, saveAdminPromotion, toggleAdminPromotion,
  promotionsSessionCleared,
} from '../src/Redux/promotionsSlice.js'
import { promotionFromBackend } from '../src/utils/promotionMapper.js'

const fixture = (id = 87, overrides = {}) => ({
  id, name: 'Promo ' + id, description: 'QA', type: 'CANTIDAD', discountPercentage: 17.25,
  minimumQuantity: 3, minimumAmount: null, productType: null, paymentMethod: null,
  collectionId: null, productId: null, stackable: false, active: true,
  startDate: '2026-10-28T08:15:22', endDate: null, ...overrides,
})
const scope = (ownerId = 1, generation = 3) => ({ ownerId, generation })
const create = () => configureStore({
  reducer: { promotions: reducer },
  middleware: getDefaultMiddleware => getDefaultMiddleware({
    thunk: { extraArgument: { promotionToken: () => 'admin-jwt-fixture' } },
  }),
})
const admin = store => store.getState().promotions.admin
const reply = (data, status = 200) => ({ status, data })
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { resolve, promise }
}

test('GET: pending/fulfilled, mapping y token fuera de Redux', async t => {
  const gate = deferred()
  const mock = t.mock.method(axios, 'request', async config => {
    assert.equal(config.url, 'http://localhost:8080/promotions')
    assert.equal(config.method, 'GET')
    assert.equal(config.headers.Authorization, 'Bearer admin-jwt-fixture')
    return gate.promise
  })
  const store = create()
  const pending = store.dispatch(fetchAdminPromotions(scope()))
  assert.equal(admin(store).status, 'loading')
  gate.resolve(reply([fixture()]))
  const result = await pending
  assert.ok(fetchAdminPromotions.fulfilled.match(result))
  assert.equal(admin(store).status, 'succeeded')
  assert.equal(admin(store).loaded, true)
  assert.equal(admin(store).items[0].kind, 'quantity')
  assert.equal(admin(store).items[0].discount, 17.25)
  assert.equal(mock.mock.callCount(), 1)
  assert.equal(JSON.stringify(result).includes('admin-jwt-fixture'), false)
  assert.equal(JSON.stringify(store.getState()).includes('admin-jwt-fixture'), false)
})

test('GET vacío es válido; HTTP 503 conserva listado anterior y reintento funciona', async t => {
  let call = 0
  t.mock.method(axios, 'request', async () => {
    if (++call === 1) return reply([fixture()])
    if (call === 2) throw { response: { status: 503, data: { message: 'Error servidor' } } }
    return reply([])
  })
  const store = create()
  await store.dispatch(fetchAdminPromotions(scope()))
  const error = await store.dispatch(fetchAdminPromotions(scope()))
  assert.ok(fetchAdminPromotions.rejected.match(error))
  assert.equal(error.error.status, 503)
  assert.equal(admin(store).status, 'failed')
  assert.deepEqual(admin(store).items.map(p => p.id), [87])
  assert.equal(admin(store).error, 'Error servidor')
  await store.dispatch(fetchAdminPromotions(scope()))
  assert.deepEqual(admin(store).items, [])
  assert.equal(admin(store).status, 'succeeded')
})

test('GET previo no sobreescribe PUT confirmado, sin refetch innecesario', async t => {
  const gate = deferred()
  const calls = []
  t.mock.method(axios, 'request', async config => {
    calls.push(config)
    if (config.method === 'GET') return gate.promise
    return reply(fixture(87, { name: 'Nombre actualizado' }))
  })
  const store = create()
  const old = store.dispatch(fetchAdminPromotions(scope()))
  const update = store.dispatch(saveAdminPromotion({
    ...scope(), promotion: promotionFromBackend(fixture()),
  }))
  const action = await update
  assert.ok(saveAdminPromotion.fulfilled.match(action))
  assert.equal(admin(store).items[0].name, 'Nombre actualizado')
  gate.resolve(reply([fixture(87, { name: 'Nombre viejo' })]))
  await old
  assert.equal(admin(store).items[0].name, 'Nombre actualizado')
  assert.deepEqual(calls.map(x => x.method), ['GET', 'PUT'])
})

test('POST crea una promoción y PATCH altera estado sin emitir GET posterior', async t => {
  const calls = []
  t.mock.method(axios, 'request', async config => {
    calls.push(config)
    if (config.method === 'POST') return reply(fixture(99), 201)
    return reply(fixture(99, { active: false }))
  })
  const store = create()
  const draft = { ...promotionFromBackend(fixture()), id: undefined }
  const created = await store.dispatch(saveAdminPromotion({ ...scope(), promotion: draft }))
  assert.ok(saveAdminPromotion.fulfilled.match(created))
  assert.equal(admin(store).items[0].id, 99)
  const changed = await store.dispatch(toggleAdminPromotion({
    ...scope(), promotionId: 99, active: false,
  }))
  assert.ok(toggleAdminPromotion.fulfilled.match(changed))
  assert.equal(admin(store).items[0].enabled, false)
  assert.deepEqual(calls.map(x => x.method), ['POST', 'PATCH'])
  assert.equal(calls[1].url, 'http://localhost:8080/promotions/99/deactivate')
  assert.equal(admin(store).busyId, null)
})

test('error en PATCH conserva último listado válido y libera bloqueo', async t => {
  const mock = t.mock.method(axios, 'request', async () => reply([fixture()]))
  const store = create()
  await store.dispatch(fetchAdminPromotions(scope()))
  mock.mock.mockImplementation(async () => {
    throw { response: { status: 403, data: { message: 'Acceso denegado' } } }
  })
  const rejected = await store.dispatch(toggleAdminPromotion({
    ...scope(), promotionId: 87, active: false,
  }))
  assert.ok(toggleAdminPromotion.rejected.match(rejected))
  assert.equal(rejected.error.status, 403)
  assert.equal(admin(store).error, 'Acceso denegado')
  assert.equal(admin(store).items[0].enabled, true)
  assert.equal(admin(store).busyId, null)
})

test('HTTP 401 en GET y PATCH preserva status en unwrap para cerrar sesión', async t => {
  t.mock.method(axios, 'request', async () => {
    throw { response: { status: 401, data: {} } }
  })
  const store = create()
  await assert.rejects(store.dispatch(fetchAdminPromotions(scope())).unwrap(),
    { status: 401, message: 'Tu sesión venció. Volvé a ingresar.' })
  await assert.rejects(store.dispatch(toggleAdminPromotion({ ...scope(), promotionId: 87, active: false })).unwrap(),
    { status: 401, message: 'Tu sesión venció. Volvé a ingresar.' })
})

test('logout y nuevo usuario ignoran GET antiguo que termina después', async t => {
  const oldGate = deferred()
  let call = 0
  t.mock.method(axios, 'request', async () => ++call === 1 ? oldGate.promise : reply([fixture(2)]))
  const store = create()
  const stale = store.dispatch(fetchAdminPromotions(scope()))
  store.dispatch(promotionsSessionCleared())
  await store.dispatch(fetchAdminPromotions(scope(2, 4)))
  oldGate.resolve(reply([fixture(1)]))
  await stale
  assert.equal(admin(store).ownerId, 2)
  assert.deepEqual(admin(store).items.map(p => p.id), [2])
  assert.equal(admin(store).generation, 4)
})

test('logout tras POST iniciado no restaura datos antiguos al recibir éxito tardío', async t => {
  const gate = deferred()
  t.mock.method(axios, 'request', async () => gate.promise)
  const store = create()
  const pending = store.dispatch(saveAdminPromotion({
    ...scope(), promotion: promotionFromBackend(fixture()),
  }))
  store.dispatch(promotionsSessionCleared())
  gate.resolve(reply(fixture(87, { name: 'Sesión antigua' })))
  await pending
  assert.equal(admin(store).ownerId, null)
  assert.deepEqual(admin(store).items, [])
})

test('cancelación externa no publica un error falso ni revive la sesión', async t => {
  const gate = deferred()
  t.mock.method(axios, 'request', async () => gate.promise)
  const store = create(), controller = new AbortController()
  const pending = store.dispatch(fetchAdminPromotions(scope(), { signal: controller.signal }))
  controller.abort()
  const result = await pending
  assert.ok(fetchAdminPromotions.rejected.match(result))
  assert.equal(result.meta.aborted, true)
  assert.equal(admin(store).error, '')
  store.dispatch(promotionsSessionCleared())
  gate.resolve(reply([fixture()]))
  assert.deepEqual(admin(store).items, [])
})
