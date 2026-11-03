import axios from 'axios'
import { API_BASE_URL } from './httpClient.js'
import { productIdFrom } from '../utils/productId.js'

// El servicio es transporte HTTP puro: Axios, autenticación por llamada y
// contratos de Spring. Redux decide cuándo solicitar y dónde guardar datos.
export function normalizePublicationError(error) {
  if (!error?.response) return error
  const status = error.response.status
  const body = error.response.data
  const message = status === 401 ? 'Tu sesión venció. Volvé a ingresar.'
    : body?.message || body?.detail || 'No se pudo completar la operación (HTTP ' + status + ').'
  return Object.assign(new Error(message), { status })
}

async function readPublication(request, status, message, signal) {
  let response
  try {
    response = await request
    signal?.throwIfAborted()
  } catch (error) {
    throw normalizePublicationError(error)
  }
  if (response.status !== status) throw new Error(message)
  return status === 204 ? undefined : response.data
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

export async function getPublications(page, { userId, token, signal }) {
  const data = await readPublication(axios.get(
    API_BASE_URL + '/products/mine?page=' + page + '&size=20',
    { signal, headers: { Authorization: 'Bearer ' + token } },
  ), 200, 'El servidor no confirmó la consulta de publicaciones.', signal)
  return validatePublicationsPage(data, page, userId)
}

export async function savePublication(body, id, { userId, token, signal }) {
  const config = { signal, headers: { Authorization: 'Bearer ' + token } }
  const request = id == null
    ? axios.post(API_BASE_URL + '/products', body, config)
    : axios.put(API_BASE_URL + publicationPath(id), body, config)
  const data = await readPublication(request, id == null ? 201 : 200,
    'El servidor no confirmó el guardado de la publicación.', signal)
  return validatePublication(data, userId, id)
}

export async function changePublicationStatus(id, action, { userId, token, signal }) {
  if (!['pause', 'resume'].includes(action)) throw new Error('La acción de publicación no es válida.')
  const data = await readPublication(axios.patch(
    API_BASE_URL + publicationPath(id) + '/' + action,
    undefined, { signal, headers: { Authorization: 'Bearer ' + token } },
  ), 200, 'El servidor no confirmó el cambio de estado.', signal)
  return validatePublication(data, userId, id)
}

export async function deletePublication(id, { token, signal }) {
  return readPublication(axios.delete(API_BASE_URL + publicationPath(id), {
    signal, headers: { Authorization: 'Bearer ' + token },
  }), 204, 'El servidor no confirmó la eliminación.', signal)
}

export async function uploadPublicationPhoto(file, { token, signal }) {
  const body = new FormData()
  body.append('file', file)
  // Axios detecta FormData y deja que el navegador agregue el boundary.
  const data = await readPublication(axios.post(API_BASE_URL + '/products/images', body, {
    signal, headers: { Authorization: 'Bearer ' + token },
  }), 201, 'El servidor no confirmó la subida de la imagen.', signal)
  return validatePublicationPhoto(data)
}
