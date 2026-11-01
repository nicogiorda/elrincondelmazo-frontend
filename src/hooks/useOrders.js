import { useCallback, useEffect, useRef, useState } from 'react'
import { getOrders, getOrderDetail } from '../services/ordersApi.js'

const CACHE_LIFETIME = 60_000
const emptyHistory = () => ({ items: [], updatedAt: 0, loading: false, error: '' })
const summaryFields = ['state', 'orderDate', 'paymentMethod', 'subtotal', 'totalDiscount', 'total']

// Una instancia en App. La navegación no destruye la caché ni sus solicitudes.
export default function useOrders({ user, token, sessionVersion, sessionAbort,
  subscribeSessionChange, logout, setSessionError, active }) {
  const [orderHistory, setOrderHistory] = useState(emptyHistory)
  const [orderDetails, setOrderDetails] = useState({})
  const historyCache = useRef({ items: null, updatedAt: 0 })
  const historyRequest = useRef(null)
  const detailRequests = useRef(new Map())
  const detailCache = useRef({})
  const mounted = useRef(false)

  const publishDetails = useCallback((details) => {
    detailCache.current = details
    setOrderDetails(details)
  }, [])
  const cancelRequests = useCallback(() => {
    historyRequest.current?.controller.abort()
    historyRequest.current = null
    detailRequests.current.forEach(request => request.controller.abort())
    detailRequests.current.clear()
  }, [])
  const resetOrders = useCallback(() => {
    cancelRequests()
    historyCache.current = { items: null, updatedAt: 0 }
    setOrderHistory(emptyHistory())
    publishDetails({})
  }, [cancelRequests, publishDetails])

  useEffect(() => {
    mounted.current = true
    const unsubscribe = subscribeSessionChange(resetOrders)
    return () => {
      mounted.current = false
      unsubscribe()
      // StrictMode vuelve a montar en el mismo turno; el desmontaje real aborta.
      queueMicrotask(() => { if (!mounted.current) cancelRequests() })
    }
  }, [subscribeSessionChange, resetOrders, cancelRequests])

  const loadOrders = useCallback((force = false) => {
    if (!mounted.current || !user?.id || !token) return
    if (historyRequest.current) return historyRequest.current.promise
    const cached = historyCache.current
    if (!force && cached.items !== null && Date.now() - cached.updatedAt < CACHE_LIFETIME) {
      return Promise.resolve(cached.items)
    }
    const version = sessionVersion.current
    const request = { controller: new AbortController() }
    const signal = AbortSignal.any([request.controller.signal, sessionAbort.current.signal])
    historyRequest.current = request
    const isCurrent = () => mounted.current && !signal.aborted
      && version === sessionVersion.current && historyRequest.current === request
    setOrderHistory(current => ({ ...current, loading: true, error: '' }))
    request.promise = getOrders({ token, signal }).then(items => {
      if (!isCurrent()) return
      if (!Array.isArray(items) || !items.every(order => order && Number.isSafeInteger(order.id)
        && typeof order.orderDate === 'string' && typeof order.state === 'string' && Number.isFinite(order.total))) {
        throw new Error('La respuesta de pedidos no contiene una lista válida.')
      }
      const updatedAt = Date.now()
      // Un detalle enviado antes de este listado no puede deshacer su resumen.
      detailRequests.current.forEach(pending => pending.controller.abort())
      detailRequests.current.clear()
      const details = {}
      items.forEach(order => {
        const previous = detailCache.current[order.id]
        if (Array.isArray(order.items) && Array.isArray(order.promotions)) {
          details[order.id] = { data: order, updatedAt, loading: false, error: '' }
        } else if (previous?.data && updatedAt - previous.updatedAt < CACHE_LIFETIME
          && summaryFields.every(field => order[field] === previous.data[field])) {
          details[order.id] = { ...previous, loading: false, error: '' }
        }
      })
      publishDetails(details)
      historyCache.current = { items, updatedAt }
      setOrderHistory({ items, updatedAt, loading: false, error: '' })
      return items
    }).catch(error => {
      if (!isCurrent()) return
      if (error.status === 401) { logout(); setSessionError(error.message) }
      else setOrderHistory(current => ({ ...current, error: 'No pudimos actualizar tus pedidos. ' + error.message }))
    }).finally(() => {
      if (!isCurrent()) return
      historyRequest.current = null
      setOrderHistory(current => ({ ...current, loading: false }))
    })
    return request.promise
  }, [user?.id, token, logout, publishDetails, sessionAbort, sessionVersion, setSessionError])

  useEffect(() => {
    if (!active) return
    let current = true
    Promise.resolve().then(() => { if (current) loadOrders() })
    return () => { current = false }
  }, [active, loadOrders])

  useEffect(() => {
    if (!active || !orderHistory.updatedAt || orderHistory.loading || orderHistory.error) return
    const timer = setTimeout(() => loadOrders(), Math.max(0, orderHistory.updatedAt + CACHE_LIFETIME - Date.now()))
    return () => clearTimeout(timer)
  }, [active, orderHistory.updatedAt, orderHistory.loading, orderHistory.error, loadOrders])

  const loadOrderDetail = useCallback((orderId) => {
    if (!mounted.current || !user?.id || !token) return
    const cached = detailCache.current[orderId]
    if (cached?.data && Date.now() - cached.updatedAt < CACHE_LIFETIME) return Promise.resolve(cached.data)
    if (detailRequests.current.has(orderId)) return detailRequests.current.get(orderId).promise
    const version = sessionVersion.current
    const request = { controller: new AbortController() }
    const signal = AbortSignal.any([request.controller.signal, sessionAbort.current.signal])
    detailRequests.current.set(orderId, request)
    const isCurrent = () => mounted.current && !signal.aborted
      && version === sessionVersion.current && detailRequests.current.get(orderId) === request
    publishDetails({ ...detailCache.current, [orderId]: { ...cached, loading: true, error: '', data: cached?.data ?? null } })
    request.promise = getOrderDetail(orderId, { token, signal }).then(data => {
      if (!isCurrent()) return
      if (data?.id !== orderId || !Array.isArray(data.items)) throw new Error('El detalle recibido no corresponde al pedido.')
      publishDetails({ ...detailCache.current, [orderId]: { loading: false, error: '', data, updatedAt: Date.now() } })
      return data
    }).catch(error => {
      if (!isCurrent()) return
      if (error.status === 401) { logout(); setSessionError(error.message) }
      else publishDetails({ ...detailCache.current, [orderId]: { ...cached, loading: false, error: error.message, data: cached?.data ?? null } })
    }).finally(() => {
      if (isCurrent()) detailRequests.current.delete(orderId)
    })
    return request.promise
  }, [user?.id, token, logout, publishDetails, sessionAbort, sessionVersion, setSessionError])

  // El llamador entrega únicamente una confirmación validada para la sesión actual.
  const recordConfirmedOrder = useCallback((order) => {
    resetOrders()
    publishDetails({ [order.id]: { loading: false, error: '', data: order, updatedAt: Date.now() } })
  }, [resetOrders, publishDetails])

  return { orderHistory, orderDetails, loadOrders, loadOrderDetail, recordConfirmedOrder }
}
