import { useCallback, useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { confirmCheckoutOrder, checkoutSessionCleared, checkoutSubmitErrorSet } from '../Redux/checkoutSlice.js'
import useCheckoutQuote from './useCheckoutQuote.js'

const changedAttemptMessage = 'Hay una confirmación sin resolver con otros datos. Revisá tus pedidos antes de iniciar otra compra.'

// Redux guarda los resultados del backend; refs locales protegen el UUID
// idempotente y el bloqueo sincrono contra dos clics en el mismo turno.
export default function useCheckout({ active, user, token, cart, cartBusy, isCartPending, beginCheckout,
  sessionVersion, sessionAbort, subscribeSessionChange, logout, setSessionError,
  onOrderConfirmed, onCatalogInvalidated, onConfirmed }) {
  const dispatch = useDispatch()
  const [paymentMethod, setPaymentMethod] = useState('TRANSFERENCIA')
  const { submitting, submitError, confirmedOrder, unresolved } = useSelector(
    state => state.checkout.confirmation)
  const attempt = useRef(null)
  const operation = useRef(null)
  const mounted = useRef(false)
  const { quote, quoteError, quoteKey, retryQuote } = useCheckoutQuote({
    active, cart, blocked: cartBusy || submitting, paymentMethod, userId: user?.id, token,
    sessionVersion, sessionAbort, subscribeSessionChange, logout, setSessionError,
  })
  const cartKey = JSON.stringify(cart)
  const confirmationBlocked = Boolean(unresolved && (unresolved.cartKey !== cartKey
    || unresolved.payload.paymentMethod !== paymentMethod || (quote && unresolved.payload.expectedTotal !== quote.total)))

  const resetCheckout = useCallback(() => {
    operation.current = null
    attempt.current = null
    setPaymentMethod('TRANSFERENCIA')
    dispatch(checkoutSessionCleared())
  }, [dispatch])
  useEffect(() => {
    mounted.current = true
    const unsubscribe = subscribeSessionChange(resetCheckout)
    return () => { mounted.current = false; unsubscribe() }
  }, [subscribeSessionChange, resetCheckout])

  function changePaymentMethod(next) {
    if (operation.current || isCartPending()) return
    setPaymentMethod(next)
  }

  function confirmOrder() {
    // Tomar el lock del hook y la reserva del carrito ANTES del primer await.
    if (operation.current) return operation.current.promise
    if (!active || !user || !token || !quote || confirmationBlocked || isCartPending()) return Promise.resolve(false)
    let currentAttempt = attempt.current
    if (!currentAttempt?.ambiguous && currentAttempt?.quoteKey !== quoteKey) {
      currentAttempt = null
    }
    if (!currentAttempt) {
      currentAttempt = { quoteKey, cartKey, payload: {
        paymentMethod, expectedTotal: quote.total, requestKey: crypto.randomUUID(),
      } }
      attempt.current = currentAttempt
    }
    // Nunca reutilizar requestKey si cambiaron importe, pago o carrito.
    if (currentAttempt.cartKey !== cartKey || currentAttempt.payload.paymentMethod !== paymentMethod
      || currentAttempt.payload.expectedTotal !== quote.total) return Promise.resolve(false)
    const reservation = beginCheckout()
    if (!reservation) {
      dispatch(checkoutSubmitErrorSet({
        ownerId: user.id, generation: sessionVersion.current,
        message: 'Revisá el carrito antes de confirmar.',
      }))
      return Promise.resolve(false)
    }
    const version = sessionVersion.current
    const signal = sessionAbort.current.signal
    const request = {}
    operation.current = request
    const isCurrent = () => mounted.current && !signal.aborted && version === sessionVersion.current
      && operation.current === request

    request.promise = dispatch(confirmCheckoutOrder({
      ownerId: user.id, generation: version, quoteKey, cartKey, payload: currentAttempt.payload,
    }, { signal })).unwrap().then(order => {
      if (!isCurrent()) return false
      // El thunk verifico HTTP 201, importe, items e identidad de la operacion.
      onOrderConfirmed(order)
      onCatalogInvalidated()
      reservation.complete()
      attempt.current = null
      onConfirmed(order)
      return order
    }).catch(error => {
      if (!isCurrent()) return false
      if (error.status === 401) { logout(); setSessionError(error.message); return false }
      if (error.status === 409) {
        attempt.current = null
        // El reducer muestra el mensaje y la nueva cotizacion exige otro clic.
        retryQuote()
      } else if (error.ambiguous) {
        // Solo se reintenta con la misma clave, precio y medio de pago.
        currentAttempt.ambiguous = true
      }
      return false
    }).finally(() => {
      reservation.release()
      if (!isCurrent()) return
      operation.current = null
    })
    return request.promise
  }

  return { paymentMethod, changePaymentMethod, quote, quoteError, retryQuote, submitting,
    submitError: confirmationBlocked ? changedAttemptMessage : submitError, confirmationBlocked,
    confirmOrder, confirmedOrder }
}
