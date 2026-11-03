import { productIdFrom } from './productId.js'

export function normalizePublicationError(error) {
  if (!error?.response) return error
  const status = error.response.status
  const body = error.response.data
  const message = status === 401 ? 'Tu sesión venció. Volvé a ingresar.'
    : body?.message || body?.detail || 'No se pudo completar la operación (HTTP ' + status + ').'
  return Object.assign(new Error(message), { status })
}

export function publicationPath(id) {
  if (productIdFrom(id) === null) throw new Error('La publicación no tiene un ID válido.')
  return '/products/' + id
}

export function validatePublication(data, userId, id) {
  if (!data || productIdFrom(data.id) === null || data.sellerId !== userId
    || (id != null && data.id !== id)) throw new Error('La respuesta no contiene la publicación esperada.')
  return data
}

export function validatePublicationsPage(data, page, userId) {
  if (!Array.isArray(data?.content) || !Number.isInteger(data.totalPages) || data.totalPages < 0
    || (data.number != null && data.number !== page)
    || data.content.some(product => !product || productIdFrom(product.id) === null || product.sellerId !== userId)) {
    throw new Error('La respuesta de publicaciones no contiene una página válida del usuario.')
  }
  return data
}

export function validatePublicationPhoto(data) {
  let url
  try { url = new URL(data?.url) } catch { /* Invalid URL. */ }
  if (typeof data?.url !== 'string' || !['http:', 'https:'].includes(url?.protocol)) {
    throw new Error('La subida no devolvió una URL de imagen válida.')
  }
  return data.url
}
