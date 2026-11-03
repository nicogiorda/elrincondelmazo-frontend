import './fixtures/axios-verb-test-bridge.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import axios from 'axios'
import { configureStore } from '@reduxjs/toolkit'
import reducer, {
  fetchProductReviews, publishProductReview, reviewSessionCleared, reviewRetryRequested,
} from '../src/Redux/reviewsSlice.js'

const review = (id = 17, productId = 42) => ({
  id, productId, userId: 3, userName: 'QA', rating: 5,
  comment: 'Muy bien', createdAt: '2026-10-20T13:00:00',
})
const scope = (ownerId = 3, generation = 2) => ({ ownerId, generation })
const create = () => configureStore({
  reducer: { reviews: reducer },
  middleware: getDefaultMiddleware => getDefaultMiddleware({
    thunk: { extraArgument: { reviewsToken: () => 'review-jwt-fixture' } },
  }),
})
const state = store => store.getState().reviews
const reply = (data, status = 200) => ({ status, data })
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { resolve, promise }
}

test('GET público sin JWT publica pending/fulfilled y almacena por producto', async t => {
  const gate = deferred()
  const mock = t.mock.method(axios, 'request', async config => {
    assert.equal(config.url, 'http://localhost:8080/products/42/reviews')
    assert.equal(config.headers, undefined)
    assert.equal(config.method, 'GET')
    return gate.promise
  })
  const store = create()
  const task = store.dispatch(fetchProductReviews({ productId: 42 }))
  assert.ok(state(store).reads[42])
  gate.resolve(reply([review()]))
  const action = await task
  assert.ok(fetchProductReviews.fulfilled.match(action))
  assert.deepEqual(state(store).byProduct[42], [review()])
  assert.equal(state(store).reads[42], undefined)
  assert.equal(mock.mock.callCount(), 1)
})

test('GET acepta lista vacía y fracaso conserva datos del otro producto', async t => {
  const mock = t.mock.method(axios, 'request', async () => reply([review(20, 42)]))
  const store = create()
  await store.dispatch(fetchProductReviews({ productId: 42 }))
  mock.mock.mockImplementation(async () => {
    throw { response: { status: 503, data: { message: 'Fallo QA' } } }
  })
  const result = await store.dispatch(fetchProductReviews({ productId: 99 }))
  assert.ok(fetchProductReviews.rejected.match(result))
  assert.equal(result.error.status, 503)
  assert.equal(state(store).errors[99], 'No pudimos cargar las reseñas.')
  assert.deepEqual(state(store).byProduct[42], [review(20, 42)])
  store.dispatch(reviewRetryRequested({ productId: 99 }))
  mock.mock.mockImplementation(async () => reply([]))
  await store.dispatch(fetchProductReviews({ productId: 99 }))
  assert.deepEqual(state(store).byProduct[99], [])
  assert.equal(state(store).errors[99], undefined)
})

test('POST añade reseña confirmada sin segundo GET ni duplicar IDs', async t => {
  const calls = []
  t.mock.method(axios, 'request', async config => {
    calls.push(config)
    return reply(review(), 201)
  })
  const store = create()
  const args = { ...scope(), productId: 42, rating: 5, comment: 'Muy bien' }
  const done = await store.dispatch(publishProductReview(args))
  assert.ok(publishProductReview.fulfilled.match(done))
  assert.deepEqual(state(store).byProduct[42], [review()])
  await store.dispatch(publishProductReview(args))
  assert.equal(state(store).byProduct[42].length, 1)
  assert.deepEqual(calls.map(x => x.method), ['POST', 'POST'])
  assert.deepEqual(calls[0].data, { rating: 5, comment: 'Muy bien' })
  assert.equal(calls[0].headers.Authorization, 'Bearer review-jwt-fixture')
  assert.equal(JSON.stringify(done).includes('review-jwt-fixture'), false)
  assert.equal(JSON.stringify(state(store)).includes('review-jwt-fixture'), false)
})

test('POST no admite 403 ni 409 y conserva reseña previa', async t => {
  const mock = t.mock.method(axios, 'request', async () => reply([review()]))
  const store = create()
  await store.dispatch(fetchProductReviews({ productId: 42 }))
  for (const code of [403, 409]) {
    mock.mock.mockImplementation(async () => {
      throw { response: { status: code, data: { message: 'No autorizado QA' } } }
    })
    const rejected = await store.dispatch(publishProductReview({
      ...scope(), productId: 42, rating: 4, comment: 'Repetida',
    }))
    assert.ok(publishProductReview.rejected.match(rejected))
    assert.equal(rejected.error.status, code)
    assert.equal(state(store).publication.error, 'No autorizado QA')
    assert.deepEqual(state(store).byProduct[42], [review()])
  }
})

test('POST 401 preserva status en rejected y unwrap para cierre de sesión', async t => {
  t.mock.method(axios, 'request', async () => {
    throw { response: { status: 401, data: {} } }
  })
  const store = create()
  await assert.rejects(store.dispatch(publishProductReview({
    ...scope(), productId: 42, rating: 5, comment: 'QA',
  })).unwrap(), { status: 401, message: 'Tu sesión venció. Volvé a ingresar.' })
})

test('GET anterior a POST no borra una reseña confirmada al llegar tarde', async t => {
  const gate = deferred()
  t.mock.method(axios, 'request', async config => config.method === 'GET'
    ? gate.promise : reply(review(), 201))
  const store = create()
  const old = store.dispatch(fetchProductReviews({ productId: 42 }))
  await store.dispatch(publishProductReview({
    ...scope(), productId: 42, rating: 5, comment: 'QA',
  }))
  gate.resolve(reply([]))
  await old
  assert.deepEqual(state(store).byProduct[42], [review()])
})

test('logout conserva reseñas públicas pero bloquea POST tardío de sesión previa', async t => {
  const gate = deferred()
  const mock = t.mock.method(axios, 'request', async () => reply([review(11)]))
  const store = create()
  await store.dispatch(fetchProductReviews({ productId: 42 }))
  mock.mock.mockImplementation(async () => gate.promise)
  const old = store.dispatch(publishProductReview({
    ...scope(), productId: 42, rating: 5, comment: 'QA',
  }))
  store.dispatch(reviewSessionCleared())
  gate.resolve(reply(review(99), 201))
  await old
  assert.deepEqual(state(store).byProduct[42], [review(11)])
  assert.equal(state(store).publication.ownerId, null)
})

test('una nueva sesión no acepta el éxito de un POST anterior', async t => {
  const gate = deferred()
  const mock = t.mock.method(axios, 'request', async () => gate.promise)
  const store = create()
  const old = store.dispatch(publishProductReview({
    ...scope(), productId: 42, rating: 5, comment: 'QA',
  }))
  store.dispatch(reviewSessionCleared())
  mock.mock.mockImplementation(async () => reply(review(88), 201))
  await store.dispatch(publishProductReview({
    ...scope(4, 3), productId: 42, rating: 5, comment: 'Cuenta B',
  }))
  gate.resolve(reply(review(), 201))
  await old
  assert.deepEqual(state(store).byProduct[42], [review(88)])
  assert.equal(state(store).publication.ownerId, 4)
})

test('AbortSignal no publica error visible ni respuesta tardía', async t => {
  const gate = deferred()
  t.mock.method(axios, 'request', async () => gate.promise)
  const store = create(), controller = new AbortController()
  const pending = store.dispatch(fetchProductReviews({ productId: 42 },
    { signal: controller.signal }))
  controller.abort()
  const result = await pending
  assert.ok(fetchProductReviews.rejected.match(result))
  assert.equal(result.meta.aborted, true)
  assert.equal(state(store).errors[42], undefined)
  gate.resolve(reply([review()]))
  assert.equal(state(store).byProduct[42], undefined)
})
