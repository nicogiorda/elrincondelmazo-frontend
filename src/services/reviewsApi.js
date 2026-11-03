import axios from 'axios'
import { API_BASE_URL } from './httpClient.js'
import { productIdFrom } from '../utils/productId.js'

function reviewPath(productId) {
  const id = productIdFrom(productId)
  if (id === null) throw new Error('El producto no tiene un ID válido.')
  return '/products/' + id + '/reviews'
}

function normalizeError(error, signal) {
  if (signal?.aborted) return signal.reason ?? new DOMException('Solicitud cancelada', 'AbortError')
  if (error?.name === 'AbortError') return error
  if (error?.code === 'ERR_CANCELED') return new DOMException('Solicitud cancelada', 'AbortError')
  const status = error?.response?.status ?? error?.status
  if (status != null) {
    const data = error?.response?.data
    return Object.assign(new Error(status === 401 ? 'Tu sesión venció. Volvé a ingresar.'
      : data?.message || data?.detail || 'No se pudo completar la operación (HTTP ' + status + ').'), { status })
  }
  if (error?.code === 'ERR_NETWORK') {
    return Object.assign(new TypeError(error.message || 'Network Error', { cause: error }), { code: error.code })
  }
  return error
}

async function reviewRequest(path, { method = 'GET', token, body, signal } = {}) {
  let response
  try {
    response = await axios.request({
      url: API_BASE_URL + path, method, signal,
      ...(token ? { headers: { Authorization: 'Bearer ' + token } } : {}),
      ...(body !== undefined ? { data: body } : {}),
    })
    signal?.throwIfAborted()
  } catch (error) {
    throw normalizeError(error, signal)
  }
  return response
}

// Las reseñas se consultan sin sesión. El backend determina si el producto es reseñable.
export async function getReviews(productId, { signal } = {}) {
  const response = await reviewRequest(reviewPath(productId), { signal })
  if (!Array.isArray(response.data)) throw new Error('La respuesta de reseñas no es una lista')
  return response.data
}

export async function createReview(productId, { rating, comment }, { token, signal } = {}) {
  const response = await reviewRequest(reviewPath(productId), {
    method: 'POST', token, signal, body: { rating, comment },
  })
  const review = response.data
  if (response.status !== 201 || !Number.isSafeInteger(review?.id) || review.id <= 0
    || review.productId !== Number(productId)) {
    throw new Error('La respuesta no contiene la reseña esperada.')
  }
  return review
}
