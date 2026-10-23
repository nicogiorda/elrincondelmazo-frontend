// React real + StrictMode, HTTP y tiempo controlados. Sin Spring/PostgreSQL.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.BASE_URL || 'http://localhost:5173'
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const user = id => ({ id, firstName: 'Usuario', lastName: String(id), email: `${id}@example.invalid`, role: 'USUARIO' })
const product = (id, extra = {}) => ({ id, name: 'Publicación ' + id, description: 'Descripción QA', price: 100,
  stock: 5, status: 'ACTIVO', type: 'CARTA', sellerId: 1, sellerName: 'Usuario 1', collectionId: 1,
  collectionName: 'NBA', imageUrls: [], createdAt: '2026-10-20T10:00:00', ...extra })
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jM5sAAAAASUVORK5CYII=', 'base64')
const imageFile = name => ({ name, mimeType: 'image/png', buffer: png })
async function setup(options = {}) {
  const context = await browser.newContext()
  await context.addInitScript(({ ignoreAbort, authenticated }) => {
    if (authenticated) localStorage.setItem('token', 'publications-fixture-1')
    const original = window.fetch.bind(window)
    window.publicationRequests = []
    window.fetch = (url, init = {}) => {
      if (!String(url).startsWith('http://localhost:8080')) return original(url, init)
      const record = { path: new URL(url).pathname, settled: false, aborted: false }
      window.publicationRequests.push(record)
      init.signal?.addEventListener('abort', () => { record.aborted = true }, { once: true })
      return original(url, ignoreAbort ? { ...init, signal: undefined } : init).finally(() => { record.settled = true })
    }
  }, { ignoreAbort: options.ignoreAbort ?? false, authenticated: options.authenticated ?? true })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  await page.clock.install()
  const state = { products: [product(1)], calls: [], errors: [], listStatus: 200, mutationStatus: null, uploadStatuses: [], ...options }
  page.on('pageerror', error => state.errors.push(error.message))
  await page.route('https://example.invalid/**', route => route.fulfill({ contentType: 'image/png', body: png }))
  await page.route('http://localhost:8080/**', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname, method = req.method()
    const owner = req.headers().authorization?.endsWith('-2') ? 2 : 1
    const body = path === '/products/images' ? undefined : req.postDataJSON()
    state.calls.push({ path, method, query: url.search, owner, body })
    let data = [], status = 200, gate
    if (path === '/users/me') data = user(owner)
    else if (path === '/api/v1/auth/authenticate') data = { access_token: 'publications-fixture-' + body.email.split('@')[0] }
    else if (path === '/collections') data = [{ id: 1, name: 'NBA' }]
    else if (path === '/carts') data = { id: owner, items: [], subtotal: 0 }
    else if (path === '/products/mine') {
      const all = state.products.filter(p => p.sellerId === owner).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
      const number = Number(url.searchParams.get('page'))
      assert.equal(url.searchParams.get('size'), '20')
      data = state.invalidList ?? { content: all.slice(number * 20, (number + 1) * 20), number, totalPages: Math.ceil(all.length / 20) }
      data = structuredClone(data)
      status = state.listStatus
      gate = owner === 1 ? state.listGate : null
    } else if (path === '/products/images') {
      const header = req.headers()['content-type']
      assert.match(header, /^multipart\/form-data; boundary=/)
      assert.match(req.postDataBuffer().toString(), /name="file"; filename="/)
      const count = state.calls.filter(c => c.path === path).length
      status = state.uploadStatuses[count - 1] ?? 201
      data = { url: state.uploadUrl ?? `https://example.invalid/upload-${count}.png` }
      gate = state.uploadGate
    } else if (path === '/products' && method === 'GET') {
      const all = state.products.filter(p => ['ACTIVO', 'AGOTADO'].includes(p.status))
      const number = Number(url.searchParams.get('page')), size = Number(url.searchParams.get('size'))
      data = { content: all.slice(number * size, (number + 1) * size), number, totalPages: Math.ceil(all.length / size), totalElements: all.length }
    } else if (path === '/products' && method === 'POST') {
      status = state.mutationStatus ?? 201
      data = product(99, { ...body, sellerId: owner, status: body.stock === 0 ? 'AGOTADO' : 'ACTIVO' })
      if (status === 201) state.products.push(data)
      gate = state.mutationGate
    } else if (/^\/products\/\d+(\/(pause|resume))?$/.test(path)) {
      const id = Number(path.split('/')[2]), current = state.products.find(p => p.id === id)
      if (method === 'GET') {
        status = current && current.status !== 'INACTIVO' ? 200 : 404
        data = current
      } else {
        status = state.mutationStatus ?? (method === 'DELETE' ? 204 : 200)
        if (status < 400) {
          if (method === 'DELETE') state.products = state.products.filter(p => p.id !== id)
          else if (method === 'PUT') Object.assign(current, body, { status: body.stock === 0 ? 'AGOTADO' : current.status === 'AGOTADO' ? 'ACTIVO' : current.status })
          else current.status = path.endsWith('pause') ? 'INACTIVO' : 'ACTIVO'
        }
        data = structuredClone(current)
        gate = state.mutationGate
      }
    }
    if (status >= 400) data = { message: 'Error controlado de publicaciones' }
    if (gate) await gate.promise
    await route.fulfill(status === 204 ? { status, body: '' } : { status, json: data ?? {} }).catch(() => {})
  })
  const count = (path, method = 'GET', owner) => state.calls.filter(c => c.path === path && c.method === method && (!owner || c.owner === owner)).length
  const close = async () => { assert.deepEqual(state.errors, []); await context.close() }
  if (options.harness) await page.route(base + '/publications-harness', route => route.fulfill({ contentType: 'text/html',
    body: '<div id="root"></div><script type="module" src="/tests/fixtures/publications-harness.js"></script>' }))
  await page.goto(base + (options.path ?? '/mis-publicaciones'))
  return { page, state, count, close }
}
const row = (page, name = 'Publicación 1') => page.getByRole('row').filter({ has: page.getByText(name, { exact: true }) })
const routeTo = (page, path) => page.evaluate(path => { history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate')) }, path)
async function settled(page) { await page.waitForFunction(() => window.publicationRequests.every(r => r.settled)); await page.clock.runFor(30) }
async function edit(s) { await row(s.page).getByRole('button', { name: 'Editar', exact: true }).click(); await s.page.getByLabel('Nombre', { exact: true }).waitFor() }
async function fill(s, name = 'Publicación nueva') {
  await s.page.getByLabel('Nombre', { exact: true }).fill(name)
  await s.page.locator('#product-description').fill('Descripción nueva')
  await s.page.getByLabel('Precio (ARS)', { exact: true }).fill('150')
  await s.page.getByLabel('Stock', { exact: true }).fill('8')
}
async function upload(s, names) {
  await s.page.getByLabel('Subir fotos', { exact: true }).setInputFiles(names.map(imageFile))
  await s.page.getByRole('img', { name: 'Foto 1 del producto', exact: true }).waitFor()
  await s.page.waitForFunction(() => !document.querySelector('input[aria-label="Subir fotos"]').disabled)
}
async function loginB(page) {
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
  await page.waitForURL('**/ingresar')
  await page.getByLabel('Email', { exact: true }).fill('2@example.invalid')
  await page.getByLabel('Contraseña', { exact: true }).fill('fixture-password')
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await page.waitForURL('**/mi-perfil')
  await page.getByRole('link', { name: 'Mis publicaciones', exact: true }).first().click()
}
let passed = 0
async function test(name, run) { await run(); passed++; console.log('PASS ' + name) }
try {
  for (const size of [0, 1, 45]) await test(`Listado de ${size} publicaciones: páginas de 20, orden y StrictMode`, async () => {
    const s = await setup({ products: Array.from({ length: size }, (_, i) => product(i + 1)) })
    if (size) await row(s.page, 'Publicación ' + size).waitFor()
    else await s.page.getByText('Todavía no tenés publicaciones', { exact: true }).waitFor()
    await settled(s.page)
    assert.equal(s.count('/products/mine'), Math.max(1, Math.ceil(size / 20)))
    if (!size) await s.page.getByText('Todavía no tenés publicaciones', { exact: true }).waitFor()
    const names = await s.page.getByRole('row').locator('p.font-extrabold, p[class*="font-extrabold"]').allTextContents()
    assert.deepEqual(names, Array.from({ length: size }, (_, i) => 'Publicación ' + (size - i)))
    await s.close()
  })
  for (const empty of [false, true]) await test(`Caché ${empty ? 'vacía' : 'con datos'}: reutiliza durante 60 s y vence al volver`, async () => {
    const s = await setup({ products: empty ? [] : [product(1)] })
    if (empty) await s.page.getByText('Todavía no tenés publicaciones', { exact: true }).waitFor()
    else await row(s.page).waitFor()
    await settled(s.page)
    await routeTo(s.page, '/mi-perfil'); await routeTo(s.page, '/mis-publicaciones'); await settled(s.page)
    assert.equal(s.count('/products/mine'), 1)
    await routeTo(s.page, '/mi-perfil'); await s.page.clock.fastForward(60_001)
    s.state.products.push(product(2))
    await routeTo(s.page, '/mis-publicaciones'); await row(s.page, 'Publicación 2').waitFor()
    assert.equal(s.count('/products/mine'), 2)
    await s.close()
  })
  await test('Error de carga y actualización manual', async () => {
    const s = await setup({ listStatus: 500 })
    await s.page.getByRole('alert').waitFor(); s.state.listStatus = 200
    await s.page.getByRole('button', { name: 'Actualizar listado', exact: true }).click()
    await row(s.page).waitFor(); assert.equal(s.count('/products/mine'), 2)
    await s.close()
  })
  await test('Navegar durante una carga reutiliza la solicitud en curso', async () => {
    const gate = deferred(), s = await setup({ listGate: gate })
    await s.page.getByText('Cargando publicaciones…', { exact: true }).waitFor()
    await routeTo(s.page, '/mi-perfil'); await routeTo(s.page, '/mis-publicaciones')
    gate.resolve(); await row(s.page).waitFor()
    assert.equal(s.count('/products/mine'), 1)
    await s.close()
  })
  await test('Página de otro vendedor no se muestra ni alimenta el catálogo', async () => {
    const s = await setup({ invalidList: { content: [product(7, { sellerId: 2 })], totalPages: 1 } })
    await s.page.getByText('La respuesta de publicaciones no contiene una página válida del usuario.', { exact: true }).waitFor()
    assert.equal(await row(s.page, 'Publicación 7').count(), 0)
    await s.close()
  })
  await test('Crear: contrato exacto, imagen multipart, lista y catálogo sincronizados', async () => {
    const s = await setup({ path: '/publicar' }); await fill(s); await upload(s, ['uno.png'])
    await s.page.getByRole('button', { name: 'Publicar', exact: true }).click()
    await row(s.page, 'Publicación nueva').waitFor()
    const sent = s.state.calls.find(c => c.path === '/products' && c.method === 'POST').body
    assert.deepEqual(Object.keys(sent).sort(), ['collectionId', 'description', 'imageUrls', 'name', 'price', 'stock', 'type'])
    assert.deepEqual(sent.imageUrls, ['https://example.invalid/upload-1.png'])
    await routeTo(s.page, '/producto/99'); await s.page.getByRole('heading', { name: 'Publicación nueva', exact: true }).waitFor()
    assert.equal(s.count('/products/99'), 0)
    await s.close()
  })
  await test('Editar nombre, precio y stock actualiza lista y detalle sin GET adicional', async () => {
    const s = await setup(); await edit(s); await fill(s, 'Edición guardada')
    await s.page.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
    await row(s.page, 'Edición guardada').waitFor()
    assert.match(await row(s.page, 'Edición guardada').innerText(), /150/)
    assert.equal(s.state.products[0].stock, 8)
    assert.equal(s.count('/products/mine'), 1)
    await routeTo(s.page, '/producto/1'); await s.page.getByRole('heading', { name: 'Edición guardada', exact: true }).waitFor()
    assert.equal(s.count('/products/1'), 0)
    await s.close()
  })
  await test('Pausa y reactivación mantienen reglas públicas sin bucles de GET', async () => {
    const s = await setup(); await row(s.page).getByRole('button', { name: 'Activo', exact: true }).click()
    await row(s.page).getByRole('button', { name: 'Pausado', exact: true }).waitFor()
    await routeTo(s.page, '/catalogo'); await settled(s.page)
    assert.equal(await s.page.getByRole('button', { name: 'Ver Publicación 1', exact: true }).count(), 0)
    await routeTo(s.page, '/producto/1'); await s.page.getByRole('heading', { name: 'Producto no disponible', exact: true }).waitFor()
    await routeTo(s.page, '/mis-publicaciones')
    await row(s.page).getByRole('button', { name: 'Pausado', exact: true }).click()
    await row(s.page).getByRole('button', { name: 'Activo', exact: true }).waitFor()
    assert.equal(s.count('/products/mine'), 1)
    await routeTo(s.page, '/producto/1'); await s.page.getByRole('heading', { name: 'Publicación 1', exact: true }).waitFor()
    assert.equal(s.count('/products/1'), 1)
    await s.close()
  })
  await test('No reactiva sin stock ni transforma AGOTADO', async () => {
    const s = await setup({ products: [product(1, { status: 'INACTIVO', stock: 0 }), product(2, { status: 'AGOTADO', stock: 0 })] })
    await row(s.page).getByRole('button', { name: 'Pausado', exact: true }).click()
    await s.page.getByText('No se puede reactivar una publicación sin stock disponible.', { exact: true }).waitFor()
    assert.equal(s.count('/products/1/resume', 'PATCH'), 0)
    assert.equal(await row(s.page, 'Publicación 2').getByRole('button', { name: 'Agotado', exact: true }).isDisabled(), true)
    await s.close()
  })
  for (const accepted of [false, true]) await test(`Eliminación ${accepted ? 'confirmada' : 'cancelada'} conserva diálogo y caché pública`, async () => {
    const s = await setup(); await row(s.page).waitFor()
    s.page.once('dialog', dialog => accepted ? dialog.accept() : dialog.dismiss())
    await row(s.page).getByRole('button', { name: 'Eliminar', exact: true }).click(); await settled(s.page)
    assert.equal(s.count('/products/1', 'DELETE'), accepted ? 1 : 0)
    assert.equal(await row(s.page).count(), accepted ? 0 : 1)
    if (accepted) {
      await routeTo(s.page, '/producto/1'); await s.page.getByRole('heading', { name: 'Producto no disponible', exact: true }).waitFor()
      assert.equal(s.count('/products/1'), 1)
    }
    await s.close()
  })
  await test('Error de mutación conserva publicación y permite reintento', async () => {
    const s = await setup({ mutationStatus: 500 })
    await row(s.page).getByRole('button', { name: 'Activo', exact: true }).click()
    await s.page.getByRole('alert').waitFor()
    assert.equal(await row(s.page).getByRole('button', { name: 'Activo', exact: true }).isEnabled(), true)
    s.state.mutationStatus = null
    await row(s.page).getByRole('button', { name: 'Activo', exact: true }).click()
    await row(s.page).getByRole('button', { name: 'Pausado', exact: true }).waitFor()
    assert.equal(s.count('/products/1/pause', 'PATCH'), 2)
    await s.close()
  })
  await test('Reemplazo y eliminación de fotos conservan las URL restantes', async () => {
    const s = await setup({ products: [product(1, { imageUrls: ['https://example.invalid/original.png', 'https://example.invalid/dorso.png', 'https://example.invalid/quitar.png'] })] })
    await edit(s)
    await s.page.getByLabel('Reemplazar foto 1', { exact: true }).setInputFiles(imageFile('reemplazo.png'))
    await s.page.waitForFunction(() => document.querySelector('img[alt="Foto 1 del producto"]').src.startsWith('data:'))
    await s.page.getByRole('button', { name: 'Eliminar foto 3', exact: true }).click()
    await s.page.getByRole('button', { name: 'Guardar cambios', exact: true }).click(); await row(s.page).waitFor()
    assert.deepEqual(s.state.products[0].imageUrls, ['https://example.invalid/upload-1.png', 'https://example.invalid/dorso.png'])
    assert.equal(s.count('/products/images', 'POST'), 1)
    await s.close()
  })
  await test('Subida parcial fallida reutiliza fotos exitosas al reintentar', async () => {
    const s = await setup({ path: '/publicar', uploadStatuses: [201, 500, 201] })
    await fill(s); await upload(s, ['uno.png', 'dos.png'])
    await s.page.getByRole('button', { name: 'Publicar', exact: true }).click()
    await s.page.getByRole('alert').waitFor(); assert.equal(s.count('/products', 'POST'), 0)
    await s.page.getByRole('button', { name: 'Publicar', exact: true }).click()
    await row(s.page, 'Publicación nueva').waitFor()
    assert.equal(s.count('/products/images', 'POST'), 3)
    assert.deepEqual(s.state.products.find(p => p.id === 99).imageUrls, ['https://example.invalid/upload-1.png', 'https://example.invalid/upload-3.png'])
    await s.close()
  })
  await test('URL inválida de subida impide publicar', async () => {
    const s = await setup({ path: '/publicar', uploadUrl: 'data:image/png;base64,invalid' })
    await fill(s); await upload(s, ['uno.png']); await s.page.getByRole('button', { name: 'Publicar', exact: true }).click()
    await s.page.getByText('La subida no devolvió una URL de imagen válida.', { exact: true }).waitFor()
    assert.equal(s.count('/products', 'POST'), 0)
    await s.close()
  })
  await test('Archivo no imagen y más de tres fotos se rechazan antes de enviar HTTP', async () => {
    const s = await setup({ path: '/publicar' })
    await s.page.getByLabel('Subir fotos', { exact: true }).setInputFiles({ name: 'texto.txt', mimeType: 'text/plain', buffer: Buffer.from('QA') })
    await s.page.getByText('Seleccioná únicamente archivos de imagen válidos.', { exact: true }).waitFor()
    await s.page.getByLabel('Subir fotos', { exact: true }).setInputFiles(['a.png', 'b.png', 'c.png', 'd.png'].map(imageFile))
    await s.page.getByText('Podés cargar hasta tres fotografías en total.', { exact: true }).waitFor()
    assert.equal(s.count('/products/images', 'POST'), 0)
    await s.close()
  })
  await test('Entrar al listado durante una subida no deja la carga bloqueada', async () => {
    const gate = deferred(), s = await setup({ path: '/publicar', uploadGate: gate })
    await fill(s); await upload(s, ['uno.png']); await s.page.getByRole('button', { name: 'Publicar', exact: true }).click()
    await s.page.waitForFunction(() => window.publicationRequests.some(r => r.path === '/products/images'))
    await routeTo(s.page, '/mis-publicaciones')
    gate.resolve(); await row(s.page).waitFor(); await row(s.page, 'Publicación nueva').waitFor()
    await settled(s.page)
    assert.equal(await s.page.getByText('Cargando publicaciones…', { exact: true }).count(), 0)
    assert.equal(s.count('/products/mine'), 1)
    await s.close()
  })
  await test('Guardado fallido conserva subidas exitosas', async () => {
    const s = await setup({ path: '/publicar', mutationStatus: 500 })
    await fill(s); await upload(s, ['uno.png']); await s.page.getByRole('button', { name: 'Publicar', exact: true }).click()
    await s.page.getByRole('alert').waitFor(); s.state.mutationStatus = null
    await s.page.getByRole('button', { name: 'Publicar', exact: true }).click(); await row(s.page, 'Publicación nueva').waitFor()
    assert.equal(s.count('/products/images', 'POST'), 1)
    assert.equal(s.count('/products', 'POST'), 2)
    await s.close()
  })
  await test('Doble clic y navegación durante una mutación no envían operaciones incompatibles', async () => {
    const gate = deferred(), s = await setup({ mutationGate: gate })
    await row(s.page).getByRole('button', { name: 'Activo', exact: true }).evaluate(button => { button.click(); button.click() })
    await s.page.waitForFunction(() => document.querySelector('[aria-busy="true"]'))
    assert.equal(s.count('/products/1/pause', 'PATCH'), 1)
    assert.equal(await row(s.page).getByRole('button', { name: 'Eliminar', exact: true }).isDisabled(), true)
    await routeTo(s.page, '/publicar'); await fill(s); await upload(s, ['uno.png'])
    await s.page.getByRole('button', { name: 'Publicar', exact: true }).click()
    await s.page.getByText('Esperá a que termine la operación de publicaciones.', { exact: true }).waitFor()
    assert.equal(s.count('/products/images', 'POST'), 0)
    assert.equal(s.count('/products', 'POST'), 0)
    gate.resolve(); await settled(s.page); await s.close()
  })
  await test('GET previo que ignora AbortSignal no sobrescribe una edición ni el catálogo', async () => {
    const s = await setup({ ignoreAbort: true, harness: true, path: '/publications-harness' })
    await s.page.locator('#private').filter({ hasText: 'Publicación 1' }).waitFor()
    const gate = deferred(); s.state.listGate = gate
    await s.page.getByRole('button', { name: 'Actualizar', exact: true }).click()
    await s.page.waitForFunction(() => window.publicationRequests.filter(r => r.path === '/products/mine').length === 2)
    await s.page.getByRole('button', { name: 'Guardar edición', exact: true }).click()
    await s.page.locator('#private').filter({ hasText: 'Edición vigente' }).waitFor()
    gate.resolve(); await settled(s.page)
    for (const target of ['#private', '#public']) {
      const items = JSON.parse(await s.page.locator(target).textContent())
      assert.equal(items[0].name, 'Edición vigente')
      assert.equal(items[0].price, 200); assert.equal(items[0].stock, 7)
    }
    assert.equal(s.count('/products/mine'), 2)
    assert.equal(await s.page.evaluate(() => window.publicationRequests.filter(r => r.path === '/products/mine')[1].aborted), true)
    await s.close()
  })
  for (const operation of ['list', 'mutation', 'upload']) await test(`Cambio A → B con ${operation} pendiente que ignora cancelación`, async () => {
    const gate = deferred()
    const s = await setup({ ignoreAbort: true, products: [product(1), product(2, { sellerId: 2 })],
      ...(operation === 'list' ? { listGate: gate } : operation === 'mutation' ? { mutationGate: gate } : { path: '/publicar', uploadGate: gate }) })
    if (operation === 'mutation') await row(s.page).getByRole('button', { name: 'Activo', exact: true }).click()
    if (operation === 'upload') {
      await fill(s); await upload(s, ['uno.png']); await s.page.getByRole('button', { name: 'Publicar', exact: true }).click()
      await s.page.waitForFunction(() => window.publicationRequests.some(r => r.path === '/products/images'))
    }
    if (operation === 'list') await s.page.getByText('Cargando publicaciones…', { exact: true }).waitFor()
    await loginB(s.page); await row(s.page, 'Publicación 2').waitFor()
    // La respuesta antigua tampoco puede liberar un bloqueo adquirido por B.
    const gateB = deferred(); s.state.mutationGate = gateB
    await row(s.page, 'Publicación 2').getByRole('button', { name: 'Activo', exact: true }).click()
    gate.resolve(); await s.page.clock.runFor(50)
    assert.equal(await row(s.page).count(), 0)
    assert.equal(await row(s.page, 'Publicación 2').getByRole('button', { name: 'Eliminar', exact: true }).isDisabled(), true)
    assert.equal(s.count('/products', 'POST', 1), 0)
    gateB.resolve(); await settled(s.page)
    await row(s.page, 'Publicación 2').getByRole('button', { name: 'Pausado', exact: true }).waitFor()
    await s.close()
  })
  for (const status of [401, 403]) for (const operation of ['list', 'mutation']) await test(`${operation} HTTP ${status} conserva sesión/permisos`, async () => {
    const s = await setup(operation === 'list' ? { listStatus: status } : { mutationStatus: status })
    if (operation === 'mutation') await row(s.page).getByRole('button', { name: 'Activo', exact: true }).click()
    if (status === 401) {
      await s.page.waitForURL('**/ingresar')
      assert.equal(await s.page.evaluate(() => localStorage.getItem('token')), null)
    } else await s.page.getByText(operation === 'list' ? 'No tenés permiso para consultar tus publicaciones.' : 'No tenés permiso para modificar esta publicación.', { exact: true }).waitFor()
    await s.close()
  })
  await test('Logout aborta realmente una carga y limpia los datos privados', async () => {
    const gate = deferred(), s = await setup({ listGate: gate })
    await s.page.getByText('Cargando publicaciones…', { exact: true }).waitFor()
    await s.page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
    await s.page.waitForURL('**/ingresar')
    assert.equal(await s.page.evaluate(() => window.publicationRequests.find(r => r.path === '/products/mine').aborted), true)
    gate.resolve(); await settled(s.page)
    assert.equal(await row(s.page).count(), 0)
    assert.equal(await s.page.evaluate(() => Boolean(localStorage.getItem('token'))), false)
    await s.close()
  })
  await test('Ruta privada sin sesión redirige sin consultar publicaciones', async () => {
    const s = await setup({ authenticated: false })
    await s.page.waitForURL('**/ingresar'); assert.equal(s.count('/products/mine'), 0); await s.close()
  })
  console.log(`Publicaciones: ${passed} pruebas PASS (HTTP simulado).`)
} finally { await browser.close() }
