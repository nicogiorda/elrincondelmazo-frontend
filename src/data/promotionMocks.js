// Datos de presentación de Figma. No son DTOs ni enums confirmados del backend.
export const promotionMockDate = '2026-10-05'
export const promotionKinds = [
  { value: 'quantity', label: 'Por cantidad', description: 'Llevando X unidades o más' },
  { value: 'collection', label: 'Por colección', description: 'Toda una colección' },
  { value: 'type', label: 'Por tipo', description: 'Cartas, sobres o lootboxes' },
  { value: 'payment', label: 'Por medio de pago', description: 'Según cómo se pague' },
  { value: 'minimum', label: 'Monto mínimo', description: 'Desde cierto total' },
  { value: 'product', label: 'Producto puntual', description: 'Un solo producto' },
]
export const emptyPromotion = { name: '', description: '', kind: 'quantity', discount: 15, minimumQuantity: 3, productType: 'SOBRE', collectionId: 4, paymentMethod: 'TRANSFERENCIA', minimumAmount: 50000, productId: 1, startDate: '', endDate: '', enabled: true, stackable: true }
export const promotionMocks = [
  { ...emptyPromotion, id: 1, name: '15% llevando 3 sobres o más', description: 'Válido para sobres de cualquier colección.', startDate: '2026-09-01', endDate: '2026-12-31' },
  { ...emptyPromotion, id: 2, name: '5% en compras desde $ 50.000', kind: 'minimum', discount: 5, startDate: '2026-08-01' },
  { ...emptyPromotion, id: 3, name: '10% pagando con transferencia', kind: 'payment', discount: 10, startDate: '2026-01-01' },
  { ...emptyPromotion, id: 4, name: 'Semana Marvel', kind: 'collection', discount: 20, startDate: '2026-10-20', endDate: '2026-10-27', stackable: false },
  { ...emptyPromotion, id: 5, name: 'Hot Sale NBA', kind: 'collection', collectionId: 1, discount: 12, startDate: '2026-05-11', endDate: '2026-05-13', stackable: false },
  { ...emptyPromotion, id: 6, name: 'Lootboxes 10% off', kind: 'type', productType: 'LOOTBOX', discount: 10, startDate: '2026-09-15', enabled: false },
]
export function promotionStatus(promotion) {
  if (!promotion.enabled) return 'Inactiva'
  if (promotion.startDate > promotionMockDate) return 'Programada'
  if (promotion.endDate && promotion.endDate < promotionMockDate) return 'Vencida'
  return 'Activa'
}
export function promotionPeriod(promotion) {
  const format = (date) => date.split('-').reverse().join('/')
  if (!promotion.startDate) return ''
  return promotion.endDate ? `${format(promotion.startDate)} al ${format(promotion.endDate)}` : `Desde ${format(promotion.startDate)} · sin fecha de fin`
}
export function promotionCondition(promotion, collections, products, payments) {
  const typeNames = { CARTA: 'cartas', SOBRE: 'sobres', LOOTBOX: 'lootboxes' }
  if (promotion.kind === 'quantity') return `Llevando ${promotion.minimumQuantity} o más ${typeNames[promotion.productType] ?? 'productos'}`
  if (promotion.kind === 'collection') return `Productos de ${collections.find((item) => item.id === Number(promotion.collectionId))?.name ?? ''}`
  if (promotion.kind === 'type') return `Solo ${typeNames[promotion.productType] ?? 'productos'}`
  if (promotion.kind === 'payment') return `Pagando con ${payments.find((item) => item.value === promotion.paymentMethod)?.label.toLocaleLowerCase('es-AR') ?? ''}`
  if (promotion.kind === 'minimum') return `Compras desde $ ${Number(promotion.minimumAmount).toLocaleString('es-AR')}`
  return products.find((item) => item.id === Number(promotion.productId))?.name ?? ''
}
