import './fixtures/axios-verb-test-bridge.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import axios from 'axios'
import { createReview, getReviews } from '../src/services/reviewsApi.js'

const sample = { id: 17, productId: 42, userId: 3, userName: 'QA', rating: 5,
  comment: 'Muy bien', createdAt: '2026-10-20T13:00:00' }

test('GET público Axios sin JWT, con AbortSignal y lista de reseñas', async t => {
  const signal = new AbortController().signal
  const mock = t.mock.method(axios, 'request', async config => {
    assert.equal(config.url, 'http://localhost:8080/products/42/reviews')
    assert.equal(config.method, 'GET')
    assert.equal(config.headers, undefined)
    assert.equal(config.signal, signal)
    return { status: 200, data: [sample] }
  })
  assert.deepEqual(await getReviews(42, { signal }), [sample])
  assert.equal(mock.mock.callCount(), 1)
})

test('GET admite lista vacía y rechaza estructura inválida', async t => {
  const mock = t.mock.method(axios, 'request', async () => ({ status: 200, data: [] }))
  assert.deepEqual(await getReviews(42), [])
  mock.mock.mockImplementation(async () => ({ status: 200, data: { items: [] } }))
  await assert.rejects(getReviews(42), /no es una lista/)
})

test('GET conserva mensaje y status HTTP, sin reintentar', async t => {
  const mock = t.mock.method(axios, 'request', async () => {
    throw { response: { status: 404, data: { message: 'No encontrado' } } }
  })
  await assert.rejects(getReviews(42), { status: 404, message: 'No encontrado' })
  mock.mock.mockImplementation(async () => { throw new TypeError('Sin conexión') })
  await assert.rejects(getReviews(42), /Sin conexión/)
  assert.equal(mock.mock.callCount(), 2)
})

test('POST envía JWT y JSON, acepta exclusivamente HTTP 201', async t => {
  const mock = t.mock.method(axios, 'request', async config => {
    assert.equal(config.method, 'POST')
    assert.equal(config.url, 'http://localhost:8080/products/42/reviews')
    assert.deepEqual(config.headers, { Authorization: 'Bearer jwt-qa' })
    assert.deepEqual(config.data, { rating: 5, comment: 'Muy bien' })
    return { status: 201, data: sample }
  })
  assert.deepEqual(await createReview(42, { rating: 5, comment: 'Muy bien' }, { token: 'jwt-qa' }), sample)
  assert.equal(mock.mock.callCount(), 1)
  mock.mock.mockImplementation(async () => ({ status: 200, data: sample }))
  await assert.rejects(createReview(42, { rating: 5, comment: 'Texto' }, { token: 'qa' }), /reseña esperada/)
})

test('POST conserva 403, 409 y 401 emitidos por Spring', async t => {
  const mock = t.mock.method(axios, 'request')
  for (const status of [403, 409, 401]) {
    mock.mock.mockImplementation(async () => {
      throw { response: { status, data: { message: 'No permitido' } } }
    })
    await assert.rejects(createReview(42, { rating: 5, comment: 'Texto' }, { token: 'qa' }),
      { status, message: status === 401 ? 'Tu sesión venció. Volvé a ingresar.' : 'No permitido' })
  }
  assert.equal(mock.mock.callCount(), 3)
})

test('POST rechaza confirmación ajena o sin ID', async t => {
  const mock = t.mock.method(axios, 'request')
  for (const invalid of [{ ...sample, id: null }, { ...sample, productId: 99 }]) {
    mock.mock.mockImplementation(async () => ({ status: 201, data: invalid }))
    await assert.rejects(createReview(42, { rating: 5, comment: 'Texto' }, { token: 'qa' }), /reseña esperada/)
  }
  assert.equal(mock.mock.callCount(), 2)
})

test('ID inválido no inicia solicitudes', async t => {
  const mock = t.mock.method(axios, 'request', async () => { throw new Error('No debería consultar') })
  await assert.rejects(getReviews('abc'), /ID válido/)
  await assert.rejects(createReview(0, { rating: 5, comment: 'Texto' }), /ID válido/)
  assert.equal(mock.mock.callCount(), 0)
})

test('Se propaga AbortError sin reintentos', async t => {
  const controller = new AbortController()
  const mock = t.mock.method(axios, 'request', async () => {
    controller.abort()
    throw { code: 'ERR_CANCELED' }
  })
  await assert.rejects(getReviews(42, { signal: controller.signal }), error => error.name === 'AbortError')
  assert.equal(mock.mock.callCount(), 1)
})

test('ERR_NETWORK se transforma en TypeError y no reintenta', async t => {
  const mock = t.mock.method(axios, 'request', async () => { throw { code: 'ERR_NETWORK', message: 'Red QA' } })
  await assert.rejects(createReview(42, { rating: 5, comment: 'Texto' }, { token: 'qa' }), TypeError)
  assert.equal(mock.mock.callCount(), 1)
})

test('tokens distintos nunca se mezclan entre solicitudes', async t => {
  const seen = []
  t.mock.method(axios, 'request', async config => {
    seen.push(config.headers?.Authorization)
    return { status: config.method === 'POST' ? 201 : 200,
      data: config.method === 'POST' ? sample : [] }
  })
  await getReviews(42)
  await createReview(42, { rating: 5, comment: 'Texto' }, { token: 'A' })
  await createReview(42, { rating: 5, comment: 'Texto' }, { token: 'B' })
  assert.deepEqual(seen, [undefined, 'Bearer A', 'Bearer B'])
})
