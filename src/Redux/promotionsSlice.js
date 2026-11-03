import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import axios from 'axios'
import { API_BASE_URL } from '../config/api.js'
import { normalizePromotionError, validatePromotion, promotionPath } from '../utils/promotionValidation.js'
import { promotionFromBackend, promotionToBackend, publicPromotionFromBackend } from '../utils/promotionMapper.js'

// Como en postSlice.js de la clase: cada thunk muestra explícitamente
// el verbo HTTP de Axios; extraReducers maneja pending/fulfilled/rejected.
const URL = API_BASE_URL + '/promotions'

const serializePromotionError = error => ({
  name: typeof error?.name === 'string' ? error.name : 'Error',
  message: typeof error?.message === 'string' ? error.message : 'No pudimos completar la operación.',
  ...(typeof error?.status === 'number' ? { status: error.status } : {}),
  ...(typeof error?.code === 'string' ? { code: error.code } : {}),
})

const adminToken = extra => {
  const token = extra?.promotionToken?.()
  if (!token) throw new Error('Ingresá con una cuenta administradora.')
  return token
}

export const fetchAdminPromotions = createAsyncThunk('promotions/fetchAdmin', async (_, { extra, signal }) => {
  const token = adminToken(extra)
  const { data, status } = await axios.get(URL, {
    signal, headers: { Authorization: 'Bearer ' + token },
  }).catch(error => { throw normalizePromotionError(error, signal) })
  signal.throwIfAborted()
  if (status !== 200) throw new Error('El servidor no confirmó la operación de promociones.')
  if (!Array.isArray(data)) throw new Error('La respuesta de promociones no es una lista.')
  return data.map(promotion => promotionFromBackend(validatePromotion(promotion)))
}, { serializeError: serializePromotionError })

export const saveAdminPromotion = createAsyncThunk('promotions/saveAdmin',
  async ({ promotion }, { extra, signal }) => {
    const token = adminToken(extra)
    const body = promotionToBackend(promotion)
    const config = { signal, headers: { Authorization: 'Bearer ' + token } }
    const { data, status } = await (promotion.id == null
      ? axios.post(URL, body, config)
      : axios.put(API_BASE_URL + promotionPath(promotion.id), body, config)
    ).catch(error => { throw normalizePromotionError(error, signal) })
    signal.throwIfAborted()
    if (status !== (promotion.id == null ? 201 : 200)) {
      throw new Error('El servidor no confirmó la operación de promociones.')
    }
    return promotionFromBackend(validatePromotion(data, promotion.id))
  }, { serializeError: serializePromotionError })

export const toggleAdminPromotion = createAsyncThunk('promotions/toggleAdmin',
  async ({ promotionId, active }, { extra, signal }) => {
    const token = adminToken(extra)
    if (typeof active !== 'boolean') throw new Error('El estado de la promoción no es válido.')
    const { data, status } = await axios.patch(
      API_BASE_URL + promotionPath(promotionId) + (active ? '/activate' : '/deactivate'),
      undefined, { signal, headers: { Authorization: 'Bearer ' + token } },
    ).catch(error => { throw normalizePromotionError(error, signal) })
    signal.throwIfAborted()
    if (status !== 200) throw new Error('El servidor no confirmó la operación de promociones.')
    const saved = validatePromotion(data, promotionId)
    if (saved.active !== active) throw new Error('El servidor no confirmó el estado de la promoción.')
    return promotionFromBackend(saved)
  }, { serializeError: serializePromotionError })

export const fetchPublicPromotions = createAsyncThunk('promotions/fetchPublic',
  async (_, { signal }) => {
    let response
    try {
      // Este GET es público y NO lleva el token de sesión.
      response = await axios.get(URL + '/public', { signal })
    } catch (error) {
      const normalized = normalizePromotionError(error, signal)
      if (typeof normalized?.status === 'number') {
        throw Object.assign(new Error('No pudimos cargar las promociones (HTTP ' + normalized.status + ').'),
          { status: normalized.status })
      }
      throw normalized
    }
    signal.throwIfAborted()
    if (response.status !== 200) {
      throw new Error('El servidor no confirmó la operación de promociones.')
    }
    if (!Array.isArray(response.data)) throw new Error('La respuesta de promociones no es una lista.')
    return response.data.map(publicPromotionFromBackend)
  },
  {
    serializeError: serializePromotionError,
    // Una segunda lectura simultánea comparte la primera.
    condition: (_, { getState }) => getState()?.promotions?.public?.status !== 'loading',
  })

const emptyAdmin = () => ({
  ownerId: null, generation: null, items: [], status: 'idle', loaded: false,
  error: '', requestId: null, mutationRequestId: null, busyId: null,
})
const emptyPublic = () => ({ items: [], status: 'idle', error: '', requestId: null })
const initialState = () => ({ admin: emptyAdmin(), public: emptyPublic() })
const sameAdminSession = (admin, scope) => admin.ownerId === scope.ownerId
  && admin.generation === scope.generation

function ensureAdminSession(state, scope) {
  if (!sameAdminSession(state.admin, scope)) {
    state.admin = { ...emptyAdmin(), ownerId: scope.ownerId, generation: scope.generation }
  }
}

function startAdminMutation(state, action, busyId) {
  if (action.meta.arg.ownerId == null) return
  ensureAdminSession(state, action.meta.arg)
  state.admin.mutationRequestId = action.meta.requestId
  state.admin.busyId = busyId
  state.admin.error = ''
  // Una respuesta GET anterior no puede restaurar los datos al guardar.
  state.admin.requestId = null
  state.admin.status = state.admin.loaded ? 'succeeded' : 'idle'
}

function saveAdminMutation(state, action) {
  if (!sameAdminSession(state.admin, action.meta.arg)
    || state.admin.mutationRequestId !== action.meta.requestId) return
  const saved = action.payload
  const existing = state.admin.items.findIndex(item => item.id === saved.id)
  if (existing >= 0) state.admin.items[existing] = saved
  else state.admin.items.push(saved)
  state.admin.busyId = null
  state.admin.mutationRequestId = null
  state.admin.error = ''
  // Si se editó sin completar antes el GET, el listado se recupera en la vista.
  state.admin.status = state.admin.loaded ? 'succeeded' : 'idle'
}

function failAdminMutation(state, action) {
  if (!sameAdminSession(state.admin, action.meta.arg)
    || state.admin.mutationRequestId !== action.meta.requestId) return
  state.admin.busyId = null
  state.admin.mutationRequestId = null
  if (!action.meta.aborted && !action.meta.condition) state.admin.error = action.error.message
}

const promotionsSlice = createSlice({
  name: 'promotions',
  initialState: initialState(),
  reducers: {
    promotionsSessionCleared(state) { state.admin = emptyAdmin() },
    publicPromotionsInvalidated(state) { state.public = emptyPublic() },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchAdminPromotions.pending, (state, action) => {
        if (action.meta.arg.ownerId == null) return
        ensureAdminSession(state, action.meta.arg)
        if (state.admin.mutationRequestId) return
        state.admin.requestId = action.meta.requestId
        state.admin.status = 'loading'
        state.admin.error = ''
      })
      .addCase(fetchAdminPromotions.fulfilled, (state, action) => {
        if (!sameAdminSession(state.admin, action.meta.arg)
          || state.admin.requestId !== action.meta.requestId) return
        state.admin.items = action.payload
        state.admin.status = 'succeeded'
        state.admin.loaded = true
        state.admin.error = ''
        state.admin.requestId = null
      })
      .addCase(fetchAdminPromotions.rejected, (state, action) => {
        if (!sameAdminSession(state.admin, action.meta.arg)
          || state.admin.requestId !== action.meta.requestId) return
        state.admin.requestId = null
        if (action.meta.aborted || action.meta.condition) {
          state.admin.status = state.admin.loaded ? 'succeeded' : 'idle'
        } else {
          state.admin.status = 'failed'
          state.admin.error = action.error.message
        }
      })
      .addCase(saveAdminPromotion.pending, (state, action) =>
        startAdminMutation(state, action, action.meta.arg.promotion?.id ?? 'new'))
      .addCase(saveAdminPromotion.fulfilled, saveAdminMutation)
      .addCase(saveAdminPromotion.rejected, failAdminMutation)
      .addCase(toggleAdminPromotion.pending, (state, action) =>
        startAdminMutation(state, action, action.meta.arg.promotionId))
      .addCase(toggleAdminPromotion.fulfilled, saveAdminMutation)
      .addCase(toggleAdminPromotion.rejected, failAdminMutation)
      .addCase(fetchPublicPromotions.pending, (state, action) => {
        state.public = { items: [], status: 'loading', error: '', requestId: action.meta.requestId }
      })
      .addCase(fetchPublicPromotions.fulfilled, (state, action) => {
        if (state.public.requestId !== action.meta.requestId) return
        state.public = { items: action.payload, status: 'succeeded', error: '', requestId: null }
      })
      .addCase(fetchPublicPromotions.rejected, (state, action) => {
        if (state.public.requestId !== action.meta.requestId) return
        state.public = { items: [],
          status: action.meta.aborted || action.meta.condition ? 'idle' : 'failed',
          error: action.meta.aborted || action.meta.condition ? '' : action.error.message,
          requestId: null }
      })
  },
})

export const { promotionsSessionCleared, publicPromotionsInvalidated } = promotionsSlice.actions
export default promotionsSlice.reducer
