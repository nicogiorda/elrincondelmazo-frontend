// Configuración visual y valores iniciales del formulario; sin promociones comerciales de ejemplo.
export const promotionKinds = [
  { value: 'quantity', label: 'Por cantidad', description: 'Llevando X unidades o más' },
  { value: 'collection', label: 'Por colección', description: 'Toda una colección' },
  { value: 'type', label: 'Por tipo', description: 'Cartas, sobres o lootboxes' },
  { value: 'payment', label: 'Por medio de pago', description: 'Según cómo se pague' },
  { value: 'minimum', label: 'Monto mínimo', description: 'Desde cierto total' },
  { value: 'product', label: 'Producto puntual', description: 'Un solo producto' },
]
export const emptyPromotion = { name: '', description: '', kind: 'quantity', discount: 15, minimumQuantity: 3, productType: 'SOBRE', collectionId: '', paymentMethod: 'TRANSFERENCIA', minimumAmount: 50000, productId: '', startDate: '', endDate: '', enabled: true, stackable: true }
export function promotionStatus(promotion) {
  if (!promotion.enabled) return 'Inactiva';

  const now = new Date();
  // LocalDateTime no tiene zona: interpretar como hora local, sin convertir a UTC.
  const start = promotion.startDate.includes('T')
    ? promotion.startDate : `${promotion.startDate}T00:00:00`;
  const end = promotion.endDate && (promotion.endDate.includes('T')
    ? promotion.endDate : `${promotion.endDate}T23:59:59`);

  if (new Date(start) > now) return 'Programada';
  if (end && new Date(end) < now) return 'Vencida';

  return 'Activa';
}

export function promotionPeriod(promotion) {
  const format = (date) => date.slice(0, 10).split('-').reverse().join('/')
  if (!promotion.startDate) return ''
  return promotion.endDate ? `${format(promotion.startDate)} al ${format(promotion.endDate)}` : `Desde ${format(promotion.startDate)} · sin fecha de fin`
}
export function promotionCondition(promotion, collections, products, payments) {
  const typeNames = { CARTA: 'cartas', SOBRE: 'sobres', LOOTBOX: 'lootboxes' }
  if (promotion.kind === 'quantity') return `Llevando ${promotion.minimumQuantity} o más ${typeNames[promotion.productType] ?? 'productos'}`
  if (promotion.kind === 'collection') return `Productos de ${collections.find((item) => item.id === Number(promotion.collectionId))?.name ?? promotion.collectionName ?? ''}`
  if (promotion.kind === 'type') return `Solo ${typeNames[promotion.productType] ?? 'productos'}`
  if (promotion.kind === 'payment') return `Pagando con ${payments.find((item) => item.value === promotion.paymentMethod)?.label.toLocaleLowerCase('es-AR') ?? ''}`
  if (promotion.kind === 'minimum') return `Compras desde $ ${Number(promotion.minimumAmount).toLocaleString('es-AR')}`
  return products.find((item) => item.id === Number(promotion.productId))?.name ?? promotion.productName ?? ''
}
