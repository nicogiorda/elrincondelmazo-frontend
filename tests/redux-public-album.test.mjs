import assert from 'node:assert/strict'
import test from 'node:test'
import { configureStore } from '@reduxjs/toolkit'
import { mockAxios } from './fixtures/mockAxios.mjs'
import reducer, { loadPublicAlbum, publicAlbumCleared, loadOwnAlbum } from '../src/Redux/albumSlice.js'
import { sessionEnded, sessionAuthenticated } from '../src/Redux/userSlice.js'

const viewerId = 7
const ownerId = 13
const JWT = 'public-album-test-token'
const scope = { viewerId, ownerId }
const album = (id = ownerId, visibility = 'PUBLIC') => ({
  id: 100, userId: id, visibility,
  sections: [
    { id: 1, key: 'NBA', pageCount: 2,
      cards: [{ id: 22, name: 'Carta compartida', imageUrl: '', origin: 'MANUAL',
        pageNumber: 1, slotIndex: 0 }] },
    { id: 2, key: 'MY_LITTLE_PONY', pageCount: 1, cards: [] },
    { id: 3, key: 'CARS', pageCount: 1, cards: [] },
    { id: 4, key: 'MARVEL', pageCount: 1, cards: [] },
  ],
})
const reply = data => ({ status: 200, data })
const store = () => configureStore({
  reducer: { album: reducer },
  middleware: getDefaultMiddleware => getDefaultMiddleware({
    thunk: { extraArgument: { albumToken: () => JWT } },
  }),
})
const state = s => s.getState().album

test('lee un álbum PUBLIC ajeno con Axios y JWT, sin cargar compras privadas', async t => {
  const axios = mockAxios(t, request => {
    assert.equal(request.method, 'GET')
    assert.equal(request.url, 'http://localhost:8080/albums/users/13')
    assert.equal(request.headers.Authorization, 'Bearer ' + JWT)
    assert.ok(request.signal instanceof AbortSignal)
    return reply(album())
  })
  const s = store()
  await s.dispatch(loadPublicAlbum(scope)).unwrap()
  assert.equal(state(s).publicView.album.userId, ownerId)
  assert.equal(state(s).publicView.album.sections[0].cards[0].name, 'Carta compartida')
  assert.equal(state(s).album, null)
  assert.deepEqual(state(s).purchases, [])
  assert.equal(JSON.stringify(state(s)).includes(JWT), false)
  assert.equal(axios.mock.callCount(), 1)
})

test('404 de álbum privado se representa genéricamente sin exponer fotos', async t => {
  mockAxios(t, () => { throw { response: { status: 404, data: { message: 'owner private metadata' } } } })
  const s = store()
  const action = await s.dispatch(loadPublicAlbum(scope))
  assert.ok(loadPublicAlbum.rejected.match(action))
  assert.equal(action.error.status, 404)
  assert.equal(state(s).publicView.album, null)
  assert.equal(state(s).publicView.error, 'Este álbum no está disponible.')
  assert.doesNotMatch(JSON.stringify(state(s)), /owner private metadata/)
})

test('rechaza un álbum PRIVATE incluso ante respuesta de backend defectuosa', async t => {
  mockAxios(t, () => reply(album(ownerId, 'PRIVATE')))
  const s = store()
  const action = await s.dispatch(loadPublicAlbum(scope))
  assert.ok(loadPublicAlbum.rejected.match(action))
  assert.equal(action.error.status, 404)
  assert.equal(state(s).publicView.album, null)
})

test('rechaza álbum de propietario distinto y no lo muestra', async t => {
  mockAxios(t, () => reply(album(55)))
  const s = store()
  const action = await s.dispatch(loadPublicAlbum(scope))
  assert.ok(loadPublicAlbum.rejected.match(action))
  assert.match(state(s).publicView.error, /inválido/)
  assert.equal(state(s).publicView.album, null)
})

test('401 conserva el código de autorización y no expone datos antiguos', async t => {
  let errorMode = false
  mockAxios(t, () => {
    if (errorMode) throw { response: { status: 401 } }
    return reply(album())
  })
  const s = store()
  await s.dispatch(loadPublicAlbum(scope))
  errorMode = true
  const failed = await s.dispatch(loadPublicAlbum(scope))
  assert.equal(failed.error.status, 401)
  assert.equal(state(s).publicView.album, null)
  assert.match(state(s).publicView.error, /sesión venció/)
})

test('solicitudes anteriores de otro usuario no contaminan el álbum nuevo', async t => {
  let resolveFirst
  mockAxios(t, request => {
    if (request.url.endsWith('/13')) return new Promise(resolve => { resolveFirst = resolve })
    return reply(album(14))
  })
  const s = store()
  const old = s.dispatch(loadPublicAlbum(scope))
  await s.dispatch(loadPublicAlbum({ viewerId, ownerId: 14 }))
  resolveFirst(reply(album()))
  await old
  assert.equal(state(s).publicView.ownerId, 14)
  assert.equal(state(s).publicView.album.userId, 14)
})

test('cambio de cuenta y cierre de sesión eliminan los datos de visitantes', async t => {
  mockAxios(t, () => reply(album()))
  const s = store()
  await s.dispatch(loadPublicAlbum(scope))
  s.dispatch(sessionEnded())
  assert.equal(state(s).publicView.album, null)
  await s.dispatch(loadPublicAlbum(scope))
  s.dispatch(sessionAuthenticated({ user: { id: 99 } }))
  assert.equal(state(s).publicView.album, null)
  assert.equal(state(s).publicView.viewerId, null)
  await s.dispatch(loadPublicAlbum(scope))
  s.dispatch(publicAlbumCleared())
  assert.equal(state(s).publicView.album, null)
})

test('la vista pública no altera la carga y aislamiento del álbum propio', async t => {
  mockAxios(t, request => reply(request.url.endsWith('/me') ? album(viewerId, 'PRIVATE') : album()))
  const s = store()
  await s.dispatch(loadOwnAlbum({ ownerId: viewerId }))
  await s.dispatch(loadPublicAlbum(scope))
  assert.equal(state(s).album.userId, viewerId)
  assert.equal(state(s).publicView.album.userId, ownerId)
})
