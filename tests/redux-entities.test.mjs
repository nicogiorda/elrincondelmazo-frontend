import assert from 'node:assert/strict'
import { test } from 'node:test'
import { configureStore } from '@reduxjs/toolkit'
import reducer, { cachedProduct, removedCachedProduct, clearedCachedProducts,
  selectPublicProducts, selectPublicProductById } from '../src/Redux/productsSlice.js'
import { store, catalogProductCache } from '../src/Redux/store.js'
import { createProductCache } from '../src/utils/productCache.js'

const product = (id, price = 100, sellerId = 5, status = 'ACTIVO') =>
  ({ id, name: 'Carta ' + id, price, sellerId, status, stock: 2 })
const page = (content, pageNumber = 0) =>
  ({ content, number: pageNumber, totalElements: content.length, totalPages: 1 })

test('createEntityAdapter almacena una única entidad por ID y mantiene el orden de ingreso', () => {
  const testStore = configureStore({ reducer: { products: reducer } })
  testStore.dispatch(cachedProduct(product(7, 100)))
  testStore.dispatch(cachedProduct(product(8, 150)))
  testStore.dispatch(cachedProduct(product(7, 230)))
  const state = testStore.getState()
  assert.deepEqual(state.products.ids, [7, 8])
  assert.deepEqual(selectPublicProducts(state).map((item) => item.price), [230, 150])
  assert.equal(selectPublicProductById(state, 7).price, 230)
  testStore.dispatch(removedCachedProduct(7))
  assert.deepEqual(selectPublicProducts(testStore.getState()).map((p) => p.id), [8])
  testStore.dispatch(clearedCachedProducts())
  assert.deepEqual(selectPublicProducts(testStore.getState()), [])
})

test('caché real entrega las mismas referencias de entidades que el store Redux', () => {
  const cache = catalogProductCache
  cache.invalidate()
  try {
    cache.rememberProduct(product(3, 110))
    assert.equal(store.getState().products.entities[3], cache.getSnapshot().products[0])
    cache.rememberProduct(product(3, 30))
    assert.equal(store.getState().products.entities[3].price, 110)
    cache.upsertProduct(product(3, 190))
    assert.equal(selectPublicProductById(store.getState(), 3).price, 190)
    assert.equal(cache.getSnapshot().products[0], selectPublicProducts(store.getState())[0])
    cache.removeProduct(3)
    assert.equal(selectPublicProductById(store.getState(), 3), undefined)
    assert.deepEqual(cache.getSnapshot().products, [])
  } finally {
    cache.invalidate()
  }
})

test('publicaciones ACTIVO/AGOTADO sincronizan Redux; INACTIVO se descarta', () => {
  const cache = catalogProductCache
  cache.invalidate()
  try {
    cache.rememberProduct(product(1, 100, 10))
    cache.rememberProduct(product(2, 200, 11))
    cache.syncPublications(10, [product(3, 150, 10, 'AGOTADO'),
      product(4, 250, 10, 'INACTIVO')])
    assert.deepEqual(selectPublicProducts(store.getState()).map(p => p.id), [2, 3])
  } finally {
    cache.invalidate()
  }
})

test('expiración de TTL expulsa la entidad del adaptador inyectado', async () => {
  const redux = configureStore({ reducer: { products: reducer } })
  const adapter = {
    get: id => redux.getState().products.entities[id],
    has: id => Object.hasOwn(redux.getState().products.entities, id),
    set(_id, value) { redux.dispatch(cachedProduct(value)) },
    delete(id) { redux.dispatch(removedCachedProduct(id)) },
    clear() { redux.dispatch(clearedCachedProducts()) },
    values() {
      const { ids, entities } = redux.getState().products
      return ids.map(id => entities[id]).values()
    },
  }
  let clock = 100_000
  let calls = 0
  const cache = createProductCache({
    now: () => clock,
    api: {
      getProducts: async () => { calls++; return page([product(12, calls * 50)]) },
      getProduct: async () => product(12),
    },
    entityStore: adapter,
  })
  await cache.loadPage('page=0')
  assert.equal(redux.getState().products.entities[12].price, 50)
  clock += 60_000
  cache.expire()
  assert.equal(redux.getState().products.entities[12], undefined)
  await cache.loadPage('page=0')
  assert.equal(redux.getState().products.entities[12].price, 100)
  assert.equal(calls, 2)
})

test('invalidación y respuestas tardías no restauran entidades en Redux', async () => {
  const redux = configureStore({ reducer: { products: reducer } })
  const adapter = {
    get: id => redux.getState().products.entities[id],
    has: id => Object.hasOwn(redux.getState().products.entities, id),
    set(_id, value) { redux.dispatch(cachedProduct(value)) },
    delete(id) { redux.dispatch(removedCachedProduct(id)) },
    clear() { redux.dispatch(clearedCachedProducts()) },
    values() { const { ids, entities } = redux.getState().products; return ids.map(id => entities[id]).values() },
  }
  let resolve
  const promise = new Promise(done => { resolve = done })
  const cache = createProductCache({
    api: { getProducts: () => promise, getProduct: async id => product(id) },
    entityStore: adapter,
  })
  const previous = cache.loadPage('page=0')
  const expectedRejection = assert.rejects(previous, /catálogo cambió/)
  cache.invalidate()
  cache.upsertProduct(product(7, 280))
  resolve(page([product(7, 50), product(9, 10)]))
  await expectedRejection
  assert.deepEqual(selectPublicProducts(redux.getState()).map(p => [p.id, p.price]), [[7, 280]])
})

test('las estructuras Map y AbortController no se guardan en el estado Redux', () => {
  catalogProductCache.invalidate()
  const state = store.getState().products
  assert.equal(Array.isArray(state.ids), true)
  assert.equal(state.entities instanceof Map, false)
  assert.equal(Object.values(state.entities).some(value => value instanceof AbortController), false)
})
