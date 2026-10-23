import { useCallback, useEffect, useRef, useState } from 'react'
import { previewOrder } from '../services/ordersApi.js'

// La cotización pertenece a esta combinación de carrito, medio de pago e intento.
// Los importes siempre llegan del servidor; aquí solo se valida su estructura.
export function validateQuote(quote) {
  if (!quote || !['subtotal', 'totalDiscount', 'total'].every(field => Number.isFinite(quote[field]) && quote[field] >= 0)
    || !Array.isArray(quote.promotions)
    || !quote.promotions.every(promotion => promotion && typeof promotion.promotionName === 'string'
      && Number.isFinite(promotion.discountApplied))) throw new Error('Cotización inválida.')
  return quote
}

export default function useCheckoutQuote({ active, cart, blocked, paymentMethod, userId, token,
  sessionVersion, sessionAbort, subscribeSessionChange, logout, setSessionError }) {
  const [result, setResult] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const request = useRef(null)
  const input = JSON.stringify([userId, cart, paymentMethod])
  const [revision, setRevision] = useState({ input, number: 0 })
  // Incluso volver al medio/carrito anterior requiere una cotización nueva.
  // Ajustar durante render impide confirmar con el resultado de otra revisión.
  if (revision.input !== input) {
    setRevision({ input, number: revision.number + 1 })
    setResult(null)
  }
  const quoteKey = JSON.stringify([input, revision.number, attempt])
  const current = result?.key === quoteKey ? result : null
  const retryQuote = useCallback(() => setAttempt(value => value + 1), [])
  const resetQuote = useCallback(() => {
    request.current?.abort()
    setResult(null)
    setAttempt(0)
  }, [])
  useEffect(() => subscribeSessionChange(resetQuote), [subscribeSessionChange, resetQuote])
  useEffect(() => {
    if (!active || !userId || !token || !cart?.items.length || blocked || current) return
    let mounted = true
    const controller = new AbortController()
    request.current = controller
    const signal = AbortSignal.any([controller.signal, sessionAbort.current.signal])
    const version = sessionVersion.current
    const isCurrent = () => mounted && !signal.aborted && version === sessionVersion.current
    Promise.resolve().then(async () => {
      if (!isCurrent()) return
      try {
        const quote = validateQuote(await previewOrder(paymentMethod, { token, signal }))
        if (isCurrent()) setResult({ key: quoteKey, data: quote })
      } catch (error) {
        if (!isCurrent()) return
        if (error.status === 401) { logout(); setSessionError(error.message) }
        else setResult({ key: quoteKey, error: error.message })
      }
    })
    return () => { mounted = false; controller.abort() }
  }, [active, userId, token, cart, blocked, current, paymentMethod, quoteKey,
    sessionVersion, sessionAbort, logout, setSessionError])
  return { quote: current?.data ?? null, quoteError: current?.error ?? '', quoteKey, retryQuote }
}
