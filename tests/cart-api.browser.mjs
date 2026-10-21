// Isolated HTTP fixtures; no backend or database writes. Uses external Playwright.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.BASE_URL || 'http://localhost:5173'
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const product = { id: 7, name: 'Carta carrito QA', description: 'QA', price: 100, stock: 10,
  status: 'ACTIVO', type: 'CARTA', sellerId: 9, sellerName: 'Seller', collectionId: 1,
  collectionName: 'NBA', imageUrls: [], createdAt: '2026-10-19T10:00:00' }
const makeCart = (quantity = 1, name = product.name) => ({ id: 1, subtotal: 100 * quantity,
  items: quantity ? [{ id: 11, productId: 7, productName: name, productImages: [], unitPrice: 100, quantity, subtotal: 100 * quantity }] : [] })
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }

async function setup(options = {}) {
  const context = await browser.newContext()
  await context.addInitScript(({ ignoreAbort }) => {
    localStorage.setItem('token', 'account-a')
    const original = window.fetch.bind(window)
    window.cartRequests = []
    window.fetch = (url, init = {}) => {
      if (!String(url).includes('/carts')) return original(url, init)
      const record = { aborted: false, settled: false }
      window.cartRequests.push(record)
      init.signal?.addEventListener('abort', () => { record.aborted = true }, { once: true })
      // Deliberately let a stale transport complete, so session guards are tested
      // independently of the browser's normal AbortController cancellation.
      return original(url, ignoreAbort ? { ...init, signal: undefined } : init)
        .finally(() => { record.settled = true })
    }
  }, { ignoreAbort: options.ignoreAbort ?? false })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  await page.clock.install()
  const state = { cart: makeCart(), status: 200, getStatus: 200, calls: [], errors: [], ...options }
  page.on('pageerror', e => state.errors.push(e.message))
  await page.route('http://localhost:8080/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname, method = req.method()
    const token = req.headers().authorization, body = req.postDataJSON()
    state.calls.push({ path, method, token, body })
    let data = [], status = 200, gate
    if (path.startsWith('/api/v1/auth/')) data = { access_token: 'account-b' }
    else if (path === '/users/me') data = { id: token === 'Bearer account-b' ? 2 : 1,
      firstName: 'QA', lastName: 'Cart', email: 'qa@example.invalid', role: 'USUARIO' }
    else if (path === '/collections') data = [{ id: 1, name: 'NBA' }]
    else if (path === '/products') data = { content: [product], totalElements: 1, totalPages: 1, number: 0 }
    else if (path === '/products/7') data = product
    else if (path === '/carts') {
      data = token === 'Bearer account-b' ? makeCart(5, 'Carrito nueva sesión') : structuredClone(state.cart)
      status = token === 'Bearer account-b' ? 200 : state.getStatus
      gate = token === 'Bearer account-b' ? null : state.getGate
    } else if (path.startsWith('/carts/items')) {
      status = state.status
      gate = state.writeGate
      if (state.networkFailure) return route.abort('connectionreset')
      if (status === 200) state.cart = method === 'DELETE' ? makeCart(0) : makeCart(body.quantity)
      data = structuredClone(state.cart)
    }
    if (status !== 200) data = { message: 'Stock insuficiente QA' }
    if (gate) await gate.promise
    await route.fulfill({ status, json: data }).catch(() => {}) // Logout may abort transport.
  })
  const count = (method, path = '/carts') => state.calls.filter(c => c.method === method && c.path === path).length
  const quantity = () => page.getByLabel('Cantidad seleccionada')
  const ready = async () => {
    await page.getByRole('button', { name: 'Aumentar cantidad' }).waitFor()
    await page.waitForFunction(() => !document.querySelector('button[aria-label="Aumentar cantidad"]')?.disabled)
  }
  const close = async () => { assert.deepEqual(state.errors, []); await context.close() }
  await page.goto(base + (options.path || '/carrito'))
  return { page, state, count, quantity, ready, close }
}

let passed = 0
async function test(name, run) { await run(); passed++; console.log('PASS ' + name) }
async function expectQuantity(page, value) {
  await page.waitForFunction(q => document.querySelector('output[aria-label="Cantidad seleccionada"]')?.textContent === String(q), value)
}
async function switchSession(page) {
  await page.getByRole('link', { name: 'Mi cuenta', exact: true }).first().click()
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await page.getByLabel('Email', { exact: true }).fill('qa@example.invalid')
  await page.getByLabel('Contraseña', { exact: true }).fill('Password123!')
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await page.getByRole('heading', { name: 'Mi perfil', exact: true }).waitFor()
  await page.getByRole('link', { name: /^Carrito/ }).first().click()
  await page.getByRole('heading', { name: 'Carrito nueva sesión', exact: true }).waitFor()
}

try {
  await test('Initial cart loads once through GET /carts with the session JWT', async () => {
    const s = await setup(); await s.ready()
    assert.equal(s.count('GET'), 1)
    assert.equal(s.state.calls.find(c => c.path === '/carts').token, 'Bearer account-a')
    assert.equal(await s.quantity().textContent(), '1')
    await s.close()
  })

  await test('POST sends the selected quantity, blocks duplicate adds and uses CartResponse without GET', async () => {
    const gate = deferred()
    const s = await setup({ path: '/producto/7', cart: makeCart(0), writeGate: gate })
    const button = s.page.getByRole('button', { name: 'Agregar al carrito', exact: true })
    await button.waitFor()
    await s.page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Agregar al carrito' && !b.disabled))
    await s.page.getByRole('button', { name: 'Aumentar cantidad' }).click()
    await button.evaluate(b => { b.click(); b.click() })
    await s.page.waitForFunction(() => [...document.querySelectorAll('button')].find(b => b.textContent === 'Agregar al carrito')?.disabled)
    gate.resolve()
    await s.page.getByText('Carrito actualizado.', { exact: true }).waitFor()
    assert.equal(s.count('POST', '/carts/items'), 1)
    assert.deepEqual(s.state.calls.find(c => c.method === 'POST').body, { productId: 7, quantity: 2 })
    await s.page.getByRole('link', { name: /^Carrito/ }).first().click()
    await expectQuantity(s.page, 2)
    assert.equal(s.count('GET'), 1)
    await s.close()
  })

  await test('PUT is optimistic, coalesces pending quantities and blocks removal and checkout', async () => {
    const gate = deferred()
    const s = await setup({ writeGate: gate }); await s.ready()
    const plus = s.page.getByRole('button', { name: 'Aumentar cantidad' })
    await plus.click(); await expectQuantity(s.page, 2)
    assert.ok(await s.page.getByRole('button', { name: 'Quitar', exact: true }).isDisabled())
    assert.ok(await s.page.getByRole('button', { name: 'Iniciar compra' }).isDisabled())
    await plus.click(); await expectQuantity(s.page, 3)
    await plus.click(); await expectQuantity(s.page, 4)
    gate.resolve()
    await s.page.getByText('Carrito actualizado.', { exact: true }).waitFor()
    await expectQuantity(s.page, 4)
    assert.deepEqual(s.state.calls.filter(c => c.method === 'PUT').map(c => c.body), [{ quantity: 2 }, { quantity: 4 }])
    assert.equal(s.count('PUT', '/carts/items/11'), 2)
    assert.equal(s.count('GET'), 1)
    assert.ok(await s.page.getByRole('button', { name: 'Quitar', exact: true }).isEnabled())
    await s.close()
  })

  await test('A failed queued PUT rolls back to the last confirmed quantity and displays the backend message', async () => {
    const gate = deferred()
    const s = await setup({ writeGate: gate }); await s.ready()
    const firstRequest = s.page.waitForRequest(req => req.method() === 'PUT')
    await s.page.getByRole('button', { name: 'Aumentar cantidad' }).click()
    await expectQuantity(s.page, 2)
    // Ensure the first successful response was captured before making the next fail.
    await firstRequest
    s.state.status = 409
    await s.page.getByRole('button', { name: 'Aumentar cantidad' }).click()
    await expectQuantity(s.page, 3)
    gate.resolve()
    await s.page.getByRole('alert').filter({ hasText: 'Stock insuficiente QA' }).waitFor()
    await expectQuantity(s.page, 2)
    assert.equal(s.count('PUT', '/carts/items/11'), 2)
    assert.equal(s.count('GET'), 1)
    assert.ok(await s.page.getByRole('button', { name: 'Iniciar compra' }).isEnabled())
    await s.close()
  })

  await test('Network failure restores the original quantity and the existing connection message', async () => {
    const s = await setup({ networkFailure: true }); await s.ready()
    await s.page.getByRole('button', { name: 'Aumentar cantidad' }).click()
    await s.page.getByRole('alert').filter({ hasText: 'Recuperamos la última cantidad guardada.' }).waitFor()
    await expectQuantity(s.page, 1)
    assert.equal(s.count('PUT', '/carts/items/11'), 1)
    assert.equal(s.count('GET'), 1)
    await s.close()
  })

  await test('DELETE uses the item ID and updates directly without a follow-up GET', async () => {
    const s = await setup(); await s.ready()
    await s.page.getByRole('button', { name: 'Quitar', exact: true }).click()
    await s.page.getByText('Tu carrito está vacío', { exact: true }).waitFor()
    assert.equal(s.count('DELETE', '/carts/items/11'), 1)
    assert.equal(s.state.calls.find(c => c.method === 'DELETE').body, null)
    assert.equal(s.count('GET'), 1)
    await s.close()
  })

  await test('Failed initial GET displays its error; explicit retry sends exactly one additional GET', async () => {
    const s = await setup({ getStatus: 503 })
    await s.page.getByText('Stock insuficiente QA', { exact: true }).waitFor()
    s.state.getStatus = 200
    await s.page.getByRole('button', { name: 'Reintentar', exact: true }).click()
    await s.ready()
    assert.equal(s.count('GET'), 2)
    await s.close()
  })

  for (const operation of ['GET', 'POST', 'PUT', 'DELETE']) {
    await test(`${operation} 401 ends the session and shows the existing expiration message`, async () => {
      const s = await setup({ getStatus: operation === 'GET' ? 401 : 200,
        status: 401, path: operation === 'POST' ? '/producto/7' : '/carrito' })
      if (operation === 'POST') await s.page.getByRole('button', { name: 'Agregar al carrito', exact: true }).click()
      if (operation === 'PUT' || operation === 'DELETE') {
        await s.ready()
        await s.page.getByRole('button', { name: operation === 'PUT' ? 'Aumentar cantidad' : 'Quitar', exact: true }).click()
      }
      await s.page.waitForURL('**/ingresar')
      await s.page.getByRole('alert').filter({ hasText: 'Tu sesión venció. Volvé a ingresar.' }).waitFor()
      assert.equal(await s.page.evaluate(() => localStorage.getItem('token')), null)
      await s.close()
    })
  }

  for (const operation of ['GET', 'POST', 'PUT', 'DELETE']) {
    await test(`Late ${operation} response cannot replace a new session's cart, even if transport ignores abort`, async () => {
      const gate = deferred()
      const s = await setup({ ignoreAbort: true, getGate: operation === 'GET' ? gate : null,
        writeGate: operation === 'GET' ? null : gate, path: operation === 'POST' ? '/producto/7' : '/carrito' })
      if (operation === 'POST') await s.page.getByRole('button', { name: 'Agregar al carrito', exact: true }).click()
      if (operation === 'PUT' || operation === 'DELETE') {
        await s.ready()
        await s.page.getByRole('button', { name: operation === 'PUT' ? 'Aumentar cantidad' : 'Quitar', exact: true }).click()
      }
      await switchSession(s.page)
      assert.ok(await s.page.evaluate(() => window.cartRequests.some(r => r.aborted)))
      gate.resolve()
      await s.page.waitForFunction(() => window.cartRequests.every(r => r.settled))
      await s.page.clock.runFor(50)
      await expectQuantity(s.page, 5)
      assert.equal(await s.page.getByRole('heading', { name: product.name, exact: true }).count(), 0)
      assert.equal(await s.page.evaluate(() => localStorage.getItem('token')), 'account-b')
      assert.equal(s.count('GET'), 2)
      assert.equal(s.state.calls.filter(c => c.path === '/carts').at(-1).token, 'Bearer account-b')
      await s.close()
    })
  }
  console.log(`Cart browser scenarios passed: ${passed}`)
} finally { await browser.close() }
