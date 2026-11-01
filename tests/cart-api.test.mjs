import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getCart, addCartItem, updateCartItemQuantity, removeCartItem } from '../src/services/cartApi.js'
import { requestJson, readResponse } from '../src/services/httpClient.js'

const cart = { id: 1, items: [{ id: 11, productId: 7, quantity: 2 }], subtotal: 200 }
const controller = new AbortController()
const options = { token: 'account-a', signal: controller.signal }

for (const [name, run, path, method, body] of [
  ['load', () => getCart(options), '/carts', 'GET'],
  ['add', () => addCartItem({ productId: 7, quantity: 2 }, options), '/carts/items', 'POST', { productId: 7, quantity: 2 }],
  ['quantity', () => updateCartItemQuantity(11, 3, options), '/carts/items/11', 'PUT', { quantity: 3 }],
  ['remove', () => removeCartItem(11, options), '/carts/items/11', 'DELETE'],
]) {
  test(`${name}: exact endpoint, JWT, signal, JSON and one request only`, async (t) => {
    const fetch = t.mock.method(globalThis, 'fetch', async (url, init) => {
      assert.equal(url, 'http://localhost:8080' + path)
      assert.equal(init.method, method)
      assert.equal(init.signal, controller.signal)
      assert.deepEqual(init.headers, {
        Authorization: 'Bearer account-a', ...(body ? { 'Content-Type': 'application/json' } : {}),
      })
      assert.equal(init.body, body ? JSON.stringify(body) : undefined)
      return Response.json(cart)
    })
    assert.deepEqual(await run(), cart)
    assert.equal(fetch.mock.callCount(), 1, 'No follow-up GET or automatic retry')
  })
}

test('anonymous requests do not inherit a previous JWT', async (t) => {
  const headers = []
  t.mock.method(globalThis, 'fetch', async (_, init) => {
    headers.push(init.headers)
    return Response.json({})
  })
  await getCart({ token: 'account-a' })
  await requestJson('/public')
  await getCart({ token: 'account-b' })
  assert.deepEqual(headers, [{ Authorization: 'Bearer account-a' }, {}, { Authorization: 'Bearer account-b' }])
})

for (const [status, data, message] of [
  [409, { message: 'Stock insuficiente', detail: 'Other' }, 'Stock insuficiente'],
  [422, { detail: 'Cantidad inválida' }, 'Cantidad inválida'],
  [503, {}, 'No se pudo completar la operación (HTTP 503).'],
  [401, { message: 'Backend message' }, 'Tu sesión venció. Volvé a ingresar.'],
]) {
  test(`HTTP ${status} preserves status and the existing message precedence`, async (t) => {
    const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json(data, { status }))
    await assert.rejects(addCartItem({ productId: 7, quantity: 2 }, options), { status, message })
    assert.equal(fetch.mock.callCount(), 1)
  })
}

test('empty and non-JSON success responses retain the existing empty-object fallback', async () => {
  assert.deepEqual(await readResponse(new Response(null, { status: 204 })), {})
  assert.deepEqual(await readResponse(new Response('not json')), {})
})

test('non-JSON HTTP errors retain their status', async () => {
  await assert.rejects(readResponse(new Response('<html>Error</html>', { status: 500 })), {
    status: 500, message: 'No se pudo completar la operación (HTTP 500).',
  })
})

test('cancellation propagates the same AbortError without retrying', async (t) => {
  const abort = new AbortController()
  const fetch = t.mock.method(globalThis, 'fetch', (_, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  }))
  const pending = getCart({ token: 'account-a', signal: abort.signal })
  abort.abort()
  await assert.rejects(pending, (error) => error === abort.signal.reason && error.name === 'AbortError')
  assert.equal(fetch.mock.callCount(), 1)
})

test('network errors remain TypeErrors for App rollback messaging', async (t) => {
  const failure = new TypeError('Failed to fetch')
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw failure })
  await assert.rejects(updateCartItemQuantity(11, 3, options), (error) => error === failure)
  assert.equal(fetch.mock.callCount(), 1)
})
