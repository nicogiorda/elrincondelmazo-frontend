import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { getPromotions, getPublicPromotions, savePromotion, setPromotionActive } from '../services/promotionsApi.js'
import { promotionFromBackend, promotionToBackend } from '../utils/promotionMapper.js'

// La clase de Gisele: cada operación HTTP es una acción asíncrona del dominio;
// Axios hace transporte y extraReducers controla pending / fulfilled / rejected.
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
  const data = await getPromotions({ token: adminToken(extra), signal })
  return data.map(promotionFromBackend)
}, { serializeError: serializePromotionError })

export const saveAdminPromotion = createAsyncThunk('promotions/saveAdmin',
  async ({ promotion }, { extra, signal }) => {
    const token = adminToken(extra)
    const data = await savePromotion(promotionToBackend(promotion), promotion.id, { token, signal })
    return promotionFromBackend(data)
  }, { serializeError: serializePromotionError })

export const toggleAdminPromotion = createAsyncThunk('promotions/toggleAdmin',
  async ({ promotionId, active }, { extra, signal }) => {
    const data = await setPromotionActive(promotionId, active, { token: adminToken(extra), signal })
    return promotionFromBackend(data)
  }, { serializeError: serializePromotionError })

export const fetchPublicPromotions = createAsyncThunk('promotions/fetchPublic',
  async (_, { signal }) => getPublicPromotions({ signal }),
  {
    serializeError: serializePromotionError,
    // Una segunda lectura simultanea del Home comparte la primera; invalidar
    // una visita reinicia el estado y permite su nuevo GET.
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
