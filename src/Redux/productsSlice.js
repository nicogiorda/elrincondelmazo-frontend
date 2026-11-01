import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'

// El estado Redux almacena únicamente metadatos de la página y referencias por ID.
// La única copia de cada entidad Product sigue en la caché pública normalizada.
const initialState = {
  page: null,
  detail: null,
}

const queryKey = ({ query, cacheVersion, attempt }) => `${query}:${cacheVersion}:${attempt}`
const detailKey = ({ productId, cacheVersion, attempt }) => `${productId}:${attempt}:${cacheVersion}`

// El coordinador aplica TTL (60 s), deduplicación, cancelación de metadatos,
// invalidación y protección frente a productos desactualizados.
export const fetchProductPage = createAsyncThunk(
  'products/fetchPage',
  async ({ query }, { extra }) => {
    const page = await extra.productCache.loadPage(query)
    return {
      ids: page.content.map((product) => product.id),
      number: page.number,
      totalElements: page.totalElements,
      totalPages: page.totalPages,
    }
  },
  {
    condition: (args, { getState }) => {
      const current = getState().products.page
      return !(current?.status === 'loading' && current.key === queryKey(args))
    },
  },
)

export const fetchProductDetail = createAsyncThunk(
  'products/fetchDetail',
  async ({ productId }, { extra, signal, rejectWithValue }) => {
    try {
      const product = await extra.productCache.loadProduct(productId, { signal })
      return { status: product.status }
    } catch (error) {
      if (signal.aborted || error.name === 'AbortError') throw error
      return rejectWithValue({ status: error.status ?? null, message: error.message })
    }
  },
  {
    condition: (args, { getState }) => {
      const current = getState().products.detail
      return !(current?.status === 'loading' && current.key === detailKey(args))
    },
  },
)

const productsSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchProductPage.pending, (state, action) => {
        state.page = {
          key: queryKey(action.meta.arg),
          query: action.meta.arg.query,
          attempt: action.meta.arg.attempt,
          cacheVersion: action.meta.arg.cacheVersion,
          requestId: action.meta.requestId,
          status: 'loading',
          ids: [],
          number: 0,
          totalElements: 0,
          totalPages: 0,
          error: '',
        }
      })
      .addCase(fetchProductPage.fulfilled, (state, action) => {
        if (state.page?.requestId !== action.meta.requestId) return
        Object.assign(state.page, { ...action.payload, status: 'succeeded', error: '' })
      })
      .addCase(fetchProductPage.rejected, (state, action) => {
        if (state.page?.requestId !== action.meta.requestId) return
        state.page.status = 'failed'
        state.page.error = action.error.message || 'No pudimos cargar el catálogo.'
        state.page.ids = []
      })
      .addCase(fetchProductDetail.pending, (state, action) => {
        state.detail = {
          key: detailKey(action.meta.arg),
          requestId: action.meta.requestId,
          status: 'loading',
          notFound: false,
          error: '',
        }
      })
      .addCase(fetchProductDetail.fulfilled, (state, action) => {
        if (state.detail?.requestId !== action.meta.requestId) return
        state.detail.status = 'succeeded'
        state.detail.notFound = !['ACTIVO', 'AGOTADO'].includes(action.payload.status)
      })
      .addCase(fetchProductDetail.rejected, (state, action) => {
        if (state.detail?.requestId !== action.meta.requestId) return
        if (action.meta.aborted) {
          state.detail = null
          return
        }
        const error = action.payload
        state.detail.status = 'failed'
        state.detail.notFound = error?.status === 404
        state.detail.error = state.detail.notFound ? '' : error?.message || action.error.message || 'No pudimos cargar el producto.'
      })
  },
})

export default productsSlice.reducer
