import { request, readResponse } from './httpClient.js'
import { productIdFrom } from '../utils/productId.js'

async function responseData(path, options, status, message) {
  const response = await request(path, options)
  // Los errores HTTP conservan el mensaje y status del cliente compartido.
  if (!response.ok) await readResponse(response)
  if (response.status !== status) throw new Error(message)
  return status === 204 ? undefined : readResponse(response)
}

function publicationPath(id) {
  if (productIdFrom(id) === null) throw new Error('La publicación no tiene un ID válido.')
  return '/products/' + id
}

function validatePublication(data, userId, id) {
  if (!data || productIdFrom(data.id) === null || data.sellerId !== userId
    || (id != null && data.id !== id)) throw new Error('La respuesta no contiene la publicación esperada.')
  return data
}

export async function getPublications(page, { userId, token, signal }) {
  const data = await responseData('/products/mine?page=' + page + '&size=20', { token, signal }, 200,
    'El servidor no confirmó la consulta de publicaciones.')
  if (!Array.isArray(data?.content) || !Number.isInteger(data.totalPages) || data.totalPages < 0
    || (data.number != null && data.number !== page)
    || data.content.some(product => !product || productIdFrom(product.id) === null || product.sellerId !== userId)) {
    throw new Error('La respuesta de publicaciones no contiene una página válida del usuario.')
  }
  return data
}

export async function savePublication(body, id, { userId, token, signal }) {
  const data = await responseData(id == null ? '/products' : publicationPath(id), {
    method: id == null ? 'POST' : 'PUT', body, token, signal,
  }, id == null ? 201 : 200, 'El servidor no confirmó el guardado de la publicación.')
  return validatePublication(data, userId, id)
}

export async function changePublicationStatus(id, action, { userId, token, signal }) {
  if (!['pause', 'resume'].includes(action)) throw new Error('La acción de publicación no es válida.')
  const data = await responseData(publicationPath(id) + '/' + action, { method: 'PATCH', token, signal }, 200,
    'El servidor no confirmó el cambio de estado.')
  return validatePublication(data, userId, id)
}

export async function deletePublication(id, { token, signal }) {
  return responseData(publicationPath(id), { method: 'DELETE', token, signal }, 204,
    'El servidor no confirmó la eliminación.')
}

export async function uploadPublicationPhoto(file, { token, signal }) {
  const body = new FormData()
  body.append('file', file)
  const data = await responseData('/products/images', { method: 'POST', body, token, signal }, 201,
    'El servidor no confirmó la subida de la imagen.')
  let url
  try { url = new URL(data?.url) } catch { /* La respuesta inválida usa el mismo error que un protocolo inseguro. */ }
  if (typeof data?.url !== 'string' || !['http:', 'https:'].includes(url?.protocol)) {
    throw new Error('La subida no devolvió una URL de imagen válida.')
  }
  return data.url
}
