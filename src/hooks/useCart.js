import { useCallback, useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { getCart, addCartItem, updateCartItemQuantity, removeCartItem } from '../services/cartApi.js'
import {
  cartSessionCleared, cartOperationStarted, cartReceived, cartUpdated,
  cartQuantityChanged, cartQuantitySyncStarted, cartOperationReleased,
  cartFailed, cartRetryRequested, cartCheckoutCompleted,
} from '../Redux/cartSlice.js'

// App conserva una sola instancia: el store administra datos y estado visual.
// Los refs coordinan exclusión, sesión y cancelación antes de cualquier render.
export default function useCart({ user, token, sessionVersion, sessionAbort,
  subscribeSessionChange, logout, setSessionError, products, onProductAdded, onLoginRequired }) {
  const dispatch = useDispatch()
  const { cart, cartLoading, cartBusy, cartError, cartMessage, cartAttempt,
    quantitySyncItemId } = useSelector((state) => state.cart)
  const requested = useRef(null)
  const operation = useRef(null)
  const mounted = useRef(false)

  const resetCart = useCallback(() => {
    requested.current = null
    operation.current = null
    dispatch(cartSessionCleared())
  }, [dispatch])

  useEffect(() => {
    mounted.current = true
    const unsubscribe = subscribeSessionChange(resetCart)
    return () => { mounted.current = false; unsubscribe() }
  }, [subscribeSessionChange, resetCart])

  // Dos eventos en un mismo turno nunca inician mutaciones incompatibles.
  // ownerId + generation impiden que una respuesta de otra sesión llegue a Redux.
  const startOperation = useCallback((kind) => {
    if (operation.current) return null
    const version = sessionVersion.current
    const signal = sessionAbort.current.signal
    const request = { kind, signal, ownerId: user?.id, generation: version }
    request.isCurrent = () => mounted.current && !signal.aborted
      && version === sessionVersion.current && operation.current === request
    request.release = () => {
      if (!request.isCurrent()) return
      operation.current = null
      dispatch(cartOperationReleased({ ownerId: request.ownerId, generation: version }))
    }
    operation.current = request
    dispatch(cartOperationStarted({ ownerId: request.ownerId, generation: version, kind }))
    return request
  }, [sessionVersion, sessionAbort, user?.id, dispatch])

  const reportError = useCallback((error) => {
    if (error.status === 401) { logout(); setSessionError(error.message) }
    else dispatch(cartFailed({
      ownerId: user?.id, generation: sessionVersion.current, message: error.message,
    }))
  }, [logout, setSessionError, user?.id, sessionVersion, dispatch])

  useEffect(() => {
    if (!user?.id || !token) return
    let active = true
    const version = sessionVersion.current
    // StrictMode descarta el primer montaje antes de iniciar la carga. Una vez
    // enviada, la solicitud pertenece al carrito y sobrevive a la navegación.
    Promise.resolve().then(() => {
      if (!active || version !== sessionVersion.current) return
      const key = version + ':' + user.id + ':' + cartAttempt
      if (requested.current === key) return
      const request = startOperation('load')
      if (!request) return
      requested.current = key
      getCart({ token, signal: request.signal })
        .then((data) => {
          if (!request.isCurrent()) return
          if (!Array.isArray(data.items)) throw new Error('El carrito recibido no tiene una lista de ítems.')
          dispatch(cartReceived({ ownerId: request.ownerId, generation: request.generation, cart: data }))
        })
        .catch((error) => { if (request.isCurrent()) reportError(error) })
        .finally(request.release)
    })
    return () => { active = false }
  }, [user?.id, token, cartAttempt, sessionVersion, startOperation, reportError, dispatch])

  function changeCart(mutation, onStart) {
    if (!user || !token) { onLoginRequired(); return Promise.resolve(false) }
    if (!cart) return Promise.resolve(false)
    const request = startOperation('mutation')
    if (!request) return Promise.resolve(false)
    onStart?.()
    return mutation({ token, signal: request.signal }).then((data) => {
      if (!request.isCurrent()) return false
      if (!Array.isArray(data.items)) throw new Error('El carrito recibido no tiene una lista de ítems.')
      dispatch(cartUpdated({ ownerId: request.ownerId, generation: request.generation, cart: data }))
      return true
    }).catch((error) => {
      if (request.isCurrent()) reportError(error)
      return false
    }).finally(request.release)
  }

  function addToCart(product, quantity = 1) {
    return changeCart((options) => addCartItem({ productId: product.id, quantity }, options),
      () => onProductAdded(product))
  }

  async function syncQuantity(request) {
    let confirmedCart = request.originalCart
    try {
      while (request.isCurrent()) {
        const quantity = request.desiredQuantity
        const data = await updateCartItemQuantity(request.id, quantity, { token, signal: request.signal })
        if (!request.isCurrent()) return false
        if (!Array.isArray(data.items)) throw new Error('El servidor devolvió un carrito inválido.')
        confirmedCart = data
        if (request.desiredQuantity !== quantity) continue
        dispatch(cartUpdated({ ownerId: request.ownerId, generation: request.generation, cart: data }))
        return true
      }
      return false
    } catch (error) {
      if (!request.isCurrent()) return false
      dispatch(cartReceived({
        ownerId: request.ownerId, generation: request.generation, cart: confirmedCart,
      }))
      if (error instanceof TypeError) {
        dispatch(cartFailed({
          ownerId: request.ownerId, generation: request.generation,
          message: 'No pudimos conectar con el servidor. Recuperamos la última cantidad guardada.',
        }))
      } else reportError(error)
      return false
    } finally { request.release() }
  }

  function changeQuantity(id, quantity) {
    if (!user || !token || !cart || quantity < 1) return Promise.resolve(false)
    const pending = operation.current
    if (pending && (pending.kind !== 'quantity' || pending.id !== id)) return Promise.resolve(false)
    const item = cart.items.find((entry) => entry.id === id)
    const product = products.find((entry) => entry.id === item?.productId)
    if (!item || !product || (quantity > item.quantity && quantity > product.stock)) return Promise.resolve(false)
    dispatch(cartQuantityChanged({
      ownerId: user.id, generation: sessionVersion.current, id, quantity,
    }))
    if (pending) {
      pending.desiredQuantity = quantity
      return pending.promise
    }
    const request = startOperation('quantity')
    Object.assign(request, { id, desiredQuantity: quantity, originalCart: cart })
    dispatch(cartQuantitySyncStarted({ ownerId: request.ownerId, generation: request.generation, id }))
    request.promise = syncQuantity(request)
    return request.promise
  }

  function removeItem(id) {
    return changeCart((options) => removeCartItem(id, options))
  }

  function retryCart() {
    if (operation.current) return false
    dispatch(cartRetryRequested({ ownerId: user?.id, generation: sessionVersion.current }))
    return true
  }

  const isCartPending = useCallback(() => Boolean(operation.current), [])

  // Checkout conserva idempotencia, HTTP y validación del pedido. La reserva
  // evita que otro evento cambie el carrito durante una confirmación.
  function beginCheckout() {
    if (!user || !token || !cart?.items.length) return null
    const request = startOperation('checkout')
    if (!request) return null
    return {
      complete: () => {
        if (request.isCurrent()) {
          dispatch(cartCheckoutCompleted({ ownerId: request.ownerId, generation: request.generation }))
        }
      },
      release: request.release,
    }
  }

  const items = cart?.items ?? []
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0)
  return { cart, items, cartCount, cartLoading, cartBusy, cartError, cartMessage,
    quantitySyncItemId, addToCart, changeQuantity, removeItem, retryCart, isCartPending, beginCheckout }
}
