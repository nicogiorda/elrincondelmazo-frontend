import assert from 'node:assert/strict'
import test from 'node:test'
import { validateQuote } from '../src/hooks/useCheckoutQuote.js'

const valid = { subtotal: 100, totalDiscount: 10, total: 90,
  promotions: [{ promotionName: 'Transferencia', discountApplied: 10 }] }

test('La cotización conserva exactamente los importes calculados por el servidor', () => {
  assert.equal(validateQuote(valid), valid)
  const free = { subtotal: 100, totalDiscount: 100, total: 0, promotions: [] }
  assert.equal(validateQuote(free), free)
})
for (const [name, value] of [
  ['vacía', null], ['sin datos', {}], ['total textual', { ...valid, total: '90' }],
  ['total negativo', { ...valid, total: -1 }], ['subtotal inválido', { ...valid, subtotal: NaN }],
  ['descuento inválido', { ...valid, totalDiscount: Infinity }],
  ['promociones ausentes', { ...valid, promotions: null }],
  ['promoción sin datos', { ...valid, promotions: [null] }],
  ['promoción sin importe', { ...valid, promotions: [{ promotionName: 'QA' }] }],
]) test('Cotización ' + name + ' no permite confirmar', () => {
  assert.throws(() => validateQuote(value), { message: 'Cotización inválida.' })
})
