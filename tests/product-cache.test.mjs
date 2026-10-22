import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createProductCache } from '../src/utils/productCache.js'
const product = (id = 7, price = 100) => ({ id, price, stock: 10, status: 'ACTIVO', sellerId: 9 })
const page = (items = [product()]) => ({ content: items, number: 0, totalPages: 1, totalElements: items.length })
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
function setup(overrides = {}) {
  let time = 100_000
  const calls = []
  const api = {
    getProducts: async (query, options) => { calls.push({ query, ...options }); return page() },
    getProduct: async (id, options) => { calls.push({ id, ...options }); return product(id) },
    ...overrides,
  }
  return { cache: createProductCache({ now: () => time, api }), calls, advance: ms => { time += ms } }
}

test('reutiliza páginas válidas y vence exactamente a los 60 segundos', async () => {
  const { cache, calls, advance } = setup()
  await cache.loadPage('page=0&size=4'); advance(59_999)
  assert.equal((await cache.loadPage('page=0&size=4')).content[0].id, 7)
  assert.equal(calls.length, 1)
  advance(1); cache.expire()
  await cache.loadPage('page=0&size=4')
  assert.equal(calls.length, 2)
})
test('capacidad de 20 páginas y expulsión de la consulta más antigua', async () => {
  const { cache, calls } = setup()
  for (let i = 0; i < 21; i++) await cache.loadPage('page=' + i)
  await cache.loadPage('page=1')
  assert.equal(calls.length, 21)
  await cache.loadPage('page=0')
  assert.equal(calls.length, 22)
  assert.ok(calls[0].signal.aborted)
})
test('consultas simultáneas comparten una única petición', async () => {
  const gate = deferred(); let count = 0
  const { cache } = setup({ getProducts: () => { count++; return gate.promise } })
  const a = cache.loadPage('page=0'), b = cache.loadPage('page=0')
  assert.equal(count, 1)
  gate.resolve(page())
  assert.deepEqual(await a, await b)
})
test('una página expulsada que ignora aborto no publica sus productos', async () => {
  const gate = deferred(); let first = true
  const { cache } = setup({ getProducts: async () => { if (first) { first = false; return gate.promise } return page([product(8)]) } })
  const old = cache.loadPage('page=0')
  const rejected = assert.rejects(old, /catálogo cambió/)
  for (let i = 1; i < 21; i++) await cache.loadPage('page=' + i)
  gate.resolve(page([product(99)])); await rejected
  assert.equal(cache.getSnapshot().products.some(p => p.id === 99), false)
})
test('error de página se elimina de caché y permite reintentar', async () => {
  let count = 0
  const { cache } = setup({ getProducts: async () => { if (++count === 1) throw Error('HTTP QA'); return page() } })
  await assert.rejects(cache.loadPage('page=0'), /HTTP QA/)
  assert.equal((await cache.loadPage('page=0')).content.length, 1)
  assert.equal(count, 2)
})
test('invalidación descarta páginas pendientes aunque el transporte ignore aborto', async () => {
  const gate = deferred()
  const { cache } = setup({ getProducts: () => gate.promise })
  const old = cache.loadPage('page=0')
  const rejected = assert.rejects(old, /catálogo cambió/)
  cache.invalidate(); cache.upsertProduct(product(7, 200))
  gate.resolve(page([product(7, 50)])); await rejected
  assert.equal(cache.getSnapshot().products[0].price, 200)
})
test('secuencias impiden que una página antigua reemplace un detalle reciente', async () => {
  const gate = deferred()
  const { cache } = setup({ getProducts: () => gate.promise, getProduct: async () => product(7, 200) })
  const old = cache.loadPage('page=0')
  await cache.loadProduct(7)
  gate.resolve(page([product(7, 50)]))
  assert.equal((await old).content[0].price, 200)
  assert.equal(cache.getSnapshot().products[0].price, 200)
})
test('detalle fresco se reutiliza, detalle vencido vuelve a consultarse', async () => {
  const { cache, calls, advance } = setup()
  await cache.loadProduct(7); await cache.loadProduct(7)
  assert.equal(calls.length, 1)
  advance(60_000)
  await cache.loadProduct(7)
  assert.equal(calls.length, 2)
})
test('detalle y metadatos comparten petición; cancelar uno conserva al otro', async () => {
  const gate = deferred(); let count = 0, signal
  const { cache } = setup({ getProduct: (id, options) => { count++; signal = options.signal; return gate.promise } })
  const controller = new AbortController()
  const a = cache.loadProduct(7, { signal: controller.signal, onlyMissing: true })
  const rejected = assert.rejects(a, { name: 'AbortError' })
  const b = cache.loadProduct(7)
  controller.abort()
  assert.equal(signal.aborted, false)
  gate.resolve(product()); await rejected
  assert.equal((await b).id, 7)
  assert.equal(count, 1)
})
test('último consumidor cancelado aborta y no contamina la siguiente sesión', async () => {
  const aGate = deferred(), bGate = deferred(); let count = 0, aSignal
  const { cache } = setup({ getProduct: (id, { signal }) => { count++; if (count === 1) { aSignal = signal; return aGate.promise } return bGate.promise } })
  const controller = new AbortController()
  const a = cache.loadProduct(7, { signal: controller.signal })
  const rejected = assert.rejects(a, { name: 'AbortError' })
  controller.abort(); assert.equal(aSignal.aborted, true)
  const b = cache.loadProduct(7)
  bGate.resolve(product(7, 200)); await b
  aGate.resolve(product(7, 50)); await rejected
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(cache.getSnapshot().products[0].price, 200)
  assert.equal(count, 2)
})
test('comprobación de vigencia del consumidor evita publicar metadatos obsoletos', async () => {
  const gate = deferred(); let current = true
  const { cache } = setup({ getProduct: () => gate.promise })
  const request = cache.loadProduct(7, { isCurrent: () => current, onlyMissing: true })
  const rejected = assert.rejects(request, { name: 'AbortError' })
  current = false; gate.resolve(product()); await rejected
  assert.deepEqual(cache.getSnapshot().products, [])
})
test('invalidación y expiración notifican a los consumidores sin exponer mapas', async () => {
  const { cache, advance } = setup(); const notifications = []
  const unsubscribe = cache.subscribeInvalidation(ids => notifications.push(ids))
  await cache.loadProduct(7); advance(60_000); cache.expire()
  assert.deepEqual([...notifications[0]], [7])
  assert.deepEqual(cache.getSnapshot().products, [])
  cache.invalidate(); assert.equal(notifications[1], undefined)
  unsubscribe(); cache.invalidate(); assert.equal(notifications.length, 2)
})
test('publicaciones públicas actualizan la única colección; las privadas quedan fuera', async () => {
  const { cache } = setup()
  cache.rememberProduct(product())
  cache.upsertProduct(product(7, 200))
  cache.rememberProduct(product(7, 50))
  assert.equal(cache.getSnapshot().products[0].price, 200)
  cache.syncPublications(9, [product(8), { ...product(9), status: 'INACTIVO' }])
  assert.deepEqual(cache.getSnapshot().products.map(p => p.id), [8])
  cache.removeProduct(8)
  assert.deepEqual(cache.getSnapshot().products, [])
})
test('instancias aisladas y errores de detalle recuperables', async () => {
  let count = 0
  const { cache } = setup({ getProduct: async () => { if (++count === 1) throw Error('HTTP QA'); return product() } })
  await assert.rejects(cache.loadProduct(7), /HTTP QA/)
  await cache.loadProduct(7)
  assert.equal(count, 2)
  assert.deepEqual(setup().cache.getSnapshot().products, [])
})

test('la revalidación explícita actualiza una selección aunque el producto esté fresco', async () => {
  let price = 100
  const { cache } = setup({ getProduct: async () => product(7, price) })
  await cache.loadProduct(7)
  price = 200
  assert.equal((await cache.loadProduct(7)).price, 100)
  assert.equal((await cache.loadProduct(7, { revalidate: true })).price, 200)
  assert.equal(cache.getSnapshot().products[0].price, 200)
})

test('una lectura local pendiente se invalida antes de entregar entidades borradas', async () => {
  const { cache } = setup()
  await cache.loadPage('page=0')
  const reading = cache.loadPage('page=0')
  const rejected = assert.rejects(reading, /catálogo cambió/)
  cache.invalidate()
  await rejected
})

test('una publicación inactiva impide que un detalle anterior restaure su versión pública', async () => {
  const gate = deferred()
  const { cache } = setup({ getProduct: () => gate.promise })
  const pending = cache.loadProduct(7)
  const rejected = assert.rejects(pending, /catálogo cambió/)
  cache.syncPublications(9, [{ ...product(7), status: 'INACTIVO' }])
  gate.resolve(product(7)); await rejected
  assert.deepEqual(cache.getSnapshot().products, [])
})
