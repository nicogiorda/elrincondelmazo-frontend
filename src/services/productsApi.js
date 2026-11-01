import { request, requestJson } from './httpClient.js'
import { productIdFrom } from '../utils/productId.js'

export async function getProducts(query, { signal } = {}) {
  const data = await requestJson('/products?' + query, { signal })
  if (!Array.isArray(data?.content) || !Number.isInteger(data.totalPages)
    || !Number.isInteger(data.totalElements) || !Number.isInteger(data.number)) {
    throw new Error('La respuesta de productos no contiene una página válida.')
  }
  return data
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
    const data = await requestJson('/products/' + id, { signal })
    if (data?.id !== Number(id)) {
      throw Object.assign(new Error('El producto recibido no coincide con el seleccionado.'), { code: 'INVALID_PRODUCT' })
    }
    return data
  } catch (error) { throw productError(error, context) }
}

export async function getCollections({ signal } = {}) {
  const response = await request('/collections', { signal })
  if (!response.ok) throw Object.assign(new Error('Error ' + response.status + ' al cargar colecciones'), { status: response.status })
  const data = await response.json()
  if (!Array.isArray(data)) throw new Error('La respuesta de colecciones no es una lista')
  return data
}
