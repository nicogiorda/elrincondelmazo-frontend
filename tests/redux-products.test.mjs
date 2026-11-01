import assert from 'node:assert/strict'
import { test } from 'node:test'
import { configureStore } from '@reduxjs/toolkit'
import productsReducer, { fetchProductPage, fetchProductDetail } from '../src/Redux/productsSlice.js'

const page = (ids, number = 0) => ({
  content: ids.map((id) => ({ id, price: 100 })),
  number, totalElements: 18, totalPages: 2,
})
const deferred = () => {
  let resolve, reject
  const promise = new Promise((a, b) => { resolve = a; reject = b })
  return { promise, resolve, reject }
}
const create = (api) => configureStore({
  reducer: { products: productsReducer },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({
    thunk: { extraArgument: { productCache: api } },
  }),
})
const pageArgs = (query, cacheVersion = 0, attempt = 0) => ({ query, cacheVersion, attempt })
const detailArgs = (productId, cacheVersion = 0, attempt = 0) => ({ productId, cacheVersion, attempt })

test('fetchProductPage usa el coordinador y mantiene solamente IDs y metadatos en Redux', async () => {
  const calls = []
  const store = create({ loadPage: async (query) => { calls.push(query); return page([10, 11]) } })
  const action = await store.dispatch(fetchProductPage(pageArgs('page=0&size=9')))
  assert.equal(action.type, 'products/fetchPage/fulfilled')
  assert.deepEqual(calls, ['page=0&size=9'])
  const state = store.getState().products.page
  assert.equal(state.status, 'succeeded')
  assert.deepEqual(state.ids, [10, 11])
  assert.equal(state.totalPages, 2)
  // Etapa 3: las entidades ya pertenecen a Redux; el coordinador falso de
  // esta prueba no las inserta, por eso la colección normalizada está vacía.
  assert.deepEqual(store.getState().products.ids, [])
  assert.deepEqual(Object.keys(store.getState().products.entities), [])
})

test('createAsyncThunk impide solicitudes simultáneas repetidas de una página', async () => {
  const gate = deferred(); let calls = 0
  const store = create({ loadPage: () => { calls++; return gate.promise } })
  const args = pageArgs('page=0&size=9')
  const first = store.dispatch(fetchProductPage(args))
  const second = await store.dispatch(fetchProductPage(args))
  assert.equal(second.meta.condition, true)
  assert.equal(calls, 1)
  gate.resolve(page([4]))
  await first
  assert.deepEqual(store.getState().products.page.ids, [4])
})

test('respuesta de página anterior no reemplaza una búsqueda posterior', async () => {
  const gate = deferred()
  const store = create({ loadPage: (query) => query === 'old' ? gate.promise : Promise.resolve(page([90])) })
  const old = store.dispatch(fetchProductPage(pageArgs('old')))
  await store.dispatch(fetchProductPage(pageArgs('new')))
  gate.resolve(page([12])); await old
  assert.equal(store.getState().products.page.query, 'new')
  assert.deepEqual(store.getState().products.page.ids, [90])
})

test('respuestas con distinta versión de caché y reintento no se mezclan', async () => {
  const gate = deferred(); let count = 0
  const store = create({ loadPage: () => ++count === 1 ? gate.promise : Promise.resolve(page([200])) })
  const old = store.dispatch(fetchProductPage(pageArgs('page=0', 1, 0)))
  await store.dispatch(fetchProductPage(pageArgs('page=0', 2, 0)))
  gate.resolve(page([100])); await old
  assert.equal(store.getState().products.page.cacheVersion, 2)
  assert.deepEqual(store.getState().products.page.ids, [200])
})

test('el fallo de una página se puede reintentar', async () => {
  let fail = true
  const store = create({ loadPage: () => {
    if (fail) return Promise.reject(new Error('HTTP 503'))
    return Promise.resolve(page([50]))
  } })
  const error = await store.dispatch(fetchProductPage(pageArgs('page=0')))
  assert.equal(error.type, 'products/fetchPage/rejected')
  assert.match(store.getState().products.page.error, /503/)
  fail = false
  await store.dispatch(fetchProductPage(pageArgs('page=0', 0, 1)))
  assert.deepEqual(store.getState().products.page.ids, [50])
})

test('detalle disponible y agotado se resuelven con la caché sin guardar productos duplicados', async () => {
  const store = create({ loadProduct: async () => ({ id: 7, status: 'AGOTADO' }) })
  await store.dispatch(fetchProductDetail(detailArgs(7)))
  assert.deepEqual(store.getState().products.detail, {
    key: '7:0:0', requestId: store.getState().products.detail.requestId,
    status: 'succeeded', notFound: false, error: '',
  })
})

test('detalle inactivo se marca como no disponible', async () => {
  const store = create({ loadProduct: async () => ({ id: 7, status: 'INACTIVO' }) })
  await store.dispatch(fetchProductDetail(detailArgs(7)))
  assert.equal(store.getState().products.detail.notFound, true)
})

test('detalle inexistente genera no disponible; otros errores permiten reintento', async () => {
  const store = create({ loadProduct: async () => { throw Object.assign(new Error('No existe'), { status: 404 }) } })
  await store.dispatch(fetchProductDetail(detailArgs(7)))
  assert.equal(store.getState().products.detail.notFound, true)
  assert.equal(store.getState().products.detail.error, '')
  const next = create({ loadProduct: async () => { throw Object.assign(new Error('HTTP QA'), { status: 503 }) } })
  await next.dispatch(fetchProductDetail(detailArgs(7)))
  assert.equal(next.getState().products.detail.error, 'HTTP QA')
})

test('la respuesta tardía de un detalle no reemplaza el detalle actual', async () => {
  const gate = deferred()
  const store = create({ loadProduct: (id) => id === 7 ? gate.promise : Promise.resolve({ id, status: 'ACTIVO' }) })
  const old = store.dispatch(fetchProductDetail(detailArgs(7)))
  await store.dispatch(fetchProductDetail(detailArgs(20)))
  gate.resolve({ id: 7, status: 'INACTIVO' }); await old
  assert.equal(store.getState().products.detail.key, '20:0:0')
  assert.equal(store.getState().products.detail.notFound, false)
})

test('cancelación de un detalle descarta la respuesta anterior', async () => {
  const gate = deferred()
  const store = create({ loadProduct: () => gate.promise })
  const request = store.dispatch(fetchProductDetail(detailArgs(5)))
  request.abort()
  const action = await request
  assert.equal(action.meta.aborted, true)
  assert.equal(store.getState().products.detail, null)
  gate.resolve({ id: 5, status: 'ACTIVO' })
})


test('Home despacha un thunk que conserva solo IDs y evita duplicados de StrictMode', async () => {
  const gate = deferred(); let calls = 0
  const store = create({ loadPage: () => { calls++; return gate.promise } })
  const { fetchHomeProducts } = await import('../src/Redux/productsSlice.js')
  const first = store.dispatch(fetchHomeProducts({ cacheVersion: 0 }))
  const duplicate = await store.dispatch(fetchHomeProducts({ cacheVersion: 0 }))
  assert.equal(duplicate.meta.condition, true)
  gate.resolve(page([5, 6, 7]))
  await first
  assert.equal(calls, 1)
  assert.equal(store.getState().products.home.status, 'succeeded')
  assert.deepEqual(store.getState().products.home.ids, [5, 6, 7])
  await store.dispatch(fetchHomeProducts({ cacheVersion: 0 }))
  assert.equal(calls, 1, 'Una segunda entrada a Home no repite un GET fresco')
})

test('Home, catálogo y relacionados conservan sus estados independientes', async () => {
  const { fetchHomeProducts, fetchRelatedProducts } = await import('../src/Redux/productsSlice.js')
  const calls = []
  const store = create({ loadPage: async query => {
    calls.push(query)
    if (query.includes('collectionId=4')) return page([7, 8])
    if (query.includes('size=4')) return page([1, 2])
    return page([42])
  } })
  await store.dispatch(fetchProductPage(pageArgs('page=0&size=9')))
  await store.dispatch(fetchHomeProducts({ cacheVersion: 0 }))
  await store.dispatch(fetchRelatedProducts({ collectionId: 4, cacheVersion: 0 }))
  assert.deepEqual(store.getState().products.page.ids, [42])
  assert.deepEqual(store.getState().products.home.ids, [1, 2])
  assert.deepEqual(store.getState().products.related.ids, [7, 8])
  assert.deepEqual(calls, ['page=0&size=9', 'page=0&size=4', 'page=0&size=5&collectionId=4'])
})

test('una respuesta tardía de productos relacionados no sobrescribe otra colección', async () => {
  const { fetchRelatedProducts } = await import('../src/Redux/productsSlice.js')
  const oldGate = deferred()
  const store = create({ loadPage: query => query.includes('collectionId=4')
    ? oldGate.promise : Promise.resolve(page([22])) })
  const old = store.dispatch(fetchRelatedProducts({ collectionId: 4, cacheVersion: 0 }))
  await store.dispatch(fetchRelatedProducts({ collectionId: 9, cacheVersion: 0 }))
  oldGate.resolve(page([14]))
  await old
  assert.equal(store.getState().products.related.key, '9:0')
  assert.deepEqual(store.getState().products.related.ids, [22])
})

test('el error de Home se refleja en Redux y la siguiente acción puede reintentarlo', async () => {
  const { fetchHomeProducts } = await import('../src/Redux/productsSlice.js')
  let calls = 0
  const store = create({ loadPage: () => ++calls === 1
    ? Promise.reject(new Error('Error 503 QA')) : Promise.resolve(page([19])) })
  await store.dispatch(fetchHomeProducts({ cacheVersion: 0 }))
  assert.match(store.getState().products.home.error, /503/)
  await store.dispatch(fetchHomeProducts({ cacheVersion: 0 }))
  assert.equal(store.getState().products.home.status, 'succeeded')
  assert.deepEqual(store.getState().products.home.ids, [19])
  assert.equal(calls, 2)
})
