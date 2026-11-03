import { configureStore } from '@reduxjs/toolkit'
import catalogReducer from './catalogSlice.js'
import productsReducer, { cachedProduct, removedCachedProduct,
  clearedCachedProducts } from './productsSlice.js'
import cartReducer from './cartSlice.js'
import ordersReducer from './ordersSlice.js'
import checkoutReducer from './checkoutSlice.js'
import publicationsReducer from './publicationsSlice.js'
import userReducer from './userSlice.js'
import promotionsReducer from './promotionsSlice.js'
import reviewsReducer from './reviewsSlice.js'
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
    cart: cartReducer,
    orders: ordersReducer,
    checkout: checkoutReducer,
    publications: publicationsReducer,
    users: userReducer,
    promotions: promotionsReducer,
    reviews: reviewsReducer,
  },
  // DevTools representa el flujo de Redux sin exponer contraseñas o JWT.
  devTools: {
    actionSanitizer: action => {
      if (['users/login/fulfilled', 'users/register/fulfilled', 'users/sessionAuthenticated'].includes(action.type)) {
        return { ...action, payload: { ...action.payload, token: '[oculto]' } }
      }
      return action
    },
    stateSanitizer: state => ({
      ...state,
      users: { ...state.users, token: state.users.token ? '[oculto]' : null },
    }),
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({
    // Las operaciones HTTP se realizan desde el coordinador existente.
    // AbortControllers, Map y promesas nunca se escriben en el estado Redux.
    thunk: { extraArgument: {
      productCache: catalogProductCache,
      publicationToken: () => globalThis.localStorage?.getItem('token'),
      authToken: () => globalThis.localStorage?.getItem('token'),
      cartToken: () => globalThis.localStorage?.getItem('token'),
      ordersToken: () => globalThis.localStorage?.getItem('token'),
      promotionToken: () => globalThis.localStorage?.getItem('token'),
      reviewsToken: () => globalThis.localStorage?.getItem('token'),
    } },
  }),
})
