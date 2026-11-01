import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchProductDetail } from '../Redux/productsSlice.js'

export default function useProductDetail({ productId, active, products, cacheVersion, loadPage, isFresh }) {
  const dispatch = useDispatch()
  const request = useSelector((state) => state.products.detail)
  const [attempt, setAttempt] = useState(0)
  const [relatedIds, setRelatedIds] = useState([])
  const key = productId + ':' + attempt + ':' + cacheVersion
  // pending todavía debe verse como «Cargando producto», no «Producto no disponible».
  const currentDetailRequest = request?.key === key && request.status !== 'loading' ? request : null
  const knownProduct = products.find(product => product.id === productId)
  const selectedProduct = !currentDetailRequest?.error && !currentDetailRequest?.notFound
    && knownProduct && ['ACTIVO', 'AGOTADO'].includes(knownProduct.status) ? knownProduct : undefined
  const needsDetail = Boolean(active && productId && !isFresh(productId) && !currentDetailRequest)

  useEffect(() => {
    // No depender de needsDetail: pending lo cambia y abortaría el mismo thunk.
    if (!active || !productId || isFresh(productId)) return
    let activeRequest = true
    let dispatched
    // Se difiere el inicio para evitar una petición del primer efecto de StrictMode.
    queueMicrotask(() => {
      if (!activeRequest) return
      dispatched = dispatch(fetchProductDetail({ productId, attempt, cacheVersion }))
    })
    return () => {
      activeRequest = false
      dispatched?.abort()
    }
  }, [active, productId, attempt, cacheVersion, dispatch, isFresh])

  useEffect(() => {
    if (!active || !selectedProduct?.collectionId) return
    let current = true
    loadPage('page=0&size=5&collectionId=' + selectedProduct.collectionId)
      .then(data => { if (current) setRelatedIds(data.content.map(product => product.id)) })
      .catch(() => { if (current) setRelatedIds([]) })
    return () => { current = false }
  }, [active, selectedProduct?.collectionId, loadPage, cacheVersion])
  return { selectedProduct, knownProduct, needsDetail, currentDetailRequest,
    relatedProducts: relatedIds.map(id => products.find(product => product.id === id)).filter(Boolean),
    retryDetail: () => setAttempt(value => value + 1) }
}
