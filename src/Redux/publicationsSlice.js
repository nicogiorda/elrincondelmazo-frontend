import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import axios from 'axios'
import { API_BASE_URL } from '../config/api.js'
import {
  normalizePublicationError, publicationPath, validatePublicationsPage,
  validatePublication, validatePublicationPhoto,
} from '../utils/publicationValidation.js'

export const PUBLICATIONS_TTL = 60_000
const newestFirst = (a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || b.id - a.id
const emptyState = () => ({
  ownerId: null, generation: null,
  items: [], updatedAt: 0, loading: false, loadError: '',
  busyId: null, operationError: '',
  listRequestId: null, mutationRequestId: null, operationRevision: 0,
})
const sameSession = (state, arg) => state.ownerId === arg.userId && state.generation === arg.generation
const isCurrent = (state, action, field) => sameSession(state, action.meta.arg)
  && state[field] === action.meta.requestId
function ensureSession(state, arg) {
  if (sameSession(state, arg)) return
  Object.assign(state, emptyState())
  state.ownerId = arg.userId
  state.generation = arg.generation
}
const errorMessage = (error) => error?.status === 404
  ? 'La publicación ya no está disponible. Actualizá el listado.'
  : error?.status === 403 ? 'No tenés permiso para modificar esta publicación.'
    : error?.message || 'No pudimos guardar la publicación.'

// Conserva status HTTP en rejected sin try/catch redundante dentro del thunk.
const serializeError = (error) => ({
  name: error?.name || 'Error', message: error?.message || 'Error de red',
  status: error?.status ?? null, code: error?.code,
})
function credentials(extra, signal, userId) {
  const token = extra.publicationToken()
  if (!token || userId == null) throw new Error('Ingresá para guardar la publicación.')
  return { userId, token, signal }
}

// Cada createAsyncThunk muestra el verbo HTTP de Axios que realmente envía.
// Solo se comparten validaciones y mensajes, no otras funciones que hagan red.
export const fetchOwnPublications = createAsyncThunk(
  'publications/fetchOwn',
  async ({ userId }, { extra, signal }) => {
    const { token } = credentials(extra, signal, userId)
    const headers = { Authorization: 'Bearer ' + token }
    const items = []
    let page = 0, totalPages
    do {
      const response = await axios.get(API_BASE_URL + '/products/mine?page=' + page + '&size=20',
        { headers, signal }).catch(error => { throw normalizePublicationError(error) })
      signal.throwIfAborted()
      if (response.status !== 200) throw new Error('El servidor no confirmó la consulta de publicaciones.')
      const result = validatePublicationsPage(response.data, page, userId)
      items.push(...result.content)
      totalPages = result.totalPages
      page += 1
    } while (page < totalPages && !signal.aborted)
    signal.throwIfAborted()
    return { items: items.sort(newestFirst), updatedAt: Date.now() }
  }, { serializeError },
)

export const saveOwnPublication = createAsyncThunk(
  'publications/save',
  async ({ body, id, userId }, { extra, signal }) => {
    const { token } = credentials(extra, signal, userId)
    const config = { headers: { Authorization: 'Bearer ' + token }, signal }
    const response = await (id == null
      ? axios.post(API_BASE_URL + '/products', body, config)
      : axios.put(API_BASE_URL + publicationPath(id), body, config)
    ).catch(error => { throw normalizePublicationError(error) })
    signal.throwIfAborted()
    if (response.status !== (id == null ? 201 : 200)) {
      throw new Error('El servidor no confirmó el guardado de la publicación.')
    }
    return validatePublication(response.data, userId, id)
  }, { serializeError },
)

export const setOwnPublicationStatus = createAsyncThunk(
  'publications/changeStatus',
  async ({ id, action, userId }, { extra, signal }) => {
    const { token } = credentials(extra, signal, userId)
    if (!['pause', 'resume'].includes(action)) throw new Error('La acción de publicación no es válida.')
    const response = await axios.patch(API_BASE_URL + publicationPath(id) + '/' + action,
      undefined, { signal, headers: { Authorization: 'Bearer ' + token } },
    ).catch(error => { throw normalizePublicationError(error) })
    signal.throwIfAborted()
    if (response.status !== 200) throw new Error('El servidor no confirmó el cambio de estado.')
    return validatePublication(response.data, userId, id)
  }, { serializeError },
)

export const removeOwnPublication = createAsyncThunk(
  'publications/delete',
  async ({ id, userId }, { extra, signal }) => {
    const { token } = credentials(extra, signal, userId)
    const response = await axios.delete(API_BASE_URL + publicationPath(id), {
      headers: { Authorization: 'Bearer ' + token }, signal,
    }).catch(error => { throw normalizePublicationError(error) })
    signal.throwIfAborted()
    if (response.status !== 204) throw new Error('El servidor no confirmó la eliminación.')
    return id
  }, { serializeError },
)

export const uploadOwnPublicationPhoto = createAsyncThunk(
  'publications/uploadPhoto',
  async ({ file, userId }, { extra, signal }) => {
    const { token } = credentials(extra, signal, userId)
    const body = new FormData()
    body.append('file', file)
    const response = await axios.post(API_BASE_URL + '/products/images', body, {
      headers: { Authorization: 'Bearer ' + token }, signal,
    }).catch(error => { throw normalizePublicationError(error) })
    signal.throwIfAborted()
    if (response.status !== 201) throw new Error('El servidor no confirmó la subida de la imagen.')
    return validatePublicationPhoto(response.data)
  }, { serializeError },
)

function mutationStarted(state, action) {
  ensureSession(state, action.meta.arg)
  state.listRequestId = null // La consulta anterior no puede sobrescribir una edición.
  state.loading = false
  state.busyId = action.meta.arg.busyId
  state.operationError = ''
  state.mutationRequestId = action.meta.requestId
}
function mutationFinished(state, action) {
  if (!isCurrent(state, action, 'mutationRequestId')) return false
  state.mutationRequestId = null
  state.busyId = null
  return true
}
function mutationFailed(state, action) {
  if (!mutationFinished(state, action) || action.meta.aborted) return
  state.operationError = errorMessage(action.error)
}
function addSaved(state, action) {
  if (!mutationFinished(state, action)) return
  const saved = action.payload
  state.items = [saved, ...state.items.filter(item => item.id !== saved.id)].sort(newestFirst)
  state.loadError = ''
}
const publicationsSlice = createSlice({
  name: 'publications',
  initialState: emptyState(),
  reducers: {
    publicationsSessionCleared: emptyState,
    publicationLocalError(state, action) { state.operationError = action.payload },
    publicationMutationReleased(state) { state.operationRevision += 1 },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchOwnPublications.pending, (state, action) => {
        ensureSession(state, action.meta.arg)
        state.loading = true
        state.loadError = ''
        state.operationError = ''
        state.listRequestId = action.meta.requestId
      })
      .addCase(fetchOwnPublications.fulfilled, (state, action) => {
        if (!isCurrent(state, action, 'listRequestId')) return
        state.items = action.payload.items
        state.updatedAt = action.payload.updatedAt
        state.loading = false
        state.listRequestId = null
        state.loadError = ''
      })
      .addCase(fetchOwnPublications.rejected, (state, action) => {
        if (!isCurrent(state, action, 'listRequestId')) return
        state.listRequestId = null
        state.loading = false
        if (action.meta.aborted) return
        state.loadError = action.error.status === 403
          ? 'No tenés permiso para consultar tus publicaciones.'
          : action.error.message
      })
      .addCase(saveOwnPublication.pending, mutationStarted)
      .addCase(saveOwnPublication.fulfilled, addSaved)
      .addCase(saveOwnPublication.rejected, mutationFailed)
      .addCase(setOwnPublicationStatus.pending, mutationStarted)
      .addCase(setOwnPublicationStatus.fulfilled, addSaved)
      .addCase(setOwnPublicationStatus.rejected, mutationFailed)
      .addCase(removeOwnPublication.pending, mutationStarted)
      .addCase(removeOwnPublication.fulfilled, (state, action) => {
        if (!mutationFinished(state, action)) return
        state.items = state.items.filter(item => item.id !== action.payload)
      })
      .addCase(removeOwnPublication.rejected, mutationFailed)
      .addCase(uploadOwnPublicationPhoto.pending, mutationStarted)
      .addCase(uploadOwnPublicationPhoto.fulfilled, (state, action) => { mutationFinished(state, action) })
      .addCase(uploadOwnPublicationPhoto.rejected, mutationFailed)
  },
})
export const { publicationsSessionCleared, publicationLocalError,
  publicationMutationReleased } = publicationsSlice.actions
export default publicationsSlice.reducer
