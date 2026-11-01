import { request, requestJson, readResponse } from './httpClient.js'

export function previewOrder(paymentMethod, { token, signal } = {}) {
  return requestJson('/orders/preview', { method: 'POST', token, signal, body: { paymentMethod } })
}

const money = value => Number.isFinite(value) && value >= 0
const positiveId = value => Number.isSafeInteger(value) && value > 0
const hasText = value => typeof value === 'string' && value.trim().length > 0

function isConfirmedOrder(order, paymentMethod, expectedTotal) {
  return order && positiveId(order.id) && hasText(order.orderDate) && Number.isFinite(Date.parse(order.orderDate))
    && hasText(order.state) && order.paymentMethod === paymentMethod
    && money(order.subtotal) && money(order.totalDiscount) && money(order.total) && order.total === expectedTotal
    && Array.isArray(order.items) && order.items.length > 0
    && order.items.every(item => item && positiveId(item.productId) && hasText(item.productName)
      && Number.isSafeInteger(item.quantity) && item.quantity > 0 && money(item.price))
    && Array.isArray(order.promotions) && order.promotions.every(promotion => promotion
      && positiveId(promotion.promotionId) && hasText(promotion.promotionName) && money(promotion.discountApplied))
}

// Un fallo de transporte o una respuesta que no confirma el contrato no prueba
// que la transacción haya fallado. El llamador conserva el mismo intento lógico.
function ambiguousFailure(error) {
  const copy = error instanceof TypeError
    ? new TypeError(error.message, { cause: error }) : new Error(error.message, { cause: error })
  return Object.assign(copy, { name: error.name, status: error.status, code: error.code, ambiguous: true })
}

export async function createOrder({ paymentMethod, expectedTotal, requestKey }, { token, signal } = {}) {
  try {
    const response = await request('/orders', {
      method: 'POST', token, signal, body: { paymentMethod, expectedTotal, requestKey },
    })
    const order = await readResponse(response)
    if (response.status !== 201 || !isConfirmedOrder(order, paymentMethod, expectedTotal)) {
      throw Object.assign(new Error('La respuesta no contiene el detalle del pedido. Revisá tus pedidos antes de reintentar.'), {
        status: response.status, ambiguous: true,
      })
    }
    return order
  } catch (error) {
    if (error.ambiguous || !error.status || error.status >= 500) throw ambiguousFailure(error)
    throw error
  }
}

export function getOrders({ token, signal } = {}) {
  return requestJson('/orders', { token, signal })
}

export function getOrderDetail(orderId, { token, signal } = {}) {
  return requestJson('/orders/' + orderId, { token, signal })
}
