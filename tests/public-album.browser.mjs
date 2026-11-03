// Browser integration: public album is read-only and respects backend privacy.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage()
const user = { id: 7, firstName: 'QA', lastName: 'Lector', email: 'qa@example.invalid', role: 'USUARIO', active: true }
const calls = [], errors = []
let visibility = 'PUBLIC'
const makeAlbum = ownerId => ({
  id: ownerId * 10, userId: ownerId, visibility: 'PUBLIC',
  sections: [
    { id: 1, key: 'NBA', pageCount: 2, cards: [
      { id: 101, name: 'Carta compartida', imageUrl: '', origin: 'MANUAL', pageNumber: 1, slotIndex: 0 },
      { id: 102, name: 'Carta segunda página', imageUrl: '', origin: 'PURCHASE', pageNumber: 2, slotIndex: 3 },
    ] },
    { id: 2, key: 'MY_LITTLE_PONY', pageCount: 1, cards: [] },
    { id: 3, key: 'CARS', pageCount: 1, cards: [
      { id: 103, name: 'Carta Cars', imageUrl: '', origin: 'MANUAL', pageNumber: 1, slotIndex: 5 },
    ] },
    { id: 4, key: 'MARVEL', pageCount: 1, cards: [] },
  ],
})
const product = {
  id: 42, name: 'Carta del vendedor', description: 'Carta QA', price: 100,
  stock: 2, type: 'CARTA', status: 'ACTIVO', sellerId: 13,
  sellerName: 'Coleccionista QA', collectionId: 1, collectionName: 'NBA',
  imageUrls: [], createdAt: '2026-10-21T10:00:00',
}

await page.addInitScript(() => localStorage.setItem('token', 'qa-public-album'))
page.on('pageerror', error => errors.push(error.message))
await page.route('http://localhost:8080/**', async route => {
  const req = route.request()
  const pathname = new URL(req.url()).pathname
  calls.push({ path: pathname, method: req.method() })
  const reply = (data, status = 200) => route.fulfill({ status, json: data })
  if (pathname === '/users/me') return reply(user)
  if (pathname === '/carts') return reply({ id: 9, items: [], subtotal: 0 })
  if (pathname === '/collections' || pathname === '/promotions/public') return reply([])
  if (pathname === '/products') return reply({ content: [], number: 0, totalElements: 0, totalPages: 0 })
  if (pathname === '/products/42') return reply(product)
  if (pathname.startsWith('/reviews')) return reply([])
  if (pathname === '/albums/me') return reply({
    ...makeAlbum(7), visibility: 'PRIVATE',
  })
  if (pathname === '/albums/me/purchases') return reply([])
  if (pathname === '/albums/users/13') {
    if (visibility === 'PRIVATE') return reply({ message: 'Private details must not escape.' }, 404)
    return reply(makeAlbum(13))
  }
  if (pathname === '/albums/users/14') return reply(makeAlbum(14))
  return reply({ message: 'Unexpected ' + pathname }, 404)
})

const base = process.env.BASE_URL || 'http://127.0.0.1:5173'
try {
  await page.goto(base + '/album/usuario/13')
  await page.getByRole('heading', { name: 'Álbum público', exact: true }).waitFor()
  await page.locator('[aria-label="Ver carta Carta compartida, posición 1"]').waitFor()
  assert.equal(await page.locator('section[data-album-theme="NBA"]').count(), 1)
  assert.equal(await page.locator('.album-collection-tab__cover').count(), 4)
  assert.equal(await page.locator('.album-sheet__art').count(), 1)
  assert.equal(await page.locator('[data-album-slot]').count(), 9)
  assert.equal(await page.getByRole('button', { name: 'Ver carta Carta compartida, posición 1' }).count(), 0)
  assert.equal(await page.getByRole('button', { name: 'Espacio 2 vacío' }).count(), 0)
  assert.equal(await page.getByRole('button', { name: 'Guardar carta' }).count(), 0)
  assert.equal(await page.getByRole('button', { name: 'Mover carta' }).count(), 0)
  assert.equal(await page.getByRole('button', { name: 'Hacer privado' }).count(), 0)

  await page.getByRole('button', { name: 'Siguiente' }).click()
  await page.locator('[aria-label="Ver carta Carta segunda página, posición 4"]').waitFor()
  await page.getByRole('button', { name: 'Cars', exact: true }).click()
  await page.locator('[aria-label="Ver carta Carta Cars, posición 6"]').waitFor()
  await page.getByText('Página 1 / 1').waitFor()

  // SPA navigation between album owners must reset the selected section/page.
  await page.getByRole('button', { name: 'NBA', exact: true }).click()
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await page.getByText('Página 2 / 2').waitFor()
  await page.evaluate(() => {
    history.pushState({}, '', '/album/usuario/14')
    dispatchEvent(new PopStateEvent('popstate'))
  })
  await page.getByText('Colección del usuario #14').waitFor()
  await page.getByText('Página 1 / 2').waitFor()
  assert.equal(await page.getByText('Página 2 / 2').count(), 0)
  // A second user's album is distinct and never inherits the first user's cards.
  await page.goto(base + '/album/usuario/13')
  await page.locator('[aria-label="Ver carta Carta compartida, posición 1"]').waitFor()

  // Private means a generic 404, with no names or image URLs from a previous read.
  visibility = 'PRIVATE'
  await page.reload()
  await page.getByRole('alert').getByText('Este álbum no está disponible.').waitFor()
  assert.equal(await page.getByText('Carta compartida').count(), 0)
  assert.equal(await page.getByText('Private details must not escape.').count(), 0)

  const beforeInvalid = calls.filter(call => call.path.startsWith('/albums/users/')).length
  await page.goto(base + '/album/usuario/abc')
  await page.getByRole('alert').getByText('El enlace del álbum no es válido.').waitFor()
  assert.equal(calls.filter(call => call.path.startsWith('/albums/users/')).length, beforeInvalid)

  await page.goto(base + '/album/usuario/7')
  await page.waitForURL('**/mi-album')
  await page.getByRole('heading', { name: 'Mi álbum', exact: true }).waitFor()

  // The entry point is the seller section of an existing product detail.
  visibility = 'PUBLIC'
  await page.goto(base + '/producto/42')
  await page.getByRole('heading', { name: 'Carta del vendedor', exact: true }).waitFor()
  const seller = page.getByRole('link', { name: 'Ver álbum del vendedor' })
  await seller.waitFor()
  assert.ok((await seller.getAttribute('href')).endsWith('/album/usuario/13'))
  await seller.click()
  await page.locator('[aria-label="Ver carta Carta compartida, posición 1"]').waitFor()

  assert.equal(calls.filter(call => call.path === '/albums/users/13' && call.method === 'GET').length >= 3, true)
  assert.equal(calls.filter(call => call.path.startsWith('/albums/') && call.method !== 'GET').length, 0)
  assert.deepEqual(errors, [])
  console.log('PASS public album: read-only, pagination, privacy, invalid IDs, own redirect and seller navigation')
} finally {
  await browser.close()
}
