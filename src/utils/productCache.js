import { getProducts, getProduct, productError } from '../services/productsApi.js'

export const PRODUCT_CACHE_TTL = 60_000
const PAGE_CAPACITY = 20
const changed = () => new Error('El catálogo cambió. Volvé a consultarlo.')
const aborted = () => new DOMException('La solicitud fue cancelada.', 'AbortError')

// Una instancia por useCatalog. Sin estado global ni entidades privadas.
// Páginas guardan IDs; todas las lecturas resuelven la misma colección de productos.
export function createProductCache({ now = Date.now, api = { getProducts, getProduct } } = {}) {
  const products = new Map(), freshness = new Map(), pages = new Map(), details = new Map()
  const listeners = new Set(), invalidations = new Set()
  let generation = 0, sequence = 0, cacheVersion = 0
  let snapshot = { products: [], cacheVersion }
  const emit = () => {
    snapshot = { products: [...products.values()], cacheVersion }
    listeners.forEach(listener => listener())
  }
  const save = (product, stamp) => {
    if (stamp < (freshness.get(product.id)?.sequence ?? 0)) return
    products.set(product.id, product)
    freshness.set(product.id, { sequence: stamp, time: now() })
  }
  const materialize = page => ({ ...page, content: page.content.map(id => products.get(id)).filter(Boolean) })
  const isFresh = id => products.has(id) && now() - (freshness.get(id)?.time ?? 0) < PRODUCT_CACHE_TTL
  const readPage = entry => entry.promise.then(page => {
    if (entry.version !== generation || entry.controller.signal.aborted) throw changed()
    return materialize(page)
  })

  function loadPage(query) {
    const cached = pages.get(query)
    if (cached && (cached.pending || (now() - cached.time < PRODUCT_CACHE_TTL && cached.ids.every(isFresh)))) {
      return readPage(cached)
    }
    const controller = new AbortController(), version = generation, stamp = ++sequence
    const entry = { controller, version, pending: true, time: 0 }
    entry.promise = api.getProducts(query, { signal: controller.signal }).then(data => {
      if (version !== generation || controller.signal.aborted || pages.get(query) !== entry) throw changed()
      data.content.forEach(product => save(product, stamp))
      entry.pending = false
      entry.time = now()
      entry.ids = data.content.map(product => product.id)
      emit()
      return { ...data, content: entry.ids }
    }).catch(error => { if (pages.get(query) === entry) pages.delete(query); throw error })
    pages.set(query, entry)
    if (pages.size > PAGE_CAPACITY) {
      const oldest = pages.keys().next().value
      pages.get(oldest).controller.abort()
      pages.delete(oldest)
    }
    return readPage(entry)
  }

  // Cada consumidor cancela su participación; la red se aborta cuando no queda
  // ninguno. Una respuesta que ignore AbortSignal tampoco puede poblar la caché.
  function loadProduct(id, { signal, isCurrent = () => true, onlyMissing = false, context = 'detail', revalidate = false } = {}) {
    if (signal?.aborted || !isCurrent()) return Promise.reject(aborted())
    if (!revalidate && isFresh(id)) return Promise.resolve(products.get(id))
    let entry = details.get(id)
    if (!entry) {
      const controller = new AbortController()
      entry = { controller, version: generation, stamp: ++sequence, consumers: new Set() }
      entry.promise = api.getProduct(id, { signal: controller.signal })
      details.set(id, entry)
    }
    const consumer = {}
    entry.consumers.add(consumer)
    return new Promise((resolve, reject) => {
      const release = () => {
        signal?.removeEventListener('abort', cancel)
        entry.consumers.delete(consumer)
        if (!entry.consumers.size) {
          entry.controller.abort()
          if (details.get(id) === entry) details.delete(id)
        }
      }
      const cancel = () => { release(); reject(aborted()) }
      signal?.addEventListener('abort', cancel, { once: true })
      entry.promise.then(product => {
        if (signal?.aborted || !isCurrent()) throw aborted()
        if (entry.version !== generation || entry.controller.signal.aborted) throw changed()
        if (!onlyMissing || !products.has(id)) { save(product, entry.stamp); emit() }
        if (!products.has(id) && entry.stamp < (freshness.get(id)?.sequence ?? 0)) throw changed()
        const result = products.get(id) ?? product
        release()
        resolve(result)
      }).catch(error => { release(); reject(productError(error, context)) })
    })
  }

  function invalidate() {
    generation += 1
    pages.forEach(entry => entry.controller.abort())
    details.forEach(entry => entry.controller.abort())
    pages.clear(); details.clear(); products.clear(); freshness.clear()
    invalidations.forEach(listener => listener())
    cacheVersion += 1
    emit()
  }
  function expire() {
    const ids = new Set([...freshness].filter(([, stamp]) => now() - stamp.time >= PRODUCT_CACHE_TTL).map(([id]) => id))
    ids.forEach(id => { freshness.delete(id); products.delete(id); details.get(id)?.controller.abort(); details.delete(id) })
    invalidations.forEach(listener => listener(ids))
    cacheVersion += 1
    emit()
  }
  function rememberProduct(product) {
    // Una tarjeta de una página anterior no reemplaza una entidad más reciente.
    if (!products.has(product.id)) { save(product, ++sequence); emit() }
  }
  function upsertProduct(product) {
    if (!['ACTIVO', 'AGOTADO'].includes(product.status)) return removeProduct(product.id)
    save(product, ++sequence); emit()
  }
  function removeProduct(id) {
    products.delete(id)
    freshness.set(id, { sequence: ++sequence, time: now() })
    emit()
  }
  function syncPublications(sellerId, items) {
    for (const product of products.values()) if (product.sellerId === sellerId) products.delete(product.id)
    items.forEach(product => {
      const stamp = ++sequence
      // También las publicaciones inactivas invalidan respuestas anteriores,
      // pero sus entidades privadas no se incorporan al catálogo compartido.
      if (['ACTIVO', 'AGOTADO'].includes(product.status)) save(product, stamp)
      else freshness.set(product.id, { sequence: stamp, time: now() })
    })
    emit()
  }
  return {
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
    getSnapshot: () => snapshot,
    subscribeInvalidation: listener => { invalidations.add(listener); return () => invalidations.delete(listener) },
    loadPage, loadProduct, isFresh, invalidate, expire, rememberProduct, upsertProduct, removeProduct, syncPublications,
  }
}
