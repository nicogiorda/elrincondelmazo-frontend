import './fixtures/axios-verb-test-bridge.mjs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import axios from 'axios'
import { getCart, addCartItem, updateCartItemQuantity, removeCartItem } from '../src/services/cartApi.js'

const cart = { id: 1, items: [{ id: 11, productId: 7, quantity: 2 }], subtotal: 200 }
const controller = new AbortController()
const options = { token: 'account-a', signal: controller.signal }

for (const [name, run, path, method, body] of [
  ['load', () => getCart(options), '/carts', 'GET'],
  ['add', () => addCartItem({ productId: 7, quantity: 2 }, options), '/carts/items', 'POST', { productId: 7, quantity: 2 }],
  ['quantity', () => updateCartItemQuantity(11, 3, options), '/carts/items/11', 'PUT', { quantity: 3 }],
  ['remove', () => removeCartItem(11, options), '/carts/items/11', 'DELETE'],
]) {
  test(name + ': Axios conserva endpoint, JWT, signal y una unica solicitud', async t => {
    const request = t.mock.method(axios, 'request', async config => {
      assert.equal(config.url, 'http://localhost:8080' + path)
      assert.equal(config.method, method)
      assert.equal(config.signal, controller.signal)
      assert.equal(config.headers?.Authorization, 'Bearer account-a')
      assert.deepEqual(config.data, body)
      return { status: 200, data: cart }
    })
    assert.deepEqual(await run(), cart)
    assert.equal(request.mock.callCount(), 1)
  })
}

test('solicitudes anonimas no heredan token', async t => {
  const headers = []
  t.mock.method(axios, 'request', async config => {
    headers.push(config.headers)
    return { status: 200, data: cart }
  })
  await getCart({ token: 'account-a' })
  await getCart()
  await getCart({ token: 'account-b' })
  assert.deepEqual(headers, [
    { Authorization: 'Bearer account-a' }, undefined, { Authorization: 'Bearer account-b' },
  ])
})

for (const [status, data, message] of [
  [409, { message: 'Stock insuficiente', detail: 'Other' }, 'Stock insuficiente'],
  [422, { detail: 'Cantidad inválida' }, 'Cantidad inválida'],
  [503, {}, 'No se pudo completar la operación (HTTP 503).'],
  [401, { message: 'Backend message' }, 'Tu sesión venció. Volvé a ingresar.'],
]) {
  test('Axios HTTP ' + status + ' conserva status y precedencia de mensaje', async t => {
    const mock = t.mock.method(axios, 'request', async () => {
      throw { response: { status, data } }
    })
    await assert.rejects(addCartItem({ productId: 7, quantity: 2 }, options), { status, message })
    assert.equal(mock.mock.callCount(), 1)
  })
}

test('sin contenido conserva objeto vacío sin depender de fetch', async t => {
  t.mock.method(axios, 'request', async () => ({ status: 204, data: undefined }))
  assert.deepEqual(await getCart(options), {})
})

test('AbortSignal propaga AbortError sin reintentar', async t => {
  const abort = new AbortController()
  const request = t.mock.method(axios, 'request', async () => {
    abort.abort()
    throw { code: 'ERR_CANCELED' }
  })
  await assert.rejects(getCart({ token: 'account-a', signal: abort.signal }), { name: 'AbortError' })
  assert.equal(request.mock.callCount(), 1)
})

test('network ERR_NETWORK es TypeError para el rollback de la UI', async t => {
  const request = t.mock.method(axios, 'request', async () => {
    throw { code: 'ERR_NETWORK', message: 'Network Error' }
  })
  await assert.rejects(updateCartItemQuantity(11, 3, options), TypeError)
  assert.equal(request.mock.callCount(), 1)
})
