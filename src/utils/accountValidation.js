export function accountUnconfirmed(message) {
  const error = new Error(message)
  error.code = 'ACCOUNT_UNCONFIRMED'
  return error
}

export function normalizeAccountError(error, signal) {
  if (signal?.aborted) return signal.reason ?? new DOMException('Solicitud cancelada', 'AbortError')
  if (error?.name === 'AbortError') return error
  if (error?.code === 'ERR_CANCELED') return new DOMException('Solicitud cancelada', 'AbortError')
  if (error?.response) {
    const status = error.response.status
    const details = error.response.data
    return Object.assign(new Error(status === 401 ? 'Tu sesión venció. Volvé a ingresar.'
      : details?.message || details?.detail || 'No se pudo completar la operación (HTTP ' + status + ').'),
    { status })
  }
  if (error?.code === 'ERR_NETWORK') {
    return Object.assign(new TypeError(error.message || 'Network Error'), { code: error.code })
  }
  return error
}

export function validateAccountResponse(user, userId, deactivating = false) {
  if (!Number.isSafeInteger(userId) || userId < 1 || user?.id !== userId) {
    throw accountUnconfirmed('El usuario recibido no coincide con tu cuenta.')
  }
  if (typeof user.email !== 'string' || !user.email.trim()
    || typeof user.firstName !== 'string' || typeof user.lastName !== 'string'
    || !['USUARIO', 'ADMIN'].includes(user.role)
    || user.active !== !deactivating) {
    throw accountUnconfirmed(deactivating ? 'El servidor no confirmó la desactivación de tu cuenta.'
      : 'El servidor devolvió datos de usuario inválidos.')
  }
  return user
}
