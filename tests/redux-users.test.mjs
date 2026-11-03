import './fixtures/axios-verb-test-bridge.mjs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import axios from 'axios'
import { configureStore } from '@reduxjs/toolkit'
import userReducer, {
  fetchAuthenticatedUser, loginUser, registerUser, stageAuthCredentials,
  discardAuthCredentials, sessionAuthenticated, sessionEnded, sessionErrorChanged,
  authenticatedUserUpdated,
} from '../src/Redux/userSlice.js'

const user = { id: 3, firstName: 'QA', lastName: 'Usuario',
  email: 'qa@example.invalid', role: 'USUARIO', active: true }
const candidate = 'fixture-token'
const credentials = { email: user.email, password: 'contraseña-secreta-fixture' }
const create = () => configureStore({
  reducer: { users: userReducer },
  middleware: getDefaultMiddleware => getDefaultMiddleware({
    thunk: { extraArgument: { authToken: () => candidate } },
  }),
})
const state = store => store.getState().users
const wait = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

test('userSlice gestiona usuario y recuperación, sin contraseñas en el store', () => {
  const store = create()
  store.dispatch(sessionAuthenticated({ user, token: candidate }))
  assert.equal(state(store).user.id, 3)
  assert.equal(state(store).token, candidate)
  assert.equal(JSON.stringify(state(store)).includes(credentials.password), false)
  store.dispatch(sessionEnded())
  assert.equal(state(store).user, null)
  assert.equal(state(store).token, null)
})

test('GET de recuperación se despacha con createAsyncThunk, Axios y extraReducers', async t => {
  const gate = wait()
  t.mock.method(axios, 'request', async config => {
    assert.equal(config.url, 'http://localhost:8080/users/me')
    assert.equal(config.method, 'GET')
    assert.equal(config.headers.Authorization, 'Bearer ' + candidate)
    return gate.promise
  })
  const store = create()
  const request = store.dispatch(fetchAuthenticatedUser())
  assert.equal(state(store).loading, true)
  gate.resolve({ data: user, status: 200 })
  const action = await request
  assert.equal(action.type, 'users/fetchCurrent/fulfilled')
  assert.equal(state(store).loading, false)
  assert.deepEqual(state(store).user, user)
})

test('login y registro son thunks: pendientes, completados, credenciales opacas', async t => {
  const calls = []
  t.mock.method(axios, 'request', async config => {
    calls.push(config)
    if (config.url.endsWith('/users/me')) return { data: user, status: 200 }
    return { data: { access_token: candidate }, status: 200 }
  })
  for (const [operation, endpoint] of [
    [loginUser, '/api/v1/auth/authenticate'],
    [registerUser, '/api/v1/auth/register'],
  ]) {
    const store = create()
    const key = stageAuthCredentials(credentials)
    const action = await store.dispatch(operation(key))
    assert.ok(operation.fulfilled.match(action))
    assert.equal(action.meta.arg, key)
    assert.equal(JSON.stringify(action.meta).includes(credentials.password), false)
    assert.equal(state(store).authStatus, 'succeeded')
    assert.equal(state(store).user, null,
      'La sesión no se publica antes de validar la versión activa en useSession')
    assert.equal(action.payload.user.id, 3)
    assert.equal(calls.at(-2).url.endsWith(endpoint), true)
    store.dispatch(sessionAuthenticated(action.payload))
    assert.equal(state(store).user.id, 3)
    assert.equal(state(store).token, candidate)
    discardAuthCredentials(key)
  }
})

test('fallo de login se publica en rejected con status 401 y permite reintento', async t => {
  const mock = t.mock.method(axios, 'request')
  mock.mock.mockImplementation(async () => { throw { response: { status: 401, data: {} } } })
  const store = create()
  let key = stageAuthCredentials(credentials)
  let action = await store.dispatch(loginUser(key))
  assert.ok(loginUser.rejected.match(action))
  assert.equal(action.error.status, 401)
  assert.match(state(store).authError, /contraseña/)
  assert.equal(state(store).user, null)
  mock.mock.mockImplementation(async config => config.url.endsWith('/users/me')
    ? { data: user, status: 200 } : { data: { access_token: candidate }, status: 200 })
  key = stageAuthCredentials(credentials)
  action = await store.dispatch(loginUser(key))
  assert.ok(loginUser.fulfilled.match(action))
  assert.equal(state(store).authError, '')
})

test('logout elimina el requestId: respuesta antigua no restaura usuario ni JWT', async t => {
  const gate = wait()
  t.mock.method(axios, 'request', async () => gate.promise)
  const store = create()
  const request = store.dispatch(fetchAuthenticatedUser())
  store.dispatch(sessionEnded())
  gate.resolve({ data: user, status: 200 })
  await request
  assert.equal(state(store).user, null)
  assert.equal(state(store).token, null)
  assert.equal(state(store).loading, false)
})

test('abort de thunk no deja una sesión parcial', async t => {
  const gate = wait()
  t.mock.method(axios, 'request', async () => gate.promise)
  const store = create()
  const key = stageAuthCredentials(credentials)
  const request = store.dispatch(loginUser(key))
  request.abort()
  const result = await request
  assert.ok(loginUser.rejected.match(result))
  assert.equal(result.meta.aborted, true)
  assert.equal(state(store).user, null)
  assert.equal(state(store).authError, '')
  gate.resolve({ data: { access_token: candidate }, status: 200 })
})

test('actualización de perfil solo modifica al usuario autenticado', () => {
  const store = create()
  store.dispatch(sessionAuthenticated({ user, token: candidate }))
  store.dispatch(authenticatedUserUpdated({ ...user, id: 999, firstName: 'Otro' }))
  assert.equal(state(store).user.firstName, 'QA')
  store.dispatch(authenticatedUserUpdated({ ...user, firstName: 'Actualizado' }))
  assert.equal(state(store).user.firstName, 'Actualizado')
  store.dispatch(sessionErrorChanged('Error controlado'))
  assert.equal(state(store).sessionError, 'Error controlado')
})

test('la autenticación falla si el registro temporal ya se descartó', async () => {
  const store = create()
  const id = stageAuthCredentials(credentials)
  discardAuthCredentials(id)
  const action = await store.dispatch(loginUser(id))
  assert.ok(loginUser.rejected.match(action))
  assert.match(action.error.message, /ya no está disponible/)
})
