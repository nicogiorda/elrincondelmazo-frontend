import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchHomeProducts } from '../Redux/productsSlice.js'
import useProductCache from './useProductCache.js'
import useCollections from './useCollections.js'
import useCatalogFilters from './useCatalogFilters.js'
import useProductDetail from './useProductDetail.js'

export default function useCatalog({ location, productId, isProductRoute }) {
  const dispatch = useDispatch()
  const cache = useProductCache()
  const { products, cacheVersion, loadPage, loadProduct, isFresh } = cache
  const home = useSelector((state) => state.products.home)
  const collections = useCollections()
  const filters = useCatalogFilters(location)
  const detail = useProductDetail({ productId, active: isProductRoute, products, cacheVersion, isFresh })

  useEffect(() => {
    if (location.pathname !== '/') return
    let active = true
    // StrictMode desmonta un primer efecto de desarrollo: no emitir GET obsoleto.
    queueMicrotask(() => { if (active) dispatch(fetchHomeProducts({ cacheVersion })) })
    return () => { active = false }
  }, [location.pathname, cacheVersion, dispatch])

  const homeState = home?.key === String(cacheVersion) ? home : null
  const productsLoading = !homeState || homeState.status === 'loading'
  const productsError = homeState?.status === 'failed' ? homeState.error : ''
  const recentProducts = (homeState?.status === 'succeeded' ? homeState.ids : [])
    .map(id => products.find(product => product.id === id))
    .filter(product => product?.status === 'ACTIVO')
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')).slice(0, 4)

  return { products, cacheVersion, loadProductPage: loadPage, loadProduct,
    recentProducts, productsLoading, productsError, ...collections, ...filters, ...detail,
    refreshPendingCatalog: cache.invalidate, rememberProduct: cache.rememberProduct,
    upsertProduct: cache.upsertProduct, removeProduct: cache.removeProduct,
    syncPublicProducts: cache.syncPublications, subscribeInvalidation: cache.subscribeInvalidation }
}
