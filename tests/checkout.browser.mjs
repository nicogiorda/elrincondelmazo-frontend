// React real en StrictMode; HTTP y reloj simulados, sin backend ni base de datos.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.BASE_URL || 'http://localhost:5173'
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const product = { id: 7, name: 'Producto checkout QA', price: 100, stock: 20, status: 'ACTIVO',
  type: 'CARTA', sellerId: 9, sellerName: 'Vendedor QA', collectionId: 1, collectionName: 'NBA',
  imageUrls: [], createdAt: '2026-10-22T10:00:00' }
const cart = (quantity = 1) => ({ id: 1, subtotal: quantity * 100, items: quantity ? [
  { id: 11, productId: 7, productName: product.name, productImages: [], unitPrice: 100, quantity, subtotal: quantity * 100 },
] : [] })
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function setup(options = {}) {
  const context = await browser.newContext()
  await context.addInitScript(({ ignoreAbort }) => {
    if (!sessionStorage.getItem('checkout-fixture')) {
      localStorage.setItem('token', 'checkout-a')
      sessionStorage.setItem('checkout-fixture', '1')
    }
    const original = window.fetch.bind(window)
    window.checkoutRequests = []
    window.fetch = (url, init = {}) => {
      if (!String(url).startsWith('http://localhost:8080')) return original(url, init)
      const record = { path: new URL(url).pathname, settled: false, aborted: false }
      window.checkoutRequests.push(record)
      init.signal?.addEventListener('abort', () => { record.aborted = true }, { once: true })
      return original(url, ignoreAbort ? { ...init, signal: undefined } : init)
        .finally(() => { record.settled = true })
    }
  }, { ignoreAbort: options.ignoreAbort ?? false })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  await page.clock.install()
  const state = { carts: { a: cart(), b: cart(5) }, product: { ...product }, quotes: [], confirmations: [],
    calls: [], errors: [], orders: new Map(), ...options }
  page.on('pageerror', error => state.errors.push(error.message))
  await page.route('http://localhost:8080/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname, method = req.method()
    const body = req.postDataJSON()
    const account = req.headers().authorization === 'Bearer checkout-b' ? 'b' : 'a'
    // Credenciales y tokens nunca forman parte de los registros de prueba.
    state.calls.push({ path, method, account, body: path.startsWith('/orders') || path.startsWith('/carts') ? body : undefined })
    let data = [], status = 200, plan = {}
    if (path.startsWith('/api/v1/auth/')) data = { access_token: 'checkout-b' }
    else if (path === '/users/me') data = { id: account === 'a' ? 1 : 2, firstName: 'QA', lastName: account,
      email: account + '@example.invalid', role: 'USUARIO', active: true }
    else if (path === '/collections') data = [{ id: 1, name: 'NBA' }]
    else if (path === '/products') data = { content: [{ ...state.product }], totalPages: 1, totalElements: 1, number: 0 }
    else if (path === '/products/7') data = { ...state.product }
    else if (path === '/carts') data = structuredClone(state.carts[account])
    else if (path === '/carts/items/11' && method === 'PUT') {
      state.carts[account] = cart(body.quantity)
      data = structuredClone(state.carts[account])
      plan = { gate: state.quantityGate }
    } else if (path === '/orders/preview') {
      plan = state.quotes.shift() ?? {}
      status = plan.status ?? 200
      const subtotal = state.carts[account].subtotal
      const discount = body.paymentMethod === 'TRANSFERENCIA' ? subtotal * .1 : 0
      data = Object.hasOwn(plan, 'data') ? plan.data : { subtotal, totalDiscount: discount,
        total: state.quoteTotal ?? subtotal - discount,
        promotions: discount ? [{ promotionId: 1, promotionName: 'Transferencia QA', discountApplied: discount }] : [] }
    } else if (path === '/orders' && method === 'POST') {
      plan = state.confirmations.shift() ?? {}
      status = plan.status ?? 201
      if (status === 201) {
        // Simula el replay del backend, incluso si la respuesta inicial se pierde.
        const key = account + ':' + body.requestKey
        if (!state.orders.has(key)) {
          const originalCart = state.carts[account]
          state.orders.set(key, { account, data: { id: 101 + state.orders.size, state: 'PENDIENTE',
            orderDate: '2026-10-22T10:00:00', paymentMethod: body.paymentMethod,
            subtotal: originalCart.subtotal, totalDiscount: originalCart.subtotal - body.expectedTotal,
            total: body.expectedTotal, promotions: [],
            items: originalCart.items.map(item => ({ ...item, price: item.unitPrice, sellerId: 9, sellerEmail: 'qa@example.invalid' })) } })
          state.carts[account] = cart(0)
        }
        data = state.orders.get(key).data
        assert.equal(data.paymentMethod, body.paymentMethod, 'Replay debe conservar medio de pago')
        assert.equal(data.total, body.expectedTotal, 'Replay debe conservar total')
        if (plan.invalid) data = { id: data.id }
      }
    } else if (path === '/orders') data = [...state.orders.values()].filter(order => order.account === account).map(order => order.data)
    else if (/^\/orders\/\d+$/.test(path)) data = [...state.orders.values()].find(order => order.account === account && order.data.id === Number(path.split('/').pop()))?.data
    if (status >= 400) data = { message: plan.message ?? 'Error controlado checkout' }
    if (plan.gate) await plan.gate.promise
    if (plan.network) return route.abort('connectionreset').catch(() => {})
    await route.fulfill({ status, json: data }).catch(() => {})
  })
  const calls = (path, method = 'POST') => state.calls.filter(call => call.path === path && call.method === method)
  const close = async () => { assert.deepEqual(state.errors, []); await context.close() }
  await page.goto(base + (options.path ?? '/checkout'))
  return { page, state, calls, close }
}
const quoteReady = page => page.getByText('La tienda verificará este importe y el stock nuevamente al confirmar.', { exact: true }).waitFor()
const total = page => page.getByRole('region', { name: 'Resumen de compra' }).locator('strong')
const confirmButton = page => page.getByRole('button', { name: 'Confirmar pedido', exact: true })
async function confirmStep(page) {
  await quoteReady(page)
  await page.getByRole('button', { name: 'Continuar al pago', exact: true }).click()
  await page.getByRole('button', { name: 'Revisar y confirmar', exact: true }).click()
}
async function readyCart(page, quantity) {
  await page.waitForFunction(q => document.querySelector('output[aria-label="Cantidad seleccionada"]')?.textContent === String(q), quantity)
}
async function routeTo(page, path) {
  await page.evaluate(path => { history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate')) }, path)
}
async function switchAccount(page) {
  await page.getByRole('link', { name: 'Mi cuenta', exact: true }).first().click()
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
  await page.getByLabel('Email', { exact: true }).fill('b@example.invalid')
  await page.getByLabel('Contraseña', { exact: true }).fill('fixture-password')
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await page.getByRole('heading', { name: 'Mi perfil', exact: true }).waitFor()
}
async function settleOrders(page) {
  await page.waitForFunction(() => window.checkoutRequests.filter(request => request.path.startsWith('/orders')).every(request => request.settled))
  await page.clock.runFor(20)
}
let passed = 0
async function test(name, run) { await run(); passed++; console.log('PASS ' + name) }

try {
  await test('Cotización inicial única bajo StrictMode y cambio de medio de pago con importes del servidor', async () => {
    const s = await setup(); await quoteReady(s.page)
    assert.equal(s.calls('/orders/preview').length, 1)
    assert.deepEqual(s.calls('/orders/preview')[0].body, { paymentMethod: 'TRANSFERENCIA' })
    assert.equal(await total(s.page).textContent(), '$ 90')
    await s.page.getByRole('button', { name: 'Continuar al pago' }).click()
    await s.page.getByRole('button', { name: 'Tarjeta de crédito', exact: true }).click()
    await s.page.getByText('Transferencia QA', { exact: true }).waitFor({ state: 'hidden' })
    await quoteReady(s.page)
    assert.equal(await total(s.page).textContent(), '$ 100')
    assert.equal(s.calls('/orders/preview').length, 2)
    assert.deepEqual(s.calls('/orders/preview')[1].body, { paymentMethod: 'TARJETA_DE_CREDITO' })
    assert.equal(s.calls('/orders').length, 0)
    await s.close()
  })
  await test('Cambiar cantidad invalida la cotización y reingresar utiliza el carrito actualizado', async () => {
    const s = await setup(); await quoteReady(s.page)
    await s.page.getByRole('link', { name: /Editar carrito/ }).click(); await readyCart(s.page, 1)
    await s.page.getByRole('button', { name: 'Aumentar cantidad' }).click()
    await s.page.getByText('Carrito actualizado.', { exact: true }).waitFor()
    await s.page.getByRole('button', { name: 'Iniciar compra' }).click(); await quoteReady(s.page)
    assert.equal(await total(s.page).textContent(), '$ 180')
    assert.equal(s.calls('/orders/preview').length, 2)
    assert.equal(s.calls('/carts', 'GET').length, 1)
    await s.close()
  })
  await test('Cotización anterior que ignora el aborto no reemplaza el medio de pago vigente', async () => {
    const s = await setup({ ignoreAbort: true }); await quoteReady(s.page)
    const gate = deferred()
    s.state.quotes.push({ gate })
    await s.page.getByRole('button', { name: 'Continuar al pago' }).click()
    const started = s.page.waitForRequest('**/orders/preview')
    await s.page.getByRole('button', { name: 'Tarjeta de crédito', exact: true }).click(); await started
    await s.page.getByRole('button', { name: 'Transferencia', exact: true }).click(); await quoteReady(s.page)
    gate.resolve(); await settleOrders(s.page)
    assert.equal(await total(s.page).textContent(), '$ 90')
    assert.equal(s.calls('/orders/preview').length, 3)
    assert.ok(await s.page.evaluate(() => window.checkoutRequests.some(r => r.path === '/orders/preview' && r.aborted)))
    await s.close()
  })
  for (const [name, plan] of [['red', { network: true }], ['HTTP', { status: 503 }], ['datos inválidos', { data: {} }]]) {
    await test('Cotización con error de ' + name + ' exige reintento explícito', async () => {
      const s = await setup({ quotes: [plan] })
      await s.page.getByRole('button', { name: 'Volver a cotizar', exact: true }).waitFor()
      assert.equal(s.calls('/orders/preview').length, 1)
      assert.equal(s.calls('/orders').length, 0)
      await s.page.getByRole('button', { name: 'Volver a cotizar', exact: true }).click(); await quoteReady(s.page)
      assert.equal(s.calls('/orders/preview').length, 2)
      await s.close()
    })
  }
  await test('HTTP 201 confirma una sola orden ante doble clic, bloquea carrito y evita GET redundantes', async () => {
    const gate = deferred()
    const s = await setup({ confirmations: [{ gate }] }); await confirmStep(s.page)
    await confirmButton(s.page).evaluate(button => { button.click(); button.click() })
    await s.page.getByRole('button', { name: 'Confirmando…', exact: true }).waitFor()
    assert.equal(s.calls('/orders').length, 1)
    const body = s.calls('/orders')[0].body
    assert.deepEqual(Object.keys(body).sort(), ['expectedTotal', 'paymentMethod', 'requestKey'])
    assert.equal(body.paymentMethod, 'TRANSFERENCIA'); assert.equal(body.expectedTotal, 90); assert.match(body.requestKey, uuid)
    await s.page.getByRole('link', { name: /^Carrito/ }).first().click(); await readyCart(s.page, 1)
    for (const name of ['Aumentar cantidad', 'Quitar', 'Iniciar compra']) assert.ok(await s.page.getByRole('button', { name, exact: true }).isDisabled())
    gate.resolve(); await s.page.waitForURL('**/pedido-confirmado')
    await s.page.getByText('Estado: Pendiente', { exact: true }).waitFor()
    assert.equal(s.state.orders.size, 1)
    await s.page.getByRole('link', { name: 'Ver mis pedidos', exact: true }).click()
    await s.page.getByRole('button', { name: 'Ver detalle del pedido 101', exact: true }).click()
    await s.page.locator('#order-101').getByText('Total', { exact: true }).waitFor()
    assert.equal(s.calls('/orders/101', 'GET').length, 0)
    await s.page.getByRole('link', { name: /^Carrito/ }).first().click()
    await s.page.getByText('Tu carrito está vacío', { exact: true }).waitFor()
    assert.equal(s.calls('/carts', 'GET').length, 1)
    await s.close()
  })
  await test('HTTP 409 recotiza, genera otro intento y espera aceptación explícita del nuevo total', async () => {
    const s = await setup({ confirmations: [{ status: 409 }] }); await confirmStep(s.page)
    s.state.quoteTotal = 80
    await confirmButton(s.page).click()
    await s.page.getByText('El total cambió. Revisá el nuevo importe y confirmá otra vez.', { exact: true }).waitFor()
    await quoteReady(s.page)
    assert.equal(await total(s.page).textContent(), '$ 80')
    assert.equal(s.calls('/orders').length, 1)
    assert.equal(s.state.orders.size, 0)
    await confirmButton(s.page).click(); await s.page.waitForURL('**/pedido-confirmado')
    const [first, second] = s.calls('/orders').map(call => call.body)
    assert.notEqual(first.requestKey, second.requestKey)
    assert.equal(first.expectedTotal, 90); assert.equal(second.expectedTotal, 80)
    assert.equal(s.state.orders.size, 1)
    await s.close()
  })
  for (const [name, plan, navigate] of [['red', { network: true }, false], ['respuesta inválida', { invalid: true }, true]]) {
    await test('Resultado ambiguo por ' + name + ' conserva intento y clave incluso si el servidor creó la orden', async () => {
      const s = await setup({ confirmations: [plan] }); await confirmStep(s.page)
      await confirmButton(s.page).click()
      await s.page.getByRole('alert').filter({ hasText: /pedidos/i }).waitFor()
      assert.equal(s.state.orders.size, 1)
      assert.equal(s.calls('/orders').length, 1)
      if (navigate) {
        await s.page.getByRole('link', { name: /^Carrito/ }).first().click(); await readyCart(s.page, 1)
        await s.page.getByRole('button', { name: 'Iniciar compra' }).click()
        await confirmStep(s.page)
      }
      await confirmButton(s.page).click(); await s.page.waitForURL('**/pedido-confirmado')
      assert.deepEqual(s.calls('/orders')[1].body, s.calls('/orders')[0].body)
      assert.equal(s.state.orders.size, 1, 'El replay debe recuperar la orden existente')
      assert.equal(s.calls('/carts', 'GET').length, 1)
      await s.close()
    })
  }
  await test('Intento ambiguo no permite enviar otra clave con medio de pago distinto', async () => {
    const s = await setup({ confirmations: [{ network: true }] }); await confirmStep(s.page)
    await confirmButton(s.page).click()
    await s.page.getByRole('alert').filter({ hasText: /pedidos/i }).waitFor()
    await s.page.getByRole('button', { name: 'Cambiar', exact: true }).nth(1).click()
    await s.page.getByRole('button', { name: 'Tarjeta de crédito', exact: true }).click()
    await s.page.getByRole('button', { name: 'Revisar y confirmar', exact: true }).click()
    if (await confirmButton(s.page).isEnabled()) await confirmButton(s.page).click()
    await s.page.getByRole('alert').filter({ hasText: /pedidos/i }).waitFor()
    assert.equal(s.calls('/orders').length, 1)
    assert.equal(s.state.orders.size, 1)
    await s.close()
  })
  await test('Intento ambiguo bloquea otra confirmación si cambió el contenido del carrito', async () => {
    const s = await setup({ confirmations: [{ network: true }] }); await confirmStep(s.page)
    await confirmButton(s.page).click()
    await s.page.getByRole('alert').filter({ hasText: /pedidos/i }).waitFor()
    await s.page.getByRole('link', { name: /^Carrito/ }).first().click(); await readyCart(s.page, 1)
    await s.page.getByRole('button', { name: 'Aumentar cantidad' }).click()
    await s.page.getByText('Carrito actualizado.', { exact: true }).waitFor(); await readyCart(s.page, 2)
    await s.page.getByRole('button', { name: 'Iniciar compra' }).click(); await confirmStep(s.page)
    assert.ok(await confirmButton(s.page).isDisabled())
    await s.page.getByRole('alert').filter({ hasText: /confirmación sin resolver con otros datos/ }).waitFor()
    assert.equal(s.calls('/orders').length, 1)
    assert.equal(s.state.orders.size, 1)
    await s.close()
  })
  await test('Restaurar el medio original de un intento ambiguo conserva la misma clave', async () => {
    // La conexión puede perderse antes o después de la transacción: aquí no se creó la orden.
    const s = await setup({ confirmations: [{ status: 503, network: true }] }); await confirmStep(s.page)
    await confirmButton(s.page).click()
    await s.page.getByRole('alert').filter({ hasText: /pedidos/i }).waitFor()
    assert.equal(s.state.orders.size, 0)
    await s.page.getByRole('button', { name: 'Cambiar', exact: true }).nth(1).click()
    await s.page.getByRole('button', { name: 'Tarjeta de crédito', exact: true }).click(); await quoteReady(s.page)
    await s.page.getByRole('button', { name: 'Transferencia', exact: true }).click(); await quoteReady(s.page)
    await s.page.getByRole('button', { name: 'Revisar y confirmar', exact: true }).click()
    await confirmButton(s.page).click(); await s.page.waitForURL('**/pedido-confirmado')
    assert.deepEqual(s.calls('/orders')[1].body, s.calls('/orders')[0].body)
    assert.equal(s.state.orders.size, 1)
    await s.close()
  })
  await test('Restaurar el contenido original del carrito también exige una cotización nueva', async () => {
    const s = await setup(); await quoteReady(s.page)
    await s.page.getByRole('link', { name: /Editar carrito/ }).click(); await readyCart(s.page, 1)
    await s.page.getByRole('button', { name: 'Aumentar cantidad' }).click()
    await s.page.getByText('Carrito actualizado.', { exact: true }).waitFor(); await readyCart(s.page, 2)
    await s.page.getByRole('button', { name: 'Iniciar compra' }).click(); await quoteReady(s.page)
    assert.equal(await total(s.page).textContent(), '$ 180')
    await s.page.getByRole('link', { name: /Editar carrito/ }).click(); await readyCart(s.page, 2)
    await s.page.getByRole('button', { name: 'Disminuir cantidad' }).click()
    await s.page.getByText('Carrito actualizado.', { exact: true }).waitFor(); await readyCart(s.page, 1)
    await s.page.getByRole('button', { name: 'Iniciar compra' }).click(); await quoteReady(s.page)
    assert.equal(await total(s.page).textContent(), '$ 90')
    assert.equal(s.calls('/orders/preview').length, 3)
    assert.equal(s.calls('/orders').length, 0)
    await s.close()
  })
  await test('Rechazo HTTP conserva carrito y libera bloqueo para modificar cantidades', async () => {
    const s = await setup({ confirmations: [{ status: 422, message: 'Stock insuficiente QA' }] }); await confirmStep(s.page)
    await confirmButton(s.page).click()
    await s.page.getByRole('alert').filter({ hasText: 'Stock insuficiente QA' }).waitFor()
    assert.equal(s.state.orders.size, 0)
    await s.page.getByRole('link', { name: /^Carrito/ }).first().click(); await readyCart(s.page, 1)
    await s.page.getByRole('button', { name: 'Aumentar cantidad' }).click()
    await s.page.getByText('Carrito actualizado.', { exact: true }).waitFor(); await readyCart(s.page, 2)
    await s.page.getByRole('button', { name: 'Iniciar compra' }).click(); await confirmStep(s.page)
    await confirmButton(s.page).click(); await s.page.waitForURL('**/pedido-confirmado')
    const [first, second] = s.calls('/orders').map(call => call.body)
    assert.notEqual(first.requestKey, second.requestKey); assert.equal(second.expectedTotal, 180)
    await s.close()
  })
  for (const stage of ['cotización', 'confirmación']) {
    await test('HTTP 401 durante ' + stage + ' invalida sesión y conserva protección', async () => {
      const s = await setup(stage === 'cotización' ? { quotes: [{ status: 401 }] } : { confirmations: [{ status: 401 }] })
      if (stage === 'confirmación') { await confirmStep(s.page); await confirmButton(s.page).click() }
      await s.page.waitForURL('**/ingresar')
      await s.page.getByRole('alert').filter({ hasText: 'Tu sesión venció. Volvé a ingresar.' }).waitFor()
      assert.equal(await s.page.evaluate(() => Boolean(localStorage.getItem('token'))), false)
      await routeTo(s.page, '/checkout'); await s.page.waitForURL('**/ingresar')
      assert.equal(s.state.orders.size, 0)
      await s.close()
    })
  }
  await test('Cotización tardía de A no puede utilizarse al ingresar B aunque ignore la cancelación', async () => {
    const gate = deferred()
    const s = await setup({ quotes: [{ gate }], ignoreAbort: true })
    await s.page.getByText('Calculando el total…', { exact: true }).waitFor()
    await s.page.waitForFunction(() => window.checkoutRequests.some(request => request.path === '/orders/preview'))
    await switchAccount(s.page)
    await s.page.getByRole('link', { name: /^Carrito/ }).first().click(); await readyCart(s.page, 5)
    await s.page.getByRole('button', { name: 'Iniciar compra' }).click(); await quoteReady(s.page)
    gate.resolve(); await settleOrders(s.page)
    assert.equal(await total(s.page).textContent(), '$ 450')
    await confirmStep(s.page); await confirmButton(s.page).click(); await s.page.waitForURL('**/pedido-confirmado')
    assert.equal(s.calls('/orders')[0].account, 'b')
    assert.equal(s.calls('/orders')[0].body.expectedTotal, 450)
    await s.close()
  })
  await test('PUT de cantidad pendiente impide cotizar y confirmar hasta resolver el carrito', async () => {
    const gate = deferred()
    const s = await setup({ path: '/carrito', quantityGate: gate }); await readyCart(s.page, 1)
    await s.page.getByRole('button', { name: 'Aumentar cantidad' }).click(); await readyCart(s.page, 2)
    await routeTo(s.page, '/checkout')
    await s.page.getByRole('heading', { name: 'Finalizar compra', exact: true }).waitFor()
    assert.equal(s.calls('/orders/preview').length, 0)
    assert.equal(s.calls('/orders').length, 0)
    assert.ok(await s.page.getByRole('button', { name: 'Continuar al pago' }).isDisabled())
    gate.resolve(); await quoteReady(s.page)
    assert.equal(await total(s.page).textContent(), '$ 180')
    assert.equal(s.calls('/orders/preview').length, 1)
    await s.close()
  })
  await test('Éxito invalida productos conocidos y recargar confirmación no inventa una orden', async () => {
    const s = await setup({ path: '/' })
    await s.page.getByRole('button', { name: 'Ver ' + product.name, exact: true }).waitFor()
    assert.equal(s.calls('/products', 'GET').length, 1)
    await s.page.getByRole('link', { name: /^Carrito/ }).first().click(); await readyCart(s.page, 1)
    await s.page.getByRole('button', { name: 'Iniciar compra' }).click(); await confirmStep(s.page)
    s.state.product.price = 120
    await confirmButton(s.page).click(); await s.page.waitForURL('**/pedido-confirmado')
    await s.page.getByRole('link', { name: 'Ir al inicio' }).click()
    await s.page.locator('article').getByText('$ 120', { exact: true }).waitFor()
    assert.equal(s.calls('/products', 'GET').length, 2, 'Compra invalida la página de Home aún vigente')
    await routeTo(s.page, '/pedido-confirmado')
    await s.page.getByText('Estado: Pendiente', { exact: true }).waitFor()
    await s.page.reload()
    await s.page.getByText('No hay una compra confirmada para mostrar.', { exact: true }).waitFor()
    assert.equal(s.calls('/orders').length, 1)
    await s.close()
  })
  console.log('Escenarios de checkout aprobados: ' + passed)
} finally { await browser.close() }
