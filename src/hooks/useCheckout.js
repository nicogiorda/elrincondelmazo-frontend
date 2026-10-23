import { useCallback, useEffect, useRef, useState } from 'react'
import { createOrder } from '../services/ordersApi.js'
import useCheckoutQuote from './useCheckoutQuote.js'

const ambiguousMessage = 'No pudimos comprobar si el pedido se creó. Revisá tus pedidos antes de iniciar otra compra; podés reintentar este mismo intento sin cambiar sus datos.'
const changedAttemptMessage = 'Hay una confirmación sin resolver con otros datos. Revisá tus pedidos antes de iniciar otra compra.'

// Una instancia en App: el intento y su clave sobreviven a la navegación.
// No administra carrito, catálogo ni historial: coordina sus interfaces públicas.
export default function useCheckout({ active, user, token, cart, cartBusy, isCartPending, beginCheckout,
  sessionVersion, sessionAbort, subscribeSessionChange, logout, setSessionError,
  onOrderConfirmed, onCatalogInvalidated, onConfirmed }) {
  const [paymentMethod, setPaymentMethod] = useState('TRANSFERENCIA')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [confirmedOrder, setConfirmedOrder] = useState(null)
  const [unresolved, setUnresolved] = useState(null)
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
    setSubmitting(false)
    setSubmitError('')
    setConfirmedOrder(null)
    setUnresolved(null)
  }, [])
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
    // El ref y beginCheckout toman los bloqueos antes de esperar un render.
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
    // La clave nunca puede acompañar otros importes o medios de pago, ni otro carrito.
    if (currentAttempt.cartKey !== cartKey || currentAttempt.payload.paymentMethod !== paymentMethod
      || currentAttempt.payload.expectedTotal !== quote.total) return Promise.resolve(false)
    const reservation = beginCheckout()
    if (!reservation) { setSubmitError('Revisá el carrito antes de confirmar.'); return Promise.resolve(false) }
    const version = sessionVersion.current
    const signal = sessionAbort.current.signal
    const request = {}
    operation.current = request
    const isCurrent = () => mounted.current && !signal.aborted && version === sessionVersion.current
      && operation.current === request
    setSubmitting(true)
    setSubmitError('')
    request.promise = createOrder(currentAttempt.payload, { token, signal }).then(order => {
      if (!isCurrent()) return false
      // Solo una respuesta válida y actual habilita efectos en otros dominios.
      onOrderConfirmed(order)
      setConfirmedOrder(order)
      onCatalogInvalidated()
      reservation.complete()
      attempt.current = null
      setUnresolved(null)
      onConfirmed(order)
      return order
    }).catch(error => {
      if (!isCurrent()) return false
      if (error.status === 401) { logout(); setSessionError(error.message); return false }
      if (error.status === 409) {
        // El servidor rechazó el importe. La siguiente cotización requiere otro clic.
        attempt.current = null
        setUnresolved(null)
        setSubmitError('El total cambió. Revisá el nuevo importe y confirmá otra vez.')
        retryQuote()
      } else if (error.ambiguous) {
        currentAttempt.ambiguous = true
        setUnresolved(currentAttempt)
        setSubmitError((error.message ? error.message + ' ' : '') + ambiguousMessage)
      } else {
        setSubmitError(error.message || 'No pudimos confirmar el pedido.')
      }
      return false
    }).finally(() => {
      reservation.release()
      if (!isCurrent()) return
      operation.current = null
      setSubmitting(false)
    })
    return request.promise
  }
  return { paymentMethod, changePaymentMethod, quote, quoteError, retryQuote, submitting,
    submitError: confirmationBlocked ? changedAttemptMessage : submitError, confirmationBlocked,
    confirmOrder, confirmedOrder }
}
