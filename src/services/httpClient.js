export const API_BASE_URL = 'http://localhost:8080'

// Compartido con los endpoints que todavía se coordinan directamente desde App.
export function readResponse(response) {
  return response.json().catch(() => ({})).then((data) => {
    if (!response.ok) {
      const error = new Error(response.status === 401
        ? 'Tu sesión venció. Volvé a ingresar.'
        : data.message || data.detail || 'No se pudo completar la operación (HTTP ' + response.status + ').')
      error.status = response.status
      throw error
    }
    return data
  })
}

// El token y la cancelación pertenecen al llamador; el cliente no guarda sesión.
export function request(path, { method = 'GET', token, body, signal } = {}) {
  return fetch(API_BASE_URL + path, {
    method,
    signal,
    headers: {
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

export function requestJson(path, options) {
  return request(path, options).then(readResponse)
}
