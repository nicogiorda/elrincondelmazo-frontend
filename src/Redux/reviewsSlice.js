import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import axios from 'axios'
import { API_BASE_URL } from '../services/httpClient.js'
import { reviewPath, normalizeReviewError } from '../services/reviewsApi.js'

// El método HTTP se lee donde se define el thunk, igual que en postSlice.js.
// Las reseñas GET son públicas; solo POST utiliza JWT.
const serializeReviewError = error => ({
  name: typeof error?.name === 'string' ? error.name : 'Error',
  message: typeof error?.message === 'string' ? error.message : 'No pudimos completar la operación.',
  ...(typeof error?.status === 'number' ? { status: error.status } : {}),
  ...(typeof error?.code === 'string' ? { code: error.code } : {}),
})

export const fetchProductReviews = createAsyncThunk('reviews/fetchProduct',
  async ({ productId }, { signal }) => {
    const { data } = await axios.get(API_BASE_URL + reviewPath(productId), { signal })
      .catch(error => { throw normalizeReviewError(error, signal) })
    signal.throwIfAborted()
    if (!Array.isArray(data)) throw new Error('La respuesta de reseñas no es una lista')
    return data
  }, { serializeError: serializeReviewError })

export const publishProductReview = createAsyncThunk('reviews/publishProduct',
  async ({ productId, rating, comment }, { extra, signal }) => {
    const token = extra?.reviewsToken?.()
    if (!token) throw new Error('Ingresá para publicar una reseña.')
    const { data, status } = await axios.post(
      API_BASE_URL + reviewPath(productId),
      { rating, comment },
      { signal, headers: { Authorization: 'Bearer ' + token } },
    ).catch(error => { throw normalizeReviewError(error, signal) })
    signal.throwIfAborted()
    if (status !== 201 || !Number.isSafeInteger(data?.id) || data.id <= 0
      || data.productId !== Number(productId)) {
      throw new Error('La respuesta no contiene la reseña esperada.')
    }
    return data
  }, { serializeError: serializeReviewError })

const emptyPublication = () => ({
  ownerId: null, generation: null, productId: null,
  busy: false, error: '', requestId: null,
})
const initialState = () => ({
  byProduct: {}, errors: {}, reads: {}, publication: emptyPublication(),
})

const reviewsSlice = createSlice({
  name: 'reviews',
  initialState: initialState(),
  reducers: {
    reviewSessionCleared(state) {
      // Las reseñas GET son públicas: cerrar sesión no borra su caché.
      state.publication = emptyPublication()
    },
    reviewRetryRequested(state, action) {
      delete state.errors[action.payload.productId]
      delete state.reads[action.payload.productId]
      // No borrar datos válidos ni reintentar automáticamente.
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchProductReviews.pending, (state, action) => {
        const id = action.meta.arg.productId
        state.reads[id] = action.meta.requestId
        delete state.errors[id]
      })
      .addCase(fetchProductReviews.fulfilled, (state, action) => {
        const id = action.meta.arg.productId
        if (state.reads[id] !== action.meta.requestId) return
        state.byProduct[id] = action.payload
        delete state.errors[id]
        delete state.reads[id]
      })
      .addCase(fetchProductReviews.rejected, (state, action) => {
        const id = action.meta.arg.productId
        if (state.reads[id] !== action.meta.requestId) return
        delete state.reads[id]
        if (!action.meta.aborted && !action.meta.condition) {
          state.errors[id] = 'No pudimos cargar las reseñas.'
        }
      })
      .addCase(publishProductReview.pending, (state, action) => {
        const { ownerId, generation, productId } = action.meta.arg
        if (ownerId == null) return
        state.publication = { ownerId, generation, productId,
          busy: true, error: '', requestId: action.meta.requestId }
      })
      .addCase(publishProductReview.fulfilled, (state, action) => {
        const { ownerId, generation, productId } = action.meta.arg
        const current = state.publication
        if (current.ownerId !== ownerId || current.generation !== generation
          || current.requestId !== action.meta.requestId) return
        const previous = state.byProduct[productId] ?? []
        state.byProduct[productId] = [action.payload,
          ...previous.filter(review => review.id !== action.payload.id)]
        // Un GET iniciado antes de la publicación no debe borrar la nueva reseña.
        delete state.reads[productId]
        delete state.errors[productId]
        state.publication = { ...current, busy: false, error: '', requestId: null }
      })
      .addCase(publishProductReview.rejected, (state, action) => {
        const { ownerId, generation } = action.meta.arg
        const current = state.publication
        if (current.ownerId !== ownerId || current.generation !== generation
          || current.requestId !== action.meta.requestId) return
        state.publication = { ...current, busy: false,
          error: action.meta.aborted || action.meta.condition ? '' : action.error.message,
          requestId: null }
      })
  },
})

export const { reviewSessionCleared, reviewRetryRequested } = reviewsSlice.actions
export default reviewsSlice.reducer
