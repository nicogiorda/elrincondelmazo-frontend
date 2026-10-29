// Aplicación y hook reales en StrictMode; HTTP simulado, sin cuentas reales.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.BASE_URL || 'http://localhost:5173'
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const fixture = owner => ({ id: owner === 'a' ? 1 : 2, firstName: owner.toUpperCase(), lastName: 'Prueba',
  email: owner + '@example.invalid', role: 'USUARIO', active: true })
async function setup(options = {}) {
  const context = await browser.newContext()
  await context.addInitScript(({ ignoreAbort }) => {
    if (!sessionStorage.getItem('initialized')) { localStorage.setItem('token', 'fixture-a'); sessionStorage.setItem('initialized', '1') }
    const original = window.fetch.bind(window)
    window.accountRequests = []
    window.fetch = (url, init = {}) => {
      if (!String(url).startsWith('http://localhost:8080')) return original(url, init)
      const record = { path: new URL(url).pathname, method: init.method || 'GET', settled: false, aborted: false,
        owner: init.headers?.Authorization?.endsWith('-b') ? 'b' : 'a' }
      window.accountRequests.push(record)
      init.signal?.addEventListener('abort', () => { record.aborted = true }, { once: true })
      return original(url, ignoreAbort ? { ...init, signal: undefined } : init).finally(() => { record.settled = true })
    }
  }, { ignoreAbort: options.ignoreAbort ?? false })
  const state = { calls: [], errors: [], users: { a: fixture('a'), b: fixture('b') }, gates: {}, status: 200, ...options }
  const page = await context.newPage(); page.setDefaultTimeout(10000)
  page.on('pageerror', error => state.errors.push(error.message))
  await page.route('http://localhost:8080/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname, method = req.method(), body = req.postDataJSON()
    const owner = req.headers().authorization?.endsWith('-b') ? 'b' : 'a'
    state.calls.push({ path, method, owner })
    let data = [], status = 200, gate, network = false
    if (path === '/api/v1/auth/authenticate') data = { access_token: 'fixture-b' }
    else if (path === '/users/me' && method === 'GET') data = state.users[owner]
    else if (method === 'PUT' && path.startsWith('/users/me')) {
      gate = state.gates[owner]; status = state.status; network = state.network
      if (path === '/users/me') {
        assert.deepEqual(Object.keys(body).sort(), ['email', 'firstName', 'lastName'])
        data = { ...state.users[owner], firstName: body.firstName.trim(), lastName: body.lastName.trim(), email: body.email.trim().toLowerCase() }
      } else { assert.equal(body, null); data = { ...state.users[owner], active: false } }
      if (Object.hasOwn(state, 'override')) data = state.override
      if (status !== 200) data = { message: 'Error controlado de cuenta' }
      if (gate) await gate.promise
      if (status === 200 && data?.id === state.users[owner].id) state.users[owner] = data
      if (network) return route.abort('connectionreset')
    } else if (path === '/carts') data = { id: owner === 'a' ? 1 : 2, items: [], subtotal: 0 }
    else if (path === '/products') data = { content: [], totalPages: 0, totalElements: 0, number: 0 }
    else if (path === '/collections') data = [{ id: 1, name: 'NBA' }]
    await route.fulfill({ status, json: data }).catch(() => {})
  })
  if (options.harness) await page.route(base + '/account-harness', route => route.fulfill({ contentType: 'text/html',
    body: '<div id="root"></div><script type="module" src="/tests/fixtures/account-harness.js"></script>' }))
  await page.goto(base + (options.harness ? '/account-harness' : '/mi-perfil'))
  if (!options.harness) await profile(page)
  const count = (path, method = 'PUT') => state.calls.filter(c => c.path === path && c.method === method).length
  return { page, state, count, close: async () => { assert.deepEqual(state.errors, []); await context.close() } }
}
const profile = page => page.getByRole('heading', { name: 'Mi perfil', exact: true }).waitFor()
const save = page => page.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
const name = page => page.getByLabel('Nombre', { exact: true })
const deactivate = page => page.getByRole('button', { name: 'Eliminar cuenta', exact: true }).click()
const routeTo = (page, path) => page.evaluate(path => { history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate')) }, path)
const idle = page => page.waitForFunction(() => document.querySelector('#profile-name') && !document.querySelector('#profile-name').disabled)
const settled = page => page.waitForFunction(() => window.accountRequests.every(r => r.settled))
async function logout(page) { await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click(); await page.waitForURL('**/ingresar') }
async function loginB(page) {
  await page.getByLabel('Email', { exact: true }).fill('b@example.invalid')
  await page.getByLabel('Contraseña', { exact: true }).fill('fixture-password')
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click(); await profile(page)
}
let passed = 0
async function test(title, run) {
  if (process.env.ACCOUNT_TEST && !title.includes(process.env.ACCOUNT_TEST)) return
  await run(); passed++; console.log('PASS ' + title)
}
try {
  await test('StrictMode no escribe al montar; nombre y apellido sincronizan sesión y formulario sin GET extra', async () => {
    const s = await setup(); await settled(s.page); assert.equal(s.count('/users/me'), 0)
    await name(s.page).fill('  Ana  '); await s.page.getByLabel('Apellido', { exact: true }).fill('  Nuevo  ')
    await save(s.page); await s.page.waitForFunction(() => document.querySelector('#profile-name')?.value === 'Ana'); await idle(s.page)
    assert.equal(await s.page.getByLabel('Apellido', { exact: true }).inputValue(), 'Nuevo')
    await routeTo(s.page, '/mis-pedidos'); await routeTo(s.page, '/mi-perfil'); await profile(s.page)
    assert.equal(await name(s.page).inputValue(), 'Ana'); assert.equal(s.count('/users/me', 'GET'), 1)
    assert.equal(s.count('/users/me'), 1); await s.close()
  })
  for (const changed of [false, true]) await test('Email confirmado normalizado: ' + (changed ? 'cierra sesión' : 'conserva sesión'), async () => {
    const s = await setup(); await s.page.getByLabel('Email', { exact: true }).fill(changed ? 'NUEVO@EXAMPLE.INVALID' : 'A@EXAMPLE.INVALID')
    await save(s.page)
    if (changed) {
      await s.page.waitForURL('**/ingresar'); assert.equal(await s.page.evaluate(() => localStorage.getItem('token')), null)
      await routeTo(s.page, '/mis-pedidos'); await s.page.waitForURL('**/ingresar'); assert.equal(s.count('/orders', 'GET'), 0)
    } else {
      await s.page.waitForFunction(() => document.querySelector('#profile-email')?.value === 'a@example.invalid'); await idle(s.page)
      assert.ok(await s.page.evaluate(() => Boolean(localStorage.getItem('token'))))
    }
    assert.equal(s.count('/users/me', 'GET'), 1); await s.close()
  })
  await test('Cancelar desactivación no envía HTTP; confirmar limpia sesión y rutas privadas', async () => {
    const s = await setup(); s.page.once('dialog', d => d.dismiss()); await deactivate(s.page)
    assert.equal(s.count('/users/me/deactivate'), 0)
    s.page.once('dialog', d => d.accept()); await deactivate(s.page); await s.page.waitForURL('**/ingresar')
    assert.equal(await s.page.evaluate(() => localStorage.getItem('token')), null)
    for (const path of ['/mi-perfil', '/carrito', '/mis-pedidos']) { await routeTo(s.page, path); await s.page.waitForURL('**/ingresar') }
    assert.equal(s.count('/users/me/deactivate'), 1); await s.close()
  })
  for (const operation of ['save', 'deactivate']) await test(operation + ': doble envío y bloqueo compartido', async () => {
    const gate = deferred(), s = await setup({ gates: { a: gate } }); s.page.on('dialog', d => d.accept())
    if (operation === 'save') await s.page.locator('form').evaluate(f => { f.requestSubmit(); f.requestSubmit() })
    else await s.page.getByRole('button', { name: 'Eliminar cuenta', exact: true }).evaluate(b => { b.click(); b.click() })
    await s.page.waitForFunction(() => window.accountRequests.some(r => r.method === 'PUT'))
    assert.ok(await s.page.getByRole('button', { name: 'Eliminar cuenta', exact: true }).isDisabled())
    await s.page.locator('form').evaluate(f => f.requestSubmit())
    assert.equal(s.count('/users/me') + s.count('/users/me/deactivate'), 1)
    gate.resolve(); if (operation === 'save') await idle(s.page); else await s.page.waitForURL('**/ingresar')
    await s.close()
  })
  for (const operation of ['save', 'deactivate']) for (const failure of ['id', 'estructura', 'estado', 'red', 401, 403, 500]) {
    await test(operation + ': ' + failure + ' conserva datos o aplica 401', async () => {
      const override = failure === 'id' ? { ...fixture('a'), id: 9, active: operation !== 'deactivate' }
        : failure === 'estructura' ? { id: 1, active: false } : { ...fixture('a'), active: operation === 'deactivate' }
      const opts = typeof failure === 'number' ? { status: failure } : failure === 'red' ? { network: true } : { override }
      const s = await setup(opts); s.page.once('dialog', d => d.accept())
      if (operation === 'save') { await name(s.page).fill('Borrador'); await save(s.page) } else await deactivate(s.page)
      if (failure === 401) {
        await s.page.waitForURL('**/ingresar'); await s.page.getByRole('alert').filter({ hasText: 'Tu sesión venció' }).waitFor()
      } else {
        await s.page.getByRole('alert').waitFor(); await idle(s.page)
        assert.equal(await name(s.page).inputValue(), operation === 'save' ? 'Borrador' : 'A')
        assert.ok(await s.page.evaluate(() => Boolean(localStorage.getItem('token'))))
        if (typeof failure !== 'number') assert.match(await s.page.getByRole('alert').innerText(), /puede haberse aplicado/)
        if (failure !== 'red') {
          await routeTo(s.page, '/mis-pedidos'); await routeTo(s.page, '/mi-perfil'); await profile(s.page)
          assert.equal(await name(s.page).inputValue(), 'A')
        }
      }
      assert.equal(s.count('/users/me') + s.count('/users/me/deactivate'), 1); await s.close()
    })
  }
  for (const operation of ['save', 'deactivate']) for (const status of [200, 401, 500]) {
    await test(operation + ': A → B ignora respuesta tardía ' + status + ' y conserva bloqueo de B', async () => {
      const gate = deferred(), s = await setup({ gates: { a: gate }, status, ignoreAbort: true }); s.page.on('dialog', d => d.accept())
      if (operation === 'save') { await s.page.getByLabel('Email', { exact: true }).fill('otro@example.invalid'); await save(s.page) }
      else await deactivate(s.page)
      await s.page.waitForFunction(() => window.accountRequests.some(r => r.method === 'PUT'))
      await logout(s.page); s.state.status = 200; await loginB(s.page)
      const gateB = deferred(); s.state.gates.b = gateB; await name(s.page).fill('B actualizado'); await save(s.page)
      await s.page.waitForFunction(() => window.accountRequests.some(r => r.owner === 'b' && r.method === 'PUT'))
      gate.resolve()
      await s.page.waitForFunction(() => window.accountRequests.filter(r => r.owner === 'a' && r.method === 'PUT').every(r => r.settled))
      assert.ok(await name(s.page).isDisabled()); assert.equal(await s.page.getByRole('alert').count(), 0)
      assert.ok(await s.page.evaluate(() => localStorage.getItem('token')?.endsWith('-b')))
      await s.page.locator('form').evaluate(f => f.requestSubmit()); assert.equal(s.count('/users/me') + s.count('/users/me/deactivate'), 2)
      gateB.resolve(); await idle(s.page); assert.equal(await name(s.page).inputValue(), 'B actualizado'); await s.close()
    })
  }
  for (const status of [200, 500]) await test('Navegación durante guardado ' + status + ' no restaura mensajes de la vista anterior', async () => {
    const gate = deferred(), s = await setup({ gates: { a: gate }, status }); await name(s.page).fill('Navegante'); await save(s.page)
    await s.page.waitForFunction(() => window.accountRequests.some(r => r.method === 'PUT'))
    await routeTo(s.page, '/mis-pedidos'); await routeTo(s.page, '/mi-perfil'); await profile(s.page)
    assert.ok(await name(s.page).isDisabled()); gate.resolve(); await idle(s.page)
    assert.equal(await name(s.page).inputValue(), status === 200 ? 'Navegante' : 'A')
    assert.equal(await s.page.getByRole('alert').count(), 0); assert.equal(s.count('/users/me', 'GET'), 1); await s.close()
  })
  await test('Logout aborta una escritura real y no publica su resultado', async () => {
    const gate = deferred(), s = await setup({ gates: { a: gate } }); await save(s.page)
    await s.page.waitForFunction(() => window.accountRequests.some(r => r.method === 'PUT'))
    await logout(s.page); gate.resolve(); await settled(s.page)
    assert.ok(await s.page.evaluate(() => window.accountRequests.some(r => r.method === 'PUT' && r.aborted)))
    assert.ok(s.page.url().endsWith('/ingresar')); await s.close()
  })
  for (const status of [200, 500]) await test('Navegación durante desactivación ' + status + ' conserva bloqueo y resultado', async () => {
    const gate = deferred(), s = await setup({ gates: { a: gate }, status })
    s.page.once('dialog', d => d.accept()); await deactivate(s.page)
    await s.page.waitForFunction(() => window.accountRequests.some(r => r.method === 'PUT'))
    await routeTo(s.page, '/mis-pedidos'); await routeTo(s.page, '/mi-perfil'); await profile(s.page)
    assert.ok(await name(s.page).isDisabled()); gate.resolve()
    if (status === 200) await s.page.waitForURL('**/ingresar')
    else { await s.page.getByRole('alert').filter({ hasText: 'Error controlado de cuenta' }).waitFor(); await idle(s.page) }
    assert.equal(s.count('/users/me/deactivate'), 1); await s.close()
  })
  await test('Desmontar el hook cancela la operación e ignora el resultado aunque no se respete AbortSignal', async () => {
    const gate = deferred(), s = await setup({ harness: true, gates: { a: gate }, ignoreAbort: true })
    await s.page.getByRole('button', { name: 'Guardar' }).click()
    await s.page.waitForFunction(() => window.accountRequests.some(r => r.method === 'PUT'))
    await s.page.getByRole('button', { name: 'Desmontar' }).click()
    await s.page.waitForFunction(() => window.accountRequests.some(r => r.method === 'PUT' && r.aborted))
    gate.resolve(); await settled(s.page)
    assert.equal(await s.page.locator('#applied').innerText(), '0'); await s.close()
  })
  console.log(`Cuenta: ${passed} escenarios PASS (HTTP simulado).`)
} finally { await browser.close() }
