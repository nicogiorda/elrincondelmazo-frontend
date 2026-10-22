import { useCallback, useEffect, useRef, useState } from 'react'

// Solo solicitudes y disponibilidad. Los productos resueltos viven en la caché
// del catálogo; el detalle puede reutilizar una consulta pendiente del carrito.
export default function useCartMetadata({ cart, products, userId, token, sessionVersion,
  subscribeSessionChange, selectedProductId, loadProduct, subscribeInvalidation }) {
  const requests = useRef(new Map())
  const [metadata, setMetadata] = useState({})
  const invalidateMetadata = useCallback((ids) => {
    const removed = ids ?? new Set(requests.current.keys())
    removed.forEach((id) => {
      requests.current.get(id)?.controller.abort()
      requests.current.delete(id)
    })
    setMetadata((current) => ids
      ? Object.fromEntries(Object.entries(current).filter(([id]) => !removed.has(Number(id)))) : {})
  }, [])
  const retryMetadata = useCallback(() => {
    requests.current.forEach((request, id) => { if (request.failed) requests.current.delete(id) })
    setMetadata({})
  }, [])

  useEffect(() => subscribeInvalidation(invalidateMetadata), [subscribeInvalidation, invalidateMetadata])
  useEffect(() => subscribeSessionChange(invalidateMetadata), [subscribeSessionChange, invalidateMetadata])
  useEffect(() => () => {
    requests.current.forEach((request) => request.controller.abort())
    requests.current.clear()
  }, [])

  useEffect(() => {
    if (!userId || !token || !cart) return
    const version = sessionVersion.current
    const missingIds = new Set(cart.items.filter((item) => !products.some((product) => product.id === item.productId))
      .map((item) => item.productId).filter((id) => selectedProductId !== id))
    missingIds.forEach((id) => {
      if (requests.current.has(id)) return
      const request = { controller: new AbortController() }
      requests.current.set(id, request)
      const isCurrent = () => !request.controller.signal.aborted
        && version === sessionVersion.current && requests.current.get(id) === request
      Promise.resolve().then(async () => {
        if (!isCurrent()) return
        setMetadata((current) => ({ ...current, [id]: { loading: true } }))
        try {
          // loadProduct comparte la consulta pública y delega HTTP en productsApi.
          await loadProduct(id, { signal: request.controller.signal, isCurrent, onlyMissing: true, context: 'cart' })
          if (!isCurrent()) return
          setMetadata((current) => ({ ...current, [id]: { loading: false } }))
        } catch (error) {
          if (!isCurrent()) return
          request.failed = true
          setMetadata((current) => ({ ...current, [id]: { loading: false, error: error.status === 404 || error.status === 403
            ? 'Este producto ya no está disponible. Podés quitarlo del carrito.'
            : 'No pudimos confirmar la disponibilidad de este producto.' } }))
        }
      })
    })
  }, [cart, products, userId, token, sessionVersion, selectedProductId, loadProduct, metadata])

  return { metadata, retryMetadata }
}
