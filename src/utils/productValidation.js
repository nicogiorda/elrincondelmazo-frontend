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


