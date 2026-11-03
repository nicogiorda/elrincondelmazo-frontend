import { createAsyncThunk, createEntityAdapter, createSlice } from '@reduxjs/toolkit'
import axios from 'axios'
import { API_BASE_URL } from '../config/api.js'
import { validateProductsPage, validateProductDetail, normalizeProductHttpError } from '../utils/productValidation.js'
import { productIdFrom } from '../utils/productId.js'

// Redux es la única fuente de las entidades públicas.
// La caché conserva solo tareas de coordinación (TTL, solicitudes y versiones).
const productsAdapter = createEntityAdapter()
const initialState = productsAdapter.getInitialState({
  home: null,
  page: null,
  detail: null,
  related: null,
  selection: { status: 'idle', requestId: null, error: '' },
  metadata: {},
})

const queryKey = ({ query, cacheVersion, attempt }) => `${query}:${cacheVersion}:${attempt}`
const detailKey = ({ productId, cacheVersion, attempt }) => `${productId}:${attempt}:${cacheVersion}`

// El coordinador aplica TTL (60 s), deduplicación, cancelación de metadatos,
// invalidación y protección frente a productos desactualizados.
export const fetchProductPage = createAsyncThunk(
  'products/fetchPage',
  async ({ query }, { extra }) => {
    const page = await extra.productCache.loadPage(query, async (search, { signal }) => {
      const { data } = await axios.get(API_BASE_URL + '/products?' + search, { signal })
        .catch(error => { throw normalizeProductHttpError(error) })
      signal.throwIfAborted()
      return validateProductsPage(data)
    })
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
      const product = await extra.productCache.loadProduct(productId, {
        signal,
        fetchProduct: async (id, { signal }) => {
          if (productIdFrom(id) === null) throw new Error('La URL del producto no es válida.')
          const { data } = await axios.get(API_BASE_URL + '/products/' + id, { signal })
            .catch(error => { throw normalizeProductHttpError(error) })
          signal.throwIfAborted()
          return validateProductDetail(data, id)
        },
      })
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

const homeKey = ({ cacheVersion }) => String(cacheVersion)
const relatedKey = ({ collectionId, cacheVersion }) => `${collectionId}:${cacheVersion}`

// Home y relacionados también despachan acciones. No hacen GET desde hooks.
export const fetchHomeProducts = createAsyncThunk(
  'products/fetchHome',
  async (_args, { extra }) => {
    const page = await extra.productCache.loadPage('page=0&size=4', async (search, { signal }) => {
      const { data } = await axios.get(API_BASE_URL + '/products?' + search, { signal })
        .catch(error => { throw normalizeProductHttpError(error) })
      signal.throwIfAborted()
      return validateProductsPage(data)
    })
    return page.content.map(product => product.id)
  },
  {
    condition: (args, { getState }) => {
      const home = getState().products.home
      return !(home?.key === homeKey(args) && ['loading', 'succeeded'].includes(home.status))
    },
  },
)

export const fetchRelatedProducts = createAsyncThunk(
  'products/fetchRelated',
  async ({ collectionId }, { extra }) => {
    const page = await extra.productCache.loadPage(
      'page=0&size=5&collectionId=' + collectionId, async (search, { signal }) => {
        const { data } = await axios.get(API_BASE_URL + '/products?' + search, { signal })
          .catch(error => { throw normalizeProductHttpError(error) })
        signal.throwIfAborted()
        return validateProductsPage(data)
      },
    )
    return page.content.map(product => product.id)
  },
  {
    condition: (args, { getState }) => {
      const related = getState().products.related
      return !(related?.key === relatedKey(args) && ['loading', 'succeeded'].includes(related.status))
    },
  },
)

// createAsyncThunk descarta status/code al serializar Error por defecto.
// El carrito y el editor necesitan distinguir HTTP 403/404 y conexión perdida.
const serializeMetadataError = error => ({
  name: error?.name || 'Error',
  message: error?.message || 'No pudimos consultar el producto.',
  ...(typeof error?.status === 'number' ? { status: error.status } : {}),
  ...(typeof error?.code === 'string' ? { code: error.code } : {}),
})

// El selector de promociones y los metadatos del carrito comparten la misma
// caché. Sus GET también nacen en thunks; el coordinador no importa Axios.
export const fetchSelectionProducts = createAsyncThunk(
  'products/fetchSelection',
  async ({ query }, { extra, signal }) => {
    const page = await extra.productCache.loadPage(query, async (search, { signal: requestSignal }) => {
      const { data } = await axios.get(API_BASE_URL + '/products?' + search, { signal: requestSignal })
        .catch(error => { throw normalizeProductHttpError(error) })
      requestSignal.throwIfAborted()
      return validateProductsPage(data)
    })
    signal.throwIfAborted()
    return page
  }, { serializeError: serializeMetadataError },
)

export const fetchCachedProduct = createAsyncThunk(
  'products/fetchCachedProduct',
  async ({ productId, onlyMissing = false, context = 'detail', revalidate = false }, { extra, signal }) => {
    const product = await extra.productCache.loadProduct(productId, {
      signal, onlyMissing, context, revalidate,
      fetchProduct: async (id, { signal: requestSignal }) => {
        if (productIdFrom(id) === null) throw new Error('La URL del producto no es válida.')
        const { data } = await axios.get(API_BASE_URL + '/products/' + id, { signal: requestSignal })
          .catch(error => { throw normalizeProductHttpError(error) })
        requestSignal.throwIfAborted()
        return validateProductDetail(data, id)
      },
    })
    signal.throwIfAborted()
    return product
  }, { serializeError: serializeMetadataError },
)

const productsSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {
    cachedProduct: productsAdapter.upsertOne,
    removedCachedProduct: productsAdapter.removeOne,
    clearedCachedProducts: productsAdapter.removeAll,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSelectionProducts.pending, (state, action) => {
        state.selection = { status: 'loading', requestId: action.meta.requestId, error: '' }
      })
      .addCase(fetchSelectionProducts.fulfilled, (state, action) => {
        if (state.selection.requestId !== action.meta.requestId) return
        state.selection = { status: 'succeeded', requestId: null, error: '' }
      })
      .addCase(fetchSelectionProducts.rejected, (state, action) => {
        if (state.selection.requestId !== action.meta.requestId) return
        state.selection = { status: action.meta.aborted ? 'idle' : 'failed',
          requestId: null, error: action.meta.aborted ? '' : action.error.message }
      })
      .addCase(fetchCachedProduct.pending, (state, action) => {
        state.metadata[action.meta.arg.productId] = {
          status: 'loading', requestId: action.meta.requestId, error: '',
        }
      })
      .addCase(fetchCachedProduct.fulfilled, (state, action) => {
        const id = action.meta.arg.productId
        if (state.metadata[id]?.requestId !== action.meta.requestId) return
        state.metadata[id] = { status: 'succeeded', requestId: null, error: '' }
      })
      .addCase(fetchCachedProduct.rejected, (state, action) => {
        const id = action.meta.arg.productId
        if (state.metadata[id]?.requestId !== action.meta.requestId) return
        state.metadata[id] = { status: action.meta.aborted ? 'idle' : 'failed',
          requestId: null, error: action.meta.aborted ? '' : action.error.message }
      })
      .addCase(fetchHomeProducts.pending, (state, action) => {
        state.home = {
          key: homeKey(action.meta.arg), requestId: action.meta.requestId,
          status: 'loading', ids: [], error: '',
        }
      })
      .addCase(fetchHomeProducts.fulfilled, (state, action) => {
        if (state.home?.requestId !== action.meta.requestId) return
        state.home.ids = action.payload
        state.home.status = 'succeeded'
      })
      .addCase(fetchHomeProducts.rejected, (state, action) => {
        if (state.home?.requestId !== action.meta.requestId) return
        state.home.status = 'failed'
        state.home.error = action.error.message || 'No pudimos cargar los productos recientes.'
      })
      .addCase(fetchRelatedProducts.pending, (state, action) => {
        state.related = {
          key: relatedKey(action.meta.arg), requestId: action.meta.requestId,
          status: 'loading', ids: [], error: '',
        }
      })
      .addCase(fetchRelatedProducts.fulfilled, (state, action) => {
        if (state.related?.requestId !== action.meta.requestId) return
        state.related.ids = action.payload
        state.related.status = 'succeeded'
      })
      .addCase(fetchRelatedProducts.rejected, (state, action) => {
        if (state.related?.requestId !== action.meta.requestId) return
        state.related.status = 'failed'
        state.related.error = action.error.message || 'No pudimos cargar productos relacionados.'
      })
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

export const { cachedProduct, removedCachedProduct, clearedCachedProducts } = productsSlice.actions
export const { selectAll: selectPublicProducts, selectById: selectPublicProductById } =
  productsAdapter.getSelectors((state) => state.products)

export default productsSlice.reducer
