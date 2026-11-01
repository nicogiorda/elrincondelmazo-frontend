import { requestJson } from './httpClient.js'

export function getCart({ token, signal } = {}) {
  return requestJson('/carts', { token, signal })
}

export function addCartItem({ productId, quantity }, { token, signal } = {}) {
  return requestJson('/carts/items', {
    method: 'POST', token, signal, body: { productId, quantity },
  })
}

export function updateCartItemQuantity(cartItemId, quantity, { token, signal } = {}) {
  return requestJson('/carts/items/' + cartItemId, {
    method: 'PUT', token, signal, body: { quantity },
  })
}

export function removeCartItem(cartItemId, { token, signal } = {}) {
  return requestJson('/carts/items/' + cartItemId, { method: 'DELETE', token, signal })
}
