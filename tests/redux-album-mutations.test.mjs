import assert from 'node:assert/strict'
import test from 'node:test'
import { File } from 'node:buffer'
import { configureStore } from '@reduxjs/toolkit'
import { mockAxios } from './fixtures/mockAxios.mjs'
import reducer, { loadOwnAlbum, loadAlbumPurchases, addAlbumPurchase, addAlbumManual,
  moveAlbumCard, removeAlbumCard, changeAlbumVisibility } from '../src/Redux/albumSlice.js'
import { sessionEnded } from '../src/Redux/userSlice.js'

const ownerId = 7
const scope = { ownerId }
const card = (id = 33, overrides = {}) => ({ id, name: 'Carta QA', imageUrl: '',
  origin: 'PURCHASE', pageNumber: 1, slotIndex: 0, ...overrides })
const album = (nba = [], cars = []) => ({
  id: 18, userId: ownerId, visibility: 'PRIVATE',
  sections: [
    { id: 1, key: 'NBA', pageCount: 1, cards: nba },
    { id: 2, key: 'CARS', pageCount: 1, cards: cars },
    { id: 3, key: 'MY_LITTLE_PONY', pageCount: 1, cards: [] },
    { id: 4, key: 'MARVEL', pageCount: 1, cards: [] },
  ],
})
const available = [{ orderItemId: 110, purchasedQuantity: 2, usedQuantity: 0,
  availableQuantity: 2, orderId: 17, name: 'Carta QA' }]
const reply = (data, status = 200) => ({ data, status })
const makeStore = () => configureStore({
  reducer: { album: reducer },
  middleware: middleware => middleware({
    thunk: { extraArgument: { albumToken: () => 'test-token' } },
  }),
})
const current = store => store.getState().album
async function prime(store) {
  await store.dispatch(loadOwnAlbum(scope)).unwrap()
  await store.dispatch(loadAlbumPurchases(scope)).unwrap()
}
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

test('POST de compra agrega action.payload y descuenta cupo en Redux, sin otro GET', async t => {
  const requests = mockAxios(t, request => {
    if (request.url.endsWith('/purchases')) return reply(available)
    if (request.method === 'GET') return reply(album())
    assert.equal(request.method, 'POST')
    assert.equal(request.url, 'http://localhost:8080/albums/me/cards/purchase')
    return reply(card(), 201)
  })
  const store = makeStore()
  await prime(store)
  await store.dispatch(addAlbumPurchase({ ...scope, orderItemId: 110, section: 'NBA',
    pageNumber: 1, slotIndex: 0 })).unwrap()
  assert.deepEqual(current(store).album.sections[0].cards, [card()])
  assert.equal(current(store).purchases[0].usedQuantity, 1)
  assert.equal(current(store).purchases[0].availableQuantity, 1)
  assert.equal(current(store).saving, false)
  assert.deepEqual(requests.mock.calls.map(r => r.method), ['GET', 'GET', 'POST'])
})

test('POST de carta manual usa payload y abre la página 2 cuando se completan 9 casilleros', async t => {
  const firstEight = Array.from({ length: 8 }, (_, i) => card(i + 1, {
    origin: 'MANUAL', slotIndex: i,
  }))
  const requests = mockAxios(t, request => request.method === 'GET'
    ? reply(request.url.endsWith('/purchases') ? available : album(firstEight))
    : reply(card(99, { origin: 'MANUAL', slotIndex: 8 }), 201))
  const store = makeStore()
  await prime(store)
  const image = new File(['png'], 'qa.png', { type: 'image/png' })
  const action = await store.dispatch(addAlbumManual({ ...scope, section: 'NBA',
    pageNumber: 1, slotIndex: 8, name: 'QA manual', image }))
  assert.ok(addAlbumManual.fulfilled.match(action))
  assert.equal(current(store).album.sections[0].cards.length, 9)
  assert.equal(current(store).album.sections[0].pageCount, 2)
  assert.equal(current(store).purchases[0].availableQuantity, 2)
  assert.equal(requests.mock.callCount(), 3)
})

test('PATCH mueve una carta, reemplaza el casillero ocupado y actualiza sin recargar', async t => {
  const source = card(33)
  const oldTarget = card(88, { origin: 'MANUAL', pageNumber: 1, slotIndex: 3 })
  const requests = mockAxios(t, request => request.method === 'GET'
    ? reply(request.url.endsWith('/purchases') ? available : album([source], [oldTarget]))
    : reply(card(33, { slotIndex: 3 })))
  const store = makeStore()
  await prime(store)
  await store.dispatch(moveAlbumCard({ ...scope, cardId: 33, section: 'CARS',
    pageNumber: 1, slotIndex: 3, replaceExisting: true })).unwrap()
  assert.deepEqual(current(store).album.sections[0].cards, [])
  assert.deepEqual(current(store).album.sections[1].cards, [card(33, { slotIndex: 3 })])
  assert.equal(requests.mock.callCount(), 3)
})

test('DELETE devuelve 204, quita por ID y no restaura otras cartas', async t => {
  const requests = mockAxios(t, request => request.method === 'GET'
    ? reply(request.url.endsWith('/purchases') ? available : album([card(33), card(44, { slotIndex: 2 })]))
    : reply(undefined, 204))
  const store = makeStore()
  await prime(store)
  await store.dispatch(removeAlbumCard({ ...scope, cardId: 33 })).unwrap()
  assert.deepEqual(current(store).album.sections[0].cards, [card(44, { slotIndex: 2 })])
  assert.equal(requests.mock.callCount(), 3)
})

test('DELETE sin HTTP 204 no puede quitar la carta localmente', async t => {
  mockAxios(t, request => request.method === 'GET'
    ? reply(request.url.endsWith('/purchases') ? available : album([card(33)]))
    : reply(undefined, 200))
  const store = makeStore()
  await prime(store)
  await assert.rejects(store.dispatch(removeAlbumCard({ ...scope, cardId: 33 })).unwrap(),
    { message: /no confirmó la eliminación/ })
  assert.equal(current(store).album.sections[0].cards.length, 1)
  assert.equal(current(store).saving, false)
})

test('PATCH de visibilidad publica el álbum confirmado sin consultar GET nuevamente', async t => {
  const requests = mockAxios(t, request => request.method === 'GET'
    ? reply(request.url.endsWith('/purchases') ? available : album([card(33)]))
    : reply({ ...album([card(33)]), visibility: 'PUBLIC' }))
  const store = makeStore()
  await prime(store)
  await store.dispatch(changeAlbumVisibility({ ...scope, visibility: 'PUBLIC' })).unwrap()
  assert.equal(current(store).album.visibility, 'PUBLIC')
  assert.equal(current(store).album.sections[0].cards.length, 1)
  assert.deepEqual(requests.mock.calls.map(request => request.method), ['GET', 'GET', 'PATCH'])
})

test('PATCH de visibilidad rechaza respuesta de propietario ajeno o estado incorrecto', async t => {
  const requests = mockAxios(t, request => request.method === 'GET'
    ? reply(request.url.endsWith('/purchases') ? available : album())
    : reply({ ...album(), userId: 99, visibility: 'PUBLIC' }))
  const store = makeStore()
  await prime(store)
  await assert.rejects(store.dispatch(changeAlbumVisibility({ ...scope, visibility: 'PUBLIC' })).unwrap(),
    { message: /álbum inválido/ })
  requests.mock.mockImplementation(request => request.method === 'PATCH'
    ? reply({ ...album(), visibility: 'PRIVATE' })
    : reply(album()))
  await assert.rejects(store.dispatch(changeAlbumVisibility({ ...scope, visibility: 'PUBLIC' })).unwrap(),
    { message: /no confirmó la visibilidad/ })
  assert.equal(current(store).album.visibility, 'PRIVATE')
})

test('un GET anterior al POST no puede borrar la nueva carta tras llegar tarde', async t => {
  const gate = deferred()
  let loads = 0
  mockAxios(t, request => {
    if (request.method === 'GET' && request.url.endsWith('/albums/me')) {
      loads += 1
      return loads === 1 ? reply(album()) : gate.promise
    }
    if (request.method === 'GET') return reply(available)
    return reply(card(77), 201)
  })
  const store = makeStore()
  await prime(store)
  const stale = store.dispatch(loadOwnAlbum(scope))
  await store.dispatch(addAlbumManual({ ...scope, section: 'NBA',
    pageNumber: 1, slotIndex: 0, name: 'QA', image: new File(['x'], 'qa.png') })).unwrap()
  gate.resolve(reply(album()))
  await stale
  assert.deepEqual(current(store).album.sections[0].cards, [card(77)])
})

test('409 y cambio de sesión conservan los datos seguros, sin publicar mutaciones viejas', async t => {
  const gate = deferred()
  let mode = 'ok'
  mockAxios(t, request => {
    if (request.method === 'GET') return reply(request.url.endsWith('/purchases') ? available : album())
    if (mode === 'fail') throw { response: { status: 409, data: { message: 'Posición ocupada' } } }
    return gate.promise
  })
  const store = makeStore()
  await prime(store)
  mode = 'fail'
  const rejected = await store.dispatch(addAlbumPurchase({ ...scope, orderItemId: 110,
    section: 'NBA', pageNumber: 1, slotIndex: 0 }))
  assert.equal(rejected.error.status, 409)
  assert.equal(current(store).album.sections[0].cards.length, 0)
  assert.equal(current(store).purchases[0].availableQuantity, 2)
  mode = 'pending'
  const stale = store.dispatch(addAlbumPurchase({ ...scope, orderItemId: 110,
    section: 'NBA', pageNumber: 1, slotIndex: 0 }))
  store.dispatch(sessionEnded())
  gate.resolve(reply(card(77), 201))
  await stale
  assert.equal(current(store).album, null)
  assert.deepEqual(current(store).purchases, [])
})
