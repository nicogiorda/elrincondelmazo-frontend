import axios from 'axios'
import { API_BASE_URL } from './httpClient.js'

// Axios no hace reintentos automaticos. El JWT se recibe por solicitud:
// ninguna cuenta puede heredar el token de una sesion anterior.
export function normalizeCartError(error, signal) {
  if (signal?.aborted) return signal.reason ?? new DOMException('Solicitud cancelada', 'AbortError')
  if (error?.name === 'AbortError') return error
  if (error?.code === 'ERR_CANCELED') return new DOMException('Solicitud cancelada', 'AbortError')

  const status = error?.response?.status ?? error?.status
  if (status != null) {
    const details = error?.response?.data
    const message = status === 401
      ? 'Tu sesión venció. Volvé a ingresar.'
      : details?.message || details?.detail || 'No se pudo completar la operación (HTTP ' + status + ').'
    return Object.assign(new Error(message), { status })
  }

  // La UI del carrito distingue una falla de red para recuperar la ultima
  // cantidad confirmada, igual que cuando el transporte era fetch.
  if (error?.code === 'ERR_NETWORK') {
    return Object.assign(new TypeError(error.message || 'Network Error'), { code: error.code })
  }
  return error
}

// Compatibilidad con los consumidores de cartApi: cada función muestra
// su verbo HTTP. La aplicación despacha directamente los thunks del slice.
async function readCart(request, signal) {
  try {
    const response = await request
    signal?.throwIfAborted()
    return response.data == null || response.data === '' ? {} : response.data
  } catch (error) {
    throw normalizeCartError(error, signal)
  }
}

export function getCart({ token, signal } = {}) {
  return readCart(axios.get(API_BASE_URL + '/carts', {
    signal, ...(token ? { headers: { Authorization: 'Bearer ' + token } } : {}),
  }), signal)
}

export function addCartItem({ productId, quantity }, { token, signal } = {}) {
  return readCart(axios.post(API_BASE_URL + '/carts/items',
    { productId, quantity }, {
      signal, ...(token ? { headers: { Authorization: 'Bearer ' + token } } : {}),
    }), signal)
}

export function updateCartItemQuantity(cartItemId, quantity, { token, signal } = {}) {
  return readCart(axios.put(API_BASE_URL + '/carts/items/' + cartItemId,
    { quantity }, {
      signal, ...(token ? { headers: { Authorization: 'Bearer ' + token } } : {}),
    }), signal)
}

export function removeCartItem(cartItemId, { token, signal } = {}) {
  return readCart(axios.delete(API_BASE_URL + '/carts/items/' + cartItemId, {
    signal, ...(token ? { headers: { Authorization: 'Bearer ' + token } } : {}),
  }), signal)
}
