import './fixtures/axios-verb-test-bridge.mjs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import axios from 'axios'
import { configureStore } from '@reduxjs/toolkit'
import reducer, {
  fetchCart, addItemToCart, changeCartItemQuantity, deleteCartItem,
  cartOperationStarted, cartOperationReleased, cartSessionCleared,
  cartQuantityChanged, cartUpdated,
} from '../src/Redux/cartSlice.js'

const scope = (ownerId = 1, generation = 1) => ({ ownerId, generation })
const sample = (quantity = 1) => ({
  id: 12, subtotal: 100 * quantity,
  items: quantity ? [{ id: 7, productId: 40, unitPrice: 100, quantity, subtotal: 100 * quantity }] : [],
})
const create = () => configureStore({
  reducer: { cart: reducer },
  middleware: getDefaultMiddleware => getDefaultMiddleware({
    thunk: { extraArgument: { cartToken: () => 'temporary-fixture-jwt' } },
  }),
})
const state = store => store.getState().cart
const reply = data => ({ status: 200, data })
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

test('GET: pending, fulfilled, JWT privado y carrito desde extraReducers', async t => {
  const gate = deferred()
  const request = t.mock.method(axios, 'request', async config => {
    assert.equal(config.method, 'GET')
    assert.equal(config.url, 'http://localhost:8080/carts')
    assert.equal(config.headers.Authorization, 'Bearer temporary-fixture-jwt')
    return gate.promise
  })
  const store = create()
  store.dispatch(cartOperationStarted({ ...scope(), kind: 'load' }))
  const pending = store.dispatch(fetchCart(scope()))
  assert.equal(state(store).cartLoading, true)
  gate.resolve(reply(sample(2)))
  const action = await pending
  assert.ok(fetchCart.fulfilled.match(action))
  assert.equal(state(store).cart.items[0].quantity, 2)
  assert.equal(state(store).cartLoading, false)
  assert.equal(JSON.stringify(action).includes('temporary-fixture-jwt'), false)
  assert.equal(JSON.stringify(state(store)).includes('temporary-fixture-jwt'), false)
  assert.equal(request.mock.callCount(), 1)
  store.dispatch(cartOperationReleased(scope()))
  assert.equal(state(store).cartBusy, false)
})

test('POST y DELETE confirman respuesta unica, sin GET posterior', async t => {
  const requests = []
  t.mock.method(axios, 'request', async config => {
    requests.push(config)
    return reply(config.method === 'POST' ? sample(3) : sample(0))
  })
  const store = create()
  store.dispatch(cartOperationStarted({ ...scope(), kind: 'mutation' }))
  const added = await store.dispatch(addItemToCart({ ...scope(), productId: 40, quantity: 3 }))
  assert.ok(addItemToCart.fulfilled.match(added))
  assert.equal(state(store).cart.items[0].quantity, 3)
  store.dispatch(cartOperationReleased(scope()))
  store.dispatch(cartOperationStarted({ ...scope(), kind: 'mutation' }))
  const removed = await store.dispatch(deleteCartItem({ ...scope(), id: 7 }))
  assert.ok(deleteCartItem.fulfilled.match(removed))
  assert.deepEqual(state(store).cart.items, [])
  assert.deepEqual(requests.map(x => x.method), ['POST', 'DELETE'])
  assert.deepEqual(requests[0].data, { productId: 40, quantity: 3 })
  assert.equal(requests[1].url, 'http://localhost:8080/carts/items/7')
})

test('PUT no sobreescribe cantidad optimista con respuesta intermedia', async t => {
  const gate = deferred()
  t.mock.method(axios, 'request', async () => gate.promise)
  const store = create()
  store.dispatch(cartOperationStarted({ ...scope(), kind: 'load' }))
  store.dispatch(cartUpdated({ ...scope(), cart: sample(1) }))
  store.dispatch(cartOperationReleased(scope()))
  store.dispatch(cartOperationStarted({ ...scope(), kind: 'quantity' }))
  store.dispatch(cartQuantityChanged({ ...scope(), id: 7, quantity: 2 }))
  const pending = store.dispatch(changeCartItemQuantity({ ...scope(), id: 7, quantity: 2 }))
  store.dispatch(cartQuantityChanged({ ...scope(), id: 7, quantity: 4 }))
  gate.resolve(reply(sample(2)))
  const action = await pending
  assert.ok(changeCartItemQuantity.fulfilled.match(action))
  assert.equal(state(store).cart.items[0].quantity, 4)
  store.dispatch(cartUpdated({ ...scope(), cart: sample(4) }))
  assert.equal(state(store).cart.subtotal, 400)
})

test('HTTP 401 via rejected conserva status, logout limpia datos y respuesta tardia no revive sesion', async t => {
  const gate = deferred()
  const mock = t.mock.method(axios, 'request', async () => {
    throw { response: { status: 401, data: {} } }
  })
  const store = create()
  store.dispatch(cartOperationStarted({ ...scope(), kind: 'mutation' }))
  const failed = await store.dispatch(addItemToCart({ ...scope(), productId: 40, quantity: 1 }))
  assert.ok(addItemToCart.rejected.match(failed))
  assert.equal(failed.error.status, 401)
  assert.equal(failed.error.message, 'Tu sesión venció. Volvé a ingresar.')
  assert.equal(state(store).cartError, 'Tu sesión venció. Volvé a ingresar.')
  mock.mock.mockImplementation(async () => gate.promise)
  const old = store.dispatch(fetchCart(scope()))
  store.dispatch(cartSessionCleared())
  store.dispatch(cartOperationStarted({ ...scope(2, 2), kind: 'load' }))
  gate.resolve(reply(sample(99)))
  await old
  assert.equal(state(store).ownerId, 2)
  assert.equal(state(store).cart, null)
})

test('HTTP 409 mantiene status en rejected y en unwrap para mostrar el error real', async t => {
  t.mock.method(axios, 'request', async () => {
    throw { response: { status: 409, data: { message: 'Stock insuficiente' } } }
  })
  const store = create()
  store.dispatch(cartOperationStarted({ ...scope(), kind: 'mutation' }))
  const pending = store.dispatch(addItemToCart({ ...scope(), productId: 40, quantity: 5 }))
  await assert.rejects(pending.unwrap(), { status: 409, message: 'Stock insuficiente' })
  assert.equal(state(store).cartError, 'Stock insuficiente')
})

test('AbortSignal cancela el thunk y no deja error visible al cerrar sesion', async t => {
  const gate = deferred()
  t.mock.method(axios, 'request', async () => gate.promise)
  const store = create()
  const controller = new AbortController()
  store.dispatch(cartOperationStarted({ ...scope(), kind: 'load' }))
  const task = store.dispatch(fetchCart(scope(), { signal: controller.signal }))
  controller.abort()
  const result = await task
  assert.ok(fetchCart.rejected.match(result))
  assert.equal(result.meta.aborted, true)
  store.dispatch(cartSessionCleared())
  gate.resolve(reply(sample(5)))
  assert.equal(state(store).cart, null)
})
