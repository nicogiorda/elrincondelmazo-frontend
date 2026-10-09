import { getMockProduct } from './productMocks.js'

// Carrito, pedidos y descuentos locales para recorrer Figma; sin integración ni DTO asumido.
export const cartItems = [
  { id: 1, product: getMockProduct(3), quantity: 1 },
  { id: 2, product: getMockProduct(5), quantity: 3 },
  { id: 3, product: getMockProduct(7), quantity: 1 },
]
export const orderMocks = [
  { id: 1051, date: '01/10/2026', paymentMethod: 'MERCADO_PAGO', status: 'PAGO', total: 21000, discounts: [], items: [
    { id: 1, quantity: 1, product: getMockProduct(16) },
    { id: 2, quantity: 2, product: getMockProduct(17) },
  ] },
  { id: 1047, date: '28/09/2026', paymentMethod: 'TARJETA_DE_CREDITO', status: 'ENVIADO', total: 38600, discounts: [], items: [{ id: 1, quantity: 1, product: getMockProduct(4) }, { id: 2, quantity: 2, product: getMockProduct(5) }] },
  { id: 1032, date: '14/09/2026', paymentMethod: 'TRANSFERENCIA', status: 'ENTREGADO', total: 20700, discounts: [{ label: '15% llevando 3 sobres o más', amount: 4140 }, { label: '10% pagando con transferencia', amount: 2760 }], items: [{ id: 1, quantity: 4, product: getMockProduct(2) }] },
  { id: 1019, date: '02/09/2026', paymentMethod: 'TARJETA_DE_DEBITO', status: 'CANCELADO', total: 21500, discounts: [], items: [{ id: 1, quantity: 1, product: getMockProduct(9) }] },
]
export const confirmationMock = { id: 1052, date: '05/10/2026', status: 'PENDIENTE' }

export function formatPrice(value) {
  return `$ ${value.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`
}

// Reglas del ejemplo visual: descuentos acumulados sobre el subtotal original, como en Figma.
// Se reemplazarán por el resumen que entregue el backend al integrar las promociones.
export function calculateMockSummary(items, paymentMethod = '') {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.product.price, 0)
  const envelopes = items.filter((item) => item.product.type === 'SOBRE')
  const envelopeCount = envelopes.reduce((sum, item) => sum + item.quantity, 0)
  const discounts = []
  if (envelopeCount >= 3) discounts.push({ label: '15% llevando 3 sobres o más', amount: Math.round(envelopes.reduce((sum, item) => sum + item.quantity * item.product.price, 0) * 0.15) })
  if (subtotal >= 50000) discounts.push({ label: '5% en compras desde $ 50.000', amount: Math.round(subtotal * 0.05) })
  if (paymentMethod === 'TRANSFERENCIA') discounts.push({ label: '10% pagando con transferencia', amount: Math.round(subtotal * 0.1) })
  const savings = discounts.reduce((sum, discount) => sum + discount.amount, 0)
  return { subtotal, discounts, savings, total: subtotal - savings }
}
