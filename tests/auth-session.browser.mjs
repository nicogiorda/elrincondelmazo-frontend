// Aplicación real en StrictMode, HTTP simulado y cuentas ficticias; no escribe en Spring/PostgreSQL.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.BASE_URL || 'http://localhost:5173'
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const accountUser = (account, role = 'USUARIO') => ({ id: account === 'a' ? 1 : 2,
  firstName: account.toUpperCase(), lastName: 'Prueba', email: `${account}@example.invalid`, role, active: true })
const product = (account) => ({ id: account === 'a' ? 7 : 8, name: `Publicación ${account}`, price: 100,
  stock: 10, status: 'ACTIVO', type: 'CARTA', sellerId: account === 'a' ? 1 : 2,
  sellerName: account, collectionId: 1, collectionName: 'NBA', imageUrls: [], createdAt: '2026-10-19T10:00:00' })
const order = (account) => ({ id: account === 'a' ? 101 : 202, state: 'PENDIENTE', orderDate: '2026-10-19T10:00:00',
  paymentMethod: 'TRANSFERENCIA', subtotal: 100, totalDiscount: 0, total: 100 })

async function setup(options = {}) {
  const context = await browser.newContext()
  await context.addInitScript(({ initial, ignoreAbort }) => {
    if (!sessionStorage.getItem('initialized')) {
      if (initial) localStorage.setItem('token', 'fixture-' + initial)
      sessionStorage.setItem('initialized', '1')
    }
    const original = window.fetch.bind(window)
    window.sessionRequests = []
    window.fetch = (url, init = {}) => {
      if (!String(url).startsWith('http://localhost:8080')) return original(url, init)
      const record = { path: new URL(url).pathname, aborted: false, settled: false }
      window.sessionRequests.push(record)
      init.signal?.addEventListener('abort', () => { record.aborted = true }, { once: true })
      return original(url, ignoreAbort ? { ...init, signal: undefined } : init)
        .finally(() => { record.settled = true })
    }
  }, { initial: options.initial, ignoreAbort: options.ignoreAbort ?? false })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  await page.clock.install()
  const state = { authStatus: 200, meStatus: 200, calls: [], errors: [], gates: {}, role: 'USUARIO', ...options }
  page.on('pageerror', error => state.errors.push(error.message))
  await page.route('http://localhost:8080/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname, method = req.method()
    const body = req.postDataJSON()
    const account = path.startsWith('/api/v1/auth/') ? body.email.split('@')[0]
      : req.headers().authorization === 'Bearer fixture-b' ? 'b' : 'a'
    // No registrar JWT ni contraseñas en resultados o errores.
    state.calls.push({ path, method, account })
    let data = [], status = 200, gate = account === 'a' ? state.gates[path] : null
    if (path.startsWith('/api/v1/auth/')) {
      assert.ok(!req.headers().authorization, 'POST de autenticación sin JWT heredado')
      const keys = path.endsWith('/register') ? ['email', 'firstname', 'lastname', 'password'] : ['email', 'password']
      assert.deepEqual(Object.keys(body).sort(), keys)
      status = state.authStatus
      data = state.invalidToken ? {} : { access_token: 'fixture-' + account }
      gate = state.authGate
      if (state.networkFailure) return route.abort('connectionreset')
    } else if (path === '/users/me') {
      status = state.meStatus
      data = Object.hasOwn(state, 'userOverride') ? state.userOverride : accountUser(account, state.role)
      if (method === 'PUT') data = { ...data, ...body }
      gate = state.meGate || gate
    } else if (path === '/carts') data = { id: account === 'a' ? 1 : 2, subtotal: 100,
      items: [{ id: 11, productId: account === 'a' ? 7 : 8, productName: `Carrito ${account}`, quantity: 1, unitPrice: 100, subtotal: 100 }] }
    else if (path === '/orders') data = [order(account)]
    else if (/^\/orders\/\d+$/.test(path)) data = { ...order(account), promotions: [],
      items: [{ id: 1, productId: 7, productName: `Detalle privado ${account}`, quantity: 1, price: 100, sellerId: 9, sellerEmail: 'seller@example.invalid' }] }
    else if (path === '/products/mine') data = { content: [product(account)], totalPages: 1 }
    else if (/^\/products\/\d+$/.test(path)) data = product(path.endsWith('7') ? 'a' : 'b')
    else if (path === '/products') data = { content: [], totalPages: 0, totalElements: 0, number: 0 }
    else if (path === '/collections') data = [{ id: 1, name: 'NBA' }]
    else if (path === '/promotions') data = [{ id: 1, name: `Promoción ${account}`, type: 'CANTIDAD',
      discountPercentage: 10, minimumQuantity: 2, active: true, startDate: '2020-01-01T00:00:00' }]
    if (status !== 200) data = { message: 'Error controlado' }
    if (gate) await gate.promise
    await route.fulfill({ status, json: data }).catch(() => {})
  })
  const count = (path, method = 'GET', account) => state.calls.filter(c => c.path === path && c.method === method && (!account || c.account === account)).length
  const close = async () => { assert.deepEqual(state.errors, []); await context.close() }
  await page.goto(base + (options.path || '/ingresar'))
  return { page, state, count, close }
}

async function submit(page, account = 'a', registering = false) {
  if (registering) {
    await page.getByLabel('Nombre', { exact: true }).fill(account.toUpperCase())
    await page.getByLabel('Apellido', { exact: true }).fill('Prueba')
  }
  await page.getByLabel('Email', { exact: true }).fill(`${account}@example.invalid`)
  await page.getByLabel('Contraseña', { exact: true }).fill('fixture-password')
  await page.getByRole('button', { name: registering ? 'Crear cuenta' : 'Ingresar', exact: true }).click()
}
async function profile(page) { await page.getByRole('heading', { name: 'Mi perfil', exact: true }).waitFor() }
async function logout(page) {
  if (!(await page.getByRole('button', { name: 'Cerrar sesión' }).count())) {
    await page.getByRole('link', { name: 'Mi cuenta', exact: true }).first().click()
  }
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await page.waitForURL('**/ingresar')
}
async function hasToken(page) { return page.evaluate(() => Boolean(localStorage.getItem('token'))) }
async function settled(page) {
  await page.waitForFunction(() => window.sessionRequests.every(r => r.settled))
  await page.clock.runFor(50)
}
let passed = 0
async function test(name, run) { await run(); passed++; console.log('PASS ' + name) }

try {
  for (const registering of [false, true]) {
    const mode = registering ? 'Registro' : 'Login'
    const path = registering ? '/crear-cuenta' : '/ingresar'
    await test(`${mode} válido verifica identidad antes de persistir, evita duplicados y carga carrito`, async () => {
      const gate = deferred()
      const s = await setup({ path, meGate: gate })
      const meRequest = s.page.waitForRequest('**/users/me')
      await submit(s.page, 'a', registering); await meRequest
      assert.equal(await hasToken(s.page), false)
      await s.page.locator('form').evaluate(form => { form.requestSubmit(); form.requestSubmit() })
      gate.resolve(); await profile(s.page)
      await settled(s.page)
      assert.equal(await hasToken(s.page), true)
      assert.equal(s.count('/users/me'), 1)
      assert.equal(s.count('/carts'), 1)
      assert.equal(s.count('/api/v1/auth/' + (registering ? 'register' : 'authenticate'), 'POST'), 1)
      await s.page.getByRole('link', { name: /^Carrito/ }).first().click()
      await s.page.getByRole('heading', { name: 'Carrito a', exact: true }).waitFor()
      assert.equal(s.count('/users/me'), 1)
      assert.equal(s.count('/carts'), 1)
      await s.close()
    })

    await test(`${mode} fallido conserva el mensaje y permite reintentar sin persistir sesión`, async () => {
      const s = await setup({ path, authStatus: registering ? 409 : 401 })
      await submit(s.page, 'a', registering)
      await s.page.getByText(registering ? 'Ya existe un usuario con este correo' : 'El correo o la contraseña son incorrectos', { exact: true }).waitFor()
      assert.equal(await hasToken(s.page), false)
      assert.equal(s.count('/users/me'), 0)
      s.state.authStatus = 200
      await submit(s.page, 'a', registering); await profile(s.page)
      assert.equal(s.count('/users/me'), 1)
      await s.close()
    })

    for (const stage of ['token', 'usuario', 'red']) {
      await test(`${mode}: falla de ${stage} no persiste una sesión`, async () => {
        const s = await setup({ path, ...(stage === 'token' ? { invalidToken: true }
          : stage === 'usuario' ? { userOverride: { ...accountUser('a'), active: false } } : { networkFailure: true }) })
        await submit(s.page, 'a', registering)
        await s.page.locator('.error-message').waitFor()
        const text = await s.page.locator('.error-message').textContent()
        assert.ok(stage === 'token' ? text.includes('token válido') : stage === 'usuario'
          ? text.includes('datos de usuario inválidos') : text.includes('Revisá tu conexión'))
        assert.equal(await hasToken(s.page), false)
        assert.equal(s.count('/carts'), 0)
        await s.close()
      })
    }

    for (const stage of ['POST', 'GET']) {
      await test(`${mode}: desmontar durante ${stage} cancela y descarta respuestas tardías`, async () => {
        const gate = deferred()
        const s = await setup({ path, ignoreAbort: true, ...(stage === 'POST' ? { authGate: gate } : { meGate: gate }) })
        const pending = s.page.waitForRequest(req => stage === 'POST' ? req.method() === 'POST' : req.url().endsWith('/users/me'))
        await submit(s.page, 'a', registering); await pending
        await s.page.getByRole('link', { name: 'Cartas', exact: true }).first().click()
        gate.resolve(); await settled(s.page)
        assert.equal(await hasToken(s.page), false)
        assert.equal(s.count('/users/me'), stage === 'POST' ? 0 : 1)
        assert.equal(s.count('/carts'), 0)
        assert.ok(await s.page.evaluate(() => window.sessionRequests.some(r => r.aborted)))
        await s.close()
      })
    }
  }

  await test('Recuperación válida bajo StrictMode: un GET de identidad y carrito por montaje', async () => {
    const s = await setup({ initial: 'a', path: '/mi-perfil' })
    await profile(s.page); await settled(s.page)
    assert.equal(s.count('/users/me'), 1); assert.equal(s.count('/carts'), 1)
    await s.page.reload(); await profile(s.page); await settled(s.page)
    assert.equal(s.count('/users/me'), 2); assert.equal(s.count('/carts'), 2)
    assert.equal(s.count('/api/v1/auth/authenticate', 'POST'), 0)
    // Crear una entrada privada previa: el montaje inicial no tiene una página
    // anterior de la aplicación a la que pueda regresar el navegador.
    await s.page.getByRole('link', { name: 'Mis pedidos', exact: true }).first().click()
    await s.page.getByRole('button', { name: 'Ver detalle del pedido 101' }).waitFor()
    await s.page.getByRole('link', { name: 'Mi perfil', exact: true }).first().click()
    await profile(s.page)
    await logout(s.page)
    assert.equal(await hasToken(s.page), false)
    await s.page.goBack(); await s.page.waitForURL('**/ingresar')
    await s.close()
  })

  for (const failure of [401, 403, 'identidad']) {
    await test(`Recuperación inválida ${failure}: elimina token y protege los datos privados`, async () => {
      const s = await setup({ initial: 'a', path: '/mi-perfil', ...(failure === 'identidad'
        ? { userOverride: null } : { meStatus: failure }) })
      await s.page.waitForURL('**/ingresar')
      await s.page.getByRole('alert').waitFor()
      assert.equal(await hasToken(s.page), false)
      assert.equal(s.count('/users/me'), 1)
      assert.equal(s.count('/carts'), 0)
      await s.close()
    })
  }

  await test('Las rutas privadas siguen inaccesibles sin autenticación', async () => {
    const s = await setup()
    for (const path of ['/carrito', '/checkout', '/mis-pedidos', '/mi-perfil', '/mis-publicaciones', '/publicar', '/pedido-confirmado', '/promociones', '/editar-promocion', '/nueva-promocion']) {
      await s.page.goto(base + path)
      await s.page.waitForURL('**/ingresar')
      await s.page.getByRole('button', { name: 'Ingresar', exact: true }).waitFor()
    }
    assert.equal(s.count('/users/me'), 0); assert.equal(s.count('/carts'), 0)
    assert.equal(s.count('/orders'), 0); assert.equal(s.count('/promotions'), 0)
    await s.close()
  })

  await test('USUARIO no accede a administración; ADMIN conserva el acceso', async () => {
    const s = await setup({ initial: 'a', path: '/promociones' })
    await profile(s.page); assert.equal(s.count('/promotions'), 0); await s.close()
    const admin = await setup({ initial: 'a', path: '/promociones', role: 'ADMIN' })
    await admin.page.getByRole('heading', { name: 'Promoción a', exact: true }).waitFor()
    assert.equal(admin.count('/promotions'), 1)
    await admin.close()
  })

  const domains = [
    ['/carrito', '/carts', 'Carrito'], ['/mis-pedidos', '/orders', 'Pedidos'],
    ['/mis-pedidos', '/orders/101', 'Detalle'], ['/mis-publicaciones', '/products/mine', 'Publicaciones'],
    ['/promociones', '/promotions', 'Promociones'],
  ]
  for (const [path, apiPath, domain] of domains) {
    await test(`${domain}: respuesta pendiente de A no contamina B aunque ignore la cancelación`, async () => {
      const gate = deferred()
      const s = await setup({ initial: 'a', path, role: 'ADMIN', ignoreAbort: true, gates: { [apiPath]: gate } })
      if (domain === 'Detalle') await s.page.getByRole('button', { name: 'Ver detalle del pedido 101' }).click()
      await s.page.waitForFunction(p => window.sessionRequests.some(r => r.path === p), apiPath)
      await logout(s.page)
      await submit(s.page, 'b'); await profile(s.page)
      const label = domain === 'Carrito' ? /^Carrito/ : domain === 'Publicaciones' ? 'Mis publicaciones'
        : domain === 'Promociones' ? 'Promociones' : 'Mis pedidos'
      await s.page.getByRole('link', { name: label, exact: domain !== 'Carrito' }).first().click()
      if (domain === 'Detalle') await s.page.getByRole('button', { name: 'Ver detalle del pedido 202' }).click()
      gate.resolve(); await settled(s.page)
      const oldVisible = domain === 'Carrito' ? 'Carrito a' : domain === 'Publicaciones' ? 'Publicación a'
        : domain === 'Promociones' ? 'Promoción a' : 'Detalle privado a'
      assert.equal(await s.page.getByText(oldVisible, { exact: true }).count(), 0)
      if (domain === 'Pedidos' || domain === 'Detalle') {
        await s.page.getByRole('button', { name: 'Ver detalle del pedido 202' }).waitFor()
        assert.equal(await s.page.getByRole('button', { name: 'Ver detalle del pedido 101' }).count(), 0)
      } else {
        await s.page.getByText(oldVisible.replace(/a$/, 'b'), { exact: true }).waitFor()
      }
      assert.ok(await s.page.evaluate(p => window.sessionRequests.some(r => r.path === p && r.aborted), apiPath))
      assert.equal(s.count('/users/me'), 2)
      assert.equal(s.count('/carts', 'GET', 'b'), 1)
      assert.ok(await s.page.evaluate(() => localStorage.getItem('token') === 'fixture-b'), 'Conserva la sesión B')
      await s.close()
    })
  }

  await test('Los datos de pedidos y detalles ya cargados se limpian al cambiar A por B', async () => {
    const s = await setup({ initial: 'a', path: '/mis-pedidos' })
    await s.page.getByRole('button', { name: 'Ver detalle del pedido 101' }).click()
    await s.page.getByText('Detalle privado a', { exact: true }).waitFor()
    await logout(s.page); await submit(s.page, 'b'); await profile(s.page)
    await s.page.getByRole('link', { name: 'Mis pedidos', exact: true }).first().click()
    await s.page.getByRole('button', { name: 'Ver detalle del pedido 202' }).click()
    await s.page.getByText('Detalle privado b', { exact: true }).waitFor()
    assert.equal(await s.page.getByText('Detalle privado a', { exact: true }).count(), 0)
    assert.equal(s.count('/orders', 'GET', 'b'), 1)
    assert.equal(s.count('/orders/202', 'GET', 'b'), 1)
    await s.close()
  })

  await test('Guardar perfil actualiza el usuario del hook; cambiar email sigue cerrando sesión', async () => {
    const s = await setup({ initial: 'a', path: '/mi-perfil' }); await profile(s.page)
    await s.page.getByLabel('Nombre', { exact: true }).fill('Actualizado')
    const saved = s.page.waitForResponse(response => response.url().endsWith('/users/me') && response.request().method() === 'PUT')
    await s.page.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
    await saved
    await s.page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Guardar cambios' && !b.disabled))
    await s.page.getByRole('link', { name: 'Mis pedidos', exact: true }).first().click()
    await s.page.getByRole('link', { name: 'Mi perfil', exact: true }).first().click()
    assert.equal(await s.page.getByLabel('Nombre', { exact: true }).inputValue(), 'Actualizado')
    assert.equal(s.count('/users/me'), 1)
    await s.page.getByLabel('Email', { exact: true }).fill('nuevo@example.invalid')
    await s.page.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
    await s.page.waitForURL('**/ingresar')
    assert.equal(await hasToken(s.page), false)
    await s.close()
  })
  console.log(`Escenarios de autenticación y sesión aprobados: ${passed}`)
} finally { await browser.close() }
