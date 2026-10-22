import { useCallback, useEffect, useRef, useState } from 'react'
import { API_BASE_URL, readResponse } from '../services/httpClient.js'

// Solo solicitudes y disponibilidad. Los productos resueltos viven en la caché
// del catálogo; el detalle puede reutilizar una consulta pendiente del carrito.
export default function useCartMetadata({ cart, products, userId, token, sessionVersion,
  subscribeSessionChange, catalogVersion, selectedProductId, onProductLoaded }) {
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
  const getPendingProduct = useCallback((id) => {
    const request = requests.current.get(id)
    return request && !request.failed ? request.promise : undefined
  }, [])

  useEffect(() => subscribeSessionChange(invalidateMetadata), [subscribeSessionChange, invalidateMetadata])
  useEffect(() => () => {
    requests.current.forEach((request) => request.controller.abort())
    requests.current.clear()
  }, [])

  useEffect(() => {
    if (!userId || !token || !cart) return
    const version = sessionVersion.current
    const productVersion = catalogVersion.current
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
          request.promise = fetch(API_BASE_URL + '/products/' + id, { signal: request.controller.signal }).then(readResponse)
          const product = await request.promise
          if (product.id !== id) throw new Error('El producto recibido no coincide con el del carrito.')
          if (!isCurrent()) return
          if (productVersion !== catalogVersion.current) {
            requests.current.delete(id)
            setMetadata((current) => ({ ...current, [id]: undefined }))
            return
          }
          onProductLoaded(product, isCurrent)
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
  }, [cart, products, userId, token, sessionVersion, catalogVersion, selectedProductId, onProductLoaded, metadata])

  return { metadata, invalidateMetadata, retryMetadata, getPendingProduct }
}
