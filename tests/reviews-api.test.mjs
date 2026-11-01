import assert from 'node:assert/strict'
import test from 'node:test'
import { createReview, getReviews } from '../src/services/reviewsApi.js'

const sample = { id: 17, productId: 42, userId: 3, userName: 'QA', rating: 5, comment: 'Muy bien', createdAt: '2026-10-20T13:00:00' }
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } })
async function mocked(handler, action) {
  const previous = globalThis.fetch
  const calls = []
  globalThis.fetch = (...args) => { calls.push(args); return handler(...args) }
  try { await action(calls) } finally { globalThis.fetch = previous }
}
test('GET público sin JWT, con señal y lista de reseñas', async () => {
  await mocked(() => Promise.resolve(json([sample])), async calls => {
    const controller = new AbortController()
    assert.deepEqual(await getReviews(42, { signal: controller.signal }), [sample])
    assert.equal(calls.length, 1)
    assert.equal(calls[0][0], 'http://localhost:8080/products/42/reviews')
    assert.equal(calls[0][1].method, 'GET')
    assert.equal(calls[0][1].headers.Authorization, undefined)
    assert.equal(calls[0][1].signal, controller.signal)
  })
})
test('GET admite lista vacía y rechaza estructura inválida', async () => {
  await mocked(() => Promise.resolve(json([])), async () => assert.deepEqual(await getReviews(42), []))
  await mocked(() => Promise.resolve(json({ items: [] })), async () => {
    await assert.rejects(getReviews(42), /no es una lista/)
  })
})
test('GET conserva mensaje y status HTTP, sin reintentar', async () => {
  await mocked(() => Promise.resolve(json({ message: 'No encontrado' }, 404)), async calls => {
    await assert.rejects(getReviews(42), error => error.status === 404 && error.message === 'No encontrado')
    assert.equal(calls.length, 1)
  })
  await mocked(() => Promise.reject(new TypeError('Sin conexión')), async calls => {
    await assert.rejects(getReviews(42), /Sin conexión/)
    assert.equal(calls.length, 1)
  })
})
test('POST envía JWT y JSON, acepta exclusivamente HTTP 201', async () => {
  await mocked(() => Promise.resolve(json(sample, 201)), async calls => {
    assert.deepEqual(await createReview(42, { rating: 5, comment: 'Muy bien' }, { token: 'jwt-qa' }), sample)
    assert.equal(calls.length, 1)
    assert.equal(calls[0][1].method, 'POST')
    assert.equal(calls[0][1].headers.Authorization, 'Bearer jwt-qa')
    assert.equal(calls[0][1].body, JSON.stringify({ rating: 5, comment: 'Muy bien' }))
  })
  await mocked(() => Promise.resolve(json(sample)), async () => {
    await assert.rejects(createReview(42, { rating: 5, comment: 'Texto' }, { token: 'qa' }), /reseña esperada/)
  })
})
test('POST conserva 403 y 409 emitidos por Spring', async () => {
  for (const status of [403, 409]) {
    await mocked(() => Promise.resolve(json({ message: 'No permitido' }, status)), async () => {
      await assert.rejects(createReview(42, { rating: 5, comment: 'Texto' }, { token: 'qa' }),
        error => error.status === status && error.message === 'No permitido')
    })
  }
})
test('POST rechaza confirmación ajena o sin ID', async () => {
  for (const invalid of [{ ...sample, id: null }, { ...sample, productId: 99 }]) {
    await mocked(() => Promise.resolve(json(invalid, 201)), async () => {
      await assert.rejects(createReview(42, { rating: 5, comment: 'Texto' }, { token: 'qa' }), /reseña esperada/)
    })
  }
})
test('ID inválido no inicia solicitudes', async () => {
  await mocked(() => { throw new Error('No debería consultar') }, async calls => {
    await assert.rejects(getReviews('abc'), /ID válido/)
    await assert.rejects(createReview(0, { rating: 5, comment: 'Texto' }), /ID válido/)
    assert.equal(calls.length, 0)
  })
})
test('Se propaga AbortError sin reintentos', async () => {
  await mocked((_url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Abort', 'AbortError')), { once: true })
  }), async calls => {
    const controller = new AbortController()
    const promise = getReviews(42, { signal: controller.signal })
    controller.abort()
    await assert.rejects(promise, error => error.name === 'AbortError')
    assert.equal(calls.length, 1)
  })
})
