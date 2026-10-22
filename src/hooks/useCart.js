import { useCallback, useEffect, useRef, useState } from 'react'
import { getCart, addCartItem, updateCartItemQuantity, removeCartItem } from '../services/cartApi.js'

function updateQuantity(cart, id, quantity) {
  const items = cart.items.map((item) => item.id === id
    ? { ...item, quantity, subtotal: item.unitPrice * quantity } : item)
  return { ...cart, items, subtotal: items.reduce((sum, item) => sum + item.subtotal, 0) }
}

// App mantiene una sola instancia; las vistas reciben el mismo estado y acciones.
export default function useCart({ user, token, sessionVersion, sessionAbort,
  subscribeSessionChange, logout, setSessionError, products, onProductAdded, onLoginRequired }) {
  const [cart, setCart] = useState(null)
  const [cartLoading, setCartLoading] = useState(false)
  const [cartBusy, setCartBusy] = useState(false)
  const [cartError, setCartError] = useState('')
  const [cartMessage, setCartMessage] = useState('')
  const [cartAttempt, setCartAttempt] = useState(0)
  const [quantitySyncItemId, setQuantitySyncItemId] = useState(null)
  const requested = useRef(null)
  const operation = useRef(null)
  const mounted = useRef(false)

  const resetCart = useCallback(() => {
    requested.current = null
    operation.current = null
    setCart(null)
    setCartLoading(false)
    setCartBusy(false)
    setCartError('')
    setCartMessage('')
    setQuantitySyncItemId(null)
  }, [])

  useEffect(() => {
    mounted.current = true
    const unsubscribe = subscribeSessionChange(resetCart)
    return () => { mounted.current = false; unsubscribe() }
  }, [subscribeSessionChange, resetCart])

  // El bloqueo se toma sin esperar al render: dos eventos del mismo turno no
  // pueden iniciar operaciones incompatibles. La sesión es dueña del aborto.
  const startOperation = useCallback((kind) => {
    if (operation.current) return null
    const version = sessionVersion.current
    const signal = sessionAbort.current.signal
    const request = { kind, signal }
    request.isCurrent = () => mounted.current && !signal.aborted
      && version === sessionVersion.current && operation.current === request
    request.release = () => {
      if (!request.isCurrent()) return
      operation.current = null
      setCartBusy(false)
      setCartLoading(false)
      setQuantitySyncItemId(null)
    }
    operation.current = request
    setCartBusy(true)
    setCartError('')
    setCartMessage('')
    return request
  }, [sessionVersion, sessionAbort])

  const reportError = useCallback((error) => {
    if (error.status === 401) { logout(); setSessionError(error.message) }
    else setCartError(error.message)
  }, [logout, setSessionError])

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
      setCartLoading(true)
      getCart({ token, signal: request.signal })
        .then((data) => {
          if (!request.isCurrent()) return
          if (!Array.isArray(data.items)) throw new Error('El carrito recibido no tiene una lista de ítems.')
          setCart(data)
        })
        .catch((error) => { if (request.isCurrent()) reportError(error) })
        .finally(request.release)
    })
    return () => { active = false }
  }, [user?.id, token, cartAttempt, sessionVersion, startOperation, reportError])

  function changeCart(mutation, onStart) {
    if (!user || !token) { onLoginRequired(); return Promise.resolve(false) }
    if (!cart) return Promise.resolve(false)
    const request = startOperation('mutation')
    if (!request) return Promise.resolve(false)
    onStart?.()
    return mutation({ token, signal: request.signal }).then((data) => {
      if (!request.isCurrent()) return false
      if (!Array.isArray(data.items)) throw new Error('El carrito recibido no tiene una lista de ítems.')
      setCart(data)
      setCartMessage('Carrito actualizado.')
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
        setCart(data)
        setCartMessage('Carrito actualizado.')
        return true
      }
      return false
    } catch (error) {
      if (!request.isCurrent()) return false
      setCart(confirmedCart)
      if (error instanceof TypeError) setCartError('No pudimos conectar con el servidor. Recuperamos la última cantidad guardada.')
      else reportError(error)
      return false
    } finally { request.release() }
  }

  function changeQuantity(id, quantity) {
    if (!user || !token || !cart || quantity < 1) return Promise.resolve(false)
    const pending = operation.current
    if (pending && (pending.kind !== 'quantity' || pending.id !== id)) return Promise.resolve(false)
    const item = cart.items.find((item) => item.id === id)
    const product = products.find((product) => product.id === item?.productId)
    if (!item || !product || (quantity > item.quantity && quantity > product.stock)) return Promise.resolve(false)
    setCart((current) => updateQuantity(current, id, quantity))
    if (pending) {
      pending.desiredQuantity = quantity
      return pending.promise
    }
    const request = startOperation('quantity')
    Object.assign(request, { id, desiredQuantity: quantity, originalCart: cart })
    setQuantitySyncItemId(id)
    request.promise = syncQuantity(request)
    return request.promise
  }

  function removeItem(id) {
    return changeCart((options) => removeCartItem(id, options))
  }

  function retryCart() {
    if (operation.current) return false
    setCartAttempt((attempt) => attempt + 1)
    return true
  }

  const isCartPending = useCallback(() => Boolean(operation.current), [])

  // Checkout conserva HTTP, idempotencia y validación del pedido. Esta reserva
  // solo protege el carrito y no permite que un cierre antiguo desbloquee B.
  function beginCheckout() {
    if (!user || !token || !cart?.items.length) return null
    const request = startOperation('checkout')
    if (!request) return null
    return {
      complete: () => {
        if (request.isCurrent()) setCart((current) => ({ ...current, items: [], subtotal: 0 }))
      },
      release: request.release,
    }
  }

  const items = cart?.items ?? []
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0)
  return { cart, items, cartCount, cartLoading, cartBusy, cartError, cartMessage,
    quantitySyncItemId, addToCart, changeQuantity, removeItem, retryCart, isCartPending, beginCheckout }
}
