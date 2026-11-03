import axios from 'axios'
import { API_BASE_URL } from './httpClient.js'
import { productIdFrom } from '../utils/productId.js'

// Un solo transporte Axios para los GET públicos. Las vistas no invocan estas
// funciones: las acciones asíncronas y el coordinador de caché las consumen.
export function normalizeProductHttpError(error) {
  if (!error?.response?.status) return error
  const status = error.response.status
  const body = error.response.data
  const message = status === 401 ? 'Tu sesión venció. Volvé a ingresar.'
    : body?.message || body?.detail || 'No se pudo completar la operación (HTTP ' + status + ').'
  return Object.assign(new Error(message), { status })
}

export function validateProductsPage(data) {
  if (!Array.isArray(data?.content) || !Number.isInteger(data.totalPages)
    || !Number.isInteger(data.totalElements) || !Number.isInteger(data.number)) {
    throw new Error('La respuesta de productos no contiene una página válida.')
  }
  return data
}

export function validateProductDetail(data, id) {
  if (data?.id !== Number(id)) {
    throw Object.assign(new Error('El producto recibido no coincide con el seleccionado.'), {
      code: 'INVALID_PRODUCT',
    })
  }
  return data
}

export async function getProducts(query, { signal } = {}) {
  const { data } = await axios.get(API_BASE_URL + '/products?' + query, { signal })
    .catch(error => { throw normalizeProductHttpError(error) })
  return validateProductsPage(data)
}

export function productError(error, context = 'detail') {
  let message = error.message
  if (error.code === 'INVALID_PRODUCT') message = context === 'cart'
    ? 'El producto recibido no coincide con el del carrito.'
    : context === 'selection' ? 'El producto recibido no coincide con la selección.'
      : 'El producto recibido no coincide con el seleccionado.'
  else if (context === 'selection' && error.status) {
    message = 'No pudimos consultar el producto seleccionado (HTTP ' + error.status + ').'
  }
  if (message === error.message) return error
  return Object.assign(new Error(message), { status: error.status, code: error.code, name: error.name })
}

export async function getProduct(id, { signal, context = 'detail' } = {}) {
  if (productIdFrom(id) === null) throw new Error('La URL del producto no es válida.')
  try {
    const { data } = await axios.get(API_BASE_URL + '/products/' + id, { signal })
    return validateProductDetail(data, id)
  } catch (error) { throw productError(normalizeProductHttpError(error), context) }
}

export async function getCollections({ signal } = {}) {
  try {
    const { data } = await axios.get(API_BASE_URL + '/collections', { signal })
    // Axios puede entregar una cadena si el servidor respondió JSON inválido.
    const collections = typeof data === 'string' ? JSON.parse(data) : data
    if (!Array.isArray(collections)) throw new Error('La respuesta de colecciones no es una lista')
    return collections
  } catch (error) {
    if (!error?.response?.status) throw error
    const status = error.response.status
    throw Object.assign(new Error('Error ' + status + ' al cargar colecciones'), { status })
  }
}
