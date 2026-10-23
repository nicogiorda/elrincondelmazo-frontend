import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage()
const errors = [], requests = [], orders = []
page.on('pageerror', (error) => errors.push(error.message))
const products = Array.from({ length: 13 }, (_, i) => ({ id: i + 1, name: `Carta QA ${i + 1}`, price: 100,
  stock: 10, status: 'ACTIVO', type: 'CARTA', sellerId: 2, sellerName: 'Seller QA', collectionId: 1,
  collectionName: 'NBA', imageUrls: [], createdAt: `2026-10-${String(19 - i).padStart(2, '0')}T10:00:00` }))
products[12].sellerId = 1
let cart = { id: 1, items: [], subtotal: 0 }, nextConflict = false, loseResponse = false
const user = { id: 1, email: 'qa@example.invalid', firstName: 'QA', lastName: 'Buyer', role: 'USUARIO' }
let requestKey, invalidSession = false, delayAuth = false
await page.route('http://localhost:8080/**', async (route) => {
  const req = route.request(), url = new URL(req.url()), method = req.method()
  requests.push({ path: url.pathname, query: url.search, method })
  const body = req.postDataJSON()
  const reply = (data, status = 200) => route.fulfill({ status, json: data })
  if (url.pathname.startsWith('/api/v1/auth/')) {
    if (delayAuth) await new Promise((resolve) => setTimeout(resolve, 700))
    assert.equal(body.email, 'qa@example.invalid')
    assert.equal(Object.hasOwn(body, 'username'), false)
    return reply({ access_token: 'qa-test-token' }, 200)
  }
  if (url.pathname === '/users/me') return invalidSession ? reply({ message: 'Invalid token' }, 401) : reply(user)
  if (url.pathname === '/promotions/public') return reply([])
  if (url.pathname === '/collections') return reply([{ id: 1, name: 'NBA' }])
  if (url.pathname === '/products') {
    const search = url.searchParams.get('search') || ''
    if (search === 'slow') await new Promise((resolve) => setTimeout(resolve, 700))
    const list = search ? products.filter((p) => p.name.includes(search)) : products
    const size = Number(url.searchParams.get('size') || 10), number = Number(url.searchParams.get('page') || 0)
    return reply({ content: list.slice(number * size, (number + 1) * size), totalElements: list.length, totalPages: Math.ceil(list.length / size), number })
  }
  if (url.pathname === '/products/mine') return reply({ content: products.filter((p) => p.sellerId === 1), totalPages: 1 })
  if (url.pathname === '/products/13/pause') { products[12].status = 'INACTIVO'; return reply(products[12]) }
  if (/\/products\/\d+\/reviews/.test(url.pathname)) return reply([])
  if (/\/products\/\d+$/.test(url.pathname)) return reply(products.find((p) => p.id === Number(url.pathname.split('/').pop())))
  if (url.pathname === '/carts') return reply(cart)
  if (url.pathname === '/carts/items') {
    const p = products.find((p) => p.id === body.productId)
    cart = { id: 1, items: [{ id: 11, productId: p.id, productName: p.name, productImages: [], unitPrice: p.price, quantity: body.quantity, subtotal: p.price * body.quantity }], subtotal: p.price * body.quantity }
    return reply(cart)
  }
  if (url.pathname === '/orders/preview') {
    const discount = body.paymentMethod === 'TRANSFERENCIA' ? cart.subtotal * .1 : 0
    return reply({ subtotal: cart.subtotal, totalDiscount: discount, total: cart.subtotal - discount,
      promotions: discount ? [{ promotionId: 1, promotionName: 'Transferencia QA', discountApplied: discount }] : [] })
  }
  if (url.pathname === '/orders' && method === 'POST') {
    if (nextConflict) { nextConflict = false; cart = { ...cart, subtotal: 200 }; return reply({ message: 'El total cambió' }, 409) }
    if (loseResponse) {
      loseResponse = false; requestKey = body.requestKey
      return route.abort('connectionreset')
    }
    if (requestKey) assert.equal(body.requestKey, requestKey, 'A retry must reuse the key')
    const order = { id: 99, state: 'PENDIENTE', paymentMethod: body.paymentMethod, orderDate: '2026-10-19T10:00:00',
      subtotal: cart.subtotal, totalDiscount: cart.subtotal - body.expectedTotal, total: body.expectedTotal, promotions: [],
      items: cart.items.map((i) => ({ id: i.id, productId: i.productId, productName: i.productName, quantity: i.quantity, price: i.unitPrice, sellerId: 2, sellerEmail: 'seller@example.invalid' })) }
    orders.push(order); cart = { id: 1, items: [], subtotal: 0 }
    return reply(order, 201)
  }
  if (url.pathname === '/orders') return reply(orders)
  return reply({ message: 'Unexpected route ' + url.pathname }, 404)
})
const count = (path) => requests.filter((r) => r.path === path && r.method === 'GET').length
try {
  await page.clock.install()
  await page.goto((process.env.BASE_URL || 'http://localhost:5173') + '/')
  await page.getByRole('button', { name: 'Ver Carta QA 1', exact: true }).waitFor()
  assert.equal(requests.filter((r) => r.path === '/products' && r.query.includes('size=4')).length, 1)
  assert.equal(requests.some((r) => r.query.includes('size=100')), false)
  await page.getByRole('link', { name: 'Cartas', exact: true }).first().click()
  await page.getByRole('button', { name: 'Ver Carta QA 9', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Ver Carta QA 1', exact: true }).click()
  await page.getByRole('heading', { name: 'Carta QA 1', exact: true }).waitFor()
  await page.goBack()
  await page.getByRole('button', { name: 'Ver Carta QA 9', exact: true }).waitFor()
  assert.equal(requests.filter((r) => r.path === '/products' && r.query.includes('size=9')).length, 1, 'Back must reuse the valid page')
  const search = page.getByRole('searchbox', { name: 'Buscar productos' })
  await search.fill('slow'); await page.waitForTimeout(300); await search.fill('QA 2')
  await page.getByRole('button', { name: 'Ver Carta QA 2', exact: true }).waitFor()
  await page.waitForTimeout(800)
  assert.equal(await page.getByRole('button', { name: 'Ver Carta QA 2', exact: true }).count(), 1, 'Late response must not replace current search')
  await page.getByRole('link', { name: 'Ingresar', exact: true }).first().click()
  await page.getByLabel('Email', { exact: true }).fill('qa@example.invalid')
  await page.getByLabel('Contraseña', { exact: true }).fill('Password123!')
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await page.getByRole('heading', { name: 'Mi perfil' }).waitFor()
  assert.equal(count('/users/me'), 1)
  await page.getByRole('link', { name: 'Mis pedidos', exact: true }).first().click()
  await page.getByRole('heading', { name: 'Mis pedidos' }).waitFor()
  await page.getByRole('link', { name: 'Mi perfil', exact: true }).first().click()
  assert.equal(count('/users/me'), 1)
  await page.getByRole('link', { name: 'Cartas', exact: true }).first().click()
  await page.getByRole('button', { name: 'Agregar', exact: true }).first().click()
  await page.getByText('Carrito actualizado.', { exact: true }).waitFor()
  const cartProductId = cart.items[0].productId
  products.find((p) => p.id === cartProductId).stock = 4
  await page.getByRole('link', { name: 'Mi cuenta', exact: true }).first().click()
  await page.getByRole('link', { name: 'Mis publicaciones', exact: true }).first().click()
  await page.getByRole('button', { name: 'Activo', exact: true }).waitFor()
  const metadataRefresh = page.waitForResponse((response) => response.url() === `http://localhost:8080/products/${cartProductId}`)
  await page.getByRole('button', { name: 'Activo', exact: true }).click()
  assert.equal((await (await metadataRefresh).json()).stock, 4, 'Mutation must invalidate shared products and completed cart metadata requests')
  await page.getByRole('button', { name: 'Pausado', exact: true }).waitFor()
  await page.getByRole('link', { name: /^Carrito/ }).first().click()
  await page.getByRole('button', { name: 'Iniciar compra' }).click()
  await page.getByText('Transferencia QA', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Continuar al pago' }).click()
  await page.getByRole('button', { name: 'Tarjeta de crédito', exact: true }).click()
  await page.waitForTimeout(100)
  assert.equal(await page.getByText('Transferencia QA', { exact: true }).count(), 0)
  await page.getByRole('button', { name: 'Transferencia', exact: true }).click()
  await page.getByText('Transferencia QA', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Revisar y confirmar' }).click()
  nextConflict = true
  await page.getByRole('button', { name: 'Confirmar pedido', exact: true }).click()
  await page.getByText('El total cambió. Revisá el nuevo importe y confirmá otra vez.', { exact: true }).waitFor()
  await page.waitForTimeout(150)
  assert.equal(orders.length, 0)
  loseResponse = true
  await page.getByRole('button', { name: 'Confirmar pedido', exact: true }).click()
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: 'Confirmar pedido', exact: true }).click()
  await page.waitForURL('**/pedido-confirmado')
  assert.equal(orders[0].total, 180)
  assert.equal(count('/carts'), 1)
  await page.getByRole('link', { name: 'Ver mis pedidos', exact: true }).click()
  await page.getByRole('button', { name: 'Ver detalle del pedido 99', exact: true }).waitFor()
  assert.equal(count('/orders'), 2, 'Purchase must invalidate the previously loaded history')
  await page.getByRole('button', { name: 'Ver detalle del pedido 99', exact: true }).click()
  await page.locator('#order-99').getByText('Total', { exact: true }).waitFor()
  assert.equal(count('/orders/99'), 0, 'Reuse the complete order returned by checkout')
  await page.getByRole('link', { name: 'Mi cuenta', exact: true }).click()
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await page.waitForURL('**/ingresar')
  assert.equal(await page.evaluate(() => localStorage.getItem('token')), null)
  const beforeRegister = count('/users/me')
  await page.getByRole('link', { name: 'Crear cuenta', exact: true }).first().click()
  await page.getByLabel('Nombre', { exact: true }).fill('QA')
  await page.getByLabel('Apellido', { exact: true }).fill('Buyer')
  await page.getByLabel('Email', { exact: true }).fill('qa@example.invalid')
  await page.getByLabel('Email', { exact: true }).fill('qa@example.invalid')
  await page.getByLabel('Contraseña', { exact: true }).fill('Password123!')
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click()
  await page.getByRole('heading', { name: 'Mi perfil' }).waitFor()
  assert.equal(count('/users/me'), beforeRegister + 1)
  await page.reload()
  await page.getByRole('heading', { name: 'Mi perfil' }).waitFor()
  assert.equal(count('/users/me'), beforeRegister + 2, 'Restore should get user only once')
  invalidSession = true
  await page.reload()
  await page.waitForURL('**/ingresar')
  assert.equal(await page.evaluate(() => localStorage.getItem('token')), null)
  invalidSession = false; delayAuth = true
  const beforeCancelledLogin = count('/users/me')
  await page.getByLabel('Email', { exact: true }).fill('qa@example.invalid')
  await page.getByLabel('Contraseña', { exact: true }).fill('Password123!')
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await page.getByRole('link', { name: 'Cartas', exact: true }).first().click()
  await page.waitForTimeout(850)
  assert.equal(await page.evaluate(() => localStorage.getItem('token')), null)
  assert.equal(count('/users/me'), beforeCancelledLogin, 'Cancelled authentication must not fetch profile with its token')
  await page.getByRole('link', { name: 'Ir al inicio' }).click()
  await page.getByRole('button', { name: 'Ver Carta QA 1', exact: true }).waitFor()
  products[0].price = 321
  const homeLoads = requests.filter((r) => r.path === '/products' && r.query.includes('size=4')).length
  await page.clock.fastForward(61_000)
  await page.locator('article').filter({ has: page.getByRole('button', { name: 'Ver Carta QA 1', exact: true }) }).getByText('$ 321', { exact: true }).waitFor()
  assert.equal(requests.filter((r) => r.path === '/products' && r.query.includes('size=4')).length, homeLoads + 1)
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ result: 'PASS', scenarios: ['pagination', 'back cache', 'out of order', 'login', 'profile without duplicate GET', 'cart', 'publication invalidates cart metadata', 'payment requote', 'changed total', 'idempotent retry', 'purchase invalidates history', 'checkout detail reuse', 'logout', 'register once', 'restore once', 'invalid session', 'cancelled login', 'cache expiry and fresh price'], requests: requests.length }, null, 2))
} finally { await browser.close() }
