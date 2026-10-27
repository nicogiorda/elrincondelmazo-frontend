import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getPublications, savePublication, changePublicationStatus, deletePublication, uploadPublicationPhoto } from '../src/services/publicationsApi.js'

const product = { id: 7, sellerId: 1, status: 'ACTIVO' }
const body = { name: 'Carta', description: 'QA', price: 10, type: 'CARTA', imageUrls: ['https://example.invalid/a.png'], stock: 2, collectionId: 1 }
const options = () => ({ userId: 1, token: 'publication-fixture', signal: new AbortController().signal })
const operations = [
  ['listado', o => getPublications(2, o), '/products/mine?page=2&size=20', 'GET', 200, { content: [product], totalPages: 3, number: 2 }],
  ['crear', o => savePublication(body, undefined, o), '/products', 'POST', 201, product],
  ['editar', o => savePublication(body, 7, o), '/products/7', 'PUT', 200, product],
  ['pausar', o => changePublicationStatus(7, 'pause', o), '/products/7/pause', 'PATCH', 200, product],
  ['reactivar', o => changePublicationStatus(7, 'resume', o), '/products/7/resume', 'PATCH', 200, product],
  ['eliminar', o => deletePublication(7, o), '/products/7', 'DELETE', 204, undefined],
]
for (const [name, operation, path, method, status, data] of operations) {
  test(name + ': contrato, autenticación y cancelación', async t => {
    const o = options()
    const mock = t.mock.method(globalThis, 'fetch', async (url, init) => {
      assert.equal(url, 'http://localhost:8080' + path)
      assert.equal(init.method, method)
      assert.equal(init.signal, o.signal)
      assert.equal(Boolean(init.headers.Authorization), true)
      if (['POST', 'PUT'].includes(method)) {
        assert.deepEqual(JSON.parse(init.body), body)
        assert.equal(init.headers['Content-Type'], 'application/json')
      } else assert.equal(init.body, undefined)
      if (status === 204) return { ok: true, status, json: () => assert.fail('204 no se interpreta como JSON') }
      return Response.json(data, { status })
    })
    assert.deepEqual(await operation(o), data)
    assert.equal(mock.mock.callCount(), 1)
  })
  test(name + ': conserva 401, 403, 404 y error del servidor', async t => {
    const mock = t.mock.method(globalThis, 'fetch')
    for (const status of [401, 403, 404, 500]) {
      mock.mock.mockImplementation(async () => Response.json({ message: 'Error QA' }, { status }))
      await assert.rejects(operation(options()), { status, message: status === 401 ? 'Tu sesión venció. Volvé a ingresar.' : 'Error QA' })
    }
  })
}
for (const data of [null, {}, { content: null, totalPages: 1 }, { content: [], totalPages: -1 },
  { content: [], totalPages: '1' }, { content: [null], totalPages: 1 },
  { content: [{ id: 7, sellerId: 2 }], totalPages: 1 }, { content: [product], totalPages: 1, number: 8 }]) {
  test('rechaza página inválida ' + JSON.stringify(data), async t => {
    t.mock.method(globalThis, 'fetch', async () => Response.json(data))
    await assert.rejects(getPublications(0, options()), /página válida/)
  })
}
test('vacío es válido y conserva totalPages cero', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ content: [], totalPages: 0, number: 0 }))
  assert.deepEqual((await getPublications(0, options())).content, [])
})
test('mutaciones rechazan vendedor, ID o JSON incorrectos', async t => {
  const mock = t.mock.method(globalThis, 'fetch')
  for (const data of [null, {}, { ...product, id: 8 }, { ...product, sellerId: 2 }]) {
    mock.mock.mockImplementation(async () => Response.json(data))
    await assert.rejects(savePublication(body, 7, options()), /publicación esperada/)
    await assert.rejects(changePublicationStatus(7, 'pause', options()), /publicación esperada/)
  }
  mock.mock.mockImplementation(async () => new Response('no JSON', { status: 201 }))
  await assert.rejects(savePublication(body, undefined, options()), /publicación esperada/)
})
test('los códigos de éxito incorrectos no confirman operaciones', async t => {
  const mock = t.mock.method(globalThis, 'fetch')
  for (const [, operation, , , status] of operations) {
    mock.mock.mockImplementation(async () => Response.json(product, { status: status === 200 ? 201 : 200 }))
    await assert.rejects(operation(options()), /no confirmó/)
  }
})
test('IDs y acciones inválidas no envían solicitudes', async t => {
  const mock = t.mock.method(globalThis, 'fetch', () => assert.fail('HTTP inesperado'))
  await assert.rejects(savePublication(body, -1, options()), /ID válido/)
  await assert.rejects(changePublicationStatus(7, 'activate', options()), /acción/)
  await assert.rejects(deletePublication('7/delete', options()), /ID válido/)
  assert.equal(mock.mock.callCount(), 0)
})
test('imagen envía FormData con archivo y sin Content-Type manual', async t => {
  const file = new File(['image-fixture'], 'foto.png', { type: 'image/png' }), o = options()
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, 'http://localhost:8080/products/images')
    assert.equal(init.method, 'POST'); assert.equal(init.signal, o.signal)
    assert.equal(Boolean(init.headers.Authorization), true)
    assert.equal(init.headers['Content-Type'], undefined)
    assert.ok(init.body instanceof FormData)
    assert.deepEqual([...init.body.keys()], ['file'])
    assert.equal(init.body.get('file').name, 'foto.png')
    assert.equal(await init.body.get('file').text(), 'image-fixture')
    return Response.json({ url: 'https://example.invalid/foto.png' }, { status: 201 })
  })
  assert.equal(await uploadPublicationPhoto(file, o), 'https://example.invalid/foto.png')
})
for (const url of [null, '', 'https://', '/foto.png', 'data:image/png;base64,xx', 'javascript:alert(1)']) {
  test('imagen rechaza URL ' + url, async t => {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ url }, { status: 201 }))
    await assert.rejects(uploadPublicationPhoto(new Blob(), options()), /URL de imagen válida/)
  })
}
test('subida conserva errores HTTP y no reintenta automáticamente', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json({ detail: 'Archivo inválido' }, { status: 400 }))
  await assert.rejects(uploadPublicationPhoto(new Blob(), options()), { status: 400, message: 'Archivo inválido' })
  assert.equal(mock.mock.callCount(), 1)
})
test('red y cancelación se propagan sin reintentos', async t => {
  const mock = t.mock.method(globalThis, 'fetch')
  for (const error of [new TypeError('Red QA'), new DOMException('Abortado', 'AbortError')]) {
    mock.mock.mockImplementation(async () => { throw error })
    for (const [, operation] of operations) await assert.rejects(operation(options()), e => e === error)
  }
  assert.equal(mock.mock.callCount(), operations.length * 2)
})
