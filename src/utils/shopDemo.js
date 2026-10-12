import { canBuyProduct } from './productPurchase.js'
import { calculateMockSummary } from '../data/purchaseMocks.js'

// Funciones normales sobre el estado en memoria de App; no son hooks ni servicios.
export function resolveCart(shop) {
  return shop.cart.map((item) => ({ ...item, product: shop.products.find((product) => product.id === item.productId) }))
}

export function addCartItem(shop, productId, quantity, userId) {
  const product = shop.products.find((item) => item.id === productId)
  if (!product || !canBuyProduct(product, userId) || !Number.isInteger(quantity) || quantity < 1) return shop
  const existing = shop.cart.find((item) => item.productId === productId)
  const available = product.stock - (existing?.quantity ?? 0)
  if (available < 1) return shop
  const added = Math.min(quantity, available)
  const cart = existing
    ? shop.cart.map((item) => item.id === existing.id ? { ...item, quantity: item.quantity + added } : item)
    : [...shop.cart, { id: Math.max(0, ...shop.cart.map((item) => item.id)) + 1, productId, quantity: added }]
  return { ...shop, cart, checkoutError: '' }
}

export function changeCartQuantity(shop, id, quantity, userId) {
  const item = shop.cart.find((entry) => entry.id === id)
  const product = shop.products.find((entry) => entry.id === item?.productId)
  if (!product || !canBuyProduct(product, userId) || !Number.isInteger(quantity)
    || quantity < 1 || quantity > product.stock) return shop
  return { ...shop, cart: shop.cart.map((entry) => entry.id === id ? { ...entry, quantity } : entry), checkoutError: '' }
}

export function checkoutError(shop, userId) {
  if (!shop.cart.length) return 'Tu carrito está vacío. Agregá productos antes de confirmar.'
  for (const item of shop.cart) {
    const product = shop.products.find((entry) => entry.id === item.productId)
    if (!product) return 'Un producto ya no está disponible. Revisá tu carrito.'
    if (!canBuyProduct(product, userId)) return `No podés comprar ${product.name}. Revisá tu carrito.`
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > product.stock) {
      return `Revisá la cantidad de ${product.name}: supera el stock o no es válida.`
    }
  }
  return ''
}

export function completeOrder(shop, userId, paymentMethod, expectedOrderId, date) {
  // Una confirmación ya procesada no vuelve a crear pedidos ni descontar stock.
  if (shop.nextOrderId !== expectedOrderId) return shop
  const error = checkoutError(shop, userId)
  if (error) return { ...shop, checkoutError: error }
  const items = resolveCart(shop).map((item) => ({ id: item.id, quantity: item.quantity,
    product: { ...item.product, imageUrls: [...item.product.imageUrls] } }))
  const summary = calculateMockSummary(items, paymentMethod)
  const order = { id: shop.nextOrderId, date, status: 'PENDIENTE', paymentMethod,
    items, summary, total: summary.total, discounts: summary.discounts }
  const products = shop.products.map((product) => {
    const item = shop.cart.find((entry) => entry.productId === product.id)
    if (!item) return product
    const stock = product.stock - item.quantity
    return { ...product, stock, status: stock === 0 ? 'AGOTADO' : product.status }
  })
  return { ...shop, products, cart: [], orders: [order, ...shop.orders],
    nextOrderId: shop.nextOrderId + 1, lastOrderId: order.id, checkoutError: '' }
}
