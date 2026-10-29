import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getPromotions, getPromotion, savePromotion, setPromotionActive } from '../src/services/promotionsApi.js'
import { promotionFromBackend, promotionToBackend } from '../src/utils/promotionMapper.js'

const fixture = { id: 87, name: 'Promo QA', description: null, type: 'CANTIDAD', discountPercentage: 17.25,
  minimumQuantity: 3, minimumAmount: null, productType: null, paymentMethod: null, collectionId: null, productId: null,
  stackable: false, active: true, startDate: '2026-10-28T08:15:22.123456', endDate: null }
const body = promotionToBackend(promotionFromBackend(fixture))
const options = () => ({ token: 'admin-fixture', signal: new AbortController().signal })
const operations = [
  ['listado', o => getPromotions(o), '/promotions', 'GET', 200, [fixture]],
  ['detalle', o => getPromotion(87, o), '/promotions/87', 'GET', 200, fixture],
  ['crear', o => savePromotion(body, undefined, o), '/promotions', 'POST', 201, fixture],
  ['editar', o => savePromotion(body, 87, o), '/promotions/87', 'PUT', 200, fixture],
  ['activar', o => setPromotionActive(87, true, o), '/promotions/87/activate', 'PATCH', 200, fixture],
  ['desactivar', o => setPromotionActive(87, false, o), '/promotions/87/deactivate', 'PATCH', 200, { ...fixture, active: false }],
]
for (const [name, operation, path, method, status, data] of operations) {
  test(name + ': URL, método, cuerpo, señal y respuesta', async t => {
    const o = options()
    const mock = t.mock.method(globalThis, 'fetch', async (url, init) => {
      assert.equal(url, 'http://localhost:8080' + path); assert.equal(init.method, method)
      assert.equal(init.signal, o.signal); assert.ok(init.headers.Authorization)
      if (['POST', 'PUT'].includes(method)) {
        assert.deepEqual(JSON.parse(init.body), body)
        assert.equal(init.headers['Content-Type'], 'application/json')
        assert.equal(Object.hasOwn(JSON.parse(init.body), 'active'), false)
      } else assert.equal(init.body, undefined)
      return Response.json(data, { status })
    })
    assert.deepEqual(await operation(o), data); assert.equal(mock.mock.callCount(), 1)
  })
  test(name + ': errores HTTP, código de éxito inesperado, red y aborto', async t => {
    const mock = t.mock.method(globalThis, 'fetch')
    for (const code of [401, 403, 404, 500]) {
      mock.mock.mockImplementation(async () => Response.json({ message: 'Error QA' }, { status: code }))
      await assert.rejects(operation(options()), { status: code, message: code === 401 ? 'Tu sesión venció. Volvé a ingresar.' : 'Error QA' })
    }
    mock.mock.mockImplementation(async () => Response.json(data, { status: status === 200 ? 201 : 200 }))
    await assert.rejects(operation(options()), /no confirmó/)
    for (const error of [new TypeError('Red QA'), new DOMException('Cancelada', 'AbortError')]) {
      mock.mock.mockImplementation(async () => { throw error })
      await assert.rejects(operation(options()), e => e === error)
    }
    assert.equal(mock.mock.callCount(), 7)
  })
}
for (const invalid of [null, {}, { ...fixture, id: 88 }, { ...fixture, active: 'true' }, { ...fixture, type: 'OTRO' },
  { ...fixture, discountPercentage: null }, { ...fixture, discountPercentage: 'abc' }, { ...fixture, discountPercentage: 101 },
  { ...fixture, collectionId: -1 }, { ...fixture, stackable: 'false' }, { ...fixture, startDate: null }]) {
  test('rechaza promoción inválida ' + JSON.stringify(invalid), async t => {
    t.mock.method(globalThis, 'fetch', async () => Response.json(invalid))
    await assert.rejects(getPromotion(87, options()), /promoción esperada/)
    await assert.rejects(savePromotion(body, 87, options()), /promoción esperada/)
  })
}
test('lista vacía válida; lista incompleta y JSON inválido se rechazan', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json([]))
  assert.deepEqual(await getPromotions(options()), [])
  mock.mock.mockImplementation(async () => Response.json([fixture, {}]))
  await assert.rejects(getPromotions(options()), /promoción esperada/)
  mock.mock.mockImplementation(async () => new Response('no JSON'))
  await assert.rejects(getPromotions(options()), /no es una lista/)
  await assert.rejects(getPromotion(87, options()), /promoción esperada/)
})
test('ID inválido no envía HTTP; PATCH verifica el estado devuelto', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json(fixture))
  await assert.rejects(getPromotion('87/delete', options()), /ID/)
  await assert.rejects(savePromotion(body, 0, options()), /ID/)
  await assert.rejects(setPromotionActive(87, 'false', options()), /estado/)
  assert.equal(mock.mock.callCount(), 0)
  await assert.rejects(setPromotionActive(87, false, options()), /no confirmó el estado/)
})
for (const [kind, type, conditions] of [
  ['quantity', 'CANTIDAD', { minimumQuantity: 4, productType: 'SOBRE' }],
  ['collection', 'COLECCION', { collectionId: 901 }],
  ['type', 'TIPO_PRODUCTO', { productType: 'LOOTBOX' }],
  ['payment', 'METODO_PAGO', { paymentMethod: 'TARJETA_DE_DEBITO' }],
  ['minimum', 'MONTO_MINIMO', { minimumAmount: 1234.56 }],
  ['product', 'PRODUCTO', { productId: 721 }],
]) test('mapeo bidireccional ' + kind + ': condiciones, nulos y fechas locales', () => {
  const backend = { ...fixture, minimumQuantity: null, type, ...conditions, endDate: '2026-11-15T21:45:30' }
  const front = promotionFromBackend(backend), mapped = promotionToBackend(front)
  assert.equal(front.kind, kind); assert.equal(front.enabled, true); assert.equal(front.discount, 17.25)
  assert.equal(mapped.type, type); assert.equal(mapped.stackable, false)
  assert.equal(mapped.startDate, backend.startDate); assert.equal(mapped.endDate, backend.endDate)
  for (const field of ['minimumQuantity', 'minimumAmount', 'productType', 'paymentMethod', 'collectionId', 'productId']) {
    assert.equal(mapped[field], conditions[field] ?? null)
  }
  assert.equal(mapped.description, ''); assert.equal(Object.hasOwn(mapped, 'active'), false)
})
test('fechas de formulario sin UTC, opcionales y validación existente de tipo', () => {
  const front = { ...promotionFromBackend(fixture), name: '  QA  ', startDate: '2026-10-28', endDate: '2026-10-29' }
  assert.equal(promotionToBackend(front).startDate, '2026-10-28T00:00:00')
  assert.equal(promotionToBackend(front).endDate, '2026-10-29T23:59:59')
  assert.equal(promotionToBackend({ ...front, endDate: '' }).endDate, null)
  assert.equal(promotionToBackend(front).name, 'QA')
  assert.equal(promotionToBackend(front).productType, null)
  assert.throws(() => promotionToBackend({ ...front, kind: 'type', productType: '' }), /tipo de producto válido/)
})
