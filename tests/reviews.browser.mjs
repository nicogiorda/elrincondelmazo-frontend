// React real en StrictMode + Redux; backend simulado, sin escrituras reales.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const base = process.env.BASE_URL || 'http://localhost:5173'
const product = { id: 42, name: 'Carta reseñas QA', description: 'Descripción QA', price: 100, stock: 10,
  status: 'ACTIVO', type: 'CARTA', sellerId: 9, sellerName: 'Vendedor QA',
  collectionId: 1, collectionName: 'NBA', imageUrls: [], createdAt: '2026-10-22T10:00:00' }
const sample = { id: 17, productId: 42, userId: 3, userName: 'Comprador QA', rating: 5,
  comment: 'Llegó perfecta', createdAt: '2026-10-22T10:00:00' }
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

async function setup(options = {}) {
  const context = await browser.newContext()
  await context.addInitScript(({ loggedIn }) => {
    if (loggedIn) localStorage.setItem('token', 'review-fixture')
  }, { loggedIn: options.loggedIn ?? false })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  const state = { reviews: [], calls: [], errors: [], postStatus: 201, ...options }
  page.on('pageerror', e => state.errors.push(e.message))
  await page.route('http://localhost:8080/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname, method = req.method()
    const auth = req.headers().authorization
    state.calls.push({ path, method, auth })
    let data = [], status = 200
    if (path === '/users/me') data = {
      id: 3, firstName: 'Comprador', lastName: 'QA', email: 'qa@example.invalid',
      role: 'USUARIO', active: true,
    }
    else if (path === '/collections') data = [{ id: 1, name: 'NBA' }]
    else if (path === '/carts') data = { id: 1, items: [], subtotal: 0 }
    else if (path === '/products') data = { content: [product], number: 0, totalPages: 1, totalElements: 1 }
    else if (path === '/products/42') data = product
    else if (path === '/products/42/reviews') {
      if (method === 'GET') {
        assert.equal(auth, undefined, 'GET reseñas es público')
        data = structuredClone(state.reviews)
        if (state.getGate) await state.getGate.promise
      } else {
        assert.equal(method, 'POST')
        assert.equal(auth, 'Bearer review-fixture')
        const payload = req.postDataJSON()
        assert.deepEqual(payload, { rating: 5, comment: 'Nueva reseña QA' })
        status = state.postStatus
        if (state.postGate) await state.postGate.promise
        if (status === 201) {
          data = { ...sample, comment: payload.comment }
          state.reviews = [data, ...state.reviews]
        } else data = { message: status === 401 ? 'Sesión inválida' : 'No se puede publicar QA' }
      }
    }
    else if (path === '/promotions/public') data = []
    else throw new Error('Endpoint inesperado: ' + method + ' ' + path)
    await route.fulfill({ status, json: data }).catch(() => {})
  })
  const count = (path, method = 'GET') => state.calls.filter(c => c.path === path && c.method === method).length
  const close = async () => { assert.deepEqual(state.errors, []); await context.close() }
  await page.goto(base + '/producto/42')
  return { page, state, count, close }
}

async function fillReview(page) {
  await page.getByRole('button', { name: '5 estrellas', exact: true }).click()
  await page.getByRole('textbox', { name: 'Comentario de la reseña' }).fill('Nueva reseña QA')
}
let passed = 0
async function test(name, fn) {
  await fn()
  passed++
  console.log('PASS ' + name)
}

try {
  await test('GET reseñas es público y no solicita sesión ni devuelve mocks', async () => {
    const s = await setup()
    await s.page.getByText('Todavía no hay reseñas', { exact: true }).waitFor()
    assert.equal(s.count('/products/42/reviews'), 1)
    assert.equal(s.count('/products/42/reviews', 'POST'), 0)
    await s.close()
  })

  await test('POST desde el formulario guarda una sola reseña confirmada en Redux', async () => {
    const s = await setup({ loggedIn: true })
    await s.page.getByRole('button', { name: '5 estrellas', exact: true }).waitFor()
    await fillReview(s.page)
    await s.page.getByRole('button', { name: 'Publicar reseña' }).click()
    await s.page.getByText('Nueva reseña QA', { exact: true }).waitFor()
    assert.equal(s.count('/products/42/reviews'), 1, 'No debe releer tras POST')
    assert.equal(s.count('/products/42/reviews', 'POST'), 1)
    await s.close()
  })

  await test('doble clic no publica dos reseñas mientras la escritura espera', async () => {
    const gate = deferred()
    const s = await setup({ loggedIn: true, postGate: gate })
    await s.page.getByRole('button', { name: '5 estrellas', exact: true }).waitFor()
    await fillReview(s.page)
    await s.page.getByRole('button', { name: 'Publicar reseña' }).evaluate(button => {
      button.click()
      button.click()
    })
    await s.page.waitForFunction(() => document.querySelector('button[type="submit"]')?.disabled)
    assert.equal(s.count('/products/42/reviews', 'POST'), 1)
    gate.resolve()
    await s.page.getByText('Nueva reseña QA', { exact: true }).waitFor()
    assert.equal(s.count('/products/42/reviews', 'POST'), 1)
    await s.close()
  })

  await test('HTTP 403 conserva formulario y permite reintentar con éxito', async () => {
    const s = await setup({ loggedIn: true, postStatus: 403 })
    await s.page.getByRole('button', { name: '5 estrellas', exact: true }).waitFor()
    await fillReview(s.page)
    await s.page.getByRole('button', { name: 'Publicar reseña' }).click()
    await s.page.getByRole('alert').filter({ hasText: 'No se puede publicar QA' }).waitFor()
    s.state.postStatus = 201
    await s.page.getByRole('button', { name: 'Publicar reseña' }).click()
    await s.page.getByText('Nueva reseña QA', { exact: true }).waitFor()
    assert.equal(s.count('/products/42/reviews', 'POST'), 2)
    await s.close()
  })

  await test('HTTP 401 de publicación cierra sesión y no agrega reseñas', async () => {
    const s = await setup({ loggedIn: true, postStatus: 401 })
    await s.page.getByRole('button', { name: '5 estrellas', exact: true }).waitFor()
    await fillReview(s.page)
    await s.page.getByRole('button', { name: 'Publicar reseña' }).click()
    await s.page.waitForFunction(() => localStorage.getItem('token') === null)
    assert.equal(s.state.reviews.length, 0)
    await s.close()
  })

  console.log('Reseñas en navegador: ' + passed + ' escenarios PASS.')
} finally {
  await browser.close()
}
