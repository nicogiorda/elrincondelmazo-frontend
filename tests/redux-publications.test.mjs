import './fixtures/axios-verb-test-bridge.mjs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import axios from 'axios'
import { configureStore } from '@reduxjs/toolkit'
import reducer, { fetchOwnPublications, saveOwnPublication, setOwnPublicationStatus,
  removeOwnPublication, uploadOwnPublicationPhoto, publicationsSessionCleared,
  publicationLocalError, publicationMutationReleased } from '../src/Redux/publicationsSlice.js'

const scope = (userId = 1, generation = 1) => ({ userId, generation })
const product = (id, owner = 1, name = 'Carta ' + id) => ({
  id, sellerId: owner, name, status: 'ACTIVO', stock: 3,
  createdAt: '2026-10-20T10:00:00', price: 100,
})
const makeStore = () => configureStore({
  reducer: { publications: reducer },
  middleware: getDefaultMiddleware => getDefaultMiddleware({
    thunk: { extraArgument: { publicationToken: () => 'session-fixture-token' } },
  }),
})
const current = store => store.getState().publications
const reply = (data, status = 200) => ({ data, status })
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

test('la sesión empieza sin datos privados y sin JWT dentro del store', () => {
  const store = makeStore()
  assert.deepEqual(current(store).items, [])
  assert.equal(current(store).ownerId, null)
  assert.equal(JSON.stringify(current(store)).includes('session-fixture-token'), false)
})

test('GET carga páginas de 20, ordena resultados y maneja pending/fulfilled', async t => {
  const pages = []
  t.mock.method(axios, 'request', async config => {
    assert.equal(config.method, 'GET')
    assert.equal(config.headers.Authorization, 'Bearer session-fixture-token')
    const parsed = new URL(config.url)
    const number = Number(parsed.searchParams.get('page'))
    pages.push(number)
    const content = Array.from({ length: number < 2 ? 20 : 1 },
      (_, i) => product(number * 20 + i + 1))
    return reply({ content, number, totalPages: 3 })
  })
  const store = makeStore()
  const actionPromise = store.dispatch(fetchOwnPublications(scope()))
  assert.equal(current(store).loading, true)
  const action = await actionPromise
  assert.equal(action.type, 'publications/fetchOwn/fulfilled')
  assert.deepEqual(pages, [0, 1, 2])
  assert.equal(current(store).items.length, 41)
  assert.equal(current(store).items[0].id, 41)
  assert.equal(current(store).loading, false)
  assert.ok(current(store).updatedAt > 0)
  assert.equal(JSON.stringify(action).includes('session-fixture-token'), false)
})

test('GET con 403 conserva mensaje, status y permite otra solicitud', async t => {
  let fail = true
  t.mock.method(axios, 'request', async () => {
    if (fail) throw { response: { status: 403, data: { message: 'No autorizado' } } }
    return reply({ content: [product(1)], totalPages: 1, number: 0 })
  })
  const store = makeStore()
  const rejected = await store.dispatch(fetchOwnPublications(scope()))
  assert.equal(rejected.type, 'publications/fetchOwn/rejected')
  assert.equal(rejected.error.status, 403)
  assert.equal(current(store).loadError, 'No tenés permiso para consultar tus publicaciones.')
  fail = false
  await store.dispatch(fetchOwnPublications(scope()))
  assert.equal(current(store).loadError, '')
  assert.deepEqual(current(store).items.map(p => p.id), [1])
})

test('POST, PUT, PATCH y DELETE se ejecutan mediante thunks Axios', async t => {
  const saved = product(8)
  const calls = []
  t.mock.method(axios, 'request', async config => {
    calls.push({ method: config.method, url: config.url })
    if (config.method === 'POST') return reply(saved, 201)
    if (config.method === 'PUT') return reply({ ...saved, name: 'Editada' })
    if (config.method === 'PATCH') return reply({ ...saved, name: 'Editada', status: 'INACTIVO' })
    if (config.method === 'DELETE') return reply(undefined, 204)
    return reply({ content: [], totalPages: 0, number: 0 })
  })
  const store = makeStore()
  const args = { ...scope(), busyId: 8 }
  const body = { name: 'Carta 8' }
  await store.dispatch(saveOwnPublication({ ...args, body, id: undefined }))
  assert.equal(current(store).items[0].name, 'Carta 8')
  await store.dispatch(saveOwnPublication({ ...args, body, id: 8 }))
  assert.equal(current(store).items[0].name, 'Editada')
  await store.dispatch(setOwnPublicationStatus({ ...args, id: 8, action: 'pause' }))
  assert.equal(current(store).items[0].status, 'INACTIVO')
  await store.dispatch(removeOwnPublication({ ...args, id: 8 }))
  assert.deepEqual(current(store).items, [])
  assert.deepEqual(calls.map(c => c.method), ['POST', 'PUT', 'PATCH', 'DELETE'])
  assert.equal(current(store).busyId, null)
})

test('subida de fotos usa thunk, no escribe un File en el store ni guarda el token', async t => {
  const file = new File(['fixture'], 'foto.png', { type: 'image/png' })
  t.mock.method(axios, 'request', async config => {
    assert.equal(config.method, 'POST')
    assert.equal(config.url, 'http://localhost:8080/products/images')
    assert.ok(config.data instanceof FormData)
    return reply({ url: 'https://example.invalid/foto.png' }, 201)
  })
  const store = makeStore()
  const action = await store.dispatch(uploadOwnPublicationPhoto({ ...scope(), file, busyId: 'image' }))
  assert.equal(action.type, 'publications/uploadPhoto/fulfilled')
  assert.equal(action.payload, 'https://example.invalid/foto.png')
  assert.equal(current(store).busyId, null)
  assert.equal('file' in current(store), false)
  assert.doesNotThrow(() => JSON.stringify(current(store)))
})

test('errores 401 y 404 se conservan para cerrar sesión o presentar mensaje', async t => {
  const mock = t.mock.method(axios, 'request', async () => { throw {
    response: { status: 401, data: { message: 'No vale' } },
  } })
  const store = makeStore()
  let result = await store.dispatch(saveOwnPublication({ ...scope(), busyId: 'new', body: {} }))
  assert.equal(result.error.status, 401)
  assert.equal(result.error.message, 'Tu sesión venció. Volvé a ingresar.')
  mock.mock.mockImplementation(async () => { throw {
    response: { status: 404, data: { message: 'No está' } },
  } })
  result = await store.dispatch(setOwnPublicationStatus({ ...scope(), busyId: 7, id: 7, action: 'pause' }))
  assert.equal(result.error.status, 404)
  assert.equal(current(store).operationError, 'La publicación ya no está disponible. Actualizá el listado.')
})

test('un GET anterior que finaliza después de guardar no reemplaza la edición', async t => {
  const gate = deferred()
  let gets = 0
  t.mock.method(axios, 'request', async config => {
    if (config.method === 'GET') {
      gets++
      if (gets === 2) return gate.promise
      return reply({ content: [product(1)], totalPages: 1, number: 0 })
    }
    if (config.method === 'PUT') return reply(product(1, 1, 'Nueva edición'))
    throw Error('Solicitud inesperada ' + config.method)
  })
  const store = makeStore()
  await store.dispatch(fetchOwnPublications(scope()))
  const old = store.dispatch(fetchOwnPublications(scope()))
  const mutation = await store.dispatch(saveOwnPublication({
    ...scope(), busyId: 1, id: 1, body: { name: 'Nueva edición' },
  }))
  assert.equal(mutation.type, 'publications/save/fulfilled')
  gate.resolve(reply({ content: [product(1)], totalPages: 1, number: 0 }))
  await old
  assert.equal(current(store).items[0].name, 'Nueva edición')
})

test('logout y cambio de cuenta descartan acciones anteriores del mismo usuario o de otro', async t => {
  const gate = deferred()
  t.mock.method(axios, 'request', async config => {
    if (config.method === 'GET') return gate.promise
    return reply(product(2, 2))
  })
  const store = makeStore()
  const old = store.dispatch(fetchOwnPublications(scope(1, 1)))
  store.dispatch(publicationsSessionCleared())
  store.dispatch(saveOwnPublication({ ...scope(2, 2), busyId: 2, id: 2, body: {} }))
  gate.resolve(reply({ content: [product(1, 1)], totalPages: 1, number: 0 }))
  await old
  assert.equal(current(store).ownerId, 2)
  assert.equal(current(store).items.some(p => p.sellerId === 1), false)
  store.dispatch(publicationsSessionCleared())
  const next = store.dispatch(fetchOwnPublications(scope(1, 3)))
  await next
  store.dispatch(publicationsSessionCleared())
  assert.deepEqual(current(store).items, [])
})

test('error local y liberación posterior notifican al hook sin datos sensibles', () => {
  const store = makeStore()
  store.dispatch(publicationLocalError('No se puede reactivar'))
  assert.equal(current(store).operationError, 'No se puede reactivar')
  store.dispatch(publicationMutationReleased())
  assert.equal(current(store).operationRevision, 1)
  assert.equal(JSON.stringify(current(store)).includes('session-fixture-token'), false)
})
