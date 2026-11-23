import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.BASE_URL || 'http://localhost:5173'
const product = { id: 7, name: 'Carta aviso QA', description: 'QA', price: 100, stock: 10,
  status: 'ACTIVO', type: 'CARTA', sellerId: 9, sellerName: 'QA', collectionId: 1,
  collectionName: 'NBA', imageUrls: [], createdAt: '2026-10-19T10:00:00' }
const cart = quantity => ({ id: 1, subtotal: 100 * quantity, items: quantity ? [{
  id: 11, productId: 7, productName: product.name, productImages: [], unitPrice: 100,
  quantity, subtotal: 100 * quantity,
}] : [] })
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const browser = await chromium.launch({ channel: 'msedge', headless: true })

async function scenario(name, run, viewport = { width: 1280, height: 800 }) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    localStorage.setItem('token', 'toast-a')
    const open = XMLHttpRequest.prototype.open
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      if (method === 'POST' && String(url).endsWith('/carts/items')) {
        this.abort = () => {}
        this.addEventListener('loadend', () => { window.finishedAdd = (window.finishedAdd || 0) + 1 })
      }
      return open.call(this, method, url, ...rest)
    }
  })
  const state = { quantity: 0, posts: [], status: 200 }
  await page.route('http://localhost:8080/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname
    const isB = req.headers().authorization === 'Bearer toast-b'
    let data = []
    if (path === '/users/me') data = { id: isB ? 2 : 1, firstName: 'QA', lastName: 'Aviso',
      email: 'qa@example.invalid', active: true, role: 'USUARIO' }
    if (path === '/api/v1/auth/authenticate') data = { access_token: 'toast-b' }
    if (path === '/collections') data = [{ id: 1, name: 'NBA' }]
    if (path === '/products') data = { content: [product], totalElements: 1, totalPages: 1, number: 0 }
    if (path === '/products' && state.showSecondProduct) {
      data = { content: [product, { ...product, id: 8, name: 'Otra carta QA' }], totalElements: 2, totalPages: 1, number: 0 }
    }
    if (path === '/products/7') data = product
    if (path === '/carts') data = cart(isB ? 4 : state.quantity)
    if (path === '/carts/items' && req.method() === 'POST') {
      const body = req.postDataJSON()
      state.posts.push(body)
      const { gate, status, networkFailure } = state
      if (gate) await gate.promise
      if (networkFailure) return route.abort('connectionreset')
      if (status !== 200) return route.fulfill({ status, json: { message: 'Stock insuficiente QA' } })
      state.quantity += body.quantity
      data = cart(state.quantity)
    }
    await route.fulfill({ json: data })
  })
  const toast = page.getByRole('status').filter({ hasText: 'Producto agregado al carrito' })
  const dismiss = page.getByRole('button', { name: 'Cerrar notificación del carrito' })
  try {
    await run({ page, state, toast, dismiss })
    assert.deepEqual(errors, [])
    console.log('PASS ' + name)
  } finally {
    state.gate?.resolve()
    await context.close()
  }
}

try {
  for (const [path, button, mobile] of [
    ['/', 'Agregar'], ['/catalogo', 'Agregar', true],
    ['/producto/7', 'Agregar al carrito'], ['/producto/7', 'Agregar al carrito', true],
  ]) {
    await scenario('Confirmación después de HTTP sobre el botón en ' + path + (mobile ? ' (móvil)' : ''), async ({ page, state, toast }) => {
      state.gate = deferred()
      state.showSecondProduct = path === '/catalogo'
      await page.goto(base + path)
      const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: product.name, exact: true }) })
      const add = (path === '/producto/7' ? page : card).getByRole('button', { name: button, exact: true })
      const post = page.waitForRequest(req => req.method() === 'POST' && req.url().endsWith('/carts/items'))
      await add.click()
      await post
      assert.equal(await toast.count(), 0)
      state.gate.resolve()
      await toast.waitFor()
      assert.equal(await toast.count(), 1)
      const notice = await toast.locator('..').boundingBox()
      const target = await add.boundingBox()
      const gap = target.y - (notice.y + notice.height)
      assert.ok(gap >= 0 && gap <= 12, 'El mensaje queda justo encima del botón: ' + gap + ' px')
      assert.ok(Math.abs(notice.x + notice.width - (target.x + target.width)) <= 1)
      if (state.showSecondProduct) {
        const otherCard = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Otra carta QA' }) })
        await otherCard.waitFor()
        assert.equal(await otherCard.getByText('Producto agregado al carrito').count(), 0)
      }
      assert.deepEqual(state.posts, [{ productId: 7, quantity: 1 }])
    }, mobile ? { width: 390, height: 844 } : undefined)
  }

  await scenario('Sin toast para fallo HTTP, fallo de red y clic simultáneo rechazado', async ({ page, state, toast }) => {
    state.gate = deferred()
    state.status = 409
    await page.goto(base + '/producto/7')
    const add = page.getByRole('button', { name: 'Agregar al carrito', exact: true })
    await add.click()
    await add.dispatchEvent('click')
    state.gate.resolve()
    await page.getByText('Stock insuficiente QA').waitFor()
    assert.equal(state.posts.length, 1)
    assert.equal(await toast.count(), 0)
    state.networkFailure = true
    await add.click()
    await page.waitForFunction(() => window.finishedAdd === 2)
    await page.waitForFunction(() => [...document.querySelectorAll('button')]
      .some(button => button.textContent === 'Agregar al carrito' && !button.disabled))
    assert.equal(await toast.count(), 0)
  })

  await scenario('El segundo agregado reinicia los tres segundos, conserva cantidades y permite cerrar', async ({ page, state, toast, dismiss }) => {
    await page.clock.install()
    await page.goto(base + '/producto/7')
    const add = page.getByRole('button', { name: 'Agregar al carrito', exact: true })
    await add.click()
    await toast.waitFor()
    await page.clock.fastForward(2200)
    await add.click()
    await page.waitForFunction(() => window.finishedAdd === 2)
    await page.waitForFunction(() => [...document.querySelectorAll('button')]
      .some(button => button.textContent === 'Agregar al carrito' && !button.disabled))
    await page.clock.fastForward(1300)
    assert.equal(await toast.count(), 1)
    await page.clock.fastForward(1800)
    await toast.waitFor({ state: 'hidden' })
    await add.click()
    await toast.waitFor()
    await dismiss.click()
    assert.equal(await toast.count(), 0)
    await page.getByRole('link', { name: /^Carrito/ }).first().click()
    await page.waitForFunction(() => document.querySelector('output[aria-label="Cantidad seleccionada"]')?.textContent === '3')
    assert.deepEqual(state.posts.map(post => post.quantity), [1, 1, 1])
  })

  await scenario('Logout limpia el toast y la respuesta tardía de A no aparece en B', async ({ page, state, toast }) => {
    await page.goto(base + '/producto/7')
    const add = page.getByRole('button', { name: 'Agregar al carrito', exact: true })
    await add.click()
    await toast.waitFor()
    state.gate = deferred()
    const post = page.waitForRequest(req => req.method() === 'POST' && req.url().endsWith('/carts/items'))
    await add.click()
    await post
    await page.getByRole('link', { name: 'Mi cuenta', exact: true }).first().click()
    await page.getByRole('button', { name: 'Cerrar sesión' }).click()
    assert.equal(await toast.count(), 0)
    await page.getByLabel('Email', { exact: true }).fill('qa@example.invalid')
    await page.getByLabel('Contraseña', { exact: true }).fill('Password123!')
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
    await page.getByRole('heading', { name: 'Mi perfil', exact: true }).waitFor()
    await page.getByRole('link', { name: /^Carrito/ }).first().click()
    await page.waitForFunction(() => document.querySelector('output[aria-label="Cantidad seleccionada"]')?.textContent === '4')
    state.gate.resolve()
    await page.waitForFunction(() => window.finishedAdd === 2)
    assert.equal(await toast.count(), 0)
    assert.equal(await page.getByLabel('Cantidad seleccionada').textContent(), '4')
  })
} finally {
  await browser.close()
}
