import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import axios from 'axios'
import { API_BASE_URL } from '../config/api.js'

export const emptyCatalogFilters = () => ({
  search: '', type: '', collection: '', minPrice: '', maxPrice: '', page: 0,
})

const initialState = {
  filters: emptyCatalogFilters(),
  byLocation: {},
  locationKey: null,
  collections: [],
  collectionsStatus: 'idle',
  collectionsError: '',
  collectionsRequestId: null,
}

// GET público compartido por Home, Catálogo, publicación y promociones.
// createAsyncThunk emite automáticamente pending / fulfilled / rejected.
export const fetchCollections = createAsyncThunk(
  'catalog/fetchCollections',
  async (_unused, { signal }) => {
    const { data } = await axios.get(API_BASE_URL + '/collections', { signal })
    if (!Array.isArray(data)) throw new Error('La respuesta de colecciones no es una lista.')
    return data
  },
  {
    // StrictMode y componentes simultáneos no duplican la petición.
    condition: (_unused, { getState }) => getState().catalog.collectionsStatus === 'idle',
  },
)

// Calcula los filtros ANTES de registrar la nueva entrada del historial.
// Así no se consulta primero con los filtros de otra entrada.
export function filtersForCatalogLocation(catalog, location) {
  if (location.pathname !== '/catalogo' || catalog.locationKey === location.key) return catalog.filters
  const previous = catalog.byLocation[location.key]
  if (previous) return previous
  if (location.state?.resetFilters) return emptyCatalogFilters()
  if (location.state?.type !== undefined || location.state?.collectionId !== undefined) {
    return {
      ...emptyCatalogFilters(),
      type: location.state.type ?? '',
      collection: String(location.state.collectionId ?? ''),
    }
  }
  return catalog.filters
}

const catalogSlice = createSlice({
  name: 'catalog',
  initialState,
  reducers: {
    enteredCatalog(state, action) {
      const { key, selection } = action.payload
      if (state.locationKey === key) return
      const next = filtersForCatalogLocation(state, {
        pathname: '/catalogo', key, state: selection,
      })
      state.filters = { ...next }
      state.byLocation[key] = { ...next }
      state.locationKey = key
    },
    changedCatalogFilters(state, action) {
      const { key, filters } = action.payload
      state.filters = { ...filters }
      state.byLocation[key] = { ...filters }
      state.locationKey = key
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCollections.pending, (state, action) => {
        state.collectionsStatus = 'loading'
        state.collectionsError = ''
        state.collectionsRequestId = action.meta.requestId
      })
      .addCase(fetchCollections.fulfilled, (state, action) => {
        if (state.collectionsRequestId !== action.meta.requestId) return
        state.collections = action.payload
        state.collectionsStatus = 'succeeded'
        state.collectionsRequestId = null
      })
      .addCase(fetchCollections.rejected, (state, action) => {
        if (state.collectionsRequestId !== action.meta.requestId) return
        state.collectionsStatus = 'failed'
        state.collectionsError = 'No pudimos cargar las colecciones. Recargá la página para reintentar.'
        state.collectionsRequestId = null
      })
  },
})

export const { enteredCatalog, changedCatalogFilters } = catalogSlice.actions
export default catalogSlice.reducer
