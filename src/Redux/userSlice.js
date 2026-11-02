import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { authenticate, getCurrentUser, register } from '../services/authApi.js'

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

export const fetchAuthenticatedUser = createAsyncThunk(
  'users/fetchCurrent',
  (_unused, { extra, signal }) => {
    const token = extra.authToken()
    if (!token) throw new Error('No hay una sesión para recuperar.')
    return getCurrentUser({ token, signal })
  },
  { serializeError },
)

export const loginUser = createAsyncThunk(
  'users/login',
  (requestId, { signal }) => authenticate(consumeAuthCredentials(requestId), { signal }),
  { serializeError },
)
export const registerUser = createAsyncThunk(
  'users/register',
  (requestId, { signal }) => register(consumeAuthCredentials(requestId), { signal }),
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
