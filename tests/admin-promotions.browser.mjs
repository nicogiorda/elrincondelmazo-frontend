// Hook y vistas reales en StrictMode, con HTTP simulado y sin backend.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const base = process.env.BASE_URL || 'http://localhost:5173'
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const promotion = (id = 1, extra = {}) => ({ id, name: 'Promo ' + id, type: 'CANTIDAD', description: 'QA', discountPercentage: 15,
  minimumQuantity: 2, productType: null, active: true, stackable: false, startDate: '2020-01-01T08:15:22', endDate: null, ...extra })
async function setup(options = {}) {
  const context = await browser.newContext()
  await context.addInitScript(({ ignoreAbort }) => {
    if (!sessionStorage.getItem('initialized')) {
      localStorage.setItem('token', 'admin-fixture-1'); sessionStorage.setItem('initialized', '1')
    }
    const original = window.fetch.bind(window)
    window.adminRequests = []
    window.fetch = (url, init = {}) => {
      if (!String(url).startsWith('http://localhost:8080')) return original(url, init)
      const record = { path: new URL(url).pathname, method: init.method || 'GET', settled: false, aborted: false }
      window.adminRequests.push(record)
      init.signal?.addEventListener('abort', () => { record.aborted = true }, { once: true })
      return original(url, ignoreAbort ? { ...init, signal: undefined } : init).finally(() => { record.settled = true })
    }
  }, { ignoreAbort: options.ignoreAbort ?? false })
  const page = await context.newPage(); page.setDefaultTimeout(10000)
  const state = { role: 'ADMIN', promotions: [promotion()], listStatus: 200, writeStatus: 200, calls: [], errors: [], ...options }
  page.on('pageerror', error => state.errors.push(error.message))
  await page.route('http://localhost:8080/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname, method = req.method(), body = req.postDataJSON()
    const owner = req.headers().authorization?.endsWith('-2') ? 2 : 1
    state.calls.push({ path, method, owner })
    let data = [], status = 200, gate
    if (path === '/users/me') data = { id: owner, firstName: 'QA', lastName: String(owner), email: `${owner}@example.invalid`, role: state.role }
    else if (path === '/api/v1/auth/authenticate') data = { access_token: 'admin-fixture-2' }
    else if (path === '/carts') data = { id: owner, items: [], subtotal: 0 }
    else if (path === '/collections') data = [{ id: 901, name: 'NBA' }]
    else if (path === '/products') data = { content: [], totalPages: 0, totalElements: 0, number: 0 }
    else if (path === '/promotions/public') {
      assert.equal(req.headers().authorization, undefined)
      data = structuredClone(state.promotions.filter(p => p.active)); gate = state.publicGate
    } else if (path === '/promotions' && method === 'GET') {
      data = structuredClone(state.listOverride ?? state.promotions); status = state.listStatus
      gate = owner === 1 ? state.listGate : null
    } else if (path.startsWith('/promotions')) {
      gate = state.writeGate
      // El guardado ocurre al liberar la respuesta, para intercalar lecturas anteriores.
      if (gate) await gate.promise
      gate = null; status = state.writeStatus
      if (method === 'POST') {
        data = promotion(99, body); if (status === 200) { state.promotions.push(data); status = 201 }
      } else {
        const id = Number(path.split('/')[2]), previous = state.promotions.find(p => p.id === id) ?? promotion(id)
        data = method === 'PUT' ? { ...previous, ...body } : { ...previous, active: path.endsWith('/activate') }
        if (status === 200) state.promotions = state.promotions.map(p => p.id === id ? data : p)
      }
      if (state.writeOverride) data = state.writeOverride
    }
    if (status >= 400) data = { message: 'Error administrativo QA' }
    if (gate) await gate.promise
    await route.fulfill({ status, json: data }).catch(() => {})
  })
  if (options.harness) await page.route(base + '/admin-harness', route => route.fulfill({ contentType: 'text/html',
    body: '<div id="root"></div><script type="module" src="/tests/fixtures/admin-promotions-harness.js"></script>' }))
  const count = (path, method = 'GET') => state.calls.filter(c => c.path === path && c.method === method).length
  const close = async () => { assert.deepEqual(state.errors, []); await context.close() }
  await page.goto(base + (options.harness ? '/admin-harness' : options.path ?? '/promociones'))
  return { page, state, count, close }
}
const heading = (page, name = 'Promo 1') => page.getByRole('heading', { name, exact: true })
const routeTo = (page, path) => page.evaluate(path => { history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate')) }, path)
async function settled(page) { await page.waitForFunction(() => window.adminRequests.every(r => r.settled)) }
async function loginB(s) {
  await s.page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
  await s.page.waitForURL('**/ingresar')
  await s.page.getByLabel('Email', { exact: true }).fill('2@example.invalid')
  await s.page.getByLabel('Contraseña', { exact: true }).fill('fixture-password')
  await s.page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await s.page.waitForURL('**/mi-perfil'); await routeTo(s.page, '/promociones')
}
let passed = 0
async function test(name, run) {
  if (process.env.ADMIN_TEST && !name.includes(process.env.ADMIN_TEST)) return
  await run(); passed++; console.log('PASS ' + name)
}
try {
  await test('StrictMode, navegación durante carga y caché vacía sin GET repetido', async () => {
    const gate = deferred(), s = await setup({ listGate: gate, promotions: [] })
    await s.page.getByText('Cargando promociones…', { exact: true }).waitFor()
    await routeTo(s.page, '/mi-perfil'); await routeTo(s.page, '/promociones')
    gate.resolve(); await s.page.getByText('No hay promociones en esta pestaña', { exact: true }).waitFor()
    await routeTo(s.page, '/mi-perfil'); await routeTo(s.page, '/promociones'); await settled(s.page)
    assert.equal(s.count('/promotions'), 1)
    await s.close()
  })
  await test('Actualizar comparte una solicitud y un GET antiguo no sobrescribe una edición', async () => {
    const s = await setup({ harness: true, ignoreAbort: true })
    await s.page.locator('#state').filter({ hasText: 'Promo 1' }).waitFor()
    const gate = deferred(); s.state.listGate = gate
    await s.page.getByRole('button', { name: 'Actualizar', exact: true }).evaluate(button => { button.click(); button.click() })
    await s.page.waitForFunction(() => window.adminRequests.filter(r => r.path === '/promotions').length === 2)
    await s.page.getByRole('button', { name: 'Guardar', exact: true }).click()
    await s.page.locator('#state').filter({ hasText: 'Edición vigente' }).waitFor()
    gate.resolve(); await settled(s.page)
    assert.equal(JSON.parse(await s.page.locator('#state').textContent())[0].name, 'Edición vigente')
    assert.equal(s.count('/promotions'), 2); assert.equal(s.count('/promotions/1', 'PUT'), 1)
    assert.equal(await s.page.evaluate(() => window.adminRequests.filter(r => r.path === '/promotions')[1].aborted), true)
    await s.close()
  })
  await test('Bloqueo compartido entre tarjetas y editor; doble clic sin mutación duplicada', async () => {
    const gate = deferred(), s = await setup({ promotions: [promotion(), promotion(2)], writeGate: gate })
    await heading(s.page).waitFor()
    await s.page.getByRole('switch', { name: 'Desactivar Promo 1', exact: true }).evaluate(button => { button.click(); button.click() })
    await s.page.getByText('Guardando…', { exact: true }).waitFor()
    assert.equal(await s.page.getByRole('switch', { name: 'Desactivar Promo 2', exact: true }).isDisabled(), true)
    assert.equal(await s.page.getByRole('button', { name: 'Actualizar promociones', exact: true }).isDisabled(), true)
    await s.page.getByRole('link', { name: '+ Nueva promoción', exact: true }).click()
    await s.page.locator('#promotion-name').fill('No concurrente'); await s.page.locator('#promotion-start').fill('2020-01-01')
    assert.equal(await s.page.getByRole('button', { name: 'Crear promoción', exact: true }).isDisabled(), true)
    await s.page.locator('form').evaluate(form => form.requestSubmit())
    assert.equal(s.count('/promotions', 'POST'), 0); assert.equal(s.count('/promotions/1/deactivate', 'PATCH'), 1)
    gate.resolve(); await settled(s.page)
    await s.page.waitForFunction(() => !document.querySelector('button[type="submit"]').disabled)
    await s.close()
  })
  await test('Mutación fallida conserva datos válidos y permite reintentar', async () => {
    const s = await setup({ writeStatus: 500 }); await heading(s.page).waitFor()
    await s.page.getByRole('switch', { name: 'Desactivar Promo 1', exact: true }).click()
    await s.page.getByRole('alert').filter({ hasText: 'Error administrativo QA' }).waitFor()
    assert.equal(await heading(s.page).isVisible(), true)
    s.state.writeStatus = 200
    await s.page.getByRole('switch', { name: 'Desactivar Promo 1', exact: true }).click()
    await s.page.getByRole('switch', { name: 'Activar Promo 1', exact: true }).waitFor()
    assert.equal(s.count('/promotions'), 1); await s.close()
  })
  await test('Respuesta inválida de escritura conserva el borrador y la promoción anterior', async () => {
    const s = await setup({ writeOverride: { ...promotion(), id: 9 } }); await heading(s.page).waitFor()
    await s.page.getByRole('button', { name: 'Editar', exact: true }).click()
    await s.page.locator('#promotion-name').fill('Borrador vigente')
    await s.page.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
    await s.page.getByRole('alert').filter({ hasText: 'La respuesta no contiene la promoción esperada.' }).waitFor()
    assert.equal(await s.page.locator('#promotion-name').inputValue(), 'Borrador vigente')
    await s.page.getByRole('link', { name: 'Cancelar', exact: true }).click()
    await heading(s.page).waitFor(); assert.equal(s.count('/promotions'), 1); await s.close()
  })
  await test('Lista inválida no reemplaza la caché válida y actualización manual recupera', async () => {
    const s = await setup(); await heading(s.page).waitFor(); s.state.listOverride = [{}]
    await s.page.getByRole('button', { name: 'Actualizar promociones', exact: true }).click()
    await s.page.getByRole('alert').waitFor(); assert.equal(await heading(s.page).isVisible(), true)
    s.state.listOverride = [promotion(1, { name: 'Lista nueva' })]
    await s.page.getByRole('button', { name: 'Reintentar', exact: true }).click()
    await heading(s.page, 'Lista nueva').waitFor(); assert.equal(s.count('/promotions'), 3); await s.close()
  })
  for (const action of ['carga', 'guardado', 'estado']) await test(`Sesión A → B con ${action} tardío que ignora AbortSignal`, async () => {
    const gate = deferred(), s = await setup({ ignoreAbort: true, ...(action === 'carga' ? { listGate: gate } : { writeGate: gate }) })
    if (action === 'carga') await s.page.getByText('Cargando promociones…', { exact: true }).waitFor()
    else {
      await heading(s.page).waitFor()
      if (action === 'guardado') {
        await s.page.getByRole('button', { name: 'Editar', exact: true }).click()
        await s.page.locator('#promotion-name').fill('Guardado anterior')
        await s.page.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
      } else await s.page.getByRole('switch', { name: 'Desactivar Promo 1', exact: true }).click()
      await s.page.waitForFunction(() => window.adminRequests.some(r => r.path.startsWith('/promotions/') && r.method !== 'GET'))
    }
    s.state.promotions = [promotion(2, { name: 'Sesión B' })]
    await loginB(s); await heading(s.page, 'Sesión B').waitFor()
    const gateB = deferred(); s.state.writeGate = gateB
    await s.page.getByRole('switch', { name: 'Desactivar Sesión B', exact: true }).click()
    gate.resolve()
    await s.page.waitForFunction(action => action === 'carga'
      ? window.adminRequests.find(r => r.path === '/promotions' && r.method === 'GET')?.settled
      : window.adminRequests.filter(r => r.path === '/promotions/1' || r.path === '/promotions/1/deactivate').every(r => r.settled), action)
    assert.equal(await heading(s.page).count(), 0)
    assert.equal(await s.page.getByRole('button', { name: 'Actualizar promociones', exact: true }).isDisabled(), true)
    assert.ok(s.page.url().endsWith('/promociones'), 'Una respuesta de A no navega la sesión B')
    gateB.resolve(); await settled(s.page)
    await s.page.getByRole('switch', { name: 'Activar Sesión B', exact: true }).waitFor(); await s.close()
  })
  for (const status of [401, 403]) for (const mutation of [false, true]) await test(`HTTP ${status} en ${mutation ? 'mutación' : 'carga'} conserva permisos y errores`, async () => {
    const s = await setup(mutation ? { writeStatus: status } : { listStatus: status })
    if (mutation) { await heading(s.page).waitFor(); await s.page.getByRole('switch', { name: 'Desactivar Promo 1', exact: true }).click() }
    if (status === 401) {
      await s.page.waitForURL('**/ingresar'); assert.equal(await s.page.evaluate(() => localStorage.getItem('token')), null)
    } else {
      await s.page.getByRole('alert').filter({ hasText: 'Error administrativo QA' }).waitFor()
      if (mutation) assert.equal(await heading(s.page).isVisible(), true)
    }
    await s.close()
  })
  await test('Usuario común no consulta administración ni puede abrir editor', async () => {
    const s = await setup({ role: 'USUARIO' }); await s.page.waitForURL('**/mi-perfil')
    await routeTo(s.page, '/nueva-promocion'); await s.page.waitForURL('**/mi-perfil')
    await routeTo(s.page, '/editar-promocion'); await s.page.waitForURL('**/mi-perfil')
    assert.equal(s.count('/promotions'), 0); await s.close()
  })
  await test('Home descarta promoción pública pendiente anterior a una mutación exitosa', async () => {
    const writeGate = deferred(), publicGate = deferred(), s = await setup({ writeGate })
    await heading(s.page).waitFor()
    await s.page.getByRole('switch', { name: 'Desactivar Promo 1', exact: true }).click()
    s.state.publicGate = publicGate
    await routeTo(s.page, '/')
    await s.page.waitForFunction(() => window.adminRequests.some(r => r.path === '/promotions/public'))
    s.state.publicGate = null; writeGate.resolve()
    await s.page.getByText('No hay promociones vigentes por el momento.', { exact: true }).waitFor()
    publicGate.resolve(); await settled(s.page)
    assert.equal(await heading(s.page).count(), 0); assert.equal(s.count('/promotions/public'), 2)
    await s.close()
  })
  console.log(`Promociones administrativas: ${passed} escenarios PASS.`)
} finally { await browser.close() }
