import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.BASE_URL || 'http://localhost:5173'
const phase = process.env.PHOTO_PHASE || 'despues'
const output = new URL('../logs/fotos/' + phase + '/', import.meta.url)
await mkdir(output, { recursive: true })
const shapes = [[240, 400], [400, 240], [280, 280]]
const pictures = shapes.map(([w, h]) => 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '"><rect width="100%" height="100%" fill="#126fd3"/></svg>',
))
const user = { id: 1, firstName: 'QA', lastName: 'Fotos', email: 'qa@example.invalid', role: 'USUARIO', active: true }
const products = pictures.map((url, i) => ({
  id: i + 1, name: 'Foto QA ' + (i + 1), description: 'Carta de prueba',
  type: 'CARTA', price: 200, stock: 10, status: 'ACTIVO', sellerId: 9, sellerName: 'QA',
  collectionId: 1, collectionName: 'NBA', imageUrls: [url, ...pictures.filter(pic => pic !== url)],
}))
const paged = content => ({ content, number: 0, totalElements: content.length, totalPages: 1 })
const cards = Array.from({ length: 9 }, (_, slotIndex) => ({
  id: slotIndex + 1, slotIndex, pageNumber: 1, section: 'NBA', origin: 'MANUAL',
  name: 'Carta QA ' + (slotIndex + 1), imageUrl: pictures[slotIndex % 3],
}))

// Mide los píxeles de la foto pintada, incluidos los márgenes reales dejados por object-fit.
async function measure(page, image) {
  await image.evaluate(img => img.decode())
  const png = await image.screenshot({ scale: 'css' })
  return page.evaluate(async data => {
    const photo = new Image()
    photo.src = 'data:image/png;base64,' + data
    await photo.decode()
    const canvas = document.createElement('canvas')
    canvas.width = photo.width
    canvas.height = photo.height
    const context = canvas.getContext('2d')
    context.drawImage(photo, 0, 0)
    const rgba = context.getImageData(0, 0, photo.width, photo.height).data
    let left = photo.width, right = -1, top = photo.height, bottom = -1
    for (let y = 0; y < photo.height; y++) {
      for (let x = 0; x < photo.width; x++) {
        const p = (y * photo.width + x) * 4
        if (rgba[p] !== 18 || rgba[p + 1] !== 111 || rgba[p + 2] !== 211) continue
        left = Math.min(left, x)
        right = Math.max(right, x)
        top = Math.min(top, y)
        bottom = Math.max(bottom, y)
      }
    }
    return { width: right - left + 1, height: bottom - top + 1 }
  }, png.toString('base64'))
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const report = {}
try {
  for (const [device, viewport] of Object.entries({ escritorio: { width: 1440, height: 900 }, movil: { width: 390, height: 844 } })) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 })
    await context.addInitScript(() => localStorage.setItem('token', 'qa-fotos'))
    const page = await context.newPage()
    await page.route('http://localhost:8080/**', route => {
      const path = new URL(route.request().url()).pathname
      let data = []
      if (path === '/users/me') data = user
      if (path === '/carts') data = { id: 1, items: [], subtotal: 0 }
      if (path === '/collections') data = [{ id: 1, name: 'NBA' }]
      if (path === '/products') data = paged(products)
      if (path === '/products/mine') data = paged(products.map(p => ({ ...p, sellerId: user.id })))
      if (path === '/products/1') data = products[0]
      if (path === '/albums/me') data = {
        id: 10, userId: user.id, visibility: 'PRIVATE',
        sections: ['NBA', 'MY_LITTLE_PONY', 'CARS', 'MARVEL'].map((key, i) => ({
          id: i + 1, key, pageCount: 1, cards: i === 0 ? cards : [],
        })),
      }
      return route.fulfill({ json: data })
    })
    const result = report[device] = {}
    const check = async (image, minimum) => {
      const size = await measure(page, image)
      assert.ok(size.width > 0 && size.height > 0)
      if (phase !== 'antes') {
        const [w, h] = await image.evaluate(img => [img.naturalWidth, img.naturalHeight])
        assert.ok(Math.abs(size.width - size.height * w / h) <= 3, JSON.stringify(size) + ' conserva la proporción ' + w + ':' + h)
        assert.ok(Math.max(size.width, size.height) >= minimum, JSON.stringify(size) + ' alcanza ' + minimum + ' px')
        assert.equal(await image.evaluate(img => {
          const r = img.getBoundingClientRect(), frame = img.parentElement.getBoundingClientRect()
          return r.x >= frame.x - 1 && r.y >= frame.y - 1 && r.right <= frame.right + 1 && r.bottom <= frame.bottom + 1
        }), true, 'La foto queda dentro de su marco')
      }
      return size
    }
    const capture = async (path, name, images, count, minimum) => {
      await page.goto(base + path)
      const photos = page.locator(images)
      await photos.first().waitFor()
      assert.equal(await photos.count(), count)
      result[name] = []
      for (let i = 0; i < count; i++) result[name].push(await check(photos.nth(i), minimum))
      await page.evaluate(() => window.scrollTo(0, 0))
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true)
      await page.screenshot({ path: fileURLToPath(new URL(device + '-' + name + '.png', output)), fullPage: true, scale: 'css' })
    }
    await capture('/catalogo', 'catalogo', '[aria-label="Productos del catálogo"] article img', 3, device === 'escritorio' ? 275 : 310)
    await capture('/producto/1', 'detalle', 'section[aria-labelledby="product-heading"] img[alt="Foto 1"]:not(button img)', 1, device === 'escritorio' ? 450 : 350)
    for (let i = 1; i < 3; i++) {
      await page.getByRole('button', { name: 'Mostrar Foto ' + (i + 1) }).click()
      result.detalle.push(await check(page.locator('section[aria-labelledby="product-heading"] img[alt="Foto ' + (i + 1) + '"]:not(button img)'), device === 'escritorio' ? 450 : 250))
    }
    await capture('/mis-publicaciones', 'publicaciones', '[role="table"] img', 3, device === 'escritorio' ? 80 : 70)
    await capture('/mi-album', 'album', '.album-slot__image', 9, device === 'escritorio' ? 158 : 80)
    await context.close()
  }
  await writeFile(new URL('medidas.json', output), JSON.stringify(report, null, 2))
  console.log('PASS Fotos en escritorio y móvil (' + phase + '): catálogo, detalle, publicaciones y nueve casilleros del álbum')
} finally {
  await browser.close()
}
