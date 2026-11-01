import { configureStore } from '@reduxjs/toolkit'
import catalogReducer from './catalogSlice.js'
import productsReducer, { cachedProduct, removedCachedProduct,
  clearedCachedProducts } from './productsSlice.js'
import { createProductCache } from '../utils/productCache.js'

// Adaptador Map compatible: la caché organiza la red, pero las entidades viven
// únicamente en Redux. No existe una segunda Map de productos en producción.
// Los métodos se ejecutan una vez configurado el store.
const productEntities = {
  get(id) { return store.getState().products.entities[id] },
  has(id) { return Object.hasOwn(store.getState().products.entities, id) },
  set(_id, product) { store.dispatch(cachedProduct(product)); return productEntities },
  delete(id) {
    const existed = productEntities.has(id)
    if (existed) store.dispatch(removedCachedProduct(id))
    return existed
  },
  clear() {
    if (store.getState().products.ids.length) store.dispatch(clearedCachedProducts())
  },
  values() {
    const { ids, entities } = store.getState().products
    return ids.map((id) => entities[id]).values()
  },
}

// Conservar el coordinador de TTL/cancelaciones evita cambiar sus garantías,
// mientras Redux ya administra la colección normalizada de productos públicos.
export const catalogProductCache = createProductCache({ entityStore: productEntities })

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
