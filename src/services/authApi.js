import { request, requestJson } from './httpClient.js'

function httpError(message, status) {
  const error = new Error(message)
  error.status = status
  return error
}

// Una única validación para recuperación, login y registro.
function validateUser(user) {
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
  const user = await requestJson('/users/me', { token, signal })
  signal?.throwIfAborted()
  return validateUser(user)
}

// Solo intercambio HTTP: el token candidato nunca se persiste en este módulo.
async function authenticateAccount(path, body, { signal } = {}, registering = false) {
  const response = await request(path, { method: 'POST', body, signal })
  if (!response.ok) {
    const message = registering
      ? response.status === 409 ? 'Ya existe un usuario con este correo' : 'No se pudo registrar el usuario'
      : response.status === 401 ? 'El correo o la contraseña son incorrectos'
        : 'No pudimos iniciar sesión (HTTP ' + response.status + '). Volvé a intentar.'
    throw httpError(message, response.status)
  }
  const data = await response.json().catch(() => {
    throw new Error('El servidor devolvió una respuesta de autenticación inválida.')
  })
  const token = data?.access_token
  if (typeof token !== 'string' || !token.trim()) {
    throw new Error(registering ? 'El servidor no devolvió un token válido.' : 'La autenticación no devolvió un token válido.')
  }
  signal?.throwIfAborted()
  try {
    const user = await getCurrentUser({ token, signal })
    return { token, user }
  } catch (error) {
    if (error.status) {
      throw httpError(registering ? 'No se pudo obtener el usuario'
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
