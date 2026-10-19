// Run against Vite dev and preview. Uses an external Playwright installation;
// no application dependency is added. HTTP fixtures are deliberately isolated.
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.BASE_URL || 'http://localhost:5173'
const active = { id: 87, name: 'Promo desde API', description: 'Descripción persistida', type: 'COLECCION', discountPercentage: 17.25, collectionId: 901, collectionName: 'Marvel', stackable: false, active: true, startDate: '2020-01-01T08:15:22', endDate: null }
const collection = { id: 901, name: 'Marvel', description: 'Colección desde API' }
const product = { id: 721, name: 'Producto desde API', price: 1200, stock: 5, type: 'CARTA', collectionId: 901, collectionName: 'Marvel', sellerId: 2, status: 'ACTIVO', imageUrls: [], createdAt: '2026-01-01T00:00:00' }
const user = { id: 1, firstName: 'QA', lastName: 'Admin', email: 'qa@example.invalid', role: 'ADMIN', active: true }
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
let browser

async function setup(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  if (options.admin) await context.addInitScript(() => localStorage.setItem('token', 'qa-token'))
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  const state = { promotions: structuredClone(options.promotions ?? [active]), calls: [], errors: [], publicStatus: options.publicStatus ?? 200, adminStatus: options.adminStatus ?? 200, writeStatus: 200, ...options }
  page.on('pageerror', error => state.errors.push(error.message))
  await page.route('http://localhost:8080/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    state.calls.push({ path: url.pathname + url.search, method, body: request.postDataJSON(), authorization: request.headers().authorization })
    let status = 200, data = {}
    if (url.pathname === '/users/me') data = user
    else if (url.pathname === '/carts') data = { id: 1, items: [], subtotal: 0 }
    else if (url.pathname === '/api/v1/auth/authenticate') data = { access_token: 'qa-new-token' }
    else if (url.pathname === '/collections') { data = state.collections ?? [collection]; status = state.collectionsStatus ?? 200 }
    else if (url.pathname === '/products') {
      if (state.productsGate) await state.productsGate.promise
      const query = url.searchParams.get('search') || ''
      const list = (state.products ?? [product]).filter(p => p.name.includes(query))
      const size = Number(url.searchParams.get('size') || 9), number = Number(url.searchParams.get('page') || 0)
      data = { content: list.slice(number * size, (number + 1) * size), totalPages: Math.ceil(list.length / size), totalElements: list.length, number }
      status = state.productsStatus ?? 200
    } else if (/^\/products\/\d+$/.test(url.pathname)) {
      data = (state.products ?? [product]).find(p => p.id === Number(url.pathname.split('/').pop()))
      if (!data) { status = 404; data = {message:'Producto no disponible'} }
    } else if (url.pathname === '/promotions/public') {
      if (state.publicGate) await state.publicGate.promise
      status = state.publicStatus
      data = state.promotions.filter(p => p.active && p.startDate < '2026' && (!p.endDate || p.endDate > '2026'))
    } else if (url.pathname === '/promotions' && method === 'GET') {
      const snapshot = structuredClone(state.promotions)
      if (state.adminGate) await state.adminGate.promise
      data = snapshot; status = state.adminStatus
    } else if (url.pathname.startsWith('/promotions')) {
      if (state.writeGate) await state.writeGate.promise
      status = state.writeStatus
      if (status >= 400) data = { message: 'Error de guardado para QA' }
      else if (method === 'POST') {
        data = { ...request.postDataJSON(), id: 99, active: true, collectionName: collection.name }
        state.promotions.push(data); status = 201
      } else {
        const id = Number(url.pathname.split('/')[2])
        const old = state.promotions.find(p => p.id === id)
        data = method === 'PUT' ? { ...old, ...request.postDataJSON() } : { ...old, active: url.pathname.endsWith('/activate') }
        state.promotions = state.promotions.map(p => p.id === id ? data : p)
      }
    } else throw new Error(`Unexpected module request: ${method} ${url.pathname}`)
    await route.fulfill({ status, json: data })
  })
  const count = (path, method = 'GET') => state.calls.filter(call => call.path === path && call.method === method).length
  const close = async () => { assert.deepEqual(state.errors, []); await context.close() }
  return { page, state, count, close }
}

async function test(name, run) {
  await run()
  console.log('PASS', name)
}

(async () => {
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  await test('Home uses API amounts, conditions and real collection IDs without authentication', async () => {
    const {page, state, count, close} = await setup()
    await page.goto(base)
    await page.getByRole('heading', {name: active.name}).waitFor()
    assert.ok(await page.getByText('17.25%', {exact: true}).isVisible())
    assert.ok(await page.getByText('No acumulable', {exact: true}).isVisible())
    assert.equal(count('/promotions/public'), 1)
    assert.equal(count('/promotions'), 0)
    assert.equal(state.calls.find(c => c.path === '/promotions/public').authorization, undefined)
    const card = page.locator('article').filter({has: page.getByRole('heading', {name: product.name})})
    assert.ok(await card.locator('.bg-amarillo').count() > 0, 'color follows collection name even when ID changes')
    await close()
  })
  await test('Home empty state has no mock promotions', async () => {
    const {page, count, close} = await setup({ promotions: [], collections: [] })
    await page.goto(base)
    await page.getByText('No hay promociones vigentes por el momento.').waitFor()
    assert.ok(await page.getByText('No hay colecciones disponibles.').isVisible())
    assert.equal(await page.getByText('15%').count(), 0)
    assert.equal(count('/promotions/public'), 1)
    await close()
  })
  await test('HTTP errors remain visible and explicit retry performs one additional public GET', async () => {
    const {page, state, count, close} = await setup({ publicStatus: 503 })
    await page.goto(base)
    await page.getByText('No pudimos cargar las promociones (HTTP 503).').waitFor()
    state.publicStatus = 200
    await page.getByRole('button', {name: 'Reintentar', exact: true}).click()
    await page.getByRole('heading', {name: active.name}).waitFor()
    assert.equal(count('/promotions/public'), 2)
    assert.equal(count('/products?size=100'), 0)
    assert.equal(count('/collections'), 1)
    await close()
  })
  await test('Navigation, POST, PUT and PATCH update lists without redundant GETs', async () => {
    const {page, state, count, close} = await setup({ admin: true })
    await page.goto(base + '/promociones')
    await page.getByRole('heading', {name: active.name}).waitFor()
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', {name: 'Editar', exact: true}).click()
      await page.getByRole('heading', {name: 'Editar promoción', exact: true}).waitFor()
      await page.getByRole('link', {name: 'Cancelar', exact: true}).click()
    }
    assert.equal(count('/promotions'), 1)
    assert.equal(count('/products?size=100'), 0)
    assert.equal(count('/collections'), 1)
    await page.getByRole('button', {name: 'Editar', exact: true}).click()
    await page.locator('#promotion-name').fill('Editada desde API')
    await page.getByRole('button', {name: 'Guardar cambios', exact: true}).click()
    await page.getByRole('heading', {name: 'Editada desde API', exact: true}).waitFor()
    assert.equal(count('/promotions/87', 'PUT'), 1)
    assert.equal(state.calls.find(c => c.method === 'PUT').body.startDate, active.startDate)
    assert.equal(count('/promotions'), 1)
    state.writeGate = deferred()
    await page.getByRole('switch', {name: 'Desactivar Editada desde API'}).evaluate(button => {button.click(); button.click()})
    await page.getByText('Guardando…', {exact: true}).waitFor()
    state.writeGate.resolve(); state.writeGate = null
    await page.getByRole('switch', {name: 'Activar Editada desde API'}).waitFor()
    assert.equal(count('/promotions/87/deactivate', 'PATCH'), 1)
    await page.getByRole('button', {name: /^Inactivas/}).click()
    assert.ok(await page.getByRole('heading', {name: 'Editada desde API'}).isVisible())
    await page.getByRole('switch', {name: 'Activar Editada desde API'}).click()
    await page.getByText('No hay promociones en esta pestaña').waitFor()
    await page.getByRole('button', {name: /^Activas/}).click()
    await page.getByRole('heading', {name: 'Editada desde API'}).waitFor()
    assert.equal(count('/promotions/87/activate', 'PATCH'), 1)
    await page.getByRole('link', {name: '+ Nueva promoción', exact: true}).click()
    await page.locator('#promotion-name').fill('Creada desde API')
    await page.locator('#promotion-start').fill('2020-01-01')
    await page.getByRole('button', {name: 'Crear promoción', exact: true}).click()
    await page.getByRole('heading', {name: 'Creada desde API'}).waitFor()
    assert.equal(count('/promotions', 'POST'), 1)
    assert.equal(count('/promotions'), 1)
    await page.getByRole('button', {name: 'Actualizar promociones'}).click()
    await page.getByRole('heading', {name: 'Creada desde API'}).waitFor()
    assert.equal(count('/promotions'), 2)
    await page.getByRole('link', {name: 'Ir al inicio'}).click()
    await page.getByRole('heading', {name: 'Creada desde API'}).waitFor()
    assert.equal(count('/promotions/public'), 1)
    assert.equal(count('/products?size=100'), 0)
    assert.equal(count('/collections'), 1)
    await close()
  })
  await test('Editor remains usable during slow product load, uses the shared request and blocks empty selections', async () => {
    const gate = deferred()
    const {page, count, close} = await setup({ admin: true, productsGate: gate })
    await page.goto(base + '/nueva-promocion')
    await page.locator('#promotion-name').fill('Mientras carga')
    assert.ok(await page.getByRole('button', {name: 'Crear promoción', exact: true}).isEnabled())
    await page.getByRole('button', {name: /Producto puntual/}).click()
    await page.getByText('Cargando productos…', {exact: true}).waitFor()
    assert.ok(await page.getByRole('button', {name: 'Crear promoción', exact: true}).isDisabled())
    gate.resolve()
    await page.locator('select option', {hasText: product.name}).waitFor({state:'attached'})
    await page.locator('select').selectOption(String(product.id))
    assert.ok(await page.getByRole('button', {name: 'Crear promoción', exact: true}).isEnabled())
    assert.equal(count('/products?size=100'), 0)
    assert.equal(count('/products?page=0&size=9'), 1)
    assert.equal(count('/collections'), 1)
    await close()
  })
  await test('Admin list HTTP retry and failed save do not lose form or emit extra GETs', async () => {
    const {page, state, count, close} = await setup({ admin: true, adminStatus: 503 })
    await page.goto(base + '/promociones')
    await page.getByRole('button', {name:'Reintentar', exact:true}).waitFor()
    state.adminStatus = 200
    await page.getByRole('button', {name:'Reintentar', exact:true}).click()
    await page.getByRole('button', {name:'Editar', exact:true}).click()
    await page.locator('#promotion-name').fill('Conservar borrador')
    state.writeStatus = 500
    await page.getByRole('button', {name:'Guardar cambios', exact:true}).click()
    await page.getByRole('alert').filter({hasText:'Error de guardado para QA'}).waitFor()
    assert.equal(await page.locator('#promotion-name').inputValue(), 'Conservar borrador')
    assert.equal(count('/promotions'), 2)
    state.writeStatus = 200
    await page.getByRole('button', {name:'Guardar cambios', exact:true}).click()
    await page.getByRole('heading', {name:'Conservar borrador'}).waitFor()
    assert.equal(count('/promotions'), 2)
    await close()
  })
  await test('Empty/error collection choices never synthesize IDs and do not block other promotion types', async () => {
    for (const options of [{collections: []}, {collectionsStatus: 500}]) {
      const {page, count, close} = await setup({ admin:true, ...options })
      await page.goto(base + '/nueva-promocion')
      await page.getByRole('button', {name:/Por colección/}).click()
      if (options.collections) await page.getByText('No hay colecciones disponibles.').waitFor()
      else await page.getByRole('alert').filter({hasText:'No pudimos cargar las colecciones.'}).waitFor()
      assert.ok(await page.getByRole('button', {name:'Crear promoción', exact:true}).isDisabled())
      await page.getByRole('button', {name:/Por cantidad/}).click()
      assert.ok(await page.getByRole('button', {name:'Crear promoción', exact:true}).isEnabled())
      assert.equal(count('/collections'), 1)
      await close()
    }
  })
  await test('All status filters distinguish active, scheduled, expired and disabled promotions', async () => {
    const entries = [active, {...active, id:88, name:'Programada QA', startDate:'2099-01-01T00:00:00'},
      {...active, id:89, name:'Vencida QA', endDate:'2001-01-01T00:00:00'}, {...active, id:90, name:'Inactiva QA', active:false}]
    const {page, count, close} = await setup({admin:true, promotions:entries})
    await page.goto(base + '/promociones')
    await page.getByRole('heading', {name:active.name}).waitFor()
    for (const [tab, name] of [['Activas', active.name], ['Programadas','Programada QA'], ['Vencidas','Vencida QA'], ['Inactivas','Inactiva QA']]) {
      await page.getByRole('button', {name:new RegExp('^'+tab)}).click()
      await page.getByRole('heading', {name, exact:true}).waitFor()
      assert.equal(await page.locator('article').count(), 1)
    }
    await page.getByRole('button', {name:/^Todas/}).click()
    assert.equal(await page.locator('article').count(), 4)
    assert.equal(count('/promotions'), 1)
    await close()
  })
  await test('Reloading an editor restores the selection from the freshly loaded administration list', async () => {
    const {page, count, close} = await setup({admin:true})
    await page.goto(base + '/promociones')
    await page.getByRole('button', {name:'Editar', exact:true}).click()
    await page.locator('#promotion-name').waitFor()
    await page.reload()
    await page.locator('#promotion-name').waitFor()
    assert.equal(await page.locator('#promotion-name').inputValue(), active.name)
    assert.equal(count('/promotions'), 2, 'one request per full App mount')
    assert.equal(count('/collections'), 2)
    assert.equal(count('/products?size=100'), 0)
    await close()
  })
  await test('An admin response arriving after logout cannot restore old-session data', async () => {
    const gate = deferred()
    const {page, state, count, close} = await setup({admin:true, adminGate:gate})
    await page.goto(base + '/promociones')
    await page.getByText('Cargando promociones…', {exact:true}).waitFor()
    await page.getByRole('button', {name:'Cerrar sesión'}).click()
    await page.locator('#access-email').fill('qa@example.invalid')
    await page.locator('#access-password').fill('qa-password')
    gate.resolve(); state.adminGate = null
    state.promotions = [{...active, name:'Nueva sesión'}]
    await page.getByRole('button', {name:'Ingresar', exact:true}).click()
    await page.getByRole('link', {name:'Promociones', exact:true}).click()
    await page.getByRole('heading', {name:'Nueva sesión'}).waitFor()
    assert.equal(await page.getByRole('heading', {name:active.name}).count(), 0)
    assert.equal(count('/promotions'), 2)
    await close()
  })
  await test('Product selection survives pages and editing fetches the selected real product', async () => {
    const choices = Array.from({length:13}, (_,i) => ({...product, id:721+i, name:'Producto paginado '+(i+1)}))
    const {page, state, count, close} = await setup({admin:true, products:choices, promotions:[]})
    await page.goto(base + '/nueva-promocion')
    await page.getByRole('heading', {name:'Nueva promoción', exact:true}).waitFor()
    assert.equal(count('/products?page=0&size=9'), 0, 'Only product condition should request products')
    await page.getByRole('button', {name:/Producto puntual/}).click()
    await page.locator('select option', {hasText:'Producto paginado 1', exact:true}).waitFor({state:'attached'})
    await page.locator('select').selectOption('721')
    await page.getByRole('button', {name:'Página siguiente', exact:true}).click()
    await page.locator('select option', {hasText:'Producto paginado 13'}).waitFor({state:'attached'})
    assert.equal(await page.locator('select').inputValue(), '721')
    await page.locator('select').selectOption('733')
    await page.getByRole('button', {name:'Página anterior', exact:true}).click()
    await page.locator('select option', {hasText:'Producto paginado 2'}).waitFor({state:'attached'})
    assert.equal(await page.locator('select').inputValue(), '733')
    assert.equal(count('/products?page=0&size=9'), 1, 'Back reuses shared page cache')
    await page.locator('#promotion-name').fill('Promo página dos')
    await page.locator('#promotion-start').fill('2020-01-01')
    await page.getByRole('button', {name:'Crear promoción', exact:true}).click()
    await page.getByRole('heading', {name:'Promo página dos', exact:true}).waitFor()
    assert.equal(state.calls.find(c=>c.method==='POST').body.productId, 733)
    await page.getByRole('button', {name:'Editar', exact:true}).click()
    await page.locator('select option', {hasText:'Producto paginado 13'}).waitFor({state:'attached'})
    assert.equal(await page.locator('select').inputValue(), '733')
    await page.getByText('Cargando productos…', {exact:true}).waitFor({state:'hidden'})
    assert.ok(await page.getByRole('button', {name:'Guardar cambios', exact:true}).isEnabled())
    assert.equal(count('/products/733'), 1, 'StrictMode must not duplicate selected-product fetch')
    await page.getByLabel('Buscar productos de la promoción').fill('paginado 7')
    await page.locator('select option', {hasText:'Producto paginado 7'}).waitFor({state:'attached'})
    assert.equal(await page.locator('select').inputValue(), '733')
    await close()
  })
  await test('Product page errors can be retried without losing the form', async () => {
    const {page, state, count, close} = await setup({admin:true, productsStatus:503})
    await page.goto(base + '/nueva-promocion')
    await page.locator('#promotion-name').fill('Borrador productos')
    await page.getByRole('button', {name:/Producto puntual/}).click()
    await page.getByRole('button', {name:'Reintentar productos'}).waitFor()
    assert.ok(await page.getByRole('button', {name:'Crear promoción', exact:true}).isDisabled())
    state.productsStatus = 200
    await page.getByRole('button', {name:'Reintentar productos'}).click()
    await page.locator('select option', {hasText:product.name}).waitFor({state:'attached'})
    await page.locator('select').selectOption(String(product.id))
    assert.equal(await page.locator('#promotion-name').inputValue(), 'Borrador productos')
    assert.equal(count('/products?page=0&size=9'), 2)
    await close()
  })
  await browser.close()
  console.log('All promotion browser scenarios passed:', base)
})().catch(async error => { console.error(error); await browser?.close(); process.exitCode = 1 })
