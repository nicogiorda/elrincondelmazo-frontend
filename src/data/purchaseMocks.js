import { getMockProduct } from './productMocks.js'

// Pedidos de demostración de la pantalla de mi compañero, aún no integrada.
export const orderMocks = [
  { id: 1051, date: '01/10/2026', paymentMethod: 'MERCADO_PAGO', status: 'PAGO', total: 21000, discounts: [], items: [
    { id: 1, quantity: 1, product: getMockProduct(16) },
    { id: 2, quantity: 2, product: getMockProduct(17) },
  ] },
  { id: 1047, date: '28/09/2026', paymentMethod: 'TARJETA_DE_CREDITO', status: 'ENVIADO', total: 38600, discounts: [], items: [{ id: 1, quantity: 1, product: getMockProduct(4) }, { id: 2, quantity: 2, product: getMockProduct(5) }] },
  { id: 1032, date: '14/09/2026', paymentMethod: 'TRANSFERENCIA', status: 'ENTREGADO', total: 20700, discounts: [{ label: '15% llevando 3 sobres o más', amount: 4140 }, { label: '10% pagando con transferencia', amount: 2760 }], items: [{ id: 1, quantity: 4, product: getMockProduct(2) }] },
  { id: 1019, date: '02/09/2026', paymentMethod: 'TARJETA_DE_DEBITO', status: 'CANCELADO', total: 21500, discounts: [], items: [{ id: 1, quantity: 1, product: getMockProduct(9) }] },
]

export { formatPrice } from '../utils/formatPrice.js'
