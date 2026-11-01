const promotionTypes = {
  quantity: 'CANTIDAD',
  collection: 'COLECCION',
  type: 'TIPO_PRODUCTO',
  payment: 'METODO_PAGO',
  minimum: 'MONTO_MINIMO',
  product: 'PRODUCTO',
};

const frontendPromotionTypes = Object.fromEntries(
  Object.entries(promotionTypes).map(([key, value]) => [value, key])
);

export function promotionFromBackend(promotion) {
  return {
    id: promotion.id,
    name: promotion.name,
    description: promotion.description ?? '',
    kind: frontendPromotionTypes[promotion.type],
    discount: Number(promotion.discountPercentage),
    minimumQuantity: promotion.minimumQuantity ?? 1,
    minimumAmount: Number(promotion.minimumAmount ?? 0),
    productType: promotion.productType ?? '',
    paymentMethod: promotion.paymentMethod ?? '',
    collectionId: promotion.collectionId ?? '',
    collectionName: promotion.collectionName ?? '',
    productId: promotion.productId ?? '',
    productName: promotion.productName ?? '',
    stackable: promotion.stackable,
    startDate: promotion.startDate ?? '',
    endDate: promotion.endDate ?? '',
    enabled: promotion.active,
  };
}

export function promotionToBackend(promotion) {
  const kind = promotion.kind;
  if (kind === 'type' && !['CARTA', 'SOBRE', 'LOOTBOX'].includes(promotion.productType)) {
    throw new Error('Seleccioná un tipo de producto válido.');
  }

  return {
    name: promotion.name.trim(),
    description: promotion.description,
    type: promotionTypes[kind],
    discountPercentage: Number(promotion.discount),

    minimumQuantity: kind === 'quantity'
      ? Number(promotion.minimumQuantity) : null,

    minimumAmount: kind === 'minimum'
      ? Number(promotion.minimumAmount) : null,

    productType: ['type', 'quantity'].includes(kind)
      ? promotion.productType || null : null,

    paymentMethod: kind === 'payment'
      ? promotion.paymentMethod || null : null,

    collectionId: kind === 'collection'
      ? Number(promotion.collectionId) : null,

    productId: kind === 'product'
      ? Number(promotion.productId) : null,

    stackable: promotion.stackable,

    startDate: promotion.startDate.includes('T')
      ? promotion.startDate : `${promotion.startDate}T00:00:00`,

    endDate: promotion.endDate
      ? (promotion.endDate.includes('T') ? promotion.endDate : `${promotion.endDate}T23:59:59`)
      : null,
  };
}
