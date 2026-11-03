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
