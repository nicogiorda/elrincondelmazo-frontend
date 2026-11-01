import { useEffect, useState } from 'react'

export default function useProductDetail({ productId, active, products, cacheVersion, loadProduct, loadPage, isFresh }) {
  const [request, setRequest] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [relatedIds, setRelatedIds] = useState([])
  const key = productId + ':' + attempt + ':' + cacheVersion
  const currentDetailRequest = request?.key === key ? request : null
  const knownProduct = products.find(product => product.id === productId)
  const selectedProduct = !currentDetailRequest?.error && !currentDetailRequest?.notFound
    && knownProduct && ['ACTIVO', 'AGOTADO'].includes(knownProduct.status) ? knownProduct : undefined
  const needsDetail = Boolean(active && productId && !isFresh(productId) && !currentDetailRequest)
  useEffect(() => {
    if (!needsDetail) return
    let current = true
    const controller = new AbortController()
    Promise.resolve().then(async () => {
      if (!current) return
      try {
        const product = await loadProduct(productId, { signal: controller.signal })
        if (current && !['ACTIVO', 'AGOTADO'].includes(product.status)) setRequest({ key, notFound: true })
      } catch (error) {
        if (current) setRequest(error.status === 404 ? { key, notFound: true } : { key, error: error.message })
      }
    })
    return () => { current = false; controller.abort() }
  }, [needsDetail, productId, key, loadProduct])
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
