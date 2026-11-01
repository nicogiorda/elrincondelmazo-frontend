import { useCallback, useEffect, useRef, useState } from 'react'
import { getPublications, savePublication, changePublicationStatus,
  deletePublication, uploadPublicationPhoto } from '../services/publicationsApi.js'

const CACHE_LIFETIME = 60_000
const empty = () => ({ userId: null, items: [], loading: false, error: '' })
const newestFirst = (a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || b.id - a.id
const operationMessage = error => error.status === 404
  ? 'La publicación ya no está disponible. Actualizá el listado.'
  : error.status === 403 ? 'No tenés permiso para modificar esta publicación.' : error.message

// Única instancia en App: datos privados aquí, productos públicos en useCatalog.
export default function usePublications({ user, token, active, sessionVersion, sessionAbort,
  subscribeSessionChange, logout, setSessionError,
  refreshPendingCatalog, upsertProduct, removeProduct, syncPublicProducts, onSaved }) {
  const [listing, setListing] = useState(empty)
  const [busyId, setBusyId] = useState(null)
  const [operationError, setOperationError] = useState('')
  const stamp = useRef(null)
  const listRequest = useRef(null)
  const mutation = useRef(null)
  const mounted = useRef(false)

  const cancelListing = useCallback(() => {
    listRequest.current?.controller.abort()
    listRequest.current = null
  }, [])
  const cancelRequests = useCallback(() => {
    cancelListing()
    mutation.current?.controller.abort()
    mutation.current = null
  }, [cancelListing])
  const reset = useCallback(() => {
    cancelRequests()
    stamp.current = null
    setListing(empty())
    setBusyId(null)
    setOperationError('')
  }, [cancelRequests])
  useEffect(() => {
    mounted.current = true
    const unsubscribe = subscribeSessionChange(reset)
    return () => {
      mounted.current = false
      unsubscribe()
      queueMicrotask(() => { if (!mounted.current) cancelRequests() })
    }
  }, [subscribeSessionChange, reset, cancelRequests])

  const load = useCallback((force = false) => {
    if (!mounted.current || !user?.id || !token || token !== localStorage.getItem('token') || mutation.current) return
    if (listRequest.current) return listRequest.current.promise
    if (!force && stamp.current?.userId === user.id && Date.now() - stamp.current.time < CACHE_LIFETIME) return
    const version = sessionVersion.current
    const pending = { controller: new AbortController() }
    const signal = AbortSignal.any([pending.controller.signal, sessionAbort.current.signal])
    listRequest.current = pending
    const isCurrent = () => mounted.current && !signal.aborted && version === sessionVersion.current
      && token === localStorage.getItem('token') && listRequest.current === pending
    setOperationError('')
    setListing(current => ({ userId: user.id, items: current.userId === user.id ? current.items : [], loading: true, error: '' }))
    pending.promise = (async () => {
      try {
        const items = []
        let page = 0, totalPages
        do {
          const data = await getPublications(page, { userId: user.id, token, signal })
          if (!isCurrent()) return
          items.push(...data.content)
          totalPages = data.totalPages
          page += 1
        } while (page < totalPages)
        items.sort(newestFirst)
        stamp.current = { userId: user.id, time: Date.now() }
        setListing({ userId: user.id, items, loading: false, error: '' })
        syncPublicProducts(user.id, items)
      } catch (error) {
        if (!isCurrent()) return
        if (error.status === 401) { logout(); setSessionError(error.message) }
        else setListing(current => ({ ...current, loading: false, error: error.status === 403
          ? 'No tenés permiso para consultar tus publicaciones.' : error.message }))
      } finally {
        if (isCurrent()) listRequest.current = null
      }
    })()
    return pending.promise
  }, [user?.id, token, sessionVersion, sessionAbort, logout, setSessionError, syncPublicProducts])

  useEffect(() => {
    if (!active) return
    let current = true
    Promise.resolve().then(() => { if (current) load() })
    return () => { current = false }
  }, [active, load, busyId])

  // Reserva sincrónica: ni dos clics en un turno ni una respuesta de otra sesión
  // pueden compartir/liberar la operación actual. Los GET anteriores se descartan.
  async function runOperation(id, operation, apply) {
    if (!mounted.current || !user?.id || !token || token !== localStorage.getItem('token')) {
      throw new Error('Ingresá para guardar la publicación.')
    }
    if (mutation.current) throw new Error('Esperá a que termine la operación de publicaciones.')
    const version = sessionVersion.current
    const pending = { controller: new AbortController() }
    const signal = AbortSignal.any([pending.controller.signal, sessionAbort.current.signal])
    mutation.current = pending
    cancelListing()
    setListing(current => ({ ...current, loading: false }))
    setBusyId(id)
    setOperationError('')
    const isCurrent = () => mounted.current && !signal.aborted && version === sessionVersion.current
      && token === localStorage.getItem('token') && mutation.current === pending
    try {
      const result = await operation({ userId: user.id, token, signal })
      if (!isCurrent()) throw new Error('La sesión cambió.')
      apply?.(result)
      return result
    } catch (error) {
      if (isCurrent()) {
        if (error.status === 401) { logout(); setSessionError(error.message) }
        else setOperationError(operationMessage(error))
      }
      throw Object.assign(new Error(operationMessage(error)), { status: error.status })
    } finally {
      if (isCurrent()) { mutation.current = null; setBusyId(null) }
    }
  }

  function syncPublication(saved) {
    refreshPendingCatalog()
    setListing(current => ({ ...current, userId: user.id, error: '',
      items: [saved, ...(current.userId === user.id ? current.items : []).filter(product => product.id !== saved.id)].sort(newestFirst),
    }))
    upsertProduct(saved)
  }
  function save(body, id) {
    return runOperation(id ?? 'new', options => savePublication(body, id, options), saved => {
      syncPublication(saved)
      onSaved()
    })
  }
  function uploadPhoto(file) {
    return runOperation('image', options => uploadPublicationPhoto(file, options))
  }
  async function change(product, action) {
    if (!user?.id || !token || mutation.current || listing.loading || product.sellerId !== user.id) return false
    try {
      await runOperation(product.id, options => action === 'delete'
        ? deletePublication(product.id, options) : changePublicationStatus(product.id, action, options), saved => {
        if (action === 'delete') {
          refreshPendingCatalog()
          setListing(current => ({ ...current, items: current.items.filter(item => item.id !== product.id) }))
          removeProduct(product.id)
        } else syncPublication(saved)
      })
      return true
    } catch { return false } // El error ya está publicado; los handlers de la lista no rechazan.
  }
  function toggle(product) {
    if (!['ACTIVO', 'INACTIVO'].includes(product.status)) return false
    if (product.status === 'INACTIVO' && product.stock <= 0) {
      setOperationError('No se puede reactivar una publicación sin stock disponible.')
      return false
    }
    return change(product, product.status === 'ACTIVO' ? 'pause' : 'resume')
  }

  return { publications: listing.userId === user?.id ? listing.items : [],
    loading: listing.loading || Boolean(active && user && listing.userId !== user.id),
    loadError: listing.error, error: listing.error || operationError, busyId,
    refresh: () => load(true), save, uploadPhoto, toggle, remove: product => change(product, 'delete') }
}
