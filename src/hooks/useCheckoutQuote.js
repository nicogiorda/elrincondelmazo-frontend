import { useCallback, useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchCheckoutQuote } from '../Redux/checkoutSlice.js'

// La validacion pura del contrato sigue disponible para las pruebas anteriores.
export { validateQuote } from '../services/ordersApi.js'

// Cotizacion y sus etapas pending/fulfilled/rejected viven en Redux.
// Las revisiones locales son solo identificadores de cada visita y reintento.
export default function useCheckoutQuote({ active, cart, blocked, paymentMethod, userId, token,
  sessionVersion, sessionAbort, subscribeSessionChange, logout, setSessionError }) {
  const dispatch = useDispatch()
  const quoteState = useSelector(state => state.checkout.quote)
  const [attempt, setAttempt] = useState(0)
  const request = useRef(null)
  const input = JSON.stringify([active, userId, cart, paymentMethod])
  const [revision, setRevision] = useState({ input, number: 0 })

  // Entrar de nuevo o cambiar carrito/pago exige cotizar con el backend.
  // El cambio durante render impide mostrar un total de la revision anterior.
  if (revision.input !== input) setRevision({ input, number: revision.number + 1 })

  const quoteKey = JSON.stringify([input, revision.number, attempt])
  const current = quoteState.key === quoteKey && quoteState.status !== 'idle' ? quoteState : null
  const retryQuote = useCallback(() => setAttempt(value => value + 1), [])
  const resetQuote = useCallback(() => {
    request.current?.abort()
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
    // StrictMode descarta el primer montaje antes de enviar una solicitud.
    Promise.resolve().then(() => {
      if (!isCurrent()) return
      dispatch(fetchCheckoutQuote({
        ownerId: userId, generation: version, paymentMethod, quoteKey,
      }, { signal })).unwrap().catch(error => {
        if (isCurrent() && error.status === 401) {
          logout()
          setSessionError(error.message)
        }
      })
    })
    return () => { mounted = false; controller.abort() }
  }, [active, userId, token, cart, blocked, current, paymentMethod, quoteKey,
    sessionVersion, sessionAbort, logout, setSessionError, dispatch])

  return {
    quote: current?.status === 'succeeded' ? current.data : null,
    quoteError: current?.status === 'failed' ? current.error : '',
    quoteKey, retryQuote,
  }
}
