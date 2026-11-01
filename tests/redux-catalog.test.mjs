import assert from 'node:assert/strict'
import { test } from 'node:test'
import axios from 'axios'
import { configureStore } from '@reduxjs/toolkit'
import reducer, { changedCatalogFilters, emptyCatalogFilters, enteredCatalog,
  fetchCollections, filtersForCatalogLocation } from '../src/Redux/catalogSlice.js'

const makeStore = () => configureStore({ reducer: { catalog: reducer } })

test('store inicia con los filtros del catálogo y colecciones vacías', () => {
  const state = makeStore().getState().catalog
  assert.deepEqual(state.filters, emptyCatalogFilters())
  assert.deepEqual(state.collections, [])
  assert.equal(state.collectionsStatus, 'idle')
})

test('Redux conserva filtros por cada entrada del historial', () => {
  const store = makeStore()
  const navigate = (key, selection = {}) =>
    store.dispatch(enteredCatalog({ key, selection }))
  navigate('a')
  store.dispatch(changedCatalogFilters({
    key: 'a', filters: { ...emptyCatalogFilters(), search: 'NBA', page: 2 },
  }))
  navigate('b', { type: 'SOBRE' })
  assert.equal(store.getState().catalog.filters.type, 'SOBRE')
  assert.equal(store.getState().catalog.filters.search, '')
  navigate('a')
  assert.equal(store.getState().catalog.filters.search, 'NBA')
  assert.equal(store.getState().catalog.filters.page, 2)
  navigate('c', { resetFilters: true })
  assert.deepEqual(store.getState().catalog.filters, emptyCatalogFilters())
})

test('las selecciones de Home y colecciones inicializan los filtros sin mezclarlos', () => {
  const state = makeStore().getState().catalog
  const selected = filtersForCatalogLocation(state, {
    pathname: '/catalogo', key: 'home-link', state: { collectionId: 19 },
  })
  assert.equal(selected.collection, '19')
  assert.equal(selected.page, 0)
  assert.deepEqual(state.filters, emptyCatalogFilters())
})

test('createAsyncThunk envía una sola petición con dos dispatch simultáneos', async () => {
  const originalGet = axios.get
  let calls = 0
  let resolve
  axios.get = () => {
    calls += 1
    return new Promise((done) => { resolve = done })
  }
  try {
    const store = makeStore()
    const first = store.dispatch(fetchCollections())
    const second = store.dispatch(fetchCollections())
    assert.equal(store.getState().catalog.collectionsStatus, 'loading')
    assert.equal(calls, 1)
    resolve({ data: [{ id: 5, name: 'NBA' }] })
    const firstAction = await first
    const secondAction = await second
    assert.equal(firstAction.type, 'catalog/fetchCollections/fulfilled')
    assert.equal(secondAction.meta.condition, true)
    assert.deepEqual(store.getState().catalog.collections, [{ id: 5, name: 'NBA' }])
    assert.equal(store.getState().catalog.collectionsStatus, 'succeeded')
  } finally {
    axios.get = originalGet
  }
})

test('el thunk deja un error visible cuando falla la API', async () => {
  const originalGet = axios.get
  axios.get = () => Promise.reject(new Error('HTTP 503 QA'))
  try {
    const store = makeStore()
    const action = await store.dispatch(fetchCollections())
    assert.equal(action.type, 'catalog/fetchCollections/rejected')
    assert.equal(store.getState().catalog.collectionsStatus, 'failed')
    assert.match(store.getState().catalog.collectionsError, /No pudimos cargar/)
  } finally {
    axios.get = originalGet
  }
})
