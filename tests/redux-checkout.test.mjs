import './fixtures/axios-verb-test-bridge.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import axios from 'axios'
import { configureStore } from '@reduxjs/toolkit'
import reducer, {
  fetchCheckoutQuote, confirmCheckoutOrder, checkoutSessionCleared, checkoutSubmitErrorSet,
} from '../src/Redux/checkoutSlice.js'

const createStore = () => configureStore({
  reducer: { checkout: reducer },
  middleware: getDefaultMiddleware => getDefaultMiddleware({
    thunk: { extraArgument: { ordersToken: () => 'jwt-only-fixture' } },
  }),
})
const scope = (ownerId = 1, generation = 3) => ({ ownerId, generation })
const quote = { subtotal: 100, totalDiscount: 10, total: 90, promotions: [] }
const order = { id: 11, state: 'PENDIENTE', orderDate: '2026-10-22T10:00:00',
  paymentMethod: 'TRANSFERENCIA', ...quote,
  items: [{ id: 77, productId: 7, productName: 'Carta QA', price: 100, quantity: 1 }] }
const payload = { paymentMethod: 'TRANSFERENCIA', expectedTotal: 90,
  requestKey: '10000000-0000-4000-8000-000000000001' }
const attempt = { ...scope(), quoteKey: 'visit-1', cartKey: 'cart-1', payload }
const quoteArgs = (key = 'visit-1', who = scope()) => ({ ...who, paymentMethod: 'TRANSFERENCIA', quoteKey: key })
const reply = (data, status = 200) => ({ status, data })
const delayed = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
const state = store => store.getState().checkout

test('estado inicial no guarda cuentas, respuestas o claves de intento previas', () => {
  const store = createStore()
  assert.equal(state(store).ownerId, null)
  assert.equal(state(store).quote.data, null)
  assert.equal(state(store).confirmation.confirmedOrder, null)
  assert.equal(state(store).confirmation.unresolved, null)
})

test('POST /orders/preview usa Axios y publica pending/fulfilled sin JWT en Redux', async t => {
  const gate = delayed()
  const request = t.mock.method(axios, 'request', async config => {
    assert.equal(config.method, 'POST')
    assert.equal(config.url, 'http://localhost:8080/orders/preview')
    assert.deepEqual(config.data, { paymentMethod: 'TRANSFERENCIA' })
    assert.equal(config.headers.Authorization, 'Bearer jwt-only-fixture')
    return gate.promise
  })
  const store = createStore()
  const task = store.dispatch(fetchCheckoutQuote(quoteArgs()))
  assert.equal(state(store).quote.status, 'loading')
  gate.resolve(reply(quote))
  const result = await task
  assert.ok(fetchCheckoutQuote.fulfilled.match(result))
  assert.deepEqual(state(store).quote.data, quote)
  assert.equal(state(store).quote.status, 'succeeded')
  assert.equal(JSON.stringify(result).includes('jwt-only-fixture'), false)
  assert.equal(JSON.stringify(state(store)).includes('jwt-only-fixture'), false)
  assert.equal(request.mock.callCount(), 1)
})

test('el backend no puede habilitar una cotización con importes o promociones inválidos', async t => {
  const invalid = { ...quote, total: '90' }
  const mock = t.mock.method(axios, 'request', async () => reply(invalid))
  const store = createStore()
  const rejected = await store.dispatch(fetchCheckoutQuote(quoteArgs()))
  assert.ok(fetchCheckoutQuote.rejected.match(rejected))
  assert.equal(state(store).quote.status, 'failed')
  assert.equal(state(store).quote.data, null)
  assert.equal(state(store).quote.error, 'Cotización inválida.')
  mock.mock.mockImplementation(async () => reply(quote))
  await store.dispatch(fetchCheckoutQuote(quoteArgs('retry-2')))
  assert.equal(state(store).quote.key, 'retry-2')
  assert.deepEqual(state(store).quote.data, quote)
})

test('solicitud vieja de cotización no reemplaza la revisión más reciente', async t => {
  const gate = delayed()
  let count = 0
  t.mock.method(axios, 'request', async () => ++count === 1 ? gate.promise : reply(quote))
  const store = createStore()
  const first = store.dispatch(fetchCheckoutQuote(quoteArgs('revision-a')))
  await store.dispatch(fetchCheckoutQuote(quoteArgs('revision-b')))
  gate.resolve(reply({ ...quote, total: 5 }))
  await first
  assert.equal(state(store).quote.key, 'revision-b')
  assert.equal(state(store).quote.data.total, 90)
})

test('HTTP 201 confirma con los tres campos exactos y una sola solicitud', async t => {
  const requests = []
  t.mock.method(axios, 'request', async config => {
    requests.push(config)
    return reply(order, 201)
  })
  const store = createStore()
  const task = store.dispatch(confirmCheckoutOrder(attempt))
  assert.equal(state(store).confirmation.submitting, true)
  const completed = await task
  assert.ok(confirmCheckoutOrder.fulfilled.match(completed))
  assert.equal(state(store).confirmation.submitting, false)
  assert.equal(state(store).confirmation.confirmedOrder.id, 11)
  assert.equal(state(store).confirmation.unresolved, null)
  assert.deepEqual(requests.map(r => r.method), ['POST'])
  assert.deepEqual(requests[0].data, payload)
  assert.equal(requests[0].headers.Authorization, 'Bearer jwt-only-fixture')
})

test('409 conserva rechazo explícito, no marca compra y exige nueva aceptación', async t => {
  t.mock.method(axios, 'request', async () => {
    throw { response: { status: 409, data: { message: 'El total cambió' } } }
  })
  const store = createStore()
  const rejected = await store.dispatch(confirmCheckoutOrder(attempt))
  assert.equal(rejected.error.status, 409)
  assert.equal(rejected.error.ambiguous, undefined)
  assert.equal(state(store).confirmation.confirmedOrder, null)
  assert.equal(state(store).confirmation.unresolved, null)
  assert.equal(state(store).confirmation.submitError, 'El total cambió. Revisá el nuevo importe y confirmá otra vez.')
})

test('503 es ambiguo, preserva requestKey para replay y no envía segundo POST automáticamente', async t => {
  const mock = t.mock.method(axios, 'request', async () => {
    throw { response: { status: 503, data: { message: 'Fallo QA' } } }
  })
  const store = createStore()
  const task = store.dispatch(confirmCheckoutOrder(attempt))
  await assert.rejects(task.unwrap(), { status: 503, ambiguous: true })
  assert.equal(mock.mock.callCount(), 1)
  assert.deepEqual(state(store).confirmation.unresolved, {
    quoteKey: attempt.quoteKey, cartKey: attempt.cartKey, payload,
  })
  assert.match(state(store).confirmation.submitError, /Revisá tus pedidos/)
  mock.mock.mockImplementation(async () => reply(order, 201))
  await store.dispatch(confirmCheckoutOrder(attempt))
  assert.equal(mock.mock.callCount(), 2)
  assert.equal(state(store).confirmation.confirmedOrder.id, 11)
  assert.equal(state(store).confirmation.unresolved, null)
})

test('201 inválido es ambiguo incluso cuando el servidor creó una orden', async t => {
  t.mock.method(axios, 'request', async () => reply({ id: 11 }, 201))
  const store = createStore()
  const result = await store.dispatch(confirmCheckoutOrder(attempt))
  assert.ok(confirmCheckoutOrder.rejected.match(result))
  assert.equal(result.error.status, 201)
  assert.equal(result.error.ambiguous, true)
  assert.deepEqual(state(store).confirmation.unresolved.payload, payload)
})

test('422 guarda el error sin marcar una orden como creada', async t => {
  t.mock.method(axios, 'request', async () => {
    throw { response: { status: 422, data: { message: 'Stock insuficiente' } } }
  })
  const store = createStore()
  const result = await store.dispatch(confirmCheckoutOrder(attempt))
  assert.equal(result.error.status, 422)
  assert.equal(result.error.ambiguous, undefined)
  assert.equal(state(store).confirmation.submitError, 'Stock insuficiente')
  assert.equal(state(store).confirmation.unresolved, null)
  assert.equal(state(store).confirmation.confirmedOrder, null)
})

test('401 de cotización o confirmación conserva status para logout', async t => {
  t.mock.method(axios, 'request', async () => {
    throw { response: { status: 401, data: {} } }
  })
  const store = createStore()
  const quoted = await store.dispatch(fetchCheckoutQuote(quoteArgs()))
  const confirmation = await store.dispatch(confirmCheckoutOrder(attempt))
  assert.equal(quoted.error.status, 401)
  assert.equal(confirmation.error.status, 401)
  assert.equal(confirmation.error.ambiguous, undefined)
})

test('logout limpia intento ambiguo, cotización y confirmación; respuestas tardías son ignoradas', async t => {
  const gate = delayed()
  t.mock.method(axios, 'request', async () => gate.promise)
  const store = createStore()
  const old = store.dispatch(confirmCheckoutOrder(attempt))
  store.dispatch(checkoutSessionCleared())
  const next = store.dispatch(fetchCheckoutQuote(quoteArgs('b', scope(2, 4))))
  gate.resolve(reply(order, 201))
  await Promise.all([old, next])
  assert.equal(state(store).ownerId, 2)
  assert.equal(state(store).confirmation.confirmedOrder, null)
  assert.equal(state(store).confirmation.unresolved, null)
})

test('la respuesta tardía de un intento previo no confirma después de cerrar sesión', async t => {
  const gate = delayed()
  t.mock.method(axios, 'request', async () => gate.promise)
  const store = createStore()
  const pending = store.dispatch(confirmCheckoutOrder(attempt))
  store.dispatch(checkoutSessionCleared())
  gate.resolve(reply(order, 201))
  await pending
  assert.equal(state(store).confirmation.confirmedOrder, null)
  assert.equal(state(store).ownerId, null)
})

test('cancelar un POST pendiente no fabrica una confirmación ni un mensaje falso', async t => {
  const gate = delayed()
  t.mock.method(axios, 'request', async () => gate.promise)
  const store = createStore(), controller = new AbortController()
  const pending = store.dispatch(confirmCheckoutOrder(attempt, { signal: controller.signal }))
  controller.abort()
  const result = await pending
  assert.ok(confirmCheckoutOrder.rejected.match(result))
  assert.equal(result.meta.aborted, true)
  assert.equal(state(store).confirmation.submitting, false)
  assert.equal(state(store).confirmation.confirmedOrder, null)
  store.dispatch(checkoutSessionCleared())
  gate.resolve(reply(order, 201))
  assert.equal(state(store).confirmation.confirmedOrder, null)
})

test('error local de reserva se aplica solo a la sesión correcta y no guarda datos no serializables', async t => {
  t.mock.method(axios, 'request', async () => reply(quote))
  const store = createStore()
  await store.dispatch(fetchCheckoutQuote(quoteArgs()))
  store.dispatch(checkoutSubmitErrorSet({ ...scope(2, 3), message: 'ajeno' }))
  assert.equal(state(store).confirmation.submitError, '')
  store.dispatch(checkoutSubmitErrorSet({ ...scope(), message: 'Revisá el carrito antes de confirmar.' }))
  assert.match(state(store).confirmation.submitError, /carrito/)
  assert.doesNotThrow(() => JSON.stringify(state(store)))
  assert.equal('token' in state(store), false)
})
