import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getProducts, getProduct, getCollections } from '../src/services/productsApi.js'
const page = { content: [{ id: 7 }], totalPages: 1, totalElements: 1, number: 0 }

for (const [name, operation, path, data] of [
  ['página', signal => getProducts('page=2&size=9&search=carta&type=CARTA&collectionId=4&minPrice=10&maxPrice=80', { signal }), '/products?page=2&size=9&search=carta&type=CARTA&collectionId=4&minPrice=10&maxPrice=80', page],
  ['detalle', signal => getProduct(7, { signal }), '/products/7', { id: 7 }],
  ['colecciones', signal => getCollections({ signal }), '/collections', [{ id: 4 }]],
]) test(name + ': conserva URL, GET, señal y ausencia de autenticación', async t => {
  const controller = new AbortController()
  const mock = t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, 'http://localhost:8080' + path)
    assert.equal(init.method, 'GET')
    assert.equal(init.signal, controller.signal)
    assert.deepEqual(init.headers, {})
    assert.equal(init.body, undefined)
    return Response.json(data)
  })
  assert.deepEqual(await operation(controller.signal), data)
  assert.equal(mock.mock.callCount(), 1)
})
for (const data of [null, {}, { ...page, content: {} }, { ...page, number: '0' },
  { ...page, totalPages: null }, { ...page, totalElements: undefined }]) {
  test('rechaza página inválida ' + JSON.stringify(data), async t => {
    t.mock.method(globalThis, 'fetch', async () => Response.json(data))
    await assert.rejects(getProducts('page=0&size=9'), /página válida/)
  })
}
for (const [context, suffix] of [['detail', 'seleccionado.'], ['cart', 'del carrito.'], ['selection', 'la selección.']]) {
  test('valida identidad y mensaje para ' + context, async t => {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ id: 8 }))
    await assert.rejects(getProduct(7, { context }), error => error.code === 'INVALID_PRODUCT' && error.message.endsWith(suffix))
  })
}
test('ID inválido nunca envía HTTP', async t => {
  const mock = t.mock.method(globalThis, 'fetch', () => { throw Error('No debe llamarse') })
  for (const id of [0, -1, '1x', '1/2', Number.MAX_SAFE_INTEGER + 1]) await assert.rejects(getProduct(id), /URL/)
  assert.equal(mock.mock.callCount(), 0)
})
for (const status of [401, 403, 404, 503]) test('HTTP ' + status + ': conserva código y mensajes de los consumidores', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'Error QA' }, { status }))
  await assert.rejects(getProduct(7), { status, message: status === 401 ? 'Tu sesión venció. Volvé a ingresar.' : 'Error QA' })
  await assert.rejects(getProduct(7, { context: 'selection' }), { status, message: 'No pudimos consultar el producto seleccionado (HTTP ' + status + ').' })
  await assert.rejects(getCollections(), { status, message: 'Error ' + status + ' al cargar colecciones' })
})
test('colecciones inválidas y JSON inválido no se aceptan', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json({}))
  await assert.rejects(getCollections(), /no es una lista/)
  mock.mock.mockImplementation(async () => new Response('no JSON'))
  await assert.rejects(getProducts('page=0'), /página válida/)
  await assert.rejects(getProduct(7), /no coincide/)
  await assert.rejects(getCollections(), SyntaxError)
})
test('cancelación y fallo de red se propagan sin reintentos', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => { throw new DOMException('cancelado', 'AbortError') })
  await assert.rejects(getProduct(7), { name: 'AbortError' })
  mock.mock.mockImplementation(async () => { throw new TypeError('sin conexión') })
  await assert.rejects(getProducts('page=0'), TypeError)
  await assert.rejects(getProduct(7), TypeError)
  assert.equal(mock.mock.callCount(), 3)
})
