import './fixtures/axios-verb-test-bridge.mjs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import axios from 'axios'
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
]) test(name + ': Axios conserva endpoint, JWT, señal y cuerpo sin reintentos', async t => {
  const mock = t.mock.method(axios, 'request', async config => {
    assert.equal(config.url, 'http://localhost:8080' + path)
    assert.equal(config.method, method)
    assert.equal(config.signal, controller.signal)
    assert.deepEqual(config.headers, { Authorization: 'Bearer session-fixture' })
    assert.deepEqual(config.data, body)
    return { status, data }
  })
  assert.deepEqual(await run(), data)
  assert.equal(mock.mock.callCount(), 1)
})

test('confirmación envía solo los tres campos y reutiliza exactamente el UUID recibido', async t => {
  const bodies = []
  t.mock.method(axios, 'request', async config => {
    bodies.push(config.data)
    return { status: 201, data: order }
  })
  await createOrder({ ...attempt, userId: 99, items: ['no deben enviarse'] }, options)
  await createOrder(attempt, options)
  assert.deepEqual(bodies, [attempt, attempt])
})

test('cada solicitud usa su token sin heredar autenticación de otra cuenta', async t => {
  const headers = []
  t.mock.method(axios, 'request', async config => {
    headers.push(config.headers)
    return { status: 200, data: [] }
  })
  await getOrders({ token: 'session-a-fixture' })
  await getOrders()
  await getOrderDetail(19, { token: 'session-b-fixture' })
  assert.deepEqual(headers, [{ Authorization: 'Bearer session-a-fixture' }, undefined,
    { Authorization: 'Bearer session-b-fixture' }])
})

for (const [status, data, message] of [
  [401, { message: 'otro mensaje' }, 'Tu sesión venció. Volvé a ingresar.'],
  [403, { message: 'Acceso denegado' }, 'Acceso denegado'],
  [409, { message: 'El total cambió', detail: 'otra causa' }, 'El total cambió'],
  [422, { detail: 'Carrito inválido' }, 'Carrito inválido'],
]) test('rechazo Axios HTTP ' + status + ' conserva status y nunca marca éxito ambiguo', async t => {
  const mock = t.mock.method(axios, 'request', async () => {
    throw { response: { status, data } }
  })
  for (const run of [() => previewOrder('TRANSFERENCIA', options), () => createOrder(attempt, options),
    () => getOrders(options), () => getOrderDetail(19, options)]) {
    await assert.rejects(run(), error => error.status === status
      && error.message === message && !error.ambiguous)
  }
  assert.equal(mock.mock.callCount(), 4)
})

for (const status of [500, 502, 503]) test('HTTP ' + status + ' en confirmación es ambiguo y no reintenta', async t => {
  const mock = t.mock.method(axios, 'request', async () => {
    throw { response: { status, data: { message: 'Fallo controlado QA' } } }
  })
  await assert.rejects(createOrder(attempt, options), {
    status, message: 'Fallo controlado QA', ambiguous: true,
  })
  assert.equal(mock.mock.callCount(), 1)
})

for (const [name, change] of [
  ['sin identidad', () => ({})],
  ['identidad negativa', value => ({ ...value, id: -1 })],
  ['sin fecha', value => ({ ...value, orderDate: undefined })],
  ['fecha inválida', value => ({ ...value, orderDate: 'no es una fecha' })],
  ['sin estado', value => ({ ...value, state: '' })],
  ['otro medio de pago', value => ({ ...value, paymentMethod: 'MERCADO_PAGO' })],
  ['importe diferente', value => ({ ...value, total: 100 })],
  ['subtotal inválido', value => ({ ...value, subtotal: null })],
  ['descuento inválido', value => ({ ...value, totalDiscount: -1 })],
  ['sin ítems', value => ({ ...value, items: undefined })],
  ['ítems vacíos', value => ({ ...value, items: [] })],
  ['ítem inválido', value => ({ ...value, items: [{ ...value.items[0], quantity: 0 }] })],
  ['sin promociones', value => ({ ...value, promotions: undefined })],
  ['promoción inválida', value => ({ ...value, promotions: [{ ...value.promotions[0], discountApplied: null }] })],
]) test('HTTP 201 ' + name + ' es ambiguo, no confirma ni genera otra clave', async t => {
  const mock = t.mock.method(axios, 'request', async () => ({ status: 201, data: change(order) }))
  await assert.rejects(createOrder(attempt, options), error => error.ambiguous === true
    && error.status === 201 && error.message.includes('Revisá tus pedidos antes de reintentar'))
  assert.equal(mock.mock.callCount(), 1)
})

test('respuesta no JSON, 204 o status 200 no confirman orden', async t => {
  const mock = t.mock.method(axios, 'request')
  mock.mock.mockImplementation(async () => ({ status: 201, data: 'JSON incompleto' }))
  await assert.rejects(createOrder(attempt, options), { status: 201, ambiguous: true })
  mock.mock.mockImplementation(async () => ({ status: 204, data: undefined }))
  await assert.rejects(createOrder(attempt, options), { status: 204, ambiguous: true })
  mock.mock.mockImplementation(async () => ({ status: 200, data: order }))
  await assert.rejects(createOrder(attempt, options), { status: 200, ambiguous: true })
  assert.equal(mock.mock.callCount(), 3)
})

test('HTTP 409 sin JSON conserva el código y no se considera ambiguo', async t => {
  t.mock.method(axios, 'request', async () => {
    throw { response: { status: 409, data: 'conflicto' } }
  })
  await assert.rejects(createOrder(attempt, options), error => error.status === 409
    && error.message === 'No se pudo completar la operación (HTTP 409).' && !error.ambiguous)
})

test('TypeError original de red conserva causa e intento sin reintentar', async t => {
  const failure = Object.freeze(new TypeError('Conexión perdida QA'))
  const mock = t.mock.method(axios, 'request', async () => { throw failure })
  await assert.rejects(createOrder(attempt, options), error => error instanceof TypeError
    && error.message === failure.message && error.cause === failure && error.ambiguous)
  assert.equal(failure.ambiguous, undefined)
  for (const run of [() => previewOrder('TRANSFERENCIA', options), () => getOrders(options),
    () => getOrderDetail(19, options)]) {
    await assert.rejects(run(), error => error === failure)
  }
  assert.equal(mock.mock.callCount(), 4)
})

test('Axios ERR_NETWORK se convierte a TypeError ambiguo solamente en POST /orders', async t => {
  const failure = Object.freeze({ code: 'ERR_NETWORK', message: 'Network Error' })
  const mock = t.mock.method(axios, 'request', async () => { throw failure })
  await assert.rejects(createOrder(attempt, options), error => error instanceof TypeError
    && error.ambiguous && error.cause?.cause === failure)
  await assert.rejects(previewOrder('TRANSFERENCIA', options), TypeError)
  assert.equal(mock.mock.callCount(), 2)
})

test('aborto de confirmación mantiene causa y se considera ambiguo', async t => {
  const abort = new AbortController()
  const mock = t.mock.method(axios, 'request', async () => {
    abort.abort()
    throw { code: 'ERR_CANCELED' }
  })
  await assert.rejects(createOrder(attempt, { token: 'session-fixture', signal: abort.signal }),
    error => error.name === 'AbortError' && error.ambiguous && error.cause === abort.signal.reason)
  assert.equal(mock.mock.callCount(), 1)
})

test('lecturas propagan cancelación original; historial vacío válido', async t => {
  const failure = new DOMException('cancelado', 'AbortError')
  const mock = t.mock.method(axios, 'request', async () => { throw failure })
  for (const run of [() => previewOrder('TRANSFERENCIA', options), () => getOrders(options),
    () => getOrderDetail(19, options)]) {
    await assert.rejects(run(), error => error === failure)
  }
  mock.mock.mockImplementation(async () => ({ status: 200, data: [] }))
  assert.deepEqual(await getOrders(options), [])
  assert.equal(mock.mock.callCount(), 4)
})
