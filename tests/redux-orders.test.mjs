import assert from 'node:assert/strict'
import test from 'node:test'
import { configureStore } from '@reduxjs/toolkit'
import reducer, {
  ORDERS_CACHE_TTL, ordersSessionCleared, ordersHistoryStarted,
  ordersHistoryLoaded, ordersHistoryFailed, ordersHistoryFinished,
  ordersDetailStarted, ordersDetailLoaded, ordersDetailFailed, ordersConfirmed,
} from '../src/Redux/ordersSlice.js'

const createStore = () => configureStore({ reducer: { orders: reducer } })
const scope = (ownerId = 1, generation = 3) => ({ ownerId, generation })
const summary = (id = 101, state = 'PENDIENTE', total = 100) => ({
  id, state, total, totalDiscount: 0, subtotal: total,
  paymentMethod: 'TRANSFERENCIA', orderDate: '2026-10-19T10:00:00',
})
const detail = (order = summary()) => ({
  ...order, items: [{ id: 1, productId: 7, productName: 'Carta', quantity: 1, price: order.total }],
  promotions: [],
})
const history = (store) => store.getState().orders.history
const details = (store) => store.getState().orders.details

test('el store comienza sin pedidos ni datos de usuario anterior', () => {
  const store = createStore()
  assert.deepEqual(history(store).items, [])
  assert.deepEqual(details(store), {})
  assert.equal(store.getState().orders.ownerId, null)
  assert.equal('token' in store.getState().orders, false)
})

test('GET publica pending y fulfilled, incluso si la lista viene vacía', () => {
  const store = createStore()
  store.dispatch(ordersHistoryStarted(scope()))
  assert.equal(history(store).loading, true)
  store.dispatch(ordersHistoryLoaded({ ...scope(), items: [], updatedAt: 1000 }))
  assert.equal(history(store).loading, false)
  assert.deepEqual(history(store).items, [])
  assert.equal(history(store).updatedAt, 1000)
})

test('refrescar conserva un detalle cuyo resumen no cambió y vence los obsoletos', () => {
  const store = createStore(), start = 100_000
  const a = summary(101), b = summary(102)
  store.dispatch(ordersHistoryStarted(scope()))
  store.dispatch(ordersHistoryLoaded({ ...scope(), items: [a, b], updatedAt: start }))
  store.dispatch(ordersDetailLoaded({ ...scope(), orderId: 101, data: detail(a), updatedAt: start + 100 }))
  store.dispatch(ordersDetailLoaded({ ...scope(), orderId: 102, data: detail(b), updatedAt: start + 100 }))
  store.dispatch(ordersHistoryLoaded({ ...scope(), items: [a, { ...b, state: 'PAGO' }],
    updatedAt: start + 2_000 }))
  assert.deepEqual(details(store)[101].data.items, detail(a).items)
  assert.equal(details(store)[102], undefined)
  store.dispatch(ordersHistoryLoaded({ ...scope(), items: [a], updatedAt: start + ORDERS_CACHE_TTL + 110 }))
  assert.equal(details(store)[101], undefined)
})

test('un pedido con detalle completo en la lista se utiliza sin GET adicional', () => {
  const store = createStore()
  const complete = detail(summary(50))
  store.dispatch(ordersHistoryStarted(scope()))
  store.dispatch(ordersHistoryLoaded({ ...scope(), items: [complete], updatedAt: 250 }))
  assert.deepEqual(details(store)[50].data, complete)
})

test('fallo HTTP preserva la última lista y permite reintentar', () => {
  const store = createStore(), order = summary()
  store.dispatch(ordersHistoryStarted(scope()))
  store.dispatch(ordersHistoryLoaded({ ...scope(), items: [order], updatedAt: 100 }))
  store.dispatch(ordersHistoryStarted(scope()))
  store.dispatch(ordersHistoryFailed({ ...scope(), message: 'No pudimos actualizar tus pedidos. HTTP 503' }))
  store.dispatch(ordersHistoryFinished(scope()))
  assert.equal(history(store).loading, false)
  assert.equal(history(store).items[0].id, 101)
  assert.match(history(store).error, /HTTP 503/)
  store.dispatch(ordersHistoryStarted(scope()))
  assert.equal(history(store).error, '')
})

test('detalle pendiente, error y reintento conservan los datos previos', () => {
  const store = createStore()
  const oldData = detail(summary(101))
  store.dispatch(ordersHistoryStarted(scope()))
  store.dispatch(ordersDetailLoaded({ ...scope(), orderId: 101, data: oldData, updatedAt: 100 }))
  store.dispatch(ordersDetailStarted({ ...scope(), orderId: 101 }))
  store.dispatch(ordersDetailFailed({ ...scope(), orderId: 101, message: 'Fallo del detalle' }))
  assert.equal(details(store)[101].loading, false)
  assert.equal(details(store)[101].data, oldData)
  assert.equal(details(store)[101].error, 'Fallo del detalle')
  store.dispatch(ordersDetailStarted({ ...scope(), orderId: 101 }))
  store.dispatch(ordersDetailLoaded({ ...scope(), orderId: 101, data: detail(summary(101, 'PAGO')), updatedAt: 200 }))
  assert.equal(details(store)[101].error, '')
  assert.equal(details(store)[101].data.state, 'PAGO')
})

test('logout y cambio de usuario descartan las respuestas tardías', () => {
  const store = createStore()
  store.dispatch(ordersHistoryStarted(scope()))
  store.dispatch(ordersHistoryLoaded({ ...scope(), items: [summary()], updatedAt: 100 }))
  store.dispatch(ordersSessionCleared())
  store.dispatch(ordersHistoryLoaded({ ...scope(), items: [summary(999)], updatedAt: 200 }))
  assert.deepEqual(history(store).items, [])
  store.dispatch(ordersHistoryStarted(scope(2, 4)))
  store.dispatch(ordersHistoryLoaded({ ...scope(), items: [summary(101)], updatedAt: 300 }))
  store.dispatch(ordersDetailLoaded({ ...scope(), orderId: 101, data: detail(), updatedAt: 300 }))
  store.dispatch(ordersHistoryLoaded({ ...scope(2, 4), items: [summary(202)], updatedAt: 400 }))
  assert.deepEqual(history(store).items.map(o => o.id), [202])
  assert.deepEqual(details(store), {})
})

test('una nueva generación del mismo usuario no hereda datos de la anterior', () => {
  const store = createStore()
  store.dispatch(ordersHistoryStarted(scope(7, 1)))
  store.dispatch(ordersHistoryLoaded({ ...scope(7, 1), items: [summary(5)], updatedAt: 100 }))
  store.dispatch(ordersHistoryStarted(scope(7, 2)))
  store.dispatch(ordersHistoryLoaded({ ...scope(7, 1), items: [summary(6)], updatedAt: 200 }))
  assert.deepEqual(history(store).items, [])
  assert.deepEqual(details(store), {})
  assert.equal(store.getState().orders.generation, 2)
})

test('confirmación de checkout invalida listado y conserva detalle confirmado', () => {
  const store = createStore(), confirmed = detail(summary(305, 'PAGO'))
  store.dispatch(ordersHistoryStarted(scope()))
  store.dispatch(ordersHistoryLoaded({ ...scope(), items: [summary(101)], updatedAt: 100 }))
  store.dispatch(ordersConfirmed({ ...scope(), order: confirmed, updatedAt: 500 }))
  assert.equal(history(store).updatedAt, 0)
  assert.deepEqual(history(store).items, [])
  assert.deepEqual(Object.keys(details(store)), ['305'])
  assert.deepEqual(details(store)[305].data, confirmed)
})

test('las acciones y el estado son serializables; no almacenan AbortController ni JWT', () => {
  const store = createStore()
  store.dispatch(ordersHistoryStarted(scope()))
  store.dispatch(ordersHistoryLoaded({ ...scope(), items: [summary()], updatedAt: 100 }))
  assert.doesNotThrow(() => JSON.stringify(store.getState()))
  assert.equal(Object.values(store.getState().orders).some(v => v instanceof AbortController), false)
  assert.equal('token' in store.getState().orders, false)
})
