export function authHttpError(message, status) {
  const error = new Error(message)
  error.status = status
  return error
}

export function normalizeAuthError(error, signal) {
  if (signal?.aborted || error?.code === 'ERR_CANCELED') {
    return new DOMException('Solicitud cancelada', 'AbortError')
  }
  if (error?.response) {
    const status = error.response.status
    const data = error.response.data
    const message = status === 401 ? 'Tu sesión venció. Volvé a ingresar.'
      : data?.message || data?.detail || 'No se pudo completar la operación (HTTP ' + status + ').'
    return authHttpError(message, status)
  }
  if (error?.code === 'ERR_NETWORK') return new TypeError(error.message)
  return error
}

// La verificación se comparte entre recuperación, login y registro.
export function validateUser(user) {
  if (!user || !Number.isSafeInteger(user.id) || user.id < 1 || !user.email
    || typeof user.firstName !== 'string' || typeof user.lastName !== 'string'
    || !['USUARIO', 'ADMIN'].includes(user.role) || user.active === false) {
    const error = new Error('El servidor devolvió datos de usuario inválidos.')
    error.code = 'INVALID_USER'
    throw error
  }
  return user
}
