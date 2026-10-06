import { publicationProducts } from './accountMocks.js'
import { catalogProducts } from './catalogMocks.js'

// Carrito, pedidos y descuentos locales para recorrer Figma; sin integración ni DTO asumido.
export const cartItems = [
  { id: 1, product: publicationProducts[0], quantity: 1 },
  { id: 2, product: catalogProducts[4], quantity: 3 },
  { id: 3, product: catalogProducts[6], quantity: 1 },
]
export const paymentMethods = ['Tarjeta de crédito', 'Tarjeta de débito', 'Mercado Pago', 'Transferencia']
export const orderMocks = [
  { id: 1051, date: '01/10/2026', paymentMethod: 'Mercado Pago', status: 'PAGADO', total: 21000, discounts: [], items: [
    { id: 1, quantity: 1, product: { id: 16, name: 'Twilight Sparkle Rara', price: 12000, type: 'CARTA', stock: 2, status: 'ACTIVO', imageUrls: [], sellerId: 1, sellerName: 'Rincón oficial', collectionId: 2, collectionName: 'My Little Pony' } },
    { id: 2, quantity: 2, product: { id: 17, name: 'Sobre My Little Pony Friendship', price: 4500, type: 'SOBRE', stock: 10, status: 'ACTIVO', imageUrls: [], sellerId: 1, sellerName: 'Rincón oficial', collectionId: 2, collectionName: 'My Little Pony' } },
  ] },
  { id: 1047, date: '28/09/2026', paymentMethod: 'Tarjeta de crédito', status: 'ENVIADO', total: 38600, discounts: [], items: [{ id: 1, quantity: 1, product: catalogProducts[3] }, { id: 2, quantity: 2, product: catalogProducts[4] }] },
  { id: 1032, date: '14/09/2026', paymentMethod: 'Transferencia', status: 'ENTREGADO', total: 20700, discounts: [{ label: '15% llevando 3 sobres o más', amount: 4140 }, { label: '10% pagando con transferencia', amount: 2760 }], items: [{ id: 1, quantity: 4, product: catalogProducts[1] }] },
  { id: 1019, date: '02/09/2026', paymentMethod: 'Tarjeta de débito', status: 'CANCELADO', total: 21500, discounts: [], items: [{ id: 1, quantity: 1, product: catalogProducts[8] }] },
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
  if (paymentMethod === 'Transferencia') discounts.push({ label: '10% pagando con transferencia', amount: Math.round(subtotal * 0.1) })
  const savings = discounts.reduce((sum, discount) => sum + discount.amount, 0)
  return { subtotal, discounts, savings, total: subtotal - savings }
}
