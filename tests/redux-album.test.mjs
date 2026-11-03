import { mockAxios } from './fixtures/mockAxios.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { File } from 'node:buffer'
import { configureStore } from '@reduxjs/toolkit'
import reducer, {
  loadOwnAlbum, loadAlbumPurchases, addAlbumPurchase, addAlbumManual,
  moveAlbumCard, removeAlbumCard, changeAlbumVisibility, albumCleared,
} from '../src/Redux/albumSlice.js'
import { sessionEnded, sessionAuthenticated } from '../src/Redux/userSlice.js'

const AUTH = 'fixture-album-jwt'
const ownerId = 7
const scope = { ownerId }
const album = (id = ownerId) => ({
  id: 15, userId: id, visibility: 'PRIVATE',
  sections: [
    { id: 1, key: 'NBA', pageCount: 1, cards: [] },
    { id: 2, key: 'MY_LITTLE_PONY', pageCount: 1, cards: [] },
    { id: 3, key: 'CARS', pageCount: 1, cards: [] },
    { id: 4, key: 'MARVEL', pageCount: 1, cards: [] },
  ],
})
const available = [{ orderItemId: 110, orderId: 14, name: 'Carta de Cars',
  imageUrl: 'https://example.invalid/card.webp', purchasedQuantity: 2,
  usedQuantity: 0, availableQuantity: 2 }]
const card = { id: 34, name: 'Carta de Cars', imageUrl: 'https://example.invalid/card.webp',
  origin: 'PURCHASE', pageNumber: 1, slotIndex: 4 }
const reply = (data, status = 200) => ({ status, data })
const makeStore = () => configureStore({
  reducer: { album: reducer },
  middleware: getDefaultMiddleware => getDefaultMiddleware({
    thunk: { extraArgument: { albumToken: () => AUTH } },
  }),
})
const state = store => store.getState().album
const check = (request, method, url) => {
  assert.equal(request.method, method)
  assert.equal(request.url, 'http://localhost:8080' + url)
  assert.equal(request.headers.Authorization, 'Bearer ' + AUTH)
  assert.ok(request.signal instanceof AbortSignal)
}

test('GET álbum y compras desde Redux, token fuera del estado', async t => {
  const axios = mockAxios(t, request => {
    if (request.url.endsWith('/purchases')) {
      check(request, 'GET', '/albums/me/purchases')
      return reply(available)
    }
    check(request, 'GET', '/albums/me')
    return reply(album())
  })
  const store = makeStore()
  await store.dispatch(loadOwnAlbum(scope)).unwrap()
  await store.dispatch(loadAlbumPurchases(scope)).unwrap()
  assert.equal(state(store).album.visibility, 'PRIVATE')
  assert.deepEqual(state(store).album.sections.map(s => s.key),
    ['NBA', 'MY_LITTLE_PONY', 'CARS', 'MARVEL'])
  assert.equal(state(store).purchases[0].availableQuantity, 2)
  assert.equal(state(store).ownerId, ownerId)
  assert.equal(JSON.stringify(state(store)).includes(AUTH), false)
  assert.equal(axios.mock.callCount(), 2)
})

test('POST carta comprada usa cantidad de pedido y destino, sin pagos externos', async t => {
  const axios = mockAxios(t, request => {
    check(request, 'POST', '/albums/me/cards/purchase')
    assert.deepEqual(request.data, { orderItemId: 110, section: 'MARVEL', pageNumber: 1, slotIndex: 4 })
    return reply(card, 201)
  })
  const store = makeStore()
  await store.dispatch(addAlbumPurchase({ ...scope, orderItemId: 110,
    section: 'MARVEL', pageNumber: 1, slotIndex: 4 })).unwrap()
  assert.equal(state(store).saving, false)
  assert.equal(axios.mock.callCount(), 1)
})

test('POST foto manual via FormData sin Content-Type fijo', async t => {
  const axios = mockAxios(t, request => {
    check(request, 'POST', '/albums/me/cards/manual')
    assert.equal(request.headers['Content-Type'], undefined)
    assert.ok(request.data instanceof FormData)
    assert.equal(request.data.get('name'), 'Mi cromo')
    assert.equal(request.data.get('section'), 'NBA')
    assert.equal(request.data.get('pageNumber'), '1')
    assert.equal(request.data.get('slotIndex'), '0')
    assert.equal(request.data.get('image').name, 'foto.png')
    return reply({ ...card, origin: 'MANUAL', name: 'Mi cromo' }, 201)
  })
  const store = makeStore()
  const image = new File(['fixture'], 'foto.png', { type: 'image/png' })
  await store.dispatch(addAlbumManual({ ...scope, section: 'NBA', pageNumber: 1,
    slotIndex: 0, name: 'Mi cromo', image })).unwrap()
  assert.equal(axios.mock.callCount(), 1)
})

test('PATCH mover, DELETE quitar y PATCH privacidad usan los endpoints oficiales', async t => {
  const axios = mockAxios(t, request => {
    if (request.method === 'PATCH' && request.url.endsWith('/cards/34')) {
      check(request, 'PATCH', '/albums/me/cards/34')
      assert.deepEqual(request.data, { section: 'CARS', pageNumber: 1, slotIndex: 3, replaceExisting: true })
      return reply({ ...card, slotIndex: 3 })
    }
    if (request.method === 'DELETE') {
      check(request, 'DELETE', '/albums/me/cards/34')
      return reply(undefined, 204)
    }
    check(request, 'PATCH', '/albums/me/visibility')
    assert.deepEqual(request.data, { visibility: 'PUBLIC' })
    return reply({ ...album(), visibility: 'PUBLIC' })
  })
  const store = makeStore()
  await store.dispatch(moveAlbumCard({ ...scope, cardId: 34, section: 'CARS',
    pageNumber: 1, slotIndex: 3, replaceExisting: true })).unwrap()
  assert.equal(await store.dispatch(removeAlbumCard({ ...scope, cardId: 34 })).unwrap(), 34)
  await store.dispatch(changeAlbumVisibility({ ...scope, visibility: 'PUBLIC' })).unwrap()
  assert.equal(axios.mock.callCount(), 3)
})

test('409 y 401 preservan status para mostrar conflicto o cerrar sesión', async t => {
  let status = 409
  mockAxios(t, () => { throw { response: { status } } })
  const store = makeStore()
  const conflict = await store.dispatch(addAlbumPurchase({
    ...scope, orderItemId: 110, section: 'NBA', pageNumber: 1, slotIndex: 0,
  }))
  assert.ok(addAlbumPurchase.rejected.match(conflict))
  assert.equal(conflict.error.status, 409)
  assert.match(state(store).mutationError, /ocupada|ejemplares/i)
  status = 401
  const unauthorized = await store.dispatch(loadOwnAlbum(scope))
  assert.equal(unauthorized.error.status, 401)
  assert.match(state(store).error, /sesión venció/)
})

test('logout elimina cartas y compras privadas de Redux', async t => {
  mockAxios(t, request => reply(request.url.endsWith('/purchases') ? available : album()))
  const store = makeStore()
  await store.dispatch(loadOwnAlbum(scope))
  await store.dispatch(loadAlbumPurchases(scope))
  store.dispatch(sessionEnded())
  assert.deepEqual(state(store), reducer(undefined, { type: '@@init' }))
  await store.dispatch(loadOwnAlbum(scope))
  store.dispatch(sessionAuthenticated({ user: { id: ownerId }, token: 'not-persisted-here' }))
  assert.equal(state(store).ownerId, null)
  assert.equal(state(store).album, null)
})

test('respuesta tardía de cuenta anterior no se publica sobre sesión nueva', async t => {
  let resolveOld
  let calls = 0
  mockAxios(t, () => {
    if (++calls === 1) return new Promise(resolve => { resolveOld = resolve })
    return reply(album(99))
  })
  const store = makeStore()
  const old = store.dispatch(loadOwnAlbum(scope))
  store.dispatch(albumCleared())
  await store.dispatch(loadOwnAlbum({ ownerId: 99 }))
  resolveOld(reply(album()))
  await old
  assert.equal(state(store).ownerId, 99)
  assert.equal(state(store).album.userId, 99)
})

test('respuesta mal formada es rechazada sin contaminar el estado', async t => {
  mockAxios(t, () => reply({ id: 15, sections: [true] }))
  const store = makeStore()
  const failed = await store.dispatch(loadOwnAlbum(scope))
  assert.ok(loadOwnAlbum.rejected.match(failed))
  assert.equal(state(store).album, null)
  assert.match(state(store).error, /inválido/)
})
