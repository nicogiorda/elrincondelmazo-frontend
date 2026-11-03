import axios from 'axios'
import { API_BASE_URL } from './httpClient.js'

// El servicio solo hace HTTP y valida los contratos del backend. Ni el token ni
// los intentos de compra se conservan en este modulo.
export function normalizeOrderError(error, signal) {
  if (signal?.aborted) return signal.reason ?? new DOMException('Solicitud cancelada', 'AbortError')
  if (error?.name === 'AbortError') return error
  if (error?.code === 'ERR_CANCELED') return new DOMException('Solicitud cancelada', 'AbortError')
  const status = error?.response?.status ?? error?.status
  if (status != null) {
    const data = error?.response?.data
    const message = status === 401 ? 'Tu sesión venció. Volvé a ingresar.'
      : data?.message || data?.detail || error?.message
        || 'No se pudo completar la operación (HTTP ' + status + ').'
    return Object.assign(new Error(message), { status })
  }
  if (error?.code === 'ERR_NETWORK') {
    return Object.assign(new TypeError(error.message || 'Network Error', { cause: error }), {
      code: error.code,
    })
  }
  return error
}

async function orderRequest(path, { method = 'GET', token, signal, body } = {}) {
  try {
    const response = await axios.request({
      url: API_BASE_URL + path, method, signal,
      ...(token ? { headers: { Authorization: 'Bearer ' + token } } : {}),
      ...(body !== undefined ? { data: body } : {}),
    })
    signal?.throwIfAborted()
    if (response.status < 200 || response.status >= 300) {
      throw { response: { status: response.status, data: response.data } }
    }
    return {
      status: response.status,
      data: response.data == null || response.data === '' ? {} : response.data,
    }
  } catch (error) {
    throw normalizeOrderError(error, signal)
  }
}

export async function previewOrder(paymentMethod, { token, signal } = {}) {
  const { data } = await orderRequest('/orders/preview', {
    method: 'POST', token, signal, body: { paymentMethod },
  })
  return data
}

export function validateQuote(quote) {
  if (!quote || !['subtotal', 'totalDiscount', 'total'].every(field => Number.isFinite(quote[field]) && quote[field] >= 0)
    || !Array.isArray(quote.promotions)
    || !quote.promotions.every(promotion => promotion && typeof promotion.promotionName === 'string'
      && Number.isFinite(promotion.discountApplied))) throw new Error('Cotización inválida.')
  return quote
}

const money = value => Number.isFinite(value) && value >= 0
const positiveId = value => Number.isSafeInteger(value) && value > 0
const hasText = value => typeof value === 'string' && value.trim().length > 0

export function isConfirmedOrder(order, paymentMethod, expectedTotal) {
  return order && positiveId(order.id) && hasText(order.orderDate) && Number.isFinite(Date.parse(order.orderDate))
    && hasText(order.state) && order.paymentMethod === paymentMethod
    && money(order.subtotal) && money(order.totalDiscount) && money(order.total) && order.total === expectedTotal
    && Array.isArray(order.items) && order.items.length > 0
    && order.items.every(item => item && positiveId(item.productId) && hasText(item.productName)
      && Number.isSafeInteger(item.quantity) && item.quantity > 0 && money(item.price))
    && Array.isArray(order.promotions) && order.promotions.every(promotion => promotion
      && positiveId(promotion.promotionId) && hasText(promotion.promotionName) && money(promotion.discountApplied))
}

// Un HTTP 5xx, aborto, error de red o 201 invalido no demuestra que la orden
// NO se haya creado. Mantener la misma requestKey evita compras duplicadas.
export function ambiguousFailure(error) {
  const copy = error instanceof TypeError
    ? new TypeError(error.message, { cause: error }) : new Error(error.message, { cause: error })
  return Object.assign(copy, {
    name: error.name, status: error.status, code: error.code, ambiguous: true,
  })
}

export async function createOrder({ paymentMethod, expectedTotal, requestKey }, { token, signal } = {}) {
  try {
    const { status, data } = await orderRequest('/orders', {
      method: 'POST', token, signal, body: { paymentMethod, expectedTotal, requestKey },
    })
    if (status !== 201 || !isConfirmedOrder(data, paymentMethod, expectedTotal)) {
      throw Object.assign(new Error('La respuesta no contiene el detalle del pedido. Revisá tus pedidos antes de reintentar.'), {
        status, ambiguous: true,
      })
    }
    return data
  } catch (error) {
    if (error.ambiguous || !error.status || error.status >= 500) throw ambiguousFailure(error)
    throw error
  }
}

export async function getOrders({ token, signal } = {}) {
  const { data } = await orderRequest('/orders', { token, signal })
  return data
}

export async function getOrderDetail(orderId, { token, signal } = {}) {
  const { data } = await orderRequest('/orders/' + orderId, { token, signal })
  return data
}
