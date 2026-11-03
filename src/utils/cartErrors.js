export function normalizeCartError(error, signal) {
  if (signal?.aborted) return signal.reason ?? new DOMException('Solicitud cancelada', 'AbortError')
  if (error?.name === 'AbortError') return error
  if (error?.code === 'ERR_CANCELED') return new DOMException('Solicitud cancelada', 'AbortError')

  const status = error?.response?.status ?? error?.status
  if (status != null) {
    const details = error?.response?.data
    const message = status === 401
      ? 'Tu sesión venció. Volvé a ingresar.'
      : details?.message || details?.detail || 'No se pudo completar la operación (HTTP ' + status + ').'
    return Object.assign(new Error(message), { status })
  }

  // La UI del carrito distingue una falla de red para recuperar la ultima
  // cantidad confirmada, igual que cuando el transporte era fetch.
  if (error?.code === 'ERR_NETWORK') {
    return Object.assign(new TypeError(error.message || 'Network Error'), { code: error.code })
  }
  return error
}
