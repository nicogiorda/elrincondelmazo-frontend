import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import axios from 'axios'
import { API_BASE_URL } from '../services/httpClient.js'
import { authHttpError, normalizeAuthError, validateUser } from '../services/authApi.js'

// Redux DevTools no debe registrar contraseñas en meta.arg.
// El formulario registra credenciales temporalmente; las acciones llevan solo un ID.
const credentialsByRequest = new Map()
let nextRequestId = 0
export function stageAuthCredentials(credentials) {
  const requestId = ++nextRequestId
  credentialsByRequest.set(requestId, credentials)
  return requestId
}
export function discardAuthCredentials(requestId) {
  credentialsByRequest.delete(requestId)
}
function consumeAuthCredentials(requestId) {
  const credentials = credentialsByRequest.get(requestId)
  credentialsByRequest.delete(requestId)
  if (!credentials) throw new Error('El intento de autenticación ya no está disponible.')
  return credentials
}

const serializeError = error => ({
  name: error?.name || 'Error', message: error?.message || 'Error de autenticación',
  status: error?.status ?? null, code: error?.code ?? null,
})

// El GET y los POST quedan explícitos como en postSlice.js. Las contraseñas
// se consumen de un Map efímero y nunca se escriben en acciones Redux.
export const fetchAuthenticatedUser = createAsyncThunk(
  'users/fetchCurrent',
  async (_unused, { extra, signal }) => {
    const token = extra.authToken()
    if (!token) throw new Error('No hay una sesión para recuperar.')
    const { data } = await axios.get(API_BASE_URL + '/users/me', {
      signal, headers: { Authorization: 'Bearer ' + token },
    }).catch(error => { throw normalizeAuthError(error, signal) })
    signal.throwIfAborted()
    return validateUser(data)
  },
  { serializeError },
)

export const loginUser = createAsyncThunk(
  'users/login',
  async (requestId, { signal }) => {
    const { email, password } = consumeAuthCredentials(requestId)
    let response
    try {
      response = await axios.post(API_BASE_URL + '/api/v1/auth/authenticate',
        { email, password }, { signal })
    } catch (error) {
      if (!error?.response) throw normalizeAuthError(error, signal)
      const status = error.response.status
      throw authHttpError(status === 401 ? 'El correo o la contraseña son incorrectos'
        : 'No pudimos iniciar sesión (HTTP ' + status + '). Volvé a intentar.', status)
    }
    const token = response.data?.access_token
    if (!response.data || typeof response.data !== 'object' || Array.isArray(response.data)) {
      throw new Error('El servidor devolvió una respuesta de autenticación inválida.')
    }
    if (typeof token !== 'string' || !token.trim()) {
      throw new Error('La autenticación no devolvió un token válido.')
    }
    signal.throwIfAborted()
    try {
      // No publicar un token candidato antes de verificar /users/me.
      const { data } = await axios.get(API_BASE_URL + '/users/me', {
        signal, headers: { Authorization: 'Bearer ' + token },
      }).catch(error => { throw normalizeAuthError(error, signal) })
      signal.throwIfAborted()
      return { token, user: validateUser(data) }
    } catch (error) {
      if (error.status) {
        throw authHttpError('No pudimos verificar tu cuenta (HTTP ' + error.status + '). Volvé a ingresar.', error.status)
      }
      throw error
    }
  },
  { serializeError },
)

export const registerUser = createAsyncThunk(
  'users/register',
  async (requestId, { signal }) => {
    const { firstname, lastname, email, password } = consumeAuthCredentials(requestId)
    let response
    try {
      response = await axios.post(API_BASE_URL + '/api/v1/auth/register',
        { firstname, lastname, email, password }, { signal })
    } catch (error) {
      if (!error?.response) throw normalizeAuthError(error, signal)
      const status = error.response.status
      throw authHttpError(status === 409 ? 'Ya existe un usuario con este correo'
        : 'No se pudo registrar el usuario', status)
    }
    const token = response.data?.access_token
    if (!response.data || typeof response.data !== 'object' || Array.isArray(response.data)) {
      throw new Error('El servidor devolvió una respuesta de autenticación inválida.')
    }
    if (typeof token !== 'string' || !token.trim()) {
      throw new Error('El servidor no devolvió un token válido.')
    }
    signal.throwIfAborted()
    try {
      const { data } = await axios.get(API_BASE_URL + '/users/me', {
        signal, headers: { Authorization: 'Bearer ' + token },
      }).catch(error => { throw normalizeAuthError(error, signal) })
      signal.throwIfAborted()
      return { token, user: validateUser(data) }
    } catch (error) {
      if (error.status) throw authHttpError('No se pudo obtener el usuario', error.status)
      throw error
    }
  },
  { serializeError },
)

const savedToken = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null
const initialState = {
  user: null,
  token: savedToken,
  loading: Boolean(savedToken), // Indica solamente restauración de sesión.
  sessionError: '',
  authStatus: 'idle',
  authError: '',
  restoreRequestId: null,
  authRequestId: null,
}

const userSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    sessionAuthenticated(state, action) {
      state.user = action.payload.user
      state.token = action.payload.token
      state.loading = false
      state.sessionError = ''
      state.authError = ''
      state.authStatus = 'succeeded'
      state.restoreRequestId = null
      state.authRequestId = null
    },
    sessionEnded(state) {
      state.user = null
      state.token = null
      state.loading = false
      state.sessionError = ''
      state.authStatus = 'idle'
      state.authError = ''
      state.restoreRequestId = null
      state.authRequestId = null
    },
    sessionErrorChanged(state, action) {
      state.sessionError = action.payload
    },
    authenticatedUserUpdated(state, action) {
      if (!state.user || state.user.id !== action.payload?.id) return
      state.user = action.payload
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchAuthenticatedUser.pending, (state, action) => {
        state.loading = true
        state.restoreRequestId = action.meta.requestId
      })
      .addCase(fetchAuthenticatedUser.fulfilled, (state, action) => {
        if (state.restoreRequestId !== action.meta.requestId) return
        state.user = action.payload
        state.loading = false
        state.restoreRequestId = null
        state.sessionError = ''
      })
      .addCase(fetchAuthenticatedUser.rejected, (state, action) => {
        if (state.restoreRequestId !== action.meta.requestId) return
        state.loading = false
        state.restoreRequestId = null
        if (!action.meta.aborted) state.sessionError = action.error.message
      })
      .addCase(loginUser.pending, (state, action) => {
        state.authStatus = 'loading'
        state.authError = ''
        state.authRequestId = action.meta.requestId
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        if (state.authRequestId !== action.meta.requestId) return
        state.authStatus = 'succeeded'
        state.authRequestId = null
        // El hook valida la versión de sesión antes de publicar user+token.
      })
      .addCase(loginUser.rejected, (state, action) => {
        if (state.authRequestId !== action.meta.requestId) return
        state.authStatus = 'failed'
        state.authError = action.meta.aborted ? '' : action.error.message
        state.authRequestId = null
      })
      .addCase(registerUser.pending, (state, action) => {
        state.authStatus = 'loading'
        state.authError = ''
        state.authRequestId = action.meta.requestId
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        if (state.authRequestId !== action.meta.requestId) return
        state.authStatus = 'succeeded'
        state.authRequestId = null
      })
      .addCase(registerUser.rejected, (state, action) => {
        if (state.authRequestId !== action.meta.requestId) return
        state.authStatus = 'failed'
        state.authError = action.meta.aborted ? '' : action.error.message
        state.authRequestId = null
      })
  },
})

export const { sessionAuthenticated, sessionEnded, sessionErrorChanged,
  authenticatedUserUpdated } = userSlice.actions
export default userSlice.reducer
