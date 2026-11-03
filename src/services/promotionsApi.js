import axios from 'axios'
import { API_BASE_URL } from './httpClient.js'
import { publicPromotionFromBackend } from '../utils/promotionMapper.js'

const types = ['CANTIDAD', 'COLECCION', 'TIPO_PRODUCTO', 'METODO_PAGO', 'MONTO_MINIMO', 'PRODUCTO']
const isId = value => Number.isSafeInteger(value) && value > 0
const isNumber = value => (typeof value === 'number' || (typeof value === 'string' && value.trim() !== ''))
  && Number.isFinite(Number(value))

export function validatePromotion(data, id) {
  if (!data || !isId(data.id) || (id != null && data.id !== id)
    || typeof data.name !== 'string' || !types.includes(data.type)
    || !isNumber(data.discountPercentage) || Number(data.discountPercentage) <= 0 || Number(data.discountPercentage) > 100
    || typeof data.active !== 'boolean' || typeof data.startDate !== 'string'
    || ['description', 'endDate', 'productType', 'paymentMethod', 'collectionName', 'productName'].some(key => data[key] != null && typeof data[key] !== 'string')
    || ['collectionId', 'productId'].some(key => data[key] != null && !isId(data[key]))
    || (data.minimumQuantity != null && !isId(data.minimumQuantity))
    || (data.minimumAmount != null && (!isNumber(data.minimumAmount) || Number(data.minimumAmount) <= 0))
    || (data.stackable != null && typeof data.stackable !== 'boolean')) {
    throw new Error('La respuesta no contiene la promoción esperada.')
  }
  return data
}

export function promotionPath(id) {
  if (!isId(id)) throw new Error('El ID de la promoción no es válido.')
  return '/promotions/' + id
}

export function normalizePromotionError(error, signal) {
  if (signal?.aborted) return signal.reason ?? new DOMException('Solicitud cancelada', 'AbortError')
  if (error?.name === 'AbortError') return error
  if (error?.code === 'ERR_CANCELED') return new DOMException('Solicitud cancelada', 'AbortError')

  const status = error?.response?.status ?? error?.status
  if (status != null) {
    const details = error?.response?.data
    const message = status === 401 ? 'Tu sesión venció. Volvé a ingresar.'
      : details?.message || details?.detail || 'No se pudo completar la operación (HTTP ' + status + ').'
    return Object.assign(new Error(message), { status })
  }
  if (error?.code === 'ERR_NETWORK') {
    return Object.assign(new TypeError(error.message || 'Network Error', { cause: error }), { code: error.code })
  }
  return error
}

// Axios realiza la unica solicitud; Redux Toolkit administra el ciclo asincrono.
// Ningun interceptor ni token global puede filtrar datos entre cuentas.
async function responseData(path, { method = 'GET', body, token, signal } = {}, expectedStatus = 200) {
  let response
  try {
    response = await axios.request({
      url: API_BASE_URL + path, method, signal,
      ...(token ? { headers: { Authorization: 'Bearer ' + token } } : {}),
      ...(body !== undefined ? { data: body } : {}),
    })
    signal?.throwIfAborted()
  } catch (error) {
    throw normalizePromotionError(error, signal)
  }
  if (response.status !== expectedStatus) throw new Error('El servidor no confirmó la operación de promociones.')
  return response.data
}

export async function getPromotions({ token, signal } = {}) {
  const data = await responseData('/promotions', { token, signal })
  if (!Array.isArray(data)) throw new Error('La respuesta de promociones no es una lista.')
  return data.map(promotion => validatePromotion(promotion))
}

export async function getPromotion(id, { token, signal } = {}) {
  return validatePromotion(await responseData(promotionPath(id), { token, signal }), id)
}

export async function savePromotion(body, id, { token, signal } = {}) {
  const path = id == null ? '/promotions' : promotionPath(id)
  return validatePromotion(await responseData(path, {
    method: id == null ? 'POST' : 'PUT', body, token, signal,
  }, id == null ? 201 : 200), id)
}

export async function setPromotionActive(id, active, { token, signal } = {}) {
  if (typeof active !== 'boolean') throw new Error('El estado de la promoción no es válido.')
  const saved = validatePromotion(await responseData(promotionPath(id) + (active ? '/activate' : '/deactivate'), {
    method: 'PATCH', token, signal,
  }), id)
  if (saved.active !== active) throw new Error('El servidor no confirmó el estado de la promoción.')
  return saved
}

// Las promociones del Home son públicas: nunca envían JWT.
export async function getPublicPromotions({ signal } = {}) {
  let data
  try {
    data = await responseData('/promotions/public', { signal })
  } catch (error) {
    if (typeof error?.status === 'number') {
      throw Object.assign(new Error('No pudimos cargar las promociones (HTTP ' + error.status + ').'),
        { status: error.status })
    }
    throw error
  }
  if (!Array.isArray(data)) throw new Error('La respuesta de promociones no es una lista.')
  return data.map(publicPromotionFromBackend)
}
