import { request, readResponse } from './httpClient.js'

function unconfirmed(message) {
  const error = new Error(message)
  error.code = 'ACCOUNT_UNCONFIRMED'
  return error
}

async function updateAccount(path, body, { userId, token, signal }, deactivating = false) {
  const response = await request(path, { method: 'PUT', body, token, signal })
  const user = await readResponse(response)
  if (response.status !== 200) throw unconfirmed('El servidor no confirmó la operación de cuenta.')
  if (!Number.isSafeInteger(userId) || userId < 1 || user?.id !== userId) {
    throw unconfirmed('El usuario recibido no coincide con tu cuenta.')
  }
  if (typeof user.email !== 'string' || !user.email.trim()
    || typeof user.firstName !== 'string' || typeof user.lastName !== 'string'
    || !['USUARIO', 'ADMIN'].includes(user.role)
    || user.active !== !deactivating) {
    throw unconfirmed(deactivating ? 'El servidor no confirmó la desactivación de tu cuenta.'
      : 'El servidor devolvió datos de usuario inválidos.')
  }
  return user
}

export function updateProfile({ firstName, lastName, email }, options) {
  return updateAccount('/users/me', { firstName, lastName, email }, options)
}

export function deactivateAccount(options) {
  return updateAccount('/users/me/deactivate', undefined, options, true)
}
