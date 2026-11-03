import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage()
const user = { id: 7, firstName: 'QA', lastName: 'Album', email: 'qa@example.invalid', role: 'USUARIO', active: true }
let visibility = 'PRIVATE', nextId = 100
const cards = []
const calls = []
const sections = [
  { id: 1, key: 'NBA', pageCount: 1 },
  { id: 2, key: 'MY_LITTLE_PONY', pageCount: 1 },
  { id: 3, key: 'CARS', pageCount: 1 },
  { id: 4, key: 'MARVEL', pageCount: 1 },
]
const orderItem = { orderItemId: 110, orderId: 14, name: 'Carta comprada',
  imageUrl: 'https://example.invalid/album/purchased.webp', purchasedQuantity: 2 }
const getAlbum = () => ({
  id: 10, userId: user.id, visibility,
  sections: sections.map(section => ({
    ...section,
    cards: cards.filter(card => card.section === section.key)
      .map(({ section: unused, ...card }) => { void unused; return card }),
  })),
})
const errors = []
page.on('pageerror', err => errors.push(err.message))
await page.addInitScript(() => localStorage.setItem('token', 'qa-album-token'))
await page.route('http://localhost:8080/**', async route => {
  const req = route.request()
  const u = new URL(req.url())
  const method = req.method()
  calls.push({ path: u.pathname, method })
  const reply = (data, status = 200) => route.fulfill({ status, json: data })
  const path = u.pathname
  if (path === '/users/me') return reply(user)
  if (path === '/promotions/public' || path === '/collections') return reply([])
  if (path === '/products') return reply({ content: [], totalElements: 0, totalPages: 0, number: 0 })
  if (path === '/carts') return reply({ id: 9, items: [], subtotal: 0 })
  if (path === '/albums/me' && method === 'GET') return reply(getAlbum())
  if (path === '/albums/me/purchases' && method === 'GET') {
    const used = cards.filter(card => card.origin === 'PURCHASE').length
    return reply([{ ...orderItem, usedQuantity: used, availableQuantity: orderItem.purchasedQuantity - used }])
  }
  if (path === '/albums/me/visibility' && method === 'PATCH') {
    visibility = req.postDataJSON().visibility
    return reply(getAlbum())
  }
  if (path === '/albums/me/cards/manual' && method === 'POST') {
    const raw = req.postData()
    assert.ok(raw.includes('QA física'), 'multipart contains the manual card name')
    const card = { id: nextId++, name: 'QA física', origin: 'MANUAL',
      imageUrl: '', section: 'NBA', pageNumber: 1, slotIndex: 0 }
    cards.push(card)
    return reply(card, 201)
  }
  if (path === '/albums/me/cards/purchase' && method === 'POST') {
    const { orderItemId, section, pageNumber, slotIndex } = req.postDataJSON()
    assert.equal(orderItemId, 110)
    const card = { id: nextId++, name: orderItem.name, origin: 'PURCHASE',
      imageUrl: '', section, pageNumber, slotIndex }
    cards.push(card)
    return reply(card, 201)
  }
  if (/^\/albums\/me\/cards\/\d+$/.test(path) && method === 'PATCH') {
    const card = cards.find(item => item.id === Number(path.split('/').pop()))
    assert.ok(card, 'an owned card can be moved')
    const target = req.postDataJSON()
    Object.assign(card, { section: target.section, pageNumber: target.pageNumber, slotIndex: target.slotIndex })
    return reply(card)
  }
  if (/^\/albums\/me\/cards\/\d+$/.test(path) && method === 'DELETE') {
    cards.splice(cards.findIndex(item => item.id === Number(path.split('/').pop())), 1)
    return route.fulfill({ status: 204, body: '' })
  }
  return reply({ message: 'Unexpected ' + method + ' ' + path }, 404)
})

try {
  await page.goto((process.env.BASE_URL || 'http://127.0.0.1:5173') + '/mi-album')
  await page.getByRole('heading', { name: 'Mi álbum', exact: true }).waitFor()
  assert.equal(await page.getByRole('link', { name: 'Mi álbum', exact: true }).count(), 1)
  await page.getByRole('button', { name: 'Espacio 1 vacío' }).click()
  await page.getByRole('button', { name: 'Carta física' }).click()
  await page.getByLabel('Nombre de la carta').fill('QA física')
  await page.getByLabel('Foto de la carta').setInputFiles({
    name: 'qa.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLytQAAAABJRU5ErkJggg==', 'base64'),
  })
  await page.getByRole('button', { name: 'Guardar carta' }).click()
  await page.getByRole('button', { name: 'Ver carta QA física, posición 1' }).waitFor()

  await page.getByRole('button', { name: 'Espacio 2 vacío' }).click()
  await page.getByLabel('Carta disponible').selectOption('110')
  await page.getByRole('button', { name: 'Guardar carta' }).click()
  await page.getByRole('button', { name: 'Ver carta Carta comprada, posición 2' }).waitFor()

  await page.getByRole('button', { name: 'Ver carta Carta comprada, posición 2' }).click()
  await page.getByLabel('Sección').selectOption('CARS')
  await page.getByLabel('Posición', { exact: true }).selectOption('3')
  await page.getByRole('button', { name: 'Mover carta' }).click()
  await page.getByRole('button', { name: 'Ver carta Carta comprada, posición 4' }).waitFor()

  await page.getByRole('button', { name: 'Hacer público' }).click()
  await page.getByText('Álbum público', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Hacer privado' }).click()
  await page.getByText('Álbum privado', { exact: true }).waitFor()

  assert.equal(calls.filter(call => call.path === '/albums/me/cards/manual' && call.method === 'POST').length, 1)
  assert.equal(calls.filter(call => call.path === '/albums/me/cards/purchase' && call.method === 'POST').length, 1)
  assert.equal(calls.filter(call => call.path === '/albums/me/visibility' && call.method === 'PATCH').length, 2)
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
