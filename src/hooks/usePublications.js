import { useCallback, useEffect, useRef } from 'react'
import { useDispatch, useSelector, useStore } from 'react-redux'
import {
  PUBLICATIONS_TTL, fetchOwnPublications, saveOwnPublication,
  setOwnPublicationStatus, removeOwnPublication, uploadOwnPublicationPhoto,
  publicationsSessionCleared, publicationLocalError,
} from '../Redux/publicationsSlice.js'

// Redux es dueño de los datos y del estado de carga; el hook conserva los
// bloqueos síncronos, navegación, cancelación y efectos entre dominios.
export default function usePublications({ user, token, active, sessionVersion, sessionAbort,
  subscribeSessionChange, logout, setSessionError,
  refreshPendingCatalog, upsertProduct, removeProduct, syncPublicProducts, onSaved }) {
  const dispatch = useDispatch()
  const store = useStore()
  const userId = user?.id
  const listing = useSelector(state => state.publications)
  const listRequest = useRef(null)
  const mutation = useRef(null)
  const mounted = useRef(false)

  const cancelListing = useCallback(() => {
    listRequest.current?.abort()
    listRequest.current = null
  }, [])
  const cancelRequests = useCallback(() => {
    cancelListing()
    mutation.current?.abort()
    mutation.current = null
  }, [cancelListing])
  const reset = useCallback(() => {
    cancelRequests()
    dispatch(publicationsSessionCleared())
  }, [cancelRequests, dispatch])
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
    if (!mounted.current || !userId || !token || token !== localStorage.getItem('token') || mutation.current) return
    if (listRequest.current) return listRequest.current.promise
    const version = sessionVersion.current
    const cached = store.getState().publications
    if (!force && cached.ownerId === userId && cached.generation === version && cached.updatedAt > 0
      && Date.now() - cached.updatedAt < PUBLICATIONS_TTL) return Promise.resolve(cached.items)
    const request = { abort: () => {} }
    listRequest.current = request
    const isCurrent = () => mounted.current && version === sessionVersion.current
      && token === localStorage.getItem('token') && listRequest.current === request
      && !sessionAbort.current.signal.aborted
    const promise = dispatch(fetchOwnPublications({ userId, generation: version }))
    request.abort = promise.abort
    request.promise = promise.then(action => {
      if (!isCurrent()) return
      if (fetchOwnPublications.fulfilled.match(action)) {
        syncPublicProducts(userId, action.payload.items)
        return action.payload.items
      }
      if (fetchOwnPublications.rejected.match(action) && action.error.status === 401) {
        logout()
        setSessionError(action.error.message)
      }
    }).finally(() => {
      if (isCurrent()) listRequest.current = null
    })
    return request.promise
  }, [userId, token, sessionVersion, sessionAbort, store, dispatch,
    logout, setSessionError, syncPublicProducts])

  useEffect(() => {
    if (!active) return
    let current = true
    queueMicrotask(() => { if (current) load() })
    return () => { current = false }
  }, [active, load, listing.busyId])

  function runOperation(busyId, action, apply) {
    if (!mounted.current || !userId || !token || token !== localStorage.getItem('token')) {
      return Promise.reject(new Error('Ingresá para guardar la publicación.'))
    }
    if (mutation.current) return Promise.reject(new Error('Esperá a que termine la operación de publicaciones.'))
    const version = sessionVersion.current
    const request = { abort: () => {} }
    mutation.current = request
    cancelListing()
    const promise = dispatch(action({ userId, generation: version, busyId }))
    request.abort = promise.abort
    const isCurrent = () => mounted.current && version === sessionVersion.current
      && token === localStorage.getItem('token') && mutation.current === request
      && !sessionAbort.current.signal.aborted
    return promise.unwrap().then(result => {
      if (!isCurrent()) throw new Error('La sesión cambió.')
      apply?.(result)
      return result
    }).catch(error => {
      if (isCurrent() && error.status === 401) {
        logout()
        setSessionError(error.message)
      }
      const message = error.status === 404 ? 'La publicación ya no está disponible. Actualizá el listado.'
        : error.status === 403 ? 'No tenés permiso para modificar esta publicación.' : error.message
      throw Object.assign(new Error(message), { status: error.status })
    }).finally(() => {
      if (isCurrent()) mutation.current = null
    })
  }

  function syncPublication(saved) {
    refreshPendingCatalog()
    upsertProduct(saved)
  }
  function save(body, id) {
    return runOperation(id ?? 'new',
      scope => saveOwnPublication({ ...scope, body, id }),
      saved => { syncPublication(saved); onSaved() })
  }
  function uploadPhoto(file) {
    return runOperation('image', scope => uploadOwnPublicationPhoto({ ...scope, file }))
  }
  function change(product, action) {
    if (!userId || !token || mutation.current || listing.loading || product.sellerId !== userId) return Promise.resolve(false)
    return runOperation(product.id, scope => action === 'delete'
      ? removeOwnPublication({ ...scope, id: product.id })
      : setOwnPublicationStatus({ ...scope, id: product.id, action }), saved => {
      if (action === 'delete') {
        refreshPendingCatalog()
        removeProduct(product.id)
      } else syncPublication(saved)
    }).then(() => true).catch(() => false)
  }
  function toggle(product) {
    if (!['ACTIVO', 'INACTIVO'].includes(product.status)) return false
    if (product.status === 'INACTIVO' && product.stock <= 0) {
      dispatch(publicationLocalError('No se puede reactivar una publicación sin stock disponible.'))
      return false
    }
    return change(product, product.status === 'ACTIVO' ? 'pause' : 'resume')
  }
  const ownsListing = listing.ownerId === userId
  return {
    publications: ownsListing ? listing.items : [],
    loading: listing.loading || Boolean(active && userId && !ownsListing),
    loadError: ownsListing ? listing.loadError : '',
    error: ownsListing ? listing.loadError || listing.operationError : '',
    busyId: ownsListing ? listing.busyId : null,
    refresh: () => load(true), save, uploadPhoto, toggle,
    remove: product => change(product, 'delete'),
  }
}
