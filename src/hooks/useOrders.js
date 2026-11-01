import { useCallback, useEffect, useRef } from 'react'
import { useDispatch, useSelector, useStore } from 'react-redux'
import { getOrders, getOrderDetail } from '../services/ordersApi.js'
import {
  ORDERS_CACHE_TTL, ordersSessionCleared, ordersHistoryStarted,
  ordersHistoryLoaded, ordersHistoryFailed, ordersHistoryFinished,
  ordersDetailStarted, ordersDetailLoaded, ordersDetailFailed, ordersConfirmed,
} from '../Redux/ordersSlice.js'

// Única instancia en App: Redux guarda el estado privado, el hook coordina
// solicitudes y cancelaciones. Navegar no destruye una lectura pendiente.
export default function useOrders({ user, token, sessionVersion, sessionAbort,
  subscribeSessionChange, logout, setSessionError, active }) {
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
    if (!mounted.current || !user?.id || !token) return
    if (historyRequest.current) return historyRequest.current.promise
    const version = sessionVersion.current
    const previous = store.getState().orders
    if (!force && previous.ownerId === user.id && previous.generation === version
      && previous.history.updatedAt > 0 && Date.now() - previous.history.updatedAt < ORDERS_CACHE_TTL) {
      return Promise.resolve(previous.history.items)
    }
    const scope = { ownerId: user.id, generation: version }
    const request = { controller: new AbortController() }
    const signal = AbortSignal.any([request.controller.signal, sessionAbort.current.signal])
    historyRequest.current = request
    const isCurrent = () => mounted.current && !signal.aborted
      && version === sessionVersion.current && historyRequest.current === request
    dispatch(ordersHistoryStarted(scope))
    request.promise = getOrders({ token, signal }).then((items) => {
      if (!isCurrent()) return
      if (!Array.isArray(items) || !items.every(order => order && Number.isSafeInteger(order.id)
        && typeof order.orderDate === 'string' && typeof order.state === 'string' && Number.isFinite(order.total))) {
        throw new Error('La respuesta de pedidos no contiene una lista válida.')
      }
      // Un detalle anterior a un listado actualizado no debe sobrescribirlo.
      detailRequests.current.forEach((pending) => pending.controller.abort())
      detailRequests.current.clear()
      dispatch(ordersHistoryLoaded({ ...scope, items, updatedAt: Date.now() }))
      return items
    }).catch((error) => {
      if (!isCurrent()) return
      if (error.status === 401) { logout(); setSessionError(error.message) }
      else dispatch(ordersHistoryFailed({ ...scope,
        message: 'No pudimos actualizar tus pedidos. ' + error.message }))
    }).finally(() => {
      if (!isCurrent()) return
      historyRequest.current = null
      dispatch(ordersHistoryFinished(scope))
    })
    return request.promise
  }, [user?.id, token, logout, store, dispatch, sessionAbort, sessionVersion, setSessionError])

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
    if (!mounted.current || !user?.id || !token) return
    const version = sessionVersion.current
    const existing = store.getState().orders
    const cached = existing.ownerId === user.id && existing.generation === version
      ? existing.details[orderId] : undefined
    if (cached?.data && Date.now() - cached.updatedAt < ORDERS_CACHE_TTL) return Promise.resolve(cached.data)
    if (detailRequests.current.has(orderId)) return detailRequests.current.get(orderId).promise
    const scope = { ownerId: user.id, generation: version }
    const request = { controller: new AbortController() }
    const signal = AbortSignal.any([request.controller.signal, sessionAbort.current.signal])
    detailRequests.current.set(orderId, request)
    const isCurrent = () => mounted.current && !signal.aborted
      && version === sessionVersion.current && detailRequests.current.get(orderId) === request
    dispatch(ordersDetailStarted({ ...scope, orderId }))
    request.promise = getOrderDetail(orderId, { token, signal }).then((data) => {
      if (!isCurrent()) return
      if (data?.id !== orderId || !Array.isArray(data.items)) {
        throw new Error('El detalle recibido no corresponde al pedido.')
      }
      dispatch(ordersDetailLoaded({ ...scope, orderId, data, updatedAt: Date.now() }))
      return data
    }).catch((error) => {
      if (!isCurrent()) return
      if (error.status === 401) { logout(); setSessionError(error.message) }
      else dispatch(ordersDetailFailed({ ...scope, orderId, message: error.message }))
    }).finally(() => {
      if (isCurrent()) detailRequests.current.delete(orderId)
    })
    return request.promise
  }, [user?.id, token, logout, dispatch, store, sessionAbort, sessionVersion, setSessionError])

  // El checkout ya validó que la confirmación pertenece a la sesión vigente.
  const recordConfirmedOrder = useCallback((order) => {
    if (!user?.id) return
    cancelRequests()
    dispatch(ordersConfirmed({
      ownerId: user.id, generation: sessionVersion.current, order, updatedAt: Date.now(),
    }))
  }, [user?.id, sessionVersion, cancelRequests, dispatch])

  return { orderHistory, orderDetails, loadOrders, loadOrderDetail, recordConfirmedOrder }
}
