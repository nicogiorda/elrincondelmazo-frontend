// Aplicación real en StrictMode; HTTP y reloj controlados, sin Spring ni PostgreSQL.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.BASE_URL || 'http://localhost:5173'
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const fixtureProducts = () => Array.from({ length: 24 }, (_, i) => ({
  id: i + 1, name: 'Producto ' + (i + 1), description: 'Detalle QA', price: (i + 1) * 10,
  stock: 10, status: 'ACTIVO', type: i % 2 ? 'SOBRE' : 'CARTA',
  sellerId: i === 23 ? 1 : 9, sellerName: 'Vendedor QA', collectionId: i < 12 ? 1 : 2,
  collectionName: i < 12 ? 'NBA' : 'Marvel', imageUrls: [],
  createdAt: '2026-10-' + String(24 - i).padStart(2, '0') + 'T10:00:00',
}))
async function setup(options = {}) {
  const context = await browser.newContext()
  await context.addInitScript(({ loggedIn, ignoreAbort }) => {
    if (loggedIn) localStorage.setItem('token', 'catalog-fixture')
    const original = window.fetch.bind(window)
    window.productRequests = []
    window.fetch = (url, init = {}) => {
      if (!String(url).includes('/products')) return original(url, init)
      const record = { settled: false }
      window.productRequests.push(record)
      return original(url, ignoreAbort ? { ...init, signal: undefined } : init).finally(() => { record.settled = true })
    }
  }, { loggedIn: options.loggedIn ?? false, ignoreAbort: options.ignoreAbort ?? false })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  await page.clock.install()
  const state = { products: fixtureProducts(), calls: [], errors: [], pageStatus: 200, detailStatus: 200, ...options }
  page.on('pageerror', error => state.errors.push(error.message))
  await page.route('http://localhost:8080/**', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname, q = url.searchParams
    const method = req.method()
    state.calls.push({ path, query: url.search, method })
    let data = [], status = 200, gate
    if (path === '/collections') { data = [{ id: 1, name: 'NBA' }, { id: 2, name: 'Marvel' }]; status = state.collectionsStatus ?? 200 }
    else if (path === '/users/me') data = { id: 1, firstName: 'QA', lastName: 'Catalogo', email: 'qa@example.invalid', role: 'USUARIO' }
    else if (path === '/carts') data = { id: 1, items: [], subtotal: 0 }
    else if (path === '/products/mine') data = { content: state.products.filter(p => p.sellerId === 1), totalPages: 1 }
    else if (path === '/products') {
      let list = state.products.filter(p => p.status === 'ACTIVO')
      if (q.has('search')) list = list.filter(p => p.name.includes(q.get('search')))
      if (q.has('type')) list = list.filter(p => p.type === q.get('type'))
      if (q.has('collectionId')) list = list.filter(p => p.collectionId === Number(q.get('collectionId')))
      if (q.has('minPrice')) list = list.filter(p => p.price >= Number(q.get('minPrice')))
      if (q.has('maxPrice')) list = list.filter(p => p.price <= Number(q.get('maxPrice')))
      const number = Number(q.get('page')), size = Number(q.get('size'))
      data = { content: structuredClone(list.slice(number * size, (number + 1) * size)), number, totalElements: list.length, totalPages: Math.ceil(list.length / size) }
      status = state.pageStatus
      gate = state.gates?.[q.get('search')] ?? state.pageGate
    } else if (/^\/products\/\d+$/.test(path)) {
      const id = Number(path.split('/').pop())
      if (method === 'DELETE') {
        state.products = state.products.filter(p => p.id !== id)
        return route.fulfill({ status: 204, body: '' })
      }
      data = structuredClone(state.products.find(p => p.id === id))
      status = data ? state.detailStatus : 404
      gate = state.detailGate
    }
    if (status >= 400) data = { message: 'Error catálogo QA' }
    if (gate) await gate.promise
    await route.fulfill({ status, json: data }).catch(() => {})
  })
  const count = (path, query) => state.calls.filter(c => c.method === 'GET' && c.path === path && (query === undefined || c.query === query)).length
  const close = async () => { assert.deepEqual(state.errors, []); await context.close() }
  await page.goto(base + (options.path ?? '/catalogo'))
  return { page, state, count, close }
}
const card = (page, id) => page.getByRole('button', { name: 'Ver Producto ' + id, exact: true })
const title = (page, id) => page.getByRole('heading', { name: 'Producto ' + id, exact: true })
const catalog = page => page.locator('[aria-label="Productos del catálogo"]')
const routeTo = (page, path) => page.evaluate(path => { history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate')) }, path)
let passed = 0
async function test(name, run) { await run(); passed++; console.log('PASS ' + name) }

try {
  await test('Home consulta cuatro productos y colecciones una vez bajo StrictMode', async () => {
    const s = await setup({ path: '/' })
    await card(s.page, 4).waitFor()
    assert.equal(s.count('/products', '?page=0&size=4'), 1)
    assert.equal(s.count('/collections'), 1)
    assert.equal(s.state.calls.filter(c => /^\/products\/\d+$/.test(c.path)).length, 0)
    assert.deepEqual(await s.page.locator('button[aria-label^="Ver Producto "]').evaluateAll(buttons => buttons.map(b => b.getAttribute('aria-label'))),
      ['Ver Producto 1', 'Ver Producto 2', 'Ver Producto 3', 'Ver Producto 4'])
    await s.close()
  })
  await test('Paginación de nueve productos, detalle conocido y regreso sin GET redundante', async () => {
    const s = await setup()
    await card(s.page, 9).waitFor()
    assert.equal(await catalog(s.page).locator('article').count(), 9)
    await s.page.getByRole('button', { name: 'Página siguiente', exact: true }).click()
    await card(s.page, 18).waitFor()
    await card(s.page, 10).click(); await title(s.page, 10).waitFor()
    assert.equal(s.count('/products/10'), 0)
    await s.page.goBack(); await card(s.page, 18).waitFor()
    assert.equal(s.count('/products', '?page=1&size=9'), 1)
    assert.equal(await s.page.getByRole('button', { name: 'Página 2', exact: true }).getAttribute('aria-current'), 'page')
    await s.close()
  })
  await test('Búsqueda y filtros combinados se envían al servidor; limpiar restablece página cero', async () => {
    const s = await setup(); await card(s.page, 9).waitFor()
    await s.page.getByRole('button', { name: 'Página siguiente', exact: true }).click()
    await card(s.page, 18).waitFor()
    await s.page.getByRole('searchbox', { name: 'Buscar productos' }).fill('Producto 2')
    await s.page.getByRole('button', { name: 'Cartas', exact: true }).click()
    await s.page.getByRole('radio', { name: 'Marvel', exact: true }).check()
    await s.page.getByLabel('Precio mínimo').fill('200')
    await s.page.getByLabel('Precio máximo').fill('240')
    await card(s.page, 23).waitFor()
    assert.equal(await catalog(s.page).locator('article').count(), 2)
    const query = new URLSearchParams(s.state.calls.filter(c => c.path === '/products').at(-1).query)
    assert.deepEqual(Object.fromEntries(query), { page: '0', size: '9', search: 'Producto 2', type: 'CARTA', collectionId: '2', minPrice: '200', maxPrice: '240' })
    await s.page.getByRole('button', { name: 'Limpiar', exact: true }).click()
    await card(s.page, 9).waitFor()
    assert.equal(await s.page.getByRole('searchbox').inputValue(), '')
    assert.equal(s.count('/products', '?page=0&size=9'), 1)
    await s.close()
  })
  await test('Debounce de 250 ms agrupa cambios rápidos y descarta resultados antiguos', async () => {
    const gate = deferred()
    const s = await setup({ gates: { Producto: gate }, ignoreAbort: true })
    await card(s.page, 9).waitFor()
    await s.page.clock.pauseAt(new Date(Date.now() + 1000))
    const search = s.page.getByRole('searchbox')
    const before = s.count('/products')
    await search.fill('P'); await search.fill('Pro'); await search.fill('Producto')
    await s.page.clock.runFor(249)
    assert.equal(s.count('/products'), before)
    const oldRequest = s.page.waitForRequest(r => r.url().includes('search=Producto'))
    await s.page.clock.runFor(1); await oldRequest
    await search.fill('Producto 24'); await s.page.clock.runFor(250)
    await card(s.page, 24).waitFor()
    gate.resolve()
    await s.page.waitForFunction(() => window.productRequests.every(r => r.settled))
    await s.page.clock.runFor(30)
    assert.equal(await catalog(s.page).locator('article').count(), 1)
    assert.equal(s.count('/products'), before + 2)
    await s.close()
  })
  await test('El historial restaura filtros propios de cada entrada y reutiliza páginas', async () => {
    const s = await setup(); await card(s.page, 9).waitFor()
    await s.page.getByRole('searchbox').fill('Producto 1'); await card(s.page, 17).waitFor()
    await s.page.getByRole('link', { name: 'Ir al inicio' }).click(); await card(s.page, 4).waitFor()
    await s.page.getByRole('link', { name: 'Sobres', exact: true }).first().click()
    await card(s.page, 18).waitFor()
    assert.equal(await s.page.getByRole('searchbox').inputValue(), '')
    await s.page.getByRole('searchbox').fill('Producto 2'); await card(s.page, 24).waitFor()
    await s.page.goBack(); await card(s.page, 4).waitFor()
    await s.page.goBack(); await card(s.page, 17).waitFor()
    assert.equal(await s.page.getByRole('searchbox').inputValue(), 'Producto 1')
    assert.equal(s.count('/products', '?page=0&size=9&search=Producto+1'), 1)
    await s.close()
  })
  await test('Home renueva datos al vencer 60 segundos y conserva los tamaños de consulta', async () => {
    const s = await setup({ path: '/' }); await card(s.page, 4).waitFor()
    s.state.products[0].price = 777
    await s.page.clock.fastForward(61_000)
    await s.page.locator('article').filter({ has: card(s.page, 1) }).getByText('$ 777', { exact: true }).waitFor()
    assert.equal(s.count('/products', '?page=0&size=4'), 2)
    assert.equal(s.count('/collections'), 1)
    await s.close()
  })
  await test('Error de página conserva mensaje y reintento hace una sola consulta adicional', async () => {
    const s = await setup({ pageStatus: 503 })
    await s.page.getByRole('alert').filter({ hasText: 'Error catálogo QA' }).waitFor()
    s.state.pageStatus = 200
    await s.page.getByRole('button', { name: 'Reintentar', exact: true }).click()
    await card(s.page, 9).waitFor()
    assert.equal(s.count('/products', '?page=0&size=9'), 2)
    await s.close()
  })
  await test('URL directa carga detalle y relacionados de cinco productos sin GET por tarjeta', async () => {
    const s = await setup({ path: '/producto/7' })
    await title(s.page, 7).waitFor(); await card(s.page, 1).waitFor()
    assert.equal(s.count('/products/7'), 1)
    assert.equal(s.count('/products', '?page=0&size=5&collectionId=1'), 1)
    await card(s.page, 1).click(); await title(s.page, 1).waitFor()
    assert.equal(s.count('/products/1'), 0)
    assert.equal(s.count('/products', '?page=0&size=5&collectionId=1'), 1)
    await s.page.reload(); await title(s.page, 1).waitFor()
    assert.equal(s.count('/products/1'), 1)
    await s.close()
  })
  for (const [name, path, options] of [
    ['inexistente', '/producto/999', {}],
    ['inactivo', '/producto/7', { products: fixtureProducts().map(p => p.id === 7 ? { ...p, status: 'INACTIVO' } : p) }],
    ['ID inválido', '/producto/no-valido', {}],
  ]) await test('Detalle ' + name + ' muestra indisponibilidad sin solicitudes adicionales', async () => {
    const s = await setup({ path, ...options })
    await s.page.getByRole('heading', { name: 'Producto no disponible', exact: true }).waitFor()
    if (name === 'ID inválido') assert.equal(s.count('/products/no-valido'), 0)
    else assert.equal(s.count(path.replace('/producto/', '/products/')), 1)
    assert.equal(s.count('/products'), 0)
    await s.close()
  })
  await test('Detalle con error permite reintentar y descarta una respuesta de otra URL', async () => {
    const s = await setup({ path: '/producto/7', detailStatus: 503 })
    await s.page.getByText('Error catálogo QA', { exact: true }).waitFor()
    s.state.detailStatus = 200
    await s.page.getByRole('button', { name: 'Reintentar', exact: true }).click()
    await title(s.page, 7).waitFor()
    assert.equal(s.count('/products/7'), 2)
    await s.close()
    const gate = deferred()
    const late = await setup({ path: '/producto/7', detailGate: gate, ignoreAbort: true })
    await late.page.getByText('Cargando producto…', { exact: true }).waitFor()
    await late.page.waitForFunction(() => window.productRequests.length > 0)
    late.state.detailGate = null
    await routeTo(late.page, '/producto/20'); await title(late.page, 20).waitFor()
    gate.resolve()
    await late.page.waitForFunction(() => window.productRequests.every(r => r.settled))
    await late.page.clock.runFor(30)
    assert.equal(await title(late.page, 7).count(), 0)
    await title(late.page, 20).waitFor()
    await late.close()
  })
  await test('Eliminar una publicación invalida el catálogo y retira el producto conocido', async () => {
    const s = await setup({ loggedIn: true, path: '/producto/24' })
    await title(s.page, 24).waitFor()
    await s.page.getByRole('link', { name: 'Vender', exact: true }).first().click()
    await s.page.getByRole('button', { name: 'Eliminar', exact: true }).waitFor()
    s.page.once('dialog', dialog => dialog.accept())
    await s.page.getByRole('button', { name: 'Eliminar', exact: true }).click()
    await s.page.getByText('Todavía no tenés publicaciones', { exact: true }).waitFor()
    await routeTo(s.page, '/producto/24')
    await s.page.getByRole('heading', { name: 'Producto no disponible', exact: true }).waitFor()
    assert.equal(s.count('/products/24'), 2)
    assert.equal(s.state.calls.filter(c => c.method === 'DELETE').length, 1)
    await s.close()
  })
  console.log('Escenarios de catálogo aprobados: ' + passed)
} finally { await browser.close() }
