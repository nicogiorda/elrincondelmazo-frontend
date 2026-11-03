import assert from 'node:assert/strict'
import test from 'node:test'
import { validateUser, normalizeAuthError, authHttpError } from '../src/utils/authValidation.js'
import { validateAccountResponse, normalizeAccountError, accountUnconfirmed } from '../src/utils/accountValidation.js'
import { normalizeCartError } from '../src/utils/cartErrors.js'
import { validateQuote, isConfirmedOrder, normalizeOrderError, ambiguousFailure } from '../src/utils/orderValidation.js'
import { validateProductsPage, validateProductDetail, normalizeProductHttpError, productError } from '../src/utils/productValidation.js'
import { validatePromotion, promotionPath, normalizePromotionError } from '../src/utils/promotionValidation.js'
import { validatePublication, validatePublicationsPage, validatePublicationPhoto,
  publicationPath, normalizePublicationError } from '../src/utils/publicationValidation.js'
import { reviewPath, normalizeReviewError } from '../src/utils/reviewValidation.js'

const user = { id: 1, firstName: 'QA', lastName: 'Persona', email: 'qa@example.invalid', role: 'USUARIO', active: true }
const promo = { id: 1, name: 'Oferta QA', type: 'CANTIDAD', discountPercentage: 17.25,
  active: true, startDate: '2026-10-20T11:00:00', minimumQuantity: 2, stackable: false }
const page = { content: [{ id: 7 }], number: 0, totalPages: 1, totalElements: 1 }
const quote = { subtotal: 100, totalDiscount: 10, total: 90,
  promotions: [{ promotionName: 'QA', discountApplied: 10 }] }
const order = {
  id: 19, state: 'PENDIENTE', orderDate: '2026-10-22T12:00:00',
  paymentMethod: 'TRANSFERENCIA', ...quote,
  items: [{ id: 1, productId: 7, productName: 'Carta', quantity: 1, price: 100 }],
  promotions: [{ promotionId: 1, promotionName: 'QA', discountApplied: 10 }],
}
const httpFailure = (status, data = { message: 'Error del servidor' }) =>
  ({ response: { status, data } })

test('Helpers de HTTP son puros, devuelven los mismos objetos válidos y no mutan la entrada', () => {
  assert.equal(validateUser(user), user)
  assert.equal(validateAccountResponse(user, 1), user)
  assert.equal(validateProductsPage(page), page)
  assert.equal(validateProductDetail({ id: 7 }, 7).id, 7)
  assert.equal(validatePromotion(promo, 1), promo)
  assert.equal(validateQuote(quote), quote)
  assert.equal(validatePublication({ id: 7, sellerId: 1 }, 1).id, 7)
  assert.equal(validatePublicationsPage({ content: [{ id: 7, sellerId: 1 }], totalPages: 1, number: 0 }, 0, 1).number, 0)
  assert.equal(validatePublicationPhoto({ url: 'https://cdn.example.invalid/a.png' }),
    'https://cdn.example.invalid/a.png')
  assert.equal(isConfirmedOrder(order, 'TRANSFERENCIA', 90), true)
})

for (const invalid of [null, {}, { ...user, id: 0 }, { ...user, role: 'ROOT' },
  { ...user, email: '' }, { ...user, firstName: null }, { ...user, lastName: 1 },
  { ...user, active: false }]) {
  test('rechaza usuario inválido: ' + JSON.stringify(invalid), () =>
    assert.throws(() => validateUser(invalid), { code: 'INVALID_USER' }))
}

for (const invalid of [null, { ...user, id: 2 }, { ...user, active: false },
  { ...user, firstName: undefined }, { ...user, email: {} }, { ...user, role: 'UNKNOWN' }]) {
  test('rechaza respuesta inválida de perfil: ' + JSON.stringify(invalid), () =>
    assert.throws(() => validateAccountResponse(invalid, 1), { code: 'ACCOUNT_UNCONFIRMED' }))
}

test('desactivación exige active false explícito, no sólo un 200', () => {
  assert.equal(validateAccountResponse({ ...user, active: false }, 1, true).active, false)
  for (const active of [true, undefined, null, 'false']) {
    assert.throws(() => validateAccountResponse({ ...user, active }, 1, true),
      { code: 'ACCOUNT_UNCONFIRMED' })
  }
  assert.equal(accountUnconfirmed('No confirmado').code, 'ACCOUNT_UNCONFIRMED')
  assert.equal(authHttpError('QA', 403).status, 403)
})

for (const invalid of [null, {}, { ...page, content: null }, { ...page, number: '0' },
  { ...page, totalPages: null }, { ...page, totalElements: undefined }, 'no JSON']) {
  test('valida página de catálogo: ' + JSON.stringify(invalid), () =>
    assert.throws(() => validateProductsPage(invalid), /página válida/))
}
for (const context of ['detail', 'cart', 'selection']) {
  test('un detalle con ID incorrecto mantiene mensaje específico de ' + context, () => {
    let error
    try { validateProductDetail({ id: 8 }, 7) } catch (failure) { error = failure }
    assert.equal(error.code, 'INVALID_PRODUCT')
    const normalized = productError(error, context)
    assert.match(normalized.message, /no coincide/)
    if (context === 'cart') assert.match(normalized.message, /carrito/)
    if (context === 'selection') assert.match(normalized.message, /selección/)
  })
}

for (const invalid of [null, {}, { ...promo, id: 0 }, { ...promo, id: 2 },
  { ...promo, active: 'true' }, { ...promo, type: 'OTRO' },
  { ...promo, discountPercentage: null }, { ...promo, discountPercentage: 'x' },
  { ...promo, discountPercentage: 101 }, { ...promo, collectionId: -1 },
  { ...promo, stackable: 'false' }, { ...promo, startDate: null }]) {
  test('rechaza promoción inválida: ' + JSON.stringify(invalid), () =>
    assert.throws(() => validatePromotion(invalid, 1), /promoción esperada/))
}
test('rutas de promoción y reseñas validan ID antes de enviar cualquier GET', () => {
  assert.equal(promotionPath(7), '/promotions/7')
  assert.equal(reviewPath(42), '/products/42/reviews')
  assert.equal(publicationPath(7), '/products/7')
  for (const invalid of [0, -1, '1/delete', Number.MAX_SAFE_INTEGER + 1, null]) {
    assert.throws(() => promotionPath(invalid), /ID/)
    assert.throws(() => reviewPath(invalid), /ID/)
    assert.throws(() => publicationPath(invalid), /ID/)
  }
})

for (const invalid of [null, {}, { ...quote, total: '90' }, { ...quote, total: -1 },
  { ...quote, promotions: null }, { ...quote, promotions: [{}] }]) {
  test('rechaza cotización inválida: ' + JSON.stringify(invalid), () =>
    assert.throws(() => validateQuote(invalid), /Cotización inválida/))
}
for (const invalid of [null, {}, { ...order, id: -1 }, { ...order, orderDate: 'cualquier texto' },
  { ...order, paymentMethod: 'MERCADO_PAGO' }, { ...order, total: 120 },
  { ...order, items: [] }, { ...order, items: [{ ...order.items[0], quantity: 0 }] },
  { ...order, promotions: undefined }, { ...order, promotions: [{ ...order.promotions[0], discountApplied: null }] }]) {
  test('no considera confirmado el pedido inválido: ' + JSON.stringify(invalid), () =>
    assert.ok(!isConfirmedOrder(invalid, 'TRANSFERENCIA', 90)))
}
test('un error de confirmación ambiguo conserva causa, status y no muta la excepción original', () => {
  const failure = Object.freeze(Object.assign(new TypeError('Red QA'), { status: 503 }))
  const result = ambiguousFailure(failure)
  assert.equal(result.ambiguous, true)
  assert.equal(result.status, 503)
  assert.equal(result.cause, failure)
  assert.equal(failure.ambiguous, undefined)
  const unconfirmed = Object.assign(new Error('HTTP 201 inválido'), { status: 201, ambiguous: true })
  assert.equal(normalizeOrderError(unconfirmed), unconfirmed)
})

for (const [normalize, name] of [
  [normalizeAuthError, 'autenticación'],
  [normalizeAccountError, 'cuenta'],
  [normalizeCartError, 'carrito'],
  [normalizeOrderError, 'pedido'],
  [normalizeProductHttpError, 'productos'],
  [normalizePromotionError, 'promociones'],
  [normalizePublicationError, 'publicaciones'],
  [normalizeReviewError, 'reseñas'],
]) {
  test(name + ': HTTP 401 conserva status para cerrar la sesión', () => {
    const error = normalize(httpFailure(401))
    assert.equal(error.status, 401)
    assert.equal(error.message, 'Tu sesión venció. Volvé a ingresar.')
  })
  test(name + ': HTTP 403 conserva status y mensaje', () => {
    const error = normalize(httpFailure(403))
    assert.equal(error.status, 403)
    assert.equal(error.message, 'Error del servidor')
  })
  test(name + ': el error de red no se convierte artificialmente en HTTP', () => {
    const error = new TypeError('Sin conexión QA')
    assert.ok(!normalize(error)?.status)
  })
}
for (const normalize of [normalizeAccountError, normalizeCartError, normalizeOrderError,
  normalizePromotionError, normalizeReviewError]) {
  test(normalize.name + ': AbortSignal cancela sin publicar error del backend', () => {
    const controller = new AbortController()
    controller.abort()
    assert.equal(normalize({ code: 'ERR_CANCELED' }, controller.signal).name, 'AbortError')
  })
}
for (const invalid of [
  null, {}, { content: [{}], number: 0, totalPages: 1 },
  { content: [{ id: 7, sellerId: 2 }], number: 0, totalPages: 1 },
  { content: [], number: 4, totalPages: 1 }, { content: [], totalPages: -1 },
]) {
  test('listado privado rechaza datos inválidos o ajenos: ' + JSON.stringify(invalid), () =>
    assert.throws(() => validatePublicationsPage(invalid, 0, 1), /página válida/))
}
for (const invalid of [null, { url: 'javascript:alert(1)' }, { url: 'data:text/html,hi' },
  { url: 'ftp://example.invalid/a.png' }, { url: 99 }]) {
  test('URL de foto inválida: ' + JSON.stringify(invalid), () =>
    assert.throws(() => validatePublicationPhoto(invalid), /URL de imagen válida/))
}
