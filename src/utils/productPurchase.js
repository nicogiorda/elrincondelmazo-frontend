export function canBuyProduct(product, userId) {
  return product.status === 'ACTIVO' && product.stock > 0 && product.sellerId !== userId
}
