import './fixtures/axios-verb-test-bridge.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import axios from 'axios'
import { configureStore } from '@reduxjs/toolkit'
import reducer, { fetchPublicPromotions, publicPromotionsInvalidated } from '../src/Redux/promotionsSlice.js'
import { invalidatePublicPromotions, subscribePublicPromotionsInvalidation } from '../src/services/publicPromotions.js'

const promo = { id: 8, type: 'COLECCION', discountPercentage: '15.50', active: true,
  description: null, startDate: null, endDate: null }
const create = () => configureStore({ reducer: { promotions: reducer } })
const pub = store => store.getState().promotions.public
const reply = data => ({ status: 200, data })
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

test('Redux comparte GET público pendiente y mapea respuestas Axios sin JWT', async t => {
  const gate = deferred()
  const mock = t.mock.method(axios, 'request', async config => {
    assert.equal(config.url, 'http://localhost:8080/promotions/public')
    assert.equal(config.method, 'GET')
    assert.equal(config.headers, undefined)
    return gate.promise
  })
  const store = create()
  const first = store.dispatch(fetchPublicPromotions())
  assert.equal(pub(store).status, 'loading')
  const second = store.dispatch(fetchPublicPromotions())
  const ignored = await second
  assert.ok(fetchPublicPromotions.rejected.match(ignored))
  assert.equal(ignored.meta.condition, true)
  assert.equal(mock.mock.callCount(), 1)
  gate.resolve(reply([promo]))
  await first
  assert.deepEqual(pub(store).items, [{ ...promo, kind: 'collection', discount: 15.5,
    enabled: true, description: '', startDate: '', endDate: '' }])
  assert.equal(pub(store).status, 'succeeded')
})

test('una nueva visita permite otro GET; no se guarda un caché persistente', async t => {
  const mock = t.mock.method(axios, 'request', async () => reply([]))
  const store = create()
  await store.dispatch(fetchPublicPromotions())
  store.dispatch(publicPromotionsInvalidated())
  await store.dispatch(fetchPublicPromotions())
  assert.equal(mock.mock.callCount(), 2)
  assert.deepEqual(pub(store).items, [])
})

test('error HTTP e invalid JSON quedan en rejected y permiten reintentar', async t => {
  let calls = 0
  t.mock.method(axios, 'request', async () => {
    if (++calls === 1) throw { response: { status: 500, data: { message: 'Fallo' } } }
    if (calls === 2) return reply({ promotions: [] })
    return reply([promo])
  })
  const store = create()
  const first = await store.dispatch(fetchPublicPromotions())
  assert.equal(first.error.status, 500)
  assert.match(pub(store).error, /HTTP 500/)
  await store.dispatch(fetchPublicPromotions())
  assert.match(pub(store).error, /no es una lista/)
  await store.dispatch(fetchPublicPromotions())
  assert.equal(pub(store).items[0].id, 8)
  assert.equal(pub(store).error, '')
  assert.equal(calls, 3)
})

test('una respuesta vieja nunca borra ni reemplaza el GET posterior a invalidación', async t => {
  const first = deferred(), second = deferred()
  let calls = 0
  t.mock.method(axios, 'request', async () => ++calls === 1 ? first.promise : second.promise)
  const store = create()
  const previous = store.dispatch(fetchPublicPromotions())
  store.dispatch(publicPromotionsInvalidated())
  const newer = store.dispatch(fetchPublicPromotions())
  first.resolve(reply([promo]))
  await previous
  assert.equal(pub(store).status, 'loading')
  second.resolve(reply([]))
  await newer
  assert.deepEqual(pub(store).items, [])
  assert.equal(calls, 2)
})

test('invalidación notifica a Home y cleanup elimina suscripción', () => {
  let called = 0
  const unsubscribe = subscribePublicPromotionsInvalidation(() => { called++ })
  invalidatePublicPromotions()
  unsubscribe()
  invalidatePublicPromotions()
  assert.equal(called, 1)
})
