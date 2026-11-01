import { useEffect, useState } from 'react'
import useProductCache from './useProductCache.js'
import useCollections from './useCollections.js'
import useCatalogFilters from './useCatalogFilters.js'
import useProductDetail from './useProductDetail.js'

export default function useCatalog({ location, productId, isProductRoute }) {
  const cache = useProductCache()
  const { products, cacheVersion, loadPage, loadProduct, isFresh } = cache
  const collections = useCollections()
  const filters = useCatalogFilters(location)
  const detail = useProductDetail({ productId, active: isProductRoute, products, cacheVersion, loadProduct, loadPage, isFresh })
  const [homeIds, setHomeIds] = useState([])
  const [productsLoading, setLoading] = useState(true)
  const [productsError, setError] = useState('')
  useEffect(() => {
    if (location.pathname !== '/') return
    let active = true
    Promise.resolve().then(async () => {
      if (!active) return
      setLoading(true)
      try {
        const data = await loadPage('page=0&size=4')
        if (active) { setHomeIds(data.content.map(product => product.id)); setError('') }
      } catch (error) { if (active) setError(error.message) }
      finally { if (active) setLoading(false) }
    })
    return () => { active = false }
  }, [location.pathname, cacheVersion, loadPage])
  const recentProducts = homeIds.map(id => products.find(product => product.id === id))
    .filter(product => product?.status === 'ACTIVO')
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')).slice(0, 4)
  return { products, cacheVersion, loadProductPage: loadPage, loadProduct,
    recentProducts, productsLoading, productsError, ...collections, ...filters, ...detail,
    refreshPendingCatalog: cache.invalidate, rememberProduct: cache.rememberProduct,
    upsertProduct: cache.upsertProduct, removeProduct: cache.removeProduct,
    syncPublicProducts: cache.syncPublications, subscribeInvalidation: cache.subscribeInvalidation }
}
