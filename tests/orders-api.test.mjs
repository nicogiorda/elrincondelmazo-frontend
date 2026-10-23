import assert from 'node:assert/strict'
import { test } from 'node:test'
import { previewOrder, createOrder, getOrders, getOrderDetail } from '../src/services/ordersApi.js'

const attempt = { paymentMethod: 'TRANSFERENCIA', expectedTotal: 90, requestKey: '10000000-0000-4000-8000-000000000001' }
const quote = { subtotal: 100, totalDiscount: 10, total: 90,
  promotions: [{ promotionId: 4, promotionName: 'Transferencia QA', discountApplied: 10 }] }
const order = { id: 19, orderDate: '2026-10-22T12:00:00', state: 'PENDIENTE', paymentMethod: 'TRANSFERENCIA',
  ...quote, items: [{ id: 2, productId: 7, productName: 'Producto QA', quantity: 1, price: 100 }] }
const controller = new AbortController()
const options = { token: 'session-fixture', signal: controller.signal }

for (const [name, run, path, method, body, data, status] of [
  ['cotización', () => previewOrder('TRANSFERENCIA', options), '/orders/preview', 'POST', { paymentMethod: 'TRANSFERENCIA' }, quote, 200],
  ['confirmación 201', () => createOrder(attempt, options), '/orders', 'POST', attempt, order, 201],
  ['historial', () => getOrders(options), '/orders', 'GET', undefined, [order], 200],
  ['detalle', () => getOrderDetail(19, options), '/orders/19', 'GET', undefined, order, 200],
]) test(name + ': conserva endpoint, JWT, señal y cuerpo sin GET ni reintento adicional', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, 'http://localhost:8080' + path)
    assert.equal(init.method, method)
    assert.equal(init.signal, controller.signal)
    assert.deepEqual(init.headers, { Authorization: 'Bearer session-fixture', ...(body ? { 'Content-Type': 'application/json' } : {}) })
    assert.equal(init.body, body ? JSON.stringify(body) : undefined)
    return Response.json(data, { status })
  })
  assert.deepEqual(await run(), data)
  assert.equal(mock.mock.callCount(), 1)
})

test('la confirmación envía exclusivamente los tres campos del contrato y no genera claves', async t => {
  const bodies = []
  t.mock.method(globalThis, 'fetch', async (_, init) => {
    bodies.push(JSON.parse(init.body))
    return Response.json(order, { status: 201 })
  })
  await createOrder({ ...attempt, userId: 99, items: ['no deben enviarse'] }, options)
  await createOrder(attempt, options)
  assert.deepEqual(bodies, [attempt, attempt])
})

test('cada solicitud usa su token propio sin heredar autenticación de otra sesión', async t => {
  const headers = []
  t.mock.method(globalThis, 'fetch', async (_, init) => { headers.push(init.headers); return Response.json([]) })
  await getOrders({ token: 'session-a-fixture' })
  await getOrders()
  await getOrderDetail(19, { token: 'session-b-fixture' })
  assert.deepEqual(headers, [{ Authorization: 'Bearer session-a-fixture' }, {}, { Authorization: 'Bearer session-b-fixture' }])
})

for (const [status, data, message] of [
  [401, { message: 'otro mensaje' }, 'Tu sesión venció. Volvé a ingresar.'],
  [403, { message: 'Acceso denegado' }, 'Acceso denegado'],
  [409, { message: 'El total cambió', detail: 'otra causa' }, 'El total cambió'],
  [422, { detail: 'Carrito inválido' }, 'Carrito inválido'],
]) test('rechazo HTTP ' + status + ' conserva mensaje y estado sin marcar éxito ambiguo', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json(data, { status }))
  for (const run of [() => previewOrder('TRANSFERENCIA', options), () => createOrder(attempt, options),
    () => getOrders(options), () => getOrderDetail(19, options)]) {
    await assert.rejects(run(), error => error.status === status && error.message === message && !error.ambiguous)
  }
  assert.equal(mock.mock.callCount(), 4)
})

for (const status of [500, 502, 503]) test('HTTP ' + status + ' en confirmación es ambiguo y conserva el error del servidor', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'Fallo controlado QA' }, { status }))
  await assert.rejects(createOrder(attempt, options), { status, message: 'Fallo controlado QA', ambiguous: true })
  assert.equal(mock.mock.callCount(), 1)
})

for (const [name, change] of [
  ['sin identidad', () => ({})],
  ['identidad negativa', value => ({ ...value, id: -1 })],
  ['sin fecha', value => ({ ...value, orderDate: undefined })],
  ['fecha inválida', value => ({ ...value, orderDate: 'no es una fecha' })],
  ['sin estado', value => ({ ...value, state: '' })],
  ['otro medio de pago', value => ({ ...value, paymentMethod: 'MERCADO_PAGO' })],
  ['importe diferente del aceptado', value => ({ ...value, total: 100 })],
  ['subtotal inválido', value => ({ ...value, subtotal: null })],
  ['descuento inválido', value => ({ ...value, totalDiscount: -1 })],
  ['sin ítems', value => ({ ...value, items: undefined })],
  ['ítems vacíos', value => ({ ...value, items: [] })],
  ['ítem inválido', value => ({ ...value, items: [{ ...value.items[0], quantity: 0 }] })],
  ['sin promociones', value => ({ ...value, promotions: undefined })],
  ['promoción inválida', value => ({ ...value, promotions: [{ ...value.promotions[0], discountApplied: null }] })],
]) test('201 ' + name + ' no permite mostrar confirmación ni asumir que no hubo compra', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json(change(order), { status: 201 }))
  await assert.rejects(createOrder(attempt, options), error => error.ambiguous === true && error.status === 201
    && error.message.includes('Revisá tus pedidos antes de reintentar'))
  assert.equal(mock.mock.callCount(), 1)
})

test('JSON inválido o respuesta exitosa sin detalle se consideran ambiguos', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => new Response('JSON incompleto', { status: 201 }))
  await assert.rejects(createOrder(attempt, options), { status: 201, ambiguous: true })
  mock.mock.mockImplementation(async () => new Response(null, { status: 204 }))
  await assert.rejects(createOrder(attempt, options), { status: 204, ambiguous: true })
  mock.mock.mockImplementation(async () => Response.json(order, { status: 200 }))
  await assert.rejects(createOrder(attempt, options), { status: 200, ambiguous: true })
  assert.equal(mock.mock.callCount(), 3)
})

test('error HTTP sin JSON conserva código y mensaje; 409 sigue siendo rechazo explícito', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('conflicto', { status: 409 }))
  await assert.rejects(createOrder(attempt, options), error => error.status === 409
    && error.message === 'No se pudo completar la operación (HTTP 409).' && !error.ambiguous)
})

test('fallo de red conserva TypeError y mensaje sin mutar la excepción original ni reintentar', async t => {
  const failure = Object.freeze(new TypeError('Conexión perdida QA'))
  const mock = t.mock.method(globalThis, 'fetch', async () => { throw failure })
  await assert.rejects(createOrder(attempt, options), error => error instanceof TypeError
    && error.message === failure.message && error.cause === failure && error.ambiguous)
  assert.equal(failure.ambiguous, undefined)
  await assert.rejects(previewOrder('TRANSFERENCIA', options), error => error === failure)
  await assert.rejects(getOrders(options), error => error === failure)
  await assert.rejects(getOrderDetail(19, options), error => error === failure)
  assert.equal(mock.mock.callCount(), 4)
})

test('aborto de confirmación no se confunde con rechazo explícito del servidor', async t => {
  const abort = new AbortController()
  const mock = t.mock.method(globalThis, 'fetch', (_, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  }))
  const pending = createOrder(attempt, { token: 'session-fixture', signal: abort.signal })
  abort.abort()
  await assert.rejects(pending, error => error.name === 'AbortError' && error.ambiguous && error.cause === abort.signal.reason)
  assert.equal(mock.mock.callCount(), 1)
})

test('las lecturas propagan la cancelación original y permiten historial vacío', async t => {
  const failure = new DOMException('cancelado', 'AbortError')
  const mock = t.mock.method(globalThis, 'fetch', async () => { throw failure })
  for (const run of [() => previewOrder('TRANSFERENCIA', options), () => getOrders(options), () => getOrderDetail(19, options)]) {
    await assert.rejects(run(), error => error === failure)
  }
  mock.mock.mockImplementation(async () => Response.json([]))
  assert.deepEqual(await getOrders(options), [])
  assert.equal(mock.mock.callCount(), 4)
})
