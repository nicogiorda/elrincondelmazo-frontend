import { useCallback, useEffect, useRef } from 'react'
import { useDispatch, useSelector, useStore } from 'react-redux'
import {
  ORDERS_CACHE_TTL, ordersSessionCleared, ordersConfirmed,
  fetchOrdersHistory, fetchOrderDetail,
} from '../Redux/ordersSlice.js'

// Única instancia en App: Redux guarda el estado privado, el hook coordina
// solicitudes y cancelaciones. Navegar no destruye una lectura pendiente.
export default function useOrders({ user, token, sessionVersion, sessionAbort,
  subscribeSessionChange, logout, setSessionError, active }) {
  const userId = user?.id
  const dispatch = useDispatch()
  const store = useStore()
  const orderHistory = useSelector((state) => state.orders.history)
  const orderDetails = useSelector((state) => state.orders.details)
  const historyRequest = useRef(null)
  const detailRequests = useRef(new Map())
  const mounted = useRef(false)

  const cancelRequests = useCallback(() => {
    historyRequest.current?.controller.abort()
    historyRequest.current = null
    detailRequests.current.forEach((request) => request.controller.abort())
    detailRequests.current.clear()
  }, [])
  const resetOrders = useCallback(() => {
    cancelRequests()
    dispatch(ordersSessionCleared())
  }, [cancelRequests, dispatch])

  useEffect(() => {
    mounted.current = true
    const unsubscribe = subscribeSessionChange(resetOrders)
    return () => {
      mounted.current = false
      unsubscribe()
      // StrictMode vuelve a montar efectos en el mismo turno.
      queueMicrotask(() => { if (!mounted.current) cancelRequests() })
    }
  }, [subscribeSessionChange, resetOrders, cancelRequests])

  const loadOrders = useCallback((force = false) => {
    if (!mounted.current || !userId || !token) return
    if (historyRequest.current) return historyRequest.current.promise
    const version = sessionVersion.current
    const previous = store.getState().orders
    if (!force && previous.ownerId === userId && previous.generation === version
      && previous.history.updatedAt > 0 && Date.now() - previous.history.updatedAt < ORDERS_CACHE_TTL) {
      return Promise.resolve(previous.history.items)
    }
    const scope = { ownerId: userId, generation: version }
    const request = { controller: new AbortController() }
    const signal = AbortSignal.any([request.controller.signal, sessionAbort.current.signal])
    historyRequest.current = request
    const isCurrent = () => mounted.current && !signal.aborted
      && version === sessionVersion.current && historyRequest.current === request
    request.promise = dispatch(fetchOrdersHistory(scope, { signal })).unwrap()
      .then(({ items }) => {
        if (!isCurrent()) return
        // Un nuevo historial invalida los detalles en curso; el slice preserva
        // únicamente los detalles compatibles con las filas actualizadas.
        detailRequests.current.forEach(pending => pending.controller.abort())
        detailRequests.current.clear()
        return items
      }).catch(error => {
        if (!isCurrent()) return
        if (error.status === 401) { logout(); setSessionError(error.message) }
      }).finally(() => {
        if (historyRequest.current === request) historyRequest.current = null
      })
    return request.promise
  }, [userId, token, logout, store, dispatch, sessionAbort, sessionVersion, setSessionError])

  useEffect(() => {
    if (!active) return
    let current = true
    Promise.resolve().then(() => { if (current) loadOrders() })
    return () => { current = false }
  }, [active, loadOrders])

  useEffect(() => {
    if (!active || !orderHistory.updatedAt || orderHistory.loading || orderHistory.error) return
    const timer = setTimeout(() => loadOrders(), Math.max(0, orderHistory.updatedAt + ORDERS_CACHE_TTL - Date.now()))
    return () => clearTimeout(timer)
  }, [active, orderHistory.updatedAt, orderHistory.loading, orderHistory.error, loadOrders])

  const loadOrderDetail = useCallback((orderId) => {
    if (!mounted.current || !userId || !token) return
    const version = sessionVersion.current
    const existing = store.getState().orders
    const cached = existing.ownerId === userId && existing.generation === version
      ? existing.details[orderId] : undefined
    if (cached?.data && Date.now() - cached.updatedAt < ORDERS_CACHE_TTL) return Promise.resolve(cached.data)
    if (detailRequests.current.has(orderId)) return detailRequests.current.get(orderId).promise
    const scope = { ownerId: userId, generation: version }
    const request = { controller: new AbortController() }
    const signal = AbortSignal.any([request.controller.signal, sessionAbort.current.signal])
    detailRequests.current.set(orderId, request)
    const isCurrent = () => mounted.current && !signal.aborted
      && version === sessionVersion.current && detailRequests.current.get(orderId) === request
    request.promise = dispatch(fetchOrderDetail({ ...scope, orderId }, { signal })).unwrap()
      .then(({ data }) => isCurrent() ? data : undefined)
      .catch(error => {
        if (isCurrent() && error.status === 401) { logout(); setSessionError(error.message) }
      }).finally(() => {
        if (detailRequests.current.get(orderId) === request) detailRequests.current.delete(orderId)
      })
    return request.promise
  }, [userId, token, logout, dispatch, store, sessionAbort, sessionVersion, setSessionError])

  // El checkout ya validó que la confirmación pertenece a la sesión vigente.
  const recordConfirmedOrder = useCallback((order) => {
    if (!userId) return
    cancelRequests()
    dispatch(ordersConfirmed({
      ownerId: userId, generation: sessionVersion.current, order, updatedAt: Date.now(),
    }))
  }, [userId, sessionVersion, cancelRequests, dispatch])

  return { orderHistory, orderDetails, loadOrders, loadOrderDetail, recordConfirmedOrder }
}
