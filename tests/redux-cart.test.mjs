import assert from 'node:assert/strict'
import { test } from 'node:test'
import { configureStore } from '@reduxjs/toolkit'
import cartReducer, { cartSessionCleared, cartOperationStarted, cartReceived,
  cartUpdated, cartQuantityChanged, cartQuantitySyncStarted, cartOperationReleased,
  cartFailed, cartRetryRequested, cartCheckoutCompleted } from '../src/Redux/cartSlice.js'

const create = () => configureStore({ reducer: { cart: cartReducer } })
const request = (ownerId = 1, generation = 1) => ({ ownerId, generation })
const sample = (quantity = 1) => ({
  id: 12, subtotal: 100 * quantity,
  items: [{ id: 7, productId: 40, unitPrice: 100, quantity, subtotal: 100 * quantity }],
})

test('Redux inicia sin datos privados y sin token JWT', () => {
  const store = create()
  assert.deepEqual(store.getState().cart.cart, null)
  assert.deepEqual(store.getState().cart.ownerId, null)
  assert.equal('token' in store.getState().cart, false)
})

test('GET inicia loading y publica la respuesta válida de su sesión', () => {
  const store = create()
  store.dispatch(cartOperationStarted({ ...request(), kind: 'load' }))
  assert.equal(store.getState().cart.cartBusy, true)
  assert.equal(store.getState().cart.cartLoading, true)
  store.dispatch(cartReceived({ ...request(), cart: sample(2) }))
  store.dispatch(cartOperationReleased(request()))
  const state = store.getState().cart
  assert.equal(state.cartLoading, false)
  assert.equal(state.cartBusy, false)
  assert.equal(state.cart.items[0].quantity, 2)
})

test('mutación actualiza la respuesta confirmada y publica el mensaje', () => {
  const store = create()
  store.dispatch(cartOperationStarted({ ...request(), kind: 'load' }))
  store.dispatch(cartReceived({ ...request(), cart: sample(1) }))
  store.dispatch(cartOperationReleased(request()))
  store.dispatch(cartOperationStarted({ ...request(), kind: 'mutation' }))
  store.dispatch(cartUpdated({ ...request(), cart: sample(3) }))
  store.dispatch(cartOperationReleased(request()))
  assert.equal(store.getState().cart.cart.items[0].quantity, 3)
  assert.equal(store.getState().cart.cartMessage, 'Carrito actualizado.')
})

test('cantidad optimista recalcula subtotal; error permite rollback a último confirmado', () => {
  const store = create()
  store.dispatch(cartOperationStarted({ ...request(), kind: 'load' }))
  store.dispatch(cartReceived({ ...request(), cart: sample(1) }))
  store.dispatch(cartOperationReleased(request()))
  store.dispatch(cartOperationStarted({ ...request(), kind: 'quantity' }))
  store.dispatch(cartQuantitySyncStarted({ ...request(), id: 7 }))
  store.dispatch(cartQuantityChanged({ ...request(), id: 7, quantity: 4 }))
  assert.equal(store.getState().cart.cart.subtotal, 400)
  assert.equal(store.getState().cart.quantitySyncItemId, 7)
  store.dispatch(cartReceived({ ...request(), cart: sample(2) }))
  store.dispatch(cartFailed({ ...request(), message: 'Stock insuficiente' }))
  store.dispatch(cartOperationReleased(request()))
  assert.equal(store.getState().cart.cart.subtotal, 200)
  assert.equal(store.getState().cart.cartError, 'Stock insuficiente')
  assert.equal(store.getState().cart.quantitySyncItemId, null)
})

test('logout limpia datos del usuario; respuesta tardía no los restaura', () => {
  const store = create()
  store.dispatch(cartOperationStarted({ ...request(), kind: 'load' }))
  store.dispatch(cartReceived({ ...request(), cart: sample(4) }))
  store.dispatch(cartSessionCleared())
  assert.equal(store.getState().cart.cart, null)
  store.dispatch(cartReceived({ ...request(), cart: sample(99) }))
  store.dispatch(cartFailed({ ...request(), message: 'Error viejo' }))
  store.dispatch(cartOperationReleased(request()))
  assert.equal(store.getState().cart.cart, null)
  assert.equal(store.getState().cart.cartError, '')
})

test('cuenta nueva o nueva generación del mismo usuario descarta respuestas viejas', () => {
  const store = create()
  store.dispatch(cartOperationStarted({ ...request(1, 5), kind: 'load' }))
  store.dispatch(cartReceived({ ...request(1, 5), cart: sample(2) }))
  store.dispatch(cartOperationStarted({ ...request(2, 6), kind: 'load' }))
  store.dispatch(cartReceived({ ...request(1, 5), cart: sample(3) }))
  assert.equal(store.getState().cart.cart, null)
  store.dispatch(cartReceived({ ...request(2, 6), cart: sample(7) }))
  assert.equal(store.getState().cart.cart.items[0].quantity, 7)
  store.dispatch(cartSessionCleared())
  store.dispatch(cartOperationStarted({ ...request(1, 8), kind: 'load' }))
  store.dispatch(cartReceived({ ...request(1, 5), cart: sample(99) }))
  assert.equal(store.getState().cart.cart, null)
})

test('retry incrementa una vez; checkout vacía carrito sólo para la sesión vigente', () => {
  const store = create()
  store.dispatch(cartOperationStarted({ ...request(), kind: 'load' }))
  store.dispatch(cartReceived({ ...request(), cart: sample(4) }))
  store.dispatch(cartOperationReleased(request()))
  store.dispatch(cartRetryRequested(request()))
  assert.equal(store.getState().cart.cartAttempt, 1)
  store.dispatch(cartOperationStarted({ ...request(), kind: 'checkout' }))
  store.dispatch(cartCheckoutCompleted({ ...request(2, 1) }))
  assert.equal(store.getState().cart.cart.subtotal, 400)
  store.dispatch(cartCheckoutCompleted(request()))
  assert.equal(store.getState().cart.cart.subtotal, 0)
  assert.deepEqual(store.getState().cart.cart.items, [])
  store.dispatch(cartOperationReleased(request()))
  assert.equal(store.getState().cart.cartBusy, false)
})

test('estado del carrito se mantiene serializable bajo mutaciones', () => {
  const store = create()
  store.dispatch(cartOperationStarted({ ...request(), kind: 'load' }))
  store.dispatch(cartReceived({ ...request(), cart: sample() }))
  assert.doesNotThrow(() => JSON.stringify(store.getState().cart))
  const { cart } = store.getState()
  assert.equal(Object.values(cart).some((value) => value instanceof AbortController), false)
})
