import assert from 'node:assert/strict'
import test from 'node:test'
import { File } from 'node:buffer'
import { configureStore } from '@reduxjs/toolkit'
import { mockAxios } from './fixtures/mockAxios.mjs'
import { createProductCache } from '../src/utils/productCache.js'
import cart, { fetchCart, addItemToCart, changeCartItemQuantity, deleteCartItem } from '../src/Redux/cartSlice.js'
import orders, { fetchOrdersHistory, fetchOrderDetail } from '../src/Redux/ordersSlice.js'
import checkout, { fetchCheckoutQuote, confirmCheckoutOrder } from '../src/Redux/checkoutSlice.js'
import publications, { fetchOwnPublications, saveOwnPublication, setOwnPublicationStatus,
  removeOwnPublication, uploadOwnPublicationPhoto } from '../src/Redux/publicationsSlice.js'
import promotions, { fetchAdminPromotions, fetchPublicPromotions,
  saveAdminPromotion, toggleAdminPromotion } from '../src/Redux/promotionsSlice.js'
import reviews, { fetchProductReviews, publishProductReview } from '../src/Redux/reviewsSlice.js'
import users, { fetchAuthenticatedUser, loginUser, registerUser, stageAuthCredentials,
  updateAccountProfile, deactivateAccountUser, sessionAuthenticated } from '../src/Redux/userSlice.js'
import products, { fetchProductPage, fetchProductDetail,
  fetchSelectionProducts, fetchCachedProduct } from '../src/Redux/productsSlice.js'
import catalog, { fetchCollections } from '../src/Redux/catalogSlice.js'
import { promotionFromBackend } from '../src/utils/promotionMapper.js'

const AUTH = 'fixture-jwt'
const scope = { ownerId: 1, generation: 2 }
const user = { id: 1, firstName: 'QA', lastName: 'Persona', email: 'qa@example.invalid', role: 'USUARIO', active: true }
const product = { id: 7, name: 'Carta QA', sellerId: 1, price: 100, status: 'ACTIVO', stock: 5 }
const cartResult = { id: 17, items: [{ id: 4, productId: 7, quantity: 2 }], subtotal: 200 }
const quote = { subtotal: 100, totalDiscount: 10, total: 90, promotions: [] }
const order = { id: 19, state: 'PENDIENTE', orderDate: '2026-10-22T12:00:00',
  paymentMethod: 'TRANSFERENCIA', ...quote,
  items: [{ id: 1, productId: 7, productName: 'Carta', quantity: 1, price: 100 }] }
const promotion = { id: 87, name: 'Promo QA', type: 'CANTIDAD', discountPercentage: 17.25,
  minimumQuantity: 2, active: true, stackable: false, startDate: '2026-10-28T08:00:00' }
const review = { id: 31, productId: 7, userId: 1, rating: 5, comment: 'Excelente' }
const page = { content: [product], number: 0, totalPages: 1, totalElements: 1 }

function makeStore() {
  const cache = createProductCache({ entityStore: new Map() })
  const store = configureStore({
    reducer: { cart, orders, checkout, publications, promotions, reviews, users, products, catalog },
    middleware: middleware => middleware({ thunk: { extraArgument: {
      cartToken: () => AUTH, ordersToken: () => AUTH, publicationToken: () => AUTH,
      promotionToken: () => AUTH, reviewsToken: () => AUTH, authToken: () => AUTH,
      productCache: cache,
    } } }),
  })
  return store
}
const delayed = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
const check = (request, { url, method, data, authenticated = true }) => {
  assert.equal(request.url, 'http://localhost:8080' + url)
  assert.equal(request.method, method)
  assert.deepEqual(request.data, data)
  if (authenticated) assert.equal(request.headers?.Authorization, 'Bearer ' + AUTH)
  else assert.equal(request.headers, undefined)
  assert.ok(request.signal instanceof AbortSignal, 'createAsyncThunk entrega AbortSignal')
}

for (const [name, action, url, method, body] of [
  ['GET carrito', () => fetchCart(scope), '/carts', 'GET'],
  ['POST agregar', () => addItemToCart({ ...scope, productId: 7, quantity: 2 }),
    '/carts/items', 'POST', { productId: 7, quantity: 2 }],
  ['PUT cantidad', () => changeCartItemQuantity({ ...scope, id: 4, quantity: 3 }),
    '/carts/items/4', 'PUT', { quantity: 3 }],
  ['DELETE ítem', () => deleteCartItem({ ...scope, id: 4 }), '/carts/items/4', 'DELETE'],
]) test(name + ': solo el thunk ejecuta Axios, con JWT y cuerpo exacto', async t => {
  const requests = mockAxios(t, request => {
    check(request, { url, method, data: body })
    return { status: 200, data: cartResult }
  })
  const result = await makeStore().dispatch(action()).unwrap()
  assert.deepEqual(result, cartResult)
  assert.equal(requests.mock.callCount(), 1)
})

for (const [name, action, url, method, body, data, status] of [
  ['historial', () => fetchOrdersHistory(scope), '/orders', 'GET', undefined, [order], 200],
  ['detalle', () => fetchOrderDetail({ ...scope, orderId: 19 }), '/orders/19', 'GET', undefined, order, 200],
  ['cotización', () => fetchCheckoutQuote({ ...scope, quoteKey: 'v1', paymentMethod: 'TRANSFERENCIA' }),
    '/orders/preview', 'POST', { paymentMethod: 'TRANSFERENCIA' }, quote, 200],
  ['confirmación', () => confirmCheckoutOrder({ ...scope, cartKey: 'cart', quoteKey: 'v1',
    payload: { paymentMethod: 'TRANSFERENCIA', expectedTotal: 90, requestKey: 'uuid-qa' } }),
    '/orders', 'POST', { paymentMethod: 'TRANSFERENCIA', expectedTotal: 90, requestKey: 'uuid-qa' }, order, 201],
]) test(name + ': el método HTTP de pedidos está solo en Redux y no reintenta', async t => {
  const requests = mockAxios(t, request => {
    check(request, { url, method, data: body })
    return { status, data }
  })
  const value = await makeStore().dispatch(action()).unwrap()
  assert.equal(name === 'historial' ? value.items[0].id
    : name === 'cotización' ? value.total
      : name === 'detalle' ? value.data.id : value.id,
  name === 'cotización' ? 90 : 19)
  assert.equal(requests.mock.callCount(), 1)
})

test('confirmación 201 inválida conserva la misma requestKey como resultado ambiguo', async t => {
  const requests = mockAxios(t, () => ({ status: 201, data: { id: 19 } }))
  const args = { ...scope, cartKey: 'cart', quoteKey: 'v1',
    payload: { paymentMethod: 'TRANSFERENCIA', expectedTotal: 90, requestKey: 'same-uuid' } }
  const store = makeStore()
  await assert.rejects(store.dispatch(confirmCheckoutOrder(args)).unwrap(),
    { status: 201, ambiguous: true })
  assert.equal(store.getState().checkout.confirmation.unresolved.payload.requestKey, 'same-uuid')
  assert.equal(requests.mock.callCount(), 1)
})

for (const [name, action, url, method, expected, response, status] of [
  ['admin GET', () => fetchAdminPromotions(scope), '/promotions', 'GET', undefined, [promotion], 200],
  ['públicas GET', () => fetchPublicPromotions(), '/promotions/public', 'GET', undefined, [promotion], 200],
  ['crear', () => saveAdminPromotion({ ...scope, promotion: { ...promotionFromBackend(promotion), id: undefined } }),
    '/promotions', 'POST', undefined, promotion, 201],
  ['editar', () => saveAdminPromotion({ ...scope, promotion: promotionFromBackend(promotion) }),
    '/promotions/87', 'PUT', undefined, promotion, 200],
  ['desactivar', () => toggleAdminPromotion({ ...scope, promotionId: 87, active: false }),
    '/promotions/87/deactivate', 'PATCH', undefined, { ...promotion, active: false }, 200],
]) test(name + ': promociones usan thunk y verbo explícito con privacidad correcta', async t => {
  const requests = mockAxios(t, request => {
    check(request, { url, method, data: expected === undefined && ['POST', 'PUT'].includes(method)
      ? request.data : expected, authenticated: url !== '/promotions/public' })
    if (['POST', 'PUT'].includes(method)) {
      assert.equal(request.data.name, 'Promo QA')
      assert.equal(Object.hasOwn(request.data, 'active'), false)
    }
    return { status, data: response }
  })
  await makeStore().dispatch(action()).unwrap()
  assert.equal(requests.mock.callCount(), 1)
})

for (const [name, action, url, method, body, response, status] of [
  ['GET reseñas', () => fetchProductReviews({ productId: 7 }), '/products/7/reviews',
    'GET', undefined, [review], 200],
  ['POST reseña', () => publishProductReview({ ...scope, productId: 7, rating: 5, comment: 'Excelente' }),
    '/products/7/reviews', 'POST', { rating: 5, comment: 'Excelente' }, review, 201],
]) test(name + ': GET anónimo y POST con JWT solo en Redux', async t => {
  const requests = mockAxios(t, request => {
    check(request, { url, method, data: body, authenticated: method === 'POST' })
    return { status, data: response }
  })
  await makeStore().dispatch(action()).unwrap()
  assert.equal(requests.mock.callCount(), 1)
})

for (const [name, action, url, method, data, response, status] of [
  ['listar', () => fetchOwnPublications({ userId: 1, generation: 2 }),
    '/products/mine?page=0&size=20', 'GET', undefined, { content: [product], number: 0, totalPages: 1 }, 200],
  ['crear', () => saveOwnPublication({ userId: 1, generation: 2, body: { name: 'Carta QA' } }),
    '/products', 'POST', { name: 'Carta QA' }, product, 201],
  ['editar', () => saveOwnPublication({ userId: 1, generation: 2, id: 7, body: { name: 'Carta QA' } }),
    '/products/7', 'PUT', { name: 'Carta QA' }, product, 200],
  ['pausar', () => setOwnPublicationStatus({ userId: 1, generation: 2, id: 7, action: 'pause' }),
    '/products/7/pause', 'PATCH', undefined, product, 200],
  ['reactivar', () => setOwnPublicationStatus({ userId: 1, generation: 2, id: 7, action: 'resume' }),
    '/products/7/resume', 'PATCH', undefined, product, 200],
  ['eliminar', () => removeOwnPublication({ userId: 1, generation: 2, id: 7 }),
    '/products/7', 'DELETE', undefined, undefined, 204],
]) test('Publicaciones ' + name + ': un HTTP por thunk con JWT y payload exactos', async t => {
  const requests = mockAxios(t, request => {
    check(request, { url, method, data })
    return { status, data: response }
  })
  await makeStore().dispatch(action()).unwrap()
  assert.equal(requests.mock.callCount(), 1)
})

test('POST de foto con FormData se inicia desde el thunk sin fijar Content-Type', async t => {
  const requests = mockAxios(t, request => {
    assert.equal(request.url, 'http://localhost:8080/products/images')
    assert.equal(request.method, 'POST')
    assert.equal(request.headers.Authorization, 'Bearer ' + AUTH)
    assert.equal(request.headers['Content-Type'], undefined)
    assert.ok(request.data instanceof FormData)
    assert.equal(request.data.get('file')?.name, 'qa.png')
    return { status: 201, data: { url: 'https://cdn.example.invalid/qa.png' } }
  })
  const file = new File(['png'], 'qa.png', { type: 'image/png' })
  const result = await makeStore().dispatch(uploadOwnPublicationPhoto({ userId: 1, generation: 2, file })).unwrap()
  assert.equal(result, 'https://cdn.example.invalid/qa.png')
  assert.equal(requests.mock.callCount(), 1)
})

test('Colecciones públicas se consultan sin JWT desde catalogSlice', async t => {
  const mock = mockAxios(t, request => {
    check(request, { url: '/collections', method: 'GET', data: undefined, authenticated: false })
    return { status: 200, data: [{ id: 4, name: 'NBA' }] }
  })
  const result = await makeStore().dispatch(fetchCollections()).unwrap()
  assert.equal(result[0].name, 'NBA')
  assert.equal(mock.mock.callCount(), 1)
})

for (const [name, action, url, response] of [
  ['página', () => fetchProductPage({ query: 'page=2&size=9&search=carta', cacheVersion: 0, attempt: 0 }),
    '/products?page=2&size=9&search=carta', page],
  ['detalle', () => fetchProductDetail({ productId: 7, cacheVersion: 0, attempt: 0 }),
    '/products/7', product],
  ['selector de promociones', () => fetchSelectionProducts({ query: 'page=0&size=20' }),
    '/products?page=0&size=20', page],
  ['metadatos del carrito', () => fetchCachedProduct({ productId: 7, context: 'cart' }),
    '/products/7', product],
]) test(name + ': caché recibe exclusivamente un GET definido dentro del thunk', async t => {
  const mock = mockAxios(t, request => {
    check(request, { url, method: 'GET', data: undefined, authenticated: false })
    return { status: 200, data: response }
  })
  const store = makeStore()
  const actionResult = await store.dispatch(action())
  assert.match(actionResult.type, /fulfilled$/)
  assert.equal(mock.mock.callCount(), 1)
})

test('metadatos y detalle comparten un GET aunque dos consumidores lo pidan simultáneamente', async t => {
  const gate = delayed()
  const mock = mockAxios(t, request => {
    check(request, { url: '/products/7', method: 'GET', data: undefined, authenticated: false })
    return gate.promise
  })
  const store = makeStore()
  const first = store.dispatch(fetchCachedProduct({ productId: 7, context: 'cart' }))
  const second = store.dispatch(fetchCachedProduct({ productId: 7, context: 'selection' }))
  assert.equal(mock.mock.callCount(), 1)
  gate.resolve({ status: 200, data: product })
  assert.equal((await first.unwrap()).id, 7)
  assert.equal((await second.unwrap()).id, 7)
  assert.equal(mock.mock.callCount(), 1)
})

test('login usa POST anónimo y GET con token candidato, sin leer services', async t => {
  const seen = []
  const mock = mockAxios(t, request => {
    seen.push(request)
    if (request.method === 'POST') {
      assert.equal(request.url, 'http://localhost:8080/api/v1/auth/authenticate')
      assert.equal(request.headers, undefined)
      assert.deepEqual(request.data, { email: user.email, password: 'pass-fixture' })
      return { status: 200, data: { access_token: AUTH } }
    }
    check(request, { url: '/users/me', method: 'GET', data: undefined })
    return { status: 200, data: user }
  })
  const store = makeStore()
  const requestId = stageAuthCredentials({ email: user.email, password: 'pass-fixture' })
  const value = await store.dispatch(loginUser(requestId)).unwrap()
  assert.equal(value.user.id, 1)
  assert.equal(seen.map(request => request.method).join(','), 'POST,GET')
  assert.equal(mock.mock.callCount(), 2)
})

test('registro usa POST explícito y GET de verificación del JWT antes de publicar sesión', async t => {
  const mock = mockAxios(t, request => request.method === 'POST'
    ? { status: 200, data: { access_token: AUTH } } : { status: 200, data: user })
  const store = makeStore()
  const credentials = { firstname: 'QA', lastname: 'Persona', email: user.email, password: 'pass-fixture' }
  const id = stageAuthCredentials(credentials)
  const done = await store.dispatch(registerUser(id))
  assert.match(done.type, /fulfilled$/)
  assert.equal(mock.mock.callCount(), 2)
  assert.equal(mock.mock.calls[0].url, 'http://localhost:8080/api/v1/auth/register')
  assert.deepEqual(mock.mock.calls[0].data, credentials)
  assert.equal(mock.mock.calls[0].headers, undefined)
  assert.equal(mock.mock.calls[1].headers.Authorization, 'Bearer ' + AUTH)
})

test('recuperación de sesión usa sólo GET con el JWT actual', async t => {
  const mock = mockAxios(t, request => {
    check(request, { url: '/users/me', method: 'GET', data: undefined })
    return { status: 200, data: user }
  })
  const result = await makeStore().dispatch(fetchAuthenticatedUser()).unwrap()
  assert.equal(result.id, 1)
  assert.equal(mock.mock.callCount(), 1)
})

for (const [name, thunk, path, response] of [
  ['perfil', () => updateAccountProfile({ userId: 1,
    form: { firstName: 'QA', lastName: 'Persona', email: user.email } }), '/users/me', user],
  ['desactivar', () => deactivateAccountUser({ userId: 1 }),
    '/users/me/deactivate', { ...user, active: false }],
]) test('PUT ' + name + ': sólo Redux hace el HTTP y valida identidad', async t => {
  const mock = mockAxios(t, request => {
    assert.equal(request.method, 'PUT')
    assert.equal(request.url, 'http://localhost:8080' + path)
    assert.equal(request.headers.Authorization, 'Bearer ' + AUTH)
    return { status: 200, data: response }
  })
  const store = makeStore()
  store.dispatch(sessionAuthenticated({ user, token: AUTH }))
  await store.dispatch(thunk()).unwrap()
  assert.equal(mock.mock.callCount(), 1)
})
