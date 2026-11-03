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

