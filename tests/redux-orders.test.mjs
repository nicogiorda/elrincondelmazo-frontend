import assert from 'node:assert/strict'
import test from 'node:test'
import axios from 'axios'
import { configureStore } from '@reduxjs/toolkit'
import reducer, {
  ORDERS_CACHE_TTL, fetchOrdersHistory, fetchOrderDetail, ordersSessionCleared, ordersConfirmed,
} from '../src/Redux/ordersSlice.js'

const createStore = () => configureStore({
  reducer: { orders: reducer },
  middleware: getDefaultMiddleware => getDefaultMiddleware({
    thunk: { extraArgument: { ordersToken: () => 'jwt-fixture-only' } },
  }),
})
const scope = (ownerId = 1, generation = 3) => ({ ownerId, generation })
const summary = (id = 101, state = 'PENDIENTE', total = 100) => ({
  id, state, total, totalDiscount: 0, subtotal: total,
  paymentMethod: 'TRANSFERENCIA', orderDate: '2026-10-19T10:00:00',
})
const detail = (order = summary()) => ({
  ...order, items: [{ id: 1, productId: 7, productName: 'Carta', quantity: 1, price: order.total }],
  promotions: [],
})
const history = store => store.getState().orders.history
const details = store => store.getState().orders.details
const delayed = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { resolve, promise }
}
const reply = data => ({ status: 200, data })

test('store comienza sin pedidos, AbortControllers ni JWT', () => {
  const store = createStore()
  assert.deepEqual(history(store).items, [])
  assert.deepEqual(details(store), {})
  assert.equal(store.getState().orders.ownerId, null)
  assert.equal('token' in store.getState().orders, false)
})

test('GET publica pending y fulfilled y acepta historial vacío', async t => {
  const gate = delayed()
  const request = t.mock.method(axios, 'request', async config => {
    assert.equal(config.method, 'GET')
    assert.equal(config.url, 'http://localhost:8080/orders')
    assert.equal(config.headers.Authorization, 'Bearer jwt-fixture-only')
    return gate.promise
  })
  const store = createStore()
  const task = store.dispatch(fetchOrdersHistory(scope()))
  assert.equal(history(store).loading, true)
  gate.resolve(reply([]))
  const action = await task
  assert.ok(fetchOrdersHistory.fulfilled.match(action))
  assert.deepEqual(history(store).items, [])
  assert.equal(history(store).loading, false)
  assert.ok(history(store).updatedAt > 0)
  assert.equal(request.mock.callCount(), 1)
  assert.equal(JSON.stringify(action).includes('jwt-fixture-only'), false)
})

test('un historial con detalles completos evita GET adicional', async t => {
  const order = detail(summary(50))
  const request = t.mock.method(axios, 'request', async () => reply([order]))
  const store = createStore()
  await store.dispatch(fetchOrdersHistory(scope()))
  assert.deepEqual(details(store)[50].data, order)
  assert.equal(request.mock.callCount(), 1)
})

test('GET preserva detalle si su resumen coincide y descarta al cambiar estado', async t => {
  const a = summary(101), b = summary(102)
  let rows = [a, b]
  t.mock.method(axios, 'request', async config => {
    if (config.url.endsWith('/orders/101')) return reply(detail(a))
    if (config.url.endsWith('/orders/102')) return reply(detail(b))
    return reply(rows)
  })
  const store = createStore()
  await store.dispatch(fetchOrdersHistory(scope()))
  await store.dispatch(fetchOrderDetail({ ...scope(), orderId: 101 }))
  await store.dispatch(fetchOrderDetail({ ...scope(), orderId: 102 }))
  rows = [a, { ...b, state: 'PAGO' }]
  await store.dispatch(fetchOrdersHistory(scope()))
  assert.deepEqual(details(store)[101].data.items, detail(a).items)
  assert.equal(details(store)[102], undefined)
})

test('detalles vencidos no sobreviven al refresh del historial', async t => {
  let now = 100_000
  t.mock.method(Date, 'now', () => now)
  const a = summary(101)
  t.mock.method(axios, 'request', async config => reply(config.url.endsWith('/orders/101') ? detail(a) : [a]))
  const store = createStore()
  await store.dispatch(fetchOrdersHistory(scope()))
  await store.dispatch(fetchOrderDetail({ ...scope(), orderId: 101 }))
  now += ORDERS_CACHE_TTL + 1
  await store.dispatch(fetchOrdersHistory(scope()))
  assert.equal(details(store)[101], undefined)
})

test('fallo de GET conserva lista anterior y retry recupera el estado', async t => {
  const order = summary()
  let step = 0
  t.mock.method(axios, 'request', async () => {
    if (++step === 2) throw { response: { status: 503, data: { message: 'Error QA' } } }
    return reply([order])
  })
  const store = createStore()
  await store.dispatch(fetchOrdersHistory(scope()))
  const failed = await store.dispatch(fetchOrdersHistory(scope()))
  assert.ok(fetchOrdersHistory.rejected.match(failed))
  assert.equal(failed.error.status, 503)
  assert.equal(history(store).loading, false)
  assert.equal(history(store).items[0].id, 101)
  assert.match(history(store).error, /Error QA/)
  await store.dispatch(fetchOrdersHistory(scope()))
  assert.equal(history(store).error, '')
  assert.equal(history(store).items.length, 1)
})

test('detalle pendiente, error y retry conservan el historial', async t => {
  let fail = true
  const gate = delayed()
  t.mock.method(axios, 'request', async config => {
    if (config.url.endsWith('/orders/101')) {
      if (fail) { fail = false; throw { response: { status: 404, data: { message: 'No existe' } } } }
      return gate.promise
    }
    return reply([summary()])
  })
  const store = createStore()
  await store.dispatch(fetchOrdersHistory(scope()))
  const rejected = await store.dispatch(fetchOrderDetail({ ...scope(), orderId: 101 }))
  assert.ok(fetchOrderDetail.rejected.match(rejected))
  assert.equal(rejected.error.status, 404)
  assert.equal(details(store)[101].error, 'No existe')
  const pending = store.dispatch(fetchOrderDetail({ ...scope(), orderId: 101 }))
  assert.equal(details(store)[101].loading, true)
  gate.resolve(reply(detail()))
  await pending
  assert.equal(details(store)[101].error, '')
  assert.equal(details(store)[101].data.id, 101)
})

test('detalle inválido se rechaza antes de escribirse en Redux', async t => {
  t.mock.method(axios, 'request', async config =>
    reply(config.url.endsWith('/orders/101') ? detail(summary(999)) : [summary()]))
  const store = createStore()
  await store.dispatch(fetchOrdersHistory(scope()))
  const failed = await store.dispatch(fetchOrderDetail({ ...scope(), orderId: 101 }))
  assert.ok(fetchOrderDetail.rejected.match(failed))
  assert.match(details(store)[101].error, /no corresponde/)
})

test('logout y nueva cuenta descartan historial tardío aun si el transporte ignora abort', async t => {
  const gate = delayed()
  t.mock.method(axios, 'request', async () => gate.promise)
  const store = createStore()
  const old = store.dispatch(fetchOrdersHistory(scope()))
  store.dispatch(ordersSessionCleared())
  const next = store.dispatch(fetchOrdersHistory(scope(2, 4)))
  gate.resolve(reply([summary(202)]))
  await Promise.all([old, next])
  assert.equal(store.getState().orders.ownerId, 2)
  assert.deepEqual(history(store).items.map(o => o.id), [202])
  assert.equal(store.getState().orders.generation, 4)
})

test('respuesta anterior del mismo usuario no reemplaza generación nueva', async t => {
  const gate = delayed()
  t.mock.method(axios, 'request', async () => gate.promise)
  const store = createStore()
  const old = store.dispatch(fetchOrdersHistory(scope(1, 1)))
  store.dispatch(ordersSessionCleared())
  const next = store.dispatch(fetchOrdersHistory(scope(1, 2)))
  gate.resolve(reply([summary(202)]))
  await Promise.all([old, next])
  assert.equal(store.getState().orders.generation, 2)
  assert.deepEqual(history(store).items.map(o => o.id), [202])
})

test('checkout confirmado invalida GET pendiente y guarda el detalle sin GET redundante', async t => {
  const gate = delayed()
  t.mock.method(axios, 'request', async () => gate.promise)
  const store = createStore()
  const old = store.dispatch(fetchOrdersHistory(scope()))
  const order = detail(summary(305, 'PAGO'))
  store.dispatch(ordersConfirmed({ ...scope(), order, updatedAt: Date.now() }))
  gate.resolve(reply([summary(101)]))
  await old
  assert.equal(history(store).updatedAt, 0)
  assert.deepEqual(history(store).items, [])
  assert.deepEqual(Object.keys(details(store)), ['305'])
  assert.deepEqual(details(store)[305].data, order)
})

test('HTTP 401 via rejected conserva status para invalidar sesión', async t => {
  t.mock.method(axios, 'request', async () => {
    throw { response: { status: 401, data: {} } }
  })
  const store = createStore()
  const action = await store.dispatch(fetchOrdersHistory(scope()))
  assert.ok(fetchOrdersHistory.rejected.match(action))
  assert.equal(action.error.status, 401)
  assert.equal(action.error.message, 'Tu sesión venció. Volvé a ingresar.')
})

test('cancelación externa no publica un error falso ni datos privados', async t => {
  const gate = delayed()
  t.mock.method(axios, 'request', async () => gate.promise)
  const store = createStore(), controller = new AbortController()
  const task = store.dispatch(fetchOrdersHistory(scope(), { signal: controller.signal }))
  controller.abort()
  const action = await task
  assert.ok(fetchOrdersHistory.rejected.match(action))
  assert.equal(action.meta.aborted, true)
  assert.equal(history(store).error, '')
  store.dispatch(ordersSessionCleared())
  gate.resolve(reply([summary(999)]))
  assert.deepEqual(history(store).items, [])
})
