import axios from 'axios'
import { API_BASE_URL } from './httpClient.js'
import { productIdFrom } from '../utils/productId.js'

export function reviewPath(productId) {
  const id = productIdFrom(productId)
  if (id === null) throw new Error('El producto no tiene un ID válido.')
  return '/products/' + id + '/reviews'
}

export function normalizeReviewError(error, signal) {
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

async function readReview(request, signal) {
  try {
    const response = await request
    signal?.throwIfAborted()
    return response
  } catch (error) {
    throw normalizeReviewError(error, signal)
  }
}

export async function getReviews(productId, { signal } = {}) {
  const response = await readReview(axios.get(API_BASE_URL + reviewPath(productId), { signal }), signal)
  if (!Array.isArray(response.data)) throw new Error('La respuesta de reseñas no es una lista')
  return response.data
}

export async function createReview(productId, { rating, comment }, { token, signal } = {}) {
  const response = await readReview(axios.post(API_BASE_URL + reviewPath(productId),
    { rating, comment }, {
      signal, ...(token ? { headers: { Authorization: 'Bearer ' + token } } : {}),
    }), signal)
  const review = response.data
  if (response.status !== 201 || !Number.isSafeInteger(review?.id) || review.id <= 0
    || review.productId !== Number(productId)) {
    throw new Error('La respuesta no contiene la reseña esperada.')
  }
  return review
}
