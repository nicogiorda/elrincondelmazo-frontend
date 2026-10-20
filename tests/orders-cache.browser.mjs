// HTTP fixtures are isolated from Spring/PostgreSQL. Run against Vite with StrictMode enabled.
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const base = process.env.BASE_URL || 'http://localhost:5173'
const order = (id = 101, state = 'PENDIENTE') => ({ id, state, orderDate: '2026-10-19T10:00:00', paymentMethod: 'TRANSFERENCIA', subtotal: 100, totalDiscount: 0, total: 100 })
const full = (summary) => ({ ...summary, items: [{ id: 1, productId: 1, productName: `Producto privado ${summary.id}`, quantity: 1, price: summary.total, sellerId: 9, sellerEmail: 'seller@example.invalid' }], promotions: [] })
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const results = []
async function setup(options = {}) {
  const context = await browser.newContext()
  await context.addInitScript(() => { if (!sessionStorage.getItem('initialized')) { localStorage.setItem('token', 'account-a'); sessionStorage.setItem('initialized', '1') } })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  await page.clock.install()
  const state = { lists: [order(), order(102, 'ENTREGADO'), order(103, 'CANCELADO')], status: 200, detailStatus: 200, calls: [], errors: [], ...options }
  page.on('pageerror', e => state.errors.push(e.message))
  await page.route('http://localhost:8080/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    const token = request.headers().authorization
    state.calls.push({ path, token })
    let data = [], status = 200, gate
    if (path.startsWith('/api/v1/auth/')) data = { access_token: 'account-b' }
    if (path === '/users/me') data = { id: token === 'Bearer account-b' ? 2 : 1, firstName: 'QA', lastName: 'Orders', email: 'qa@example.invalid', role: 'USUARIO' }
    if (path === '/carts') data = { id: 1, items: [], subtotal: 0 }
    if (path === '/orders') { data = structuredClone(token === 'Bearer account-b' ? [order(202)] : state.lists); status = state.status; gate = state.listGate }
    if (/^\/orders\/\d+$/.test(path)) { data = full(state.lists.find(o => o.id === Number(path.split('/').pop())) || order(202)); status = state.detailStatus; gate = state.detailGate }
    if (status !== 200) data = { message: 'Fallo controlado' }
    if (gate) await gate.promise
    await route.fulfill({ json: data, status }).catch(() => {}) // A logout may have aborted the connection.
  })
  const count = path => state.calls.filter(c => c.path === path).length
  const row = id => page.getByRole('button', { name: `Ver detalle del pedido ${id}`, exact: true })
  const ready = () => page.waitForFunction(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent === 'Actualizar pedidos'); return b && !b.disabled })
  const navigateBack = async () => { await page.getByRole('link', { name: 'Mi perfil', exact: true }).first().click(); await page.getByRole('link', { name: 'Mis pedidos', exact: true }).first().click() }
  await page.goto(base + '/mis-pedidos')
  return { page, state, count, row, ready, navigateBack, close: async () => { assert.deepEqual(state.errors, []); await context.close() } }
}
async function test(name, run) { await run(); results.push(name); console.log('PASS ' + name) }
try {
  await test('StrictMode, navigation, local filters, detail reuse and changed-summary invalidation', async () => {
    const s = await setup(); const { page, state, count, row, ready } = s
    await ready(); assert.equal(count('/orders'), 1)
    await row(101).click(); await page.getByText('Producto privado 101', { exact: true }).waitFor()
    await row(101).click(); await row(101).click(); assert.equal(count('/orders/101'), 1)
    await s.navigateBack(); await ready(); assert.equal(count('/orders'), 1)
    for (const name of ['En curso', 'Entregados', 'Cancelados', 'Todos']) await page.getByRole('button', { name, exact: true }).click()
    assert.equal(count('/orders'), 1)
    await row(101).click(); assert.equal(count('/orders/101'), 1)
    state.lists[0] = { ...state.lists[0], state: 'PAGO', total: 90, totalDiscount: 10 }
    await page.getByRole('button', { name: 'Actualizar pedidos' }).click(); await ready()
    await page.locator('#order-101').getByLabel('Resumen de compra').getByText('$ 90', { exact: true }).waitFor()
    assert.equal(count('/orders'), 2); assert.equal(count('/orders/101'), 2)
    await s.close()
  })
  await test('Pending request survives navigation, manual button deduplicates, expiry on route and on return', async () => {
    const gate = deferred(), s = await setup({ listGate: gate }); const { page, count, state, ready } = s
    await page.getByText('Cargando pedidos…', { exact: true }).waitFor()
    await s.navigateBack(); assert.equal(count('/orders'), 1)
    gate.resolve(); state.listGate = null; await ready()
    const manual = deferred(); state.listGate = manual
    await page.getByRole('button', { name: 'Actualizar pedidos' }).click()
    assert.equal(await page.getByRole('button', { name: 'Actualizar pedidos' }).isDisabled(), true)
    await s.navigateBack(); assert.equal(count('/orders'), 2)
    manual.resolve(); state.listGate = null; await ready()
    await page.clock.fastForward(61000); await ready(); assert.equal(count('/orders'), 3)
    await page.getByRole('link', { name: 'Mi perfil', exact: true }).first().click()
    await page.clock.fastForward(61000); assert.equal(count('/orders'), 3)
    await page.getByRole('link', { name: 'Mis pedidos', exact: true }).first().click(); await ready()
    assert.equal(count('/orders'), 4); await s.close()
  })
  await test('HTTP failures, retries, valid data preserved and unauthorized logout', async () => {
    const s = await setup({ status: 503 }); const { page, state, row, ready } = s
    await page.getByRole('alert').waitFor(); state.status = 200
    await page.getByRole('button', { name: 'Reintentar', exact: true }).click(); await ready(); await row(101).waitFor()
    state.status = 503; await page.getByRole('button', { name: 'Actualizar pedidos' }).click()
    await page.getByRole('alert').waitFor(); assert.equal(await row(101).count(), 1)
    state.status = 200; await page.getByRole('button', { name: 'Reintentar', exact: true }).click(); await ready()
    state.detailStatus = 503; await row(101).click(); await page.getByRole('button', { name: 'Reintentar detalle' }).waitFor()
    state.detailStatus = 200; await page.getByRole('button', { name: 'Reintentar detalle' }).click()
    await page.getByText('Producto privado 101', { exact: true }).waitFor()
    assert.equal(s.count('/orders/101'), 2)
    state.status = 401; await page.getByRole('button', { name: 'Actualizar pedidos' }).click()
    await page.waitForURL('**/ingresar'); assert.equal(await page.evaluate(() => localStorage.getItem('token')), null)
    assert.equal(await row(101).count(), 0); await s.close()
  })
  await test('Logout/new account discards late list and detail responses', async () => {
    const s = await setup(); const { page, state, ready, row } = s
    await ready(); const detailGate = deferred(); state.detailGate = detailGate
    await row(101).click(); await page.getByText('Cargando detalle…').waitFor()
    const listGate = deferred(); state.listGate = listGate
    await page.getByRole('button', { name: 'Actualizar pedidos' }).click()
    await page.getByRole('button', { name: 'Cerrar sesión' }).click(); await page.waitForURL('**/ingresar')
    state.listGate = null; state.detailGate = null
    await page.getByLabel('Email', { exact: true }).fill('other@example.invalid')
    await page.getByLabel('Contraseña', { exact: true }).fill('Password123!')
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
    await page.getByRole('heading', { name: 'Mi perfil' }).waitFor()
    await page.getByRole('link', { name: 'Mis pedidos', exact: true }).first().click(); await ready(); await row(202).waitFor()
    detailGate.resolve(); listGate.resolve(); await page.waitForTimeout(150)
    assert.equal(await row(101).count(), 0); assert.equal(await page.getByText('Producto privado 101', { exact: true }).count(), 0)
    await row(202).click(); await page.getByText('Producto privado 202', { exact: true }).waitFor()
    assert.equal(state.calls.filter(c => c.path === '/orders' && c.token === 'Bearer account-b').length, 1)
    await s.close()
  })
  await test('Fresh list supersedes an older pending detail; detail expires with the list', async () => {
    const s = await setup(); const { page, state, ready, row, count } = s
    await ready(); const oldDetail = deferred(); state.detailGate = oldDetail
    await row(101).click(); await page.getByText('Cargando detalle…').waitFor()
    state.detailGate = null; state.lists[0] = { ...state.lists[0], total: 80, totalDiscount: 20, state: 'PAGO' }
    await page.getByRole('button', { name: 'Actualizar pedidos' }).click(); await ready()
    const total = page.locator('#order-101').getByLabel('Resumen de compra').getByText('$ 80', { exact: true })
    await total.waitFor(); oldDetail.resolve(); await page.waitForTimeout(100)
    assert.equal(await total.count(), 1); assert.equal(count('/orders/101'), 2)
    await page.clock.fastForward(61000); await ready(); await total.waitFor()
    assert.equal(count('/orders/101'), 3, 'An open expired detail is refreshed, not retained forever')
    await s.close()
  })
  await test('Complete list reuses detail and empty history is also cached', async () => {
    const s = await setup({ lists: [full(order())] }); await s.ready(); await s.row(101).click()
    await s.page.getByText('Producto privado 101', { exact: true }).waitFor(); assert.equal(s.count('/orders/101'), 0); await s.close()
    const empty = await setup({ lists: [] }); await empty.ready(); await empty.navigateBack(); await empty.ready()
    assert.equal(empty.count('/orders'), 1); await empty.close()
  })
  console.log(JSON.stringify({ result: 'PASS', groups: results }, null, 2))
} finally { await browser.close() }
