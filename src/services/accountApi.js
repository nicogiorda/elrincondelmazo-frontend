import axios from 'axios'
import { API_BASE_URL } from './httpClient.js'

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

// Funciones públicas mantenidas para quienes usan accountApi directamente.
// En la aplicación las llamadas se despachan desde userSlice con Axios explícito.
export async function updateProfile({ firstName, lastName, email }, { userId, token, signal } = {}) {
  const response = await axios.put(API_BASE_URL + '/users/me',
    { firstName, lastName, email }, { signal, headers: { Authorization: 'Bearer ' + token } },
  ).catch(error => { throw normalizeAccountError(error, signal) })
  signal?.throwIfAborted()
  if (response.status !== 200) throw accountUnconfirmed('El servidor no confirmó la operación de cuenta.')
  return validateAccountResponse(response.data, userId)
}

export async function deactivateAccount({ userId, token, signal } = {}) {
  const response = await axios.put(API_BASE_URL + '/users/me/deactivate',
    undefined, { signal, headers: { Authorization: 'Bearer ' + token } },
  ).catch(error => { throw normalizeAccountError(error, signal) })
  signal?.throwIfAborted()
  if (response.status !== 200) throw accountUnconfirmed('El servidor no confirmó la operación de cuenta.')
  return validateAccountResponse(response.data, userId, true)
}
