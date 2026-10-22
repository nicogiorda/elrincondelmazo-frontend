import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createProductCache, PRODUCT_CACHE_TTL } from '../utils/productCache.js'

export default function useProductCache() {
  const [cache] = useState(() => createProductCache())
  const snapshot = useSyncExternalStore(cache.subscribe, cache.getSnapshot)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    const timer = setInterval(cache.expire, PRODUCT_CACHE_TTL)
    return () => {
      mounted.current = false
      clearInterval(timer)
      queueMicrotask(() => { if (!mounted.current) cache.invalidate() })
    }
  }, [cache])
  return { ...snapshot, ...cache }
}
