// Read-only smoke test: browser -> actual Spring Boot -> configured PostgreSQL.
// The bridge permits testing an isolated backend port without changing App's URL.
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.BASE_URL || 'http://localhost:5173'
const api = process.env.API_URL || 'http://localhost:8080'
let browser

;(async () => {
  browser = await chromium.launch({channel: 'msedge', headless: true})
  const page = await browser.newPage({ viewport: {width: 1440, height: 1000} })
  const records = []
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('http://localhost:8080/**', async route => {
    const request = route.request()
    assert.equal(request.method(), 'GET', 'live verification must remain read-only')
    assert.equal(request.headers().authorization, undefined)
    const url = new URL(request.url())
    const start = performance.now()
    const response = await page.request.get(api + url.pathname + url.search)
    assert.equal(response.status(), 200)
    records.push({path: url.pathname + url.search, status: response.status(), ms: Math.round(performance.now() - start), data: await response.json()})
    await route.fulfill({response})
  })
  await page.goto(base)
  await page.waitForResponse('http://localhost:8080/promotions/public')
  await page.getByText('Cargando promociones…', {exact:true}).waitFor({state: 'hidden'})
  await page.getByText('Cargando colecciones…', {exact:true}).waitFor({state: 'hidden'})
  await page.getByText('Cargando productos…', {exact:true}).waitFor({state: 'hidden'})
  const promotions = records.find(r => r.path === '/promotions/public').data
  const section = page.locator('section[aria-labelledby="promotions-heading"]')
  assert.equal(await section.locator('article').count(), promotions.length)
  for (const [index, promotion] of promotions.entries()) {
    const card = section.locator('article').nth(index)
    assert.ok(await card.getByRole('heading', {name:promotion.name, exact:true}).isVisible())
    assert.ok(await card.getByText(`${Number(promotion.discountPercentage)}%`, {exact:true}).isVisible())
    assert.equal(promotion.active, true)
  }
  if (!promotions.length) assert.ok(await page.getByText('No hay promociones vigentes por el momento.').isVisible())
  const collections = records.find(r => r.path === '/collections').data
  for (const collection of collections) {
    assert.ok(await page.locator('section[aria-labelledby="collections-heading"]').getByRole('heading', {name:collection.name, exact:true}).isVisible())
  }
  const restricted = await page.request.get(api + '/promotions')
  assert.equal(restricted.status(), 401)
  const cors = await page.request.get(api + '/promotions/public', {headers: {Origin:'http://localhost:5173'}})
  assert.equal(cors.status(), 200)
  assert.equal(cors.headers()['access-control-allow-origin'], 'http://localhost:5173')
  assert.deepEqual(errors, [])
  assert.ok(await section.evaluate(element => element.scrollWidth <= element.clientWidth), 'promotion section must not overflow')
  if (process.env.SCREENSHOT_PATH) await page.screenshot({path:process.env.SCREENSHOT_PATH, fullPage:true})
  await page.setViewportSize({width:390, height:844})
  assert.ok(await section.evaluate(element => element.scrollWidth <= element.clientWidth), 'mobile promotion section must not overflow')
  if (process.env.SCREENSHOT_PATH) await section.screenshot({path:process.env.SCREENSHOT_PATH.replace('.png', '-mobile.png')})
  console.log(JSON.stringify({promotions:promotions.length, collections:collections.length, requests:records.map(({data, ...record}) => ({...record, items:Array.isArray(data) ? data.length : data.content?.length})), anonymousAdminStatus:restricted.status(), cors: cors.status()}))
  await browser.close()
})().catch(async error => {console.error(error); await browser?.close(); process.exitCode=1})
