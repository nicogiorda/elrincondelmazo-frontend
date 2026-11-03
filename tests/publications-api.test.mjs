import './fixtures/axios-verb-test-bridge.mjs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import axios from 'axios'
import { getPublications, savePublication, changePublicationStatus, deletePublication,
  uploadPublicationPhoto } from '../src/services/publicationsApi.js'

const product = { id: 7, sellerId: 1, status: 'ACTIVO' }
const body = { name: 'Carta', description: 'QA', price: 10, type: 'CARTA',
  imageUrls: ['https://example.invalid/a.png'], stock: 2, collectionId: 1 }
const options = () => ({ userId: 1, token: 'publication-fixture', signal: new AbortController().signal })
const operations = [
  ['listado', o => getPublications(2, o), '/products/mine?page=2&size=20', 'GET', 200,
    { content: [product], totalPages: 3, number: 2 }],
  ['crear', o => savePublication(body, undefined, o), '/products', 'POST', 201, product],
  ['editar', o => savePublication(body, 7, o), '/products/7', 'PUT', 200, product],
  ['pausar', o => changePublicationStatus(7, 'pause', o), '/products/7/pause', 'PATCH', 200, product],
  ['reactivar', o => changePublicationStatus(7, 'resume', o), '/products/7/resume', 'PATCH', 200, product],
  ['eliminar', o => deletePublication(7, o), '/products/7', 'DELETE', 204, undefined],
]
for (const [name, operation, path, method, status, data] of operations) {
  test(name + ': Axios respeta contrato, JWT y AbortSignal', async t => {
    const o = options()
    const mock = t.mock.method(axios, 'request', async config => {
      assert.equal(config.url, 'http://localhost:8080' + path)
      assert.equal(config.method, method)
      assert.equal(config.signal, o.signal)
      assert.equal(config.headers.Authorization, 'Bearer publication-fixture')
      if (['POST', 'PUT'].includes(method)) assert.deepEqual(config.data, body)
      else assert.equal(config.data, undefined)
      return { status, data }
    })
    assert.deepEqual(await operation(o), data)
    assert.equal(mock.mock.callCount(), 1)
  })
  test(name + ': error HTTP conserva 401, 403, 404 y mensaje del servidor', async t => {
    const mock = t.mock.method(axios, 'request')
    for (const status of [401, 403, 404, 500]) {
      mock.mock.mockImplementation(async () => { throw {
        response: { status, data: { message: 'Error QA' } },
      } })
      await assert.rejects(operation(options()), {
        status, message: status === 401 ? 'Tu sesión venció. Volvé a ingresar.' : 'Error QA',
      })
    }
  })
}
for (const data of [null, {}, { content: null, totalPages: 1 }, { content: [], totalPages: -1 },
  { content: [], totalPages: '1' }, { content: [null], totalPages: 1 },
  { content: [{ id: 7, sellerId: 2 }], totalPages: 1 },
  { content: [product], totalPages: 1, number: 8 }]) {
  test('rechaza página inválida ' + JSON.stringify(data), async t => {
    t.mock.method(axios, 'request', async () => ({ status: 200, data }))
    await assert.rejects(getPublications(0, options()), /página válida/)
  })
}
test('vacío es válido y conserva totalPages cero', async t => {
  t.mock.method(axios, 'request', async () => ({
    status: 200, data: { content: [], totalPages: 0, number: 0 },
  }))
  assert.deepEqual((await getPublications(0, options())).content, [])
})
test('mutaciones rechazan vendedor, ID y JSON incorrectos', async t => {
  const mock = t.mock.method(axios, 'request')
  for (const data of [null, {}, { ...product, id: 8 }, { ...product, sellerId: 2 }]) {
    mock.mock.mockImplementation(async () => ({ status: 200, data }))
    await assert.rejects(savePublication(body, 7, options()), /publicación esperada/)
    await assert.rejects(changePublicationStatus(7, 'pause', options()), /publicación esperada/)
  }
  mock.mock.mockImplementation(async () => ({ status: 201, data: 'no JSON' }))
  await assert.rejects(savePublication(body, undefined, options()), /publicación esperada/)
})
test('códigos de éxito incorrectos no confirman operaciones', async t => {
  const mock = t.mock.method(axios, 'request')
  for (const [, operation, , , status] of operations) {
    mock.mock.mockImplementation(async () => ({
      status: status === 200 ? 201 : 200, data: product,
    }))
    await assert.rejects(operation(options()), /no confirmó/)
  }
})
test('IDs y acciones inválidas no envían solicitudes', async t => {
  const mock = t.mock.method(axios, 'request', () => assert.fail('HTTP inesperado'))
  await assert.rejects(savePublication(body, -1, options()), /ID válido/)
  await assert.rejects(changePublicationStatus(7, 'activate', options()), /acción/)
  await assert.rejects(deletePublication('7/delete', options()), /ID válido/)
  assert.equal(mock.mock.callCount(), 0)
})
test('imagen envía FormData sin fijar el boundary ni Content-Type', async t => {
  const file = new File(['image-fixture'], 'foto.png', { type: 'image/png' }), o = options()
  t.mock.method(axios, 'request', async config => {
    assert.equal(config.url, 'http://localhost:8080/products/images')
    assert.equal(config.method, 'POST')
    assert.equal(config.signal, o.signal)
    assert.equal(config.headers.Authorization, 'Bearer publication-fixture')
    assert.equal(config.headers['Content-Type'], undefined)
    assert.ok(config.data instanceof FormData)
    assert.deepEqual([...config.data.keys()], ['file'])
    assert.equal(config.data.get('file').name, 'foto.png')
    assert.equal(await config.data.get('file').text(), 'image-fixture')
    return { status: 201, data: { url: 'https://example.invalid/foto.png' } }
  })
  assert.equal(await uploadPublicationPhoto(file, o), 'https://example.invalid/foto.png')
})
for (const url of [null, '', 'https://', '/foto.png', 'data:image/png;base64,xx', 'javascript:alert(1)']) {
  test('imagen rechaza URL ' + url, async t => {
    t.mock.method(axios, 'request', async () => ({ status: 201, data: { url } }))
    await assert.rejects(uploadPublicationPhoto(new Blob(), options()), /URL de imagen válida/)
  })
}
test('subida conserva errores HTTP y no reintenta automáticamente', async t => {
  const mock = t.mock.method(axios, 'request', async () => { throw {
    response: { status: 400, data: { detail: 'Archivo inválido' } },
  } })
  await assert.rejects(uploadPublicationPhoto(new Blob(), options()),
    { status: 400, message: 'Archivo inválido' })
  assert.equal(mock.mock.callCount(), 1)
})
test('errores de red y cancelación se propagan sin reintentos', async t => {
  const mock = t.mock.method(axios, 'request')
  for (const error of [new TypeError('Red QA'), new DOMException('Abortado', 'AbortError')]) {
    mock.mock.mockImplementation(async () => { throw error })
    for (const [, operation] of operations) await assert.rejects(operation(options()), e => e === error)
  }
  assert.equal(mock.mock.callCount(), operations.length * 2)
})
