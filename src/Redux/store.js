import { configureStore } from '@reduxjs/toolkit'
import catalogReducer from './catalogSlice.js'
import productsReducer from './productsSlice.js'
import { createProductCache } from '../utils/productCache.js'

// Entidades públicas: una sola caché, compartida por Home, detalle y catálogo.
// Redux guarda el estado de las consultas y los IDs mostrados, no copias de productos.
export const catalogProductCache = createProductCache()

export const store = configureStore({
  reducer: {
    catalog: catalogReducer,
    products: productsReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({
    // Las operaciones HTTP se realizan desde el coordinador existente.
    // AbortControllers, Map y promesas nunca se escriben en el estado Redux.
    thunk: { extraArgument: { productCache: catalogProductCache } },
  }),
})
