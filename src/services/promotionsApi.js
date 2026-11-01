import { request, readResponse } from './httpClient.js'

const types = ['CANTIDAD', 'COLECCION', 'TIPO_PRODUCTO', 'METODO_PAGO', 'MONTO_MINIMO', 'PRODUCTO']
const isId = value => Number.isSafeInteger(value) && value > 0
const isNumber = value => (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value))

function validatePromotion(data, id) {
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

function pathFor(id) {
  if (!isId(id)) throw new Error('El ID de la promoción no es válido.')
  return '/promotions/' + id
}
async function responseData(path, options, status) {
  const response = await request(path, options)
  const data = await readResponse(response)
  if (response.status !== status) throw new Error('El servidor no confirmó la operación de promociones.')
  return data
}

export async function getPromotions({ token, signal }) {
  const data = await responseData('/promotions', { token, signal }, 200)
  if (!Array.isArray(data)) throw new Error('La respuesta de promociones no es una lista.')
  return data.map(promotion => validatePromotion(promotion))
}
export async function getPromotion(id, { token, signal }) {
  return validatePromotion(await responseData(pathFor(id), { token, signal }, 200), id)
}
export async function savePromotion(body, id, { token, signal }) {
  return validatePromotion(await responseData(id == null ? '/promotions' : pathFor(id), {
    method: id == null ? 'POST' : 'PUT', body, token, signal,
  }, id == null ? 201 : 200), id)
}
export async function setPromotionActive(id, active, { token, signal }) {
  if (typeof active !== 'boolean') throw new Error('El estado de la promoción no es válido.')
  const saved = validatePromotion(await responseData(pathFor(id) + (active ? '/activate' : '/deactivate'), {
    method: 'PATCH', token, signal,
  }, 200), id)
  if (saved.active !== active) throw new Error('El servidor no confirmó el estado de la promoción.')
  return saved
}
