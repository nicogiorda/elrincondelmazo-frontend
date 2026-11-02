import axios from 'axios'
import { API_BASE_URL } from './httpClient.js'

// Axios no hace reintentos automaticos. El JWT se recibe por solicitud:
// ninguna cuenta puede heredar el token de una sesion anterior.
function normalizeCartError(error, signal) {
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

async function requestCart(path, { method = 'GET', token, body, signal } = {}) {
  try {
    const response = await axios.request({
      url: API_BASE_URL + path,
      method,
      signal,
      ...(token ? { headers: { Authorization: 'Bearer ' + token } } : {}),
      ...(body !== undefined ? { data: body } : {}),
    })
    signal?.throwIfAborted()
    // Equivalente al objeto vacio de readResponse si el backend responde 204.
    return response.data == null || response.data === '' ? {} : response.data
  } catch (error) {
    throw normalizeCartError(error, signal)
  }
}

export function getCart({ token, signal } = {}) {
  return requestCart('/carts', { token, signal })
}

export function addCartItem({ productId, quantity }, { token, signal } = {}) {
  return requestCart('/carts/items', {
    method: 'POST', token, signal, body: { productId, quantity },
  })
}

export function updateCartItemQuantity(cartItemId, quantity, { token, signal } = {}) {
  return requestCart('/carts/items/' + cartItemId, {
    method: 'PUT', token, signal, body: { quantity },
  })
}

export function removeCartItem(cartItemId, { token, signal } = {}) {
  return requestCart('/carts/items/' + cartItemId, { method: 'DELETE', token, signal })
}
