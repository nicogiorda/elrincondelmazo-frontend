import { createAsyncThunk, createSlice, isAnyOf } from '@reduxjs/toolkit'
import axios from 'axios'
import { API_BASE_URL } from '../config/api.js'
import { sessionAuthenticated, sessionEnded } from './userSlice.js'

const initialState = () => ({
  ownerId: null,
  album: null,
  purchases: [],
  loading: false,
  loadingPurchases: false,
  saving: false,
  error: '',
  purchasesError: '',
  mutationError: '',
  requestId: null,
  purchasesRequestId: null,
  mutationRequestId: null,
})

function scoped(state, ownerId) {
  if (state.ownerId === ownerId) return
  Object.assign(state, initialState())
  state.ownerId = ownerId
}

function albumError(error) {
  const status = error?.response?.status ?? error?.status
  const text = error?.response?.data?.message || error?.message
  return Object.assign(new Error(
    status === 401 ? 'Tu sesión venció. Volvé a ingresar.'
      : status === 409 ? text || 'La posición está ocupada o ya no quedan ejemplares disponibles.'
        : status === 404 ? 'El recurso no existe o no pertenece a tu cuenta.'
          : text || 'No pudimos actualizar tu álbum.',
  ), { status })
}

const serializeError = error => ({
  name: error?.name || 'Error',
  message: error?.message || 'Error del álbum.',
  ...(Number.isInteger(error?.status) ? { status: error.status } : {}),
})

function tokenHeader(extra) {
  const token = extra?.albumToken?.()
  if (!token) throw Object.assign(new Error('Ingresá para usar tu álbum.'), { status: 401 })
  return { Authorization: 'Bearer ' + token }
}

function validateAlbum(data, ownerId) {
  if (!data || data.userId !== ownerId || !Array.isArray(data.sections)
    || !data.sections.every(section => typeof section.key === 'string'
      && Number.isInteger(section.pageCount) && section.pageCount >= 1
      && Array.isArray(section.cards))) {
    throw new Error('El servidor devolvió un álbum inválido.')
  }
  return data
}

function validPurchases(data) {
  if (!Array.isArray(data) || !data.every(item => Number.isSafeInteger(item.orderItemId)
    && Number.isInteger(item.purchasedQuantity) && Number.isInteger(item.availableQuantity))) {
    throw new Error('La respuesta de compras disponibles es inválida.')
  }
  return data
}

export const loadOwnAlbum = createAsyncThunk('album/loadOwn',
  async ({ ownerId }, { extra, signal }) => {
    const response = await axios.get(API_BASE_URL + '/albums/me', {
      signal, headers: tokenHeader(extra),
    }).catch(error => { throw albumError(error) })
    signal.throwIfAborted()
    return validateAlbum(response.data, ownerId)
  }, { serializeError })

export const loadAlbumPurchases = createAsyncThunk('album/loadPurchases',
  async (_, { extra, signal }) => {
    const response = await axios.get(API_BASE_URL + '/albums/me/purchases', {
      signal, headers: tokenHeader(extra),
    }).catch(error => { throw albumError(error) })
    signal.throwIfAborted()
    return validPurchases(response.data)
  }, { serializeError })

export const addAlbumPurchase = createAsyncThunk('album/addPurchase',
  async ({ orderItemId, section, pageNumber, slotIndex }, { extra, signal }) => {
    const response = await axios.post(API_BASE_URL + '/albums/me/cards/purchase',
      { orderItemId, section, pageNumber, slotIndex },
      { signal, headers: tokenHeader(extra) }).catch(error => { throw albumError(error) })
    signal.throwIfAborted()
    if (response.status !== 201) throw new Error('El servidor no confirmó la carta.')
    return response.data
  }, { serializeError })

export const addAlbumManual = createAsyncThunk('album/addManual',
  async ({ section, pageNumber, slotIndex, name, image }, { extra, signal }) => {
    const form = new FormData()
    form.append('section', section)
    form.append('pageNumber', String(pageNumber))
    form.append('slotIndex', String(slotIndex))
    form.append('name', name)
    form.append('image', image)
    const response = await axios.post(API_BASE_URL + '/albums/me/cards/manual', form, {
      signal, headers: tokenHeader(extra),
    }).catch(error => { throw albumError(error) })
    signal.throwIfAborted()
    if (response.status !== 201) throw new Error('El servidor no confirmó el registro.')
    return response.data
  }, { serializeError })

export const moveAlbumCard = createAsyncThunk('album/moveCard',
  async ({ cardId, section, pageNumber, slotIndex, replaceExisting = false }, { extra, signal }) => {
    const response = await axios.patch(API_BASE_URL + '/albums/me/cards/' + cardId,
      { section, pageNumber, slotIndex, replaceExisting },
      { signal, headers: tokenHeader(extra) }).catch(error => { throw albumError(error) })
    signal.throwIfAborted()
    return response.data
  }, { serializeError })

export const removeAlbumCard = createAsyncThunk('album/removeCard',
  async ({ cardId }, { extra, signal }) => {
    await axios.delete(API_BASE_URL + '/albums/me/cards/' + cardId, {
      signal, headers: tokenHeader(extra),
    }).catch(error => { throw albumError(error) })
    signal.throwIfAborted()
    return cardId
  }, { serializeError })

export const changeAlbumVisibility = createAsyncThunk('album/changeVisibility',
  async ({ visibility }, { extra, signal }) => {
    const response = await axios.patch(API_BASE_URL + '/albums/me/visibility',
      { visibility }, { signal, headers: tokenHeader(extra) }).catch(error => { throw albumError(error) })
    signal.throwIfAborted()
    return response.data
  }, { serializeError })

const mutations = [addAlbumPurchase, addAlbumManual, moveAlbumCard, removeAlbumCard, changeAlbumVisibility]
const albumSlice = createSlice({
  name: 'album',
  initialState: initialState(),
  reducers: {
    albumCleared: initialState,
    albumMutationErrorCleared(state) { state.mutationError = '' },
  },
  extraReducers: builder => {
    builder
      .addCase(sessionEnded, () => initialState())
      .addCase(sessionAuthenticated, () => initialState())
      .addCase(loadOwnAlbum.pending, (state, action) => {
        scoped(state, action.meta.arg.ownerId)
        state.loading = true
        state.error = ''
        state.requestId = action.meta.requestId
      })
      .addCase(loadOwnAlbum.fulfilled, (state, action) => {
        if (state.ownerId !== action.meta.arg.ownerId || state.requestId !== action.meta.requestId) return
        state.album = action.payload
        state.loading = false
        state.requestId = null
      })
      .addCase(loadOwnAlbum.rejected, (state, action) => {
        if (state.ownerId !== action.meta.arg.ownerId || state.requestId !== action.meta.requestId) return
        state.loading = false
        state.requestId = null
        if (!action.meta.aborted) state.error = action.error.message
      })
      .addCase(loadAlbumPurchases.pending, (state, action) => {
        scoped(state, action.meta.arg.ownerId)
        state.loadingPurchases = true
        state.purchasesError = ''
        state.purchasesRequestId = action.meta.requestId
      })
      .addCase(loadAlbumPurchases.fulfilled, (state, action) => {
        if (state.ownerId !== action.meta.arg.ownerId
          || state.purchasesRequestId !== action.meta.requestId) return
        state.purchases = action.payload
        state.loadingPurchases = false
        state.purchasesRequestId = null
      })
      .addCase(loadAlbumPurchases.rejected, (state, action) => {
        if (state.ownerId !== action.meta.arg.ownerId
          || state.purchasesRequestId !== action.meta.requestId) return
        state.loadingPurchases = false
        state.purchasesRequestId = null
        if (!action.meta.aborted) state.purchasesError = action.error.message
      })
      .addMatcher(isAnyOf(...mutations.map(thunk => thunk.pending)), (state, action) => {
        scoped(state, action.meta.arg.ownerId)
        state.saving = true
        state.mutationError = ''
        state.mutationRequestId = action.meta.requestId
      })
      .addMatcher(isAnyOf(...mutations.map(thunk => thunk.fulfilled)), (state, action) => {
        if (state.ownerId !== action.meta.arg.ownerId
          || state.mutationRequestId !== action.meta.requestId) return
        state.saving = false
        state.mutationRequestId = null
      })
      .addMatcher(isAnyOf(...mutations.map(thunk => thunk.rejected)), (state, action) => {
        if (state.ownerId !== action.meta.arg.ownerId
          || state.mutationRequestId !== action.meta.requestId) return
        state.saving = false
        state.mutationRequestId = null
        if (!action.meta.aborted) state.mutationError = action.error.message
      })
  },
})

export const { albumCleared, albumMutationErrorCleared } = albumSlice.actions
export default albumSlice.reducer
