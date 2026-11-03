import { productIdFrom } from './productId.js'

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
