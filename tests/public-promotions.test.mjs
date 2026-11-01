import assert from 'node:assert/strict'
import test from 'node:test'
import { invalidatePublicPromotions, loadPublicPromotions, subscribePublicPromotionsInvalidation } from '../src/services/publicPromotions.js'

const promo = { id: 8, type: 'COLECCION', discountPercentage: '15.50', active: true, description: null, startDate: null, endDate: null }
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
const deferred = () => {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}
async function withFetch(handler, fn) {
  const original = globalThis.fetch
  invalidatePublicPromotions()
  globalThis.fetch = handler
  try { await fn() } finally { globalThis.fetch = original; invalidatePublicPromotions() }
}

test('public promotions share one pending HTTP call and map data', async () => {
  const gate = deferred()
  let count = 0
  await withFetch((url) => {
    assert.equal(url, 'http://localhost:8080/promotions/public')
    count++
    return gate.promise
  }, async () => {
    const first = loadPublicPromotions()
    const second = loadPublicPromotions()
    assert.strictEqual(first, second)
    assert.equal(count, 1)
    gate.resolve(json([promo]))
    const list = await first
    assert.deepEqual(list, [{ ...promo, kind: 'collection', discount: 15.5, enabled: true, description: '', startDate: '', endDate: '' }])
  })
})

test('a settled request is not used as a persistent cache', async () => {
  let calls = 0
  await withFetch(() => {
    calls++
    return Promise.resolve(json([]))
  }, async () => {
    assert.deepEqual(await loadPublicPromotions(), [])
    assert.deepEqual(await loadPublicPromotions(), [])
    assert.equal(calls, 2)
  })
})

test('errors and invalid JSON shapes propagate and allow later retry', async () => {
  let calls = 0
  await withFetch(() => {
    calls++
    if (calls === 1) return Promise.resolve(json({ message: 'Server problem' }, 500))
    if (calls === 2) return Promise.resolve(json({ promotions: [] }))
    return Promise.resolve(json([promo]))
  }, async () => {
    await assert.rejects(loadPublicPromotions(), /HTTP 500/)
    await assert.rejects(loadPublicPromotions(), /no es una lista/)
    assert.equal((await loadPublicPromotions())[0].id, 8)
    assert.equal(calls, 3)
  })
})

test('a stale request completing cannot clear a newer pending request', async () => {
  const first = deferred()
  const second = deferred()
  let calls = 0
  await withFetch(() => (++calls === 1 ? first.promise : second.promise), async () => {
    const previous = loadPublicPromotions()
    invalidatePublicPromotions()
    const newer = loadPublicPromotions()
    first.resolve(json([promo]))
    await previous
    assert.strictEqual(loadPublicPromotions(), newer)
    assert.equal(calls, 2)
    second.resolve(json([]))
    assert.deepEqual(await newer, [])
  })
})

test('invalidations notify listeners and cleanup removes subscription', async () => {
  let called = 0
  const unsubscribe = subscribePublicPromotionsInvalidation(() => { called++ })
  invalidatePublicPromotions()
  unsubscribe()
  invalidatePublicPromotions()
  assert.equal(called, 1)
})
