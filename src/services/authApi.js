import axios from 'axios'
import { API_BASE_URL } from './httpClient.js'

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

export async function getCurrentUser({ token, signal } = {}) {
  let response
  try {
    response = await axios.request({
      url: API_BASE_URL + '/users/me', method: 'GET', signal,
      headers: token ? { Authorization: 'Bearer ' + token } : {},
    })
  } catch (error) { throw normalizeAuthError(error, signal) }
  signal?.throwIfAborted()
  return validateUser(response.data)
}

// El JWT candidato nunca se guarda antes de validar /users/me.
async function authenticateAccount(path, body, { signal } = {}, registering = false) {
  let response
  try {
    response = await axios.request({
      url: API_BASE_URL + path, method: 'POST', data: body, signal,
    })
  } catch (error) {
    if (!error?.response) throw normalizeAuthError(error, signal)
    const status = error.response.status
    const message = registering
      ? status === 409 ? 'Ya existe un usuario con este correo' : 'No se pudo registrar el usuario'
      : status === 401 ? 'El correo o la contraseña son incorrectos'
        : 'No pudimos iniciar sesión (HTTP ' + status + '). Volvé a intentar.'
    throw authHttpError(message, status)
  }

  const data = response.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('El servidor devolvió una respuesta de autenticación inválida.')
  }
  const token = data.access_token
  if (typeof token !== 'string' || !token.trim()) {
    throw new Error(registering ? 'El servidor no devolvió un token válido.' : 'La autenticación no devolvió un token válido.')
  }
  signal?.throwIfAborted()
  try {
    const user = await getCurrentUser({ token, signal })
    return { token, user }
  } catch (error) {
    if (error.status) {
      throw authHttpError(registering ? 'No se pudo obtener el usuario'
        : 'No pudimos verificar tu cuenta (HTTP ' + error.status + '). Volvé a ingresar.', error.status)
    }
    throw error
  }
}

export function authenticate({ email, password }, options) {
  return authenticateAccount('/api/v1/auth/authenticate', { email, password }, options)
}

export function register({ firstname, lastname, email, password }, options) {
  return authenticateAccount('/api/v1/auth/register', { firstname, lastname, email, password }, options, true)
}
