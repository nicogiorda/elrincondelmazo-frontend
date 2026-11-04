import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
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
  publicView: { viewerId: null, ownerId: null, album: null,
    loading: false, error: '', requestId: null },
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
    const response = await axios.delete(API_BASE_URL + '/albums/me/cards/' + cardId, {
      signal, headers: tokenHeader(extra),
    }).catch(error => { throw albumError(error) })
    signal.throwIfAborted()
    if (response.status !== 204) throw new Error('El servidor no confirmó la eliminación.')
    return cardId
  }, { serializeError })

export const changeAlbumVisibility = createAsyncThunk('album/changeVisibility',
  async ({ visibility, ownerId }, { extra, signal }) => {
    const response = await axios.patch(API_BASE_URL + '/albums/me/visibility',
      { visibility }, { signal, headers: tokenHeader(extra) }).catch(error => { throw albumError(error) })
    signal.throwIfAborted()
    const album = validateAlbum(response.data, ownerId)
    if (album.visibility !== visibility) throw new Error('El servidor no confirmó la visibilidad.')
    return album
  }, { serializeError })

// La vista ajena tiene un scope independiente: nunca se mezcla con /albums/me.
export const loadPublicAlbum = createAsyncThunk('album/loadPublic',
  async ({ ownerId }, { extra, signal }) => {
    const response = await axios.get(API_BASE_URL + '/albums/users/' + ownerId, {
      signal, headers: tokenHeader(extra),
    }).catch(error => {
      const normalized = albumError(error)
      if (normalized.status === 404) {
        throw Object.assign(new Error('Este álbum no está disponible.'), { status: 404 })
      }
      throw normalized
    })
    signal.throwIfAborted()
    const data = validateAlbum(response.data, ownerId)
    // Defensive validation: an owner-only PRIVATE response must never appear in a visitor's UI.
    if (data.visibility !== 'PUBLIC') {
      throw Object.assign(new Error('Este álbum no está disponible.'), { status: 404 })
    }
    return data
  }, { serializeError })

// Como updatePost.fulfilled en la Demo Redux II: la respuesta de Axios
// actualiza directamente el array global, sin reconstruirlo con otro GET.
function mutationStarted(state, action) {
  scoped(state, action.meta.arg.ownerId)
  // Un GET anterior no puede pisar la respuesta confirmada de un POST/PATCH/DELETE.
  state.requestId = null
  state.purchasesRequestId = null
  state.loading = false
  state.loadingPurchases = false
  state.saving = true
  state.mutationError = ''
  state.mutationRequestId = action.meta.requestId
}

function mutationFinished(state, action) {
  if (state.ownerId !== action.meta.arg.ownerId
    || state.mutationRequestId !== action.meta.requestId) return false
  state.saving = false
  state.mutationRequestId = null
  return true
}

function mutationFailed(state, action) {
  if (!mutationFinished(state, action) || action.meta.aborted || action.meta.condition) return
  state.mutationError = action.error.message
}

function putCardInAlbum(state, sectionKey, card) {
  if (!state.album || !card) return
  // Sacar la posición anterior, si ya existía (PATCH/PUT).
  for (const section of state.album.sections) {
    const previous = section.cards.findIndex(entry => entry.id === card.id)
    if (previous !== -1) section.cards.splice(previous, 1)
  }
  const target = state.album.sections.find(section => section.key === sectionKey)
  if (!target) return
  // El PATCH puede reemplazar una carta que ocupaba el casillero.
  const occupied = target.cards.findIndex(entry =>
    entry.pageNumber === card.pageNumber && entry.slotIndex === card.slotIndex)
  if (occupied !== -1) target.cards.splice(occupied, 1)
  target.cards.push(card)
  // El backend desbloquea la página siguiente al llenar los 9 casilleros.
  if (target.cards.filter(entry => entry.pageNumber === target.pageCount).length === 9) {
    target.pageCount += 1
  }
}

function removeCardFromAlbum(state, cardId) {
  if (!state.album) return
  for (const section of state.album.sections) {
    const index = section.cards.findIndex(card => card.id === cardId)
    if (index !== -1) section.cards.splice(index, 1)
  }
}

const albumSlice = createSlice({
  name: 'album',
  initialState: initialState(),
  reducers: {
    albumCleared: initialState,
    albumMutationErrorCleared(state) { state.mutationError = '' },
    publicAlbumCleared(state) {
      state.publicView = initialState().publicView
    },
  },
  extraReducers: builder => {
    builder
      .addCase(sessionEnded, () => initialState())
      .addCase(sessionAuthenticated, () => initialState())
      .addCase(loadPublicAlbum.pending, (state, action) => {
        const { viewerId, ownerId } = action.meta.arg
        if (state.publicView.viewerId !== viewerId || state.publicView.ownerId !== ownerId) {
          state.publicView = { ...initialState().publicView, viewerId, ownerId }
        }
        state.publicView.album = null
        state.publicView.loading = true
        state.publicView.error = ''
        state.publicView.requestId = action.meta.requestId
      })
      .addCase(loadPublicAlbum.fulfilled, (state, action) => {
        const view = state.publicView
        if (view.viewerId !== action.meta.arg.viewerId || view.ownerId !== action.meta.arg.ownerId
          || view.requestId !== action.meta.requestId) return
        view.album = action.payload
        view.loading = false
        view.requestId = null
      })
      .addCase(loadPublicAlbum.rejected, (state, action) => {
        const view = state.publicView
        if (view.viewerId !== action.meta.arg.viewerId || view.ownerId !== action.meta.arg.ownerId
          || view.requestId !== action.meta.requestId) return
        view.album = null
        view.loading = false
        view.requestId = null
        if (!action.meta.aborted && !action.meta.condition) view.error = action.error.message
      })
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
      .addCase(addAlbumPurchase.pending, mutationStarted)
      .addCase(addAlbumPurchase.fulfilled, (state, action) => {
        if (!mutationFinished(state, action)) return
        putCardInAlbum(state, action.meta.arg.section, action.payload)
        const item = state.purchases.find(entry => entry.orderItemId === action.meta.arg.orderItemId)
        if (item) {
          item.usedQuantity += 1
          item.availableQuantity = Math.max(0, item.purchasedQuantity - item.usedQuantity)
        }
      })
      .addCase(addAlbumPurchase.rejected, mutationFailed)
      .addCase(addAlbumManual.pending, mutationStarted)
      .addCase(addAlbumManual.fulfilled, (state, action) => {
        if (!mutationFinished(state, action)) return
        putCardInAlbum(state, action.meta.arg.section, action.payload)
      })
      .addCase(addAlbumManual.rejected, mutationFailed)
      .addCase(moveAlbumCard.pending, mutationStarted)
      .addCase(moveAlbumCard.fulfilled, (state, action) => {
        if (!mutationFinished(state, action)) return
        putCardInAlbum(state, action.meta.arg.section, action.payload)
      })
      .addCase(moveAlbumCard.rejected, mutationFailed)
      .addCase(removeAlbumCard.pending, mutationStarted)
      .addCase(removeAlbumCard.fulfilled, (state, action) => {
        if (!mutationFinished(state, action)) return
        removeCardFromAlbum(state, action.payload)
      })
      .addCase(removeAlbumCard.rejected, mutationFailed)
      .addCase(changeAlbumVisibility.pending, mutationStarted)
      .addCase(changeAlbumVisibility.fulfilled, (state, action) => {
        if (!mutationFinished(state, action)) return
        // El endpoint ya devuelve el álbum completo y confirmado.
        state.album = action.payload
      })
      .addCase(changeAlbumVisibility.rejected, mutationFailed)
  },
})

export const { albumCleared, albumMutationErrorCleared, publicAlbumCleared } = albumSlice.actions
export default albumSlice.reducer
