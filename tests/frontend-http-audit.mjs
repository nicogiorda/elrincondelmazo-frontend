import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
assert.equal(process.env.AUDIT_LOCAL_DB, '1', 'Run only against the disposable local audit database')
const api = 'http://localhost:8080'
const suffix = Date.now().toString()
async function request(path, method = 'GET', body, token) {
  const response = await fetch(api + path, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
  const data = await response.json()
  assert.ok(response.ok, `${method} ${path}: HTTP ${response.status}`)
  return data
}
assert.ok(process.env.AUDIT_PSQL, 'Provide the local PostgreSQL psql executable for isolated QA fixture setup')
const adminEmail = 'admin_qa_' + suffix + '@example.invalid'
await request('/api/v1/auth/register', 'POST', {firstname:'QA', lastname:'Admin', email:adminEmail, password:'Password123!'})
// The only direct write grants ADMIN to this test account in the disposable LOCAL database.
execFileSync(process.env.AUDIT_PSQL, ['-h','127.0.0.1','-p','55432','-U','postgres','-d','mazo_integration','-v','ON_ERROR_STOP=1','-c',
  `UPDATE users SET role='ADMIN' WHERE email='${adminEmail}';`], {stdio:'pipe'})
const sellerName = 'seller_qa_' + suffix
const seller = await request('/api/v1/auth/register', 'POST', { firstname: 'QA', lastname: 'Seller', email: sellerName + '@example.invalid', password: 'Password123!' })
const collections = await request('/collections')
const collectionId = collections[0].id
let product
const createdProducts = []
for (let i = 0; i < 13; i++) {
  product = await request('/products', 'POST', { name: 'HTTP QA ' + suffix + ' ' + i, description: 'Disposable audit product', type: 'CARTA', collectionId, price: 100, stock: 2, imageUrls: ['https://example.invalid/qa.png'] }, seller.access_token)
  createdProducts.push(product)
}
product = createdProducts[0] // Oldest fixture is on the second page, beyond the first nine.
const timings = []
for (const size of [4, 9, 100]) for (let sample = 1; sample <= 3; sample++) {
  const start = performance.now()
  const response = await fetch(api + '/products?size=' + size)
  const ttfb = performance.now() - start
  const bytes = (await response.arrayBuffer()).byteLength
  timings.push({ size, sample, ttfb_ms: +ttfb.toFixed(2), total_ms: +(performance.now() - start).toFixed(2), bytes })
}
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const adminPage = await browser.newPage()
const adminCalls = [], adminErrors = []
adminPage.on('pageerror', error => adminErrors.push(error.message))
adminPage.on('request', r => { if(r.url().startsWith(api)) adminCalls.push({url:r.url(), method:r.method()}) })
const promotionName = 'Promo integración ' + suffix
let savedPromotion
try {
  await adminPage.goto('http://localhost:5173/ingresar')
  await adminPage.getByLabel('Email', {exact:true}).fill(adminEmail)
  await adminPage.getByLabel('Contraseña', {exact:true}).fill('Password123!')
  await adminPage.getByRole('button', {name:'Ingresar', exact:true}).click()
  await adminPage.getByRole('heading', {name:'Mi perfil', exact:true}).waitFor()
  await adminPage.getByRole('link', {name:'Promociones', exact:true}).first().click()
  await adminPage.getByRole('link', {name:'+ Nueva promoción', exact:true}).click()
  await adminPage.getByRole('button', {name:/Por colección/}).click()
  await adminPage.locator('select').selectOption(String(collectionId))
  assert.equal(await adminPage.locator('select').inputValue(), String(collectionId))
  await adminPage.getByRole('button', {name:/Producto puntual/}).click()
  await adminPage.getByRole('button', {name:'Página siguiente', exact:true}).waitFor()
  await adminPage.locator('select').selectOption(String(createdProducts[12].id))
  await adminPage.getByRole('button', {name:'Página siguiente', exact:true}).click()
  await adminPage.locator(`select option[value="${product.id}"]`).waitFor({state:'attached'})
  assert.equal(await adminPage.locator('select').inputValue(), String(createdProducts[12].id))
  await adminPage.locator('select').selectOption(String(product.id))
  await adminPage.locator('#promotion-name').fill(promotionName)
  await adminPage.locator('#promotion-start').fill('2020-01-01')
  await adminPage.locator('#promotion-discount').fill('10')
  const created = adminPage.waitForResponse(r=>r.url()===api+'/promotions' && r.request().method()==='POST')
  await adminPage.getByRole('button', {name:'Crear promoción', exact:true}).click()
  const createResponse = await created
  assert.equal(createResponse.status(), 201)
  savedPromotion = await createResponse.json()
  await adminPage.getByRole('heading', {name:promotionName, exact:true}).waitFor()
  await adminPage.locator('article').filter({has:adminPage.getByRole('heading', {name:promotionName, exact:true})}).getByRole('button', {name:'Editar', exact:true}).click()
  await adminPage.locator(`select option[value="${product.id}"]`).waitFor({state:'attached'})
  await adminPage.getByText('Cargando productos…', {exact:true}).waitFor({state:'hidden'})
  assert.equal(await adminPage.locator('select').inputValue(), String(product.id))
  await adminPage.locator('#promotion-discount').fill('20')
  await adminPage.getByRole('button', {name:'Guardar cambios', exact:true}).click()
  await adminPage.getByRole('heading', {name:promotionName, exact:true}).waitFor()
  assert.equal(adminCalls.filter(r=>r.url===api+'/promotions' && r.method==='GET').length, 1)
  await adminPage.getByRole('link', {name:'Ir al inicio', exact:true}).click()
  const publicCard = adminPage.locator('section[aria-labelledby="promotions-heading"] article').filter({has:adminPage.getByRole('heading', {name:promotionName, exact:true})})
  await publicCard.getByText('20%', {exact:true}).waitFor()
  assert.deepEqual(adminErrors, [])
} catch (error) { await browser.close(); throw error }
await adminPage.close()
const page = await browser.newPage()
const errors = [], calls = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('request', (r) => { if (r.url().startsWith(api)) calls.push({ url: r.url(), method: r.method() }) })
try {
  await page.goto('http://localhost:5173/crear-cuenta')
  const buyerName = 'buyer_qa_' + suffix
  await page.getByLabel('Nombre', { exact: true }).fill('QA')
  await page.getByLabel('Apellido', { exact: true }).fill('Buyer')
  await page.getByLabel('Email', { exact: true }).fill(buyerName + '@example.invalid')
  await page.getByLabel('Contraseña', { exact: true }).fill('Password123!')
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click()
  await page.getByRole('heading', { name: 'Mi perfil' }).waitFor()
  const countMe = () => calls.filter((r) => r.url === api + '/users/me' && r.method === 'GET').length
  assert.equal(countMe(), 1)
  await page.reload()
  await page.getByRole('heading', { name: 'Mi perfil' }).waitFor()
  assert.equal(countMe(), 2, 'Existing email JWT is restored once after reload')
  const navigationStart = performance.now()
  await page.getByRole('link', { name: 'Cartas', exact: true }).first().click()
  await page.getByRole('searchbox', {name:'Buscar productos'}).fill(product.name)
  await page.getByRole('button', { name: 'Ver ' + product.name, exact: true }).waitFor()
  const catalogNavigationMs = performance.now() - navigationStart
  await page.getByRole('button', { name: 'Ver ' + product.name, exact: true }).click()
  await page.getByRole('heading', { name: product.name, exact: true }).waitFor()
  await page.getByRole('button', { name: /Agregar al carrito/ }).click()
  await page.getByText('Carrito actualizado.', { exact: true }).waitFor()
  await page.getByRole('link', { name: /^Carrito/ }).first().click()
  await page.getByRole('button', { name: 'Iniciar compra' }).click()
  await page.getByText('La tienda verificará este importe y el stock nuevamente al confirmar.', { exact: true }).waitFor()
  await page.getByText(promotionName, {exact:true}).waitFor()
  await page.getByRole('button', { name: 'Continuar al pago' }).click()
  await page.getByRole('button', { name: 'Revisar y confirmar' }).click()
  const orderResponse = page.waitForResponse((r) => r.url() === api + '/orders' && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Confirmar pedido', exact: true }).click()
  const response = await orderResponse
  assert.equal(response.status(), 201)
  const order = await response.json()
  await page.waitForURL('**/pedido-confirmado')
  assert.equal(order.total, 80)
  assert.equal(order.totalDiscount, 20)
  assert.ok(order.promotions.some(p=>p.promotionId===savedPromotion.id))
  const token = await page.evaluate(() => localStorage.getItem('token'))
  assert.equal((await request('/carts', 'GET', undefined, token)).items.length, 0)
  const replay = await request('/orders', 'POST', response.request().postDataJSON(), token)
  assert.equal(replay.id, order.id, 'HTTP retry with the same key must return the persisted order')
  assert.equal((await request('/orders', 'GET', undefined, token)).length, 1)
  assert.equal((await request('/products/' + product.id)).stock, 1)
  assert.equal((await request('/orders/' + order.id, 'GET', undefined, token)).items[0].price, 100)
  await page.getByRole('link', { name: 'Ver mis pedidos', exact: true }).click()
  await page.getByRole('heading', { name: 'Mis pedidos', exact: true }).waitFor()
  assert.ok((await request('/orders', 'GET', undefined, token)).some((o) => o.id === order.id))
  assert.equal(countMe(), 2)
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  assert.equal(await page.evaluate(() => localStorage.getItem('token')), null)
  await page.getByLabel('Email', { exact: true }).fill(sellerName + '@example.invalid')
  await page.getByLabel('Contraseña', { exact: true }).fill('Password123!')
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await page.getByRole('heading', { name: 'Mi perfil' }).waitFor()
  await page.getByRole('link', { name: 'Mis publicaciones', exact: true }).first().click()
  await page.getByText(product.name, { exact: true }).waitFor()
  assert.deepEqual(errors, [])
  const report = { result: 'PASS', backend: 'Spring Boot + local PostgreSQL 17.11 (no API interception)', timings, catalog_navigation_ms: +catalogNavigationMs.toFixed(2), api_calls: calls.length, admin_api_calls: adminCalls.length, order_id: order.id, promotion_id: savedPromotion.id, total:order.total, idempotent_replay:true }
  await writeFile('node_modules/.cache/audit/http-report.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} finally { await browser.close() }
