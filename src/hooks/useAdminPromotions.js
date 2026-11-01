import { useCallback, useEffect, useRef, useState } from 'react'
import { getPromotions, savePromotion, setPromotionActive } from '../services/promotionsApi.js'
import { promotionFromBackend, promotionToBackend } from '../utils/promotionMapper.js'
import { invalidatePublicPromotions } from '../services/publicPromotions.js'

const empty = () => ({ userId: null, items: [], loading: false, error: '' })

export default function useAdminPromotions({ user, token, active, sessionVersion, sessionAbort,
  subscribeSessionChange, logout, setSessionError, onSaved }) {
  const [state, setState] = useState(empty)
  const [busyId, setBusyId] = useState(null)
  const listRequest = useRef(null)
  const mutation = useRef(null)
  const cache = useRef({ attempted: false, complete: false })
  const mounted = useRef(false)
  const userId = user?.id
  const allowed = user?.role === 'ADMIN' && Boolean(userId && token)

  const cancelList = useCallback(() => {
    if (listRequest.current) {
      listRequest.current.controller.abort()
      listRequest.current = null
      cache.current.attempted = cache.current.complete
    }
  }, [])
  const cancelRequests = useCallback(() => {
    cancelList()
    mutation.current?.controller.abort()
    mutation.current = null
  }, [cancelList])
  const reset = useCallback(() => {
    cancelRequests()
    cache.current = { attempted: false, complete: false }
    setState(empty())
    setBusyId(null)
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

  const reportError = useCallback(error => {
    if (error.status === 401) { logout(); setSessionError(error.message) }
    else setState(current => ({ ...current, loading: false, error: error.message }))
  }, [logout, setSessionError])

  const load = useCallback((force = false) => {
    if (!mounted.current || !allowed || token !== localStorage.getItem('token') || mutation.current) return
    if (listRequest.current) return listRequest.current.promise
    // Como antes: caché hasta actualización manual o cambio de sesión, sin TTL nuevo.
    if (!force && cache.current.attempted) return
    const version = sessionVersion.current
    const pending = { controller: new AbortController() }
    const signal = AbortSignal.any([pending.controller.signal, sessionAbort.current.signal])
    const isCurrent = () => mounted.current && !signal.aborted && version === sessionVersion.current
      && token === localStorage.getItem('token') && listRequest.current === pending
    listRequest.current = pending
    cache.current.attempted = true
    setState(current => ({ userId, items: current.userId === userId ? current.items : [], loading: true, error: '' }))
    pending.promise = getPromotions({ token, signal }).then(data => {
      if (!isCurrent()) return
      cache.current.complete = true
      setState({ userId, items: data.map(promotionFromBackend), loading: false, error: '' })
    }).catch(error => { if (isCurrent()) reportError(error) })
      .finally(() => { if (isCurrent()) listRequest.current = null })
    return pending.promise
  }, [allowed, userId, token, sessionVersion, sessionAbort, reportError])
  useEffect(() => {
    if (!active) return
    let current = true
    Promise.resolve().then(() => { if (current) load() })
    return () => { current = false }
  }, [active, load, busyId])

  async function mutate(id, operation, afterSave) {
    if (!mounted.current || !allowed || token !== localStorage.getItem('token')) throw new Error('Ingresá con una cuenta administradora.')
    if (mutation.current) throw new Error('Esperá a que termine la operación de promociones.')
    const version = sessionVersion.current
    const pending = { controller: new AbortController() }
    const signal = AbortSignal.any([pending.controller.signal, sessionAbort.current.signal])
    const isCurrent = () => mounted.current && !signal.aborted && version === sessionVersion.current
      && token === localStorage.getItem('token') && mutation.current === pending
    mutation.current = pending
    cancelList()
    setBusyId(id ?? 'new')
    setState(current => ({ ...current, loading: false, error: '' }))
    try {
      const data = await operation({ token, signal })
      if (!isCurrent()) return false
      const saved = promotionFromBackend(data)
      // Ninguna lectura iniciada antes de esta escritura puede restaurar el listado.
      setState(current => ({ userId, loading: false, error: '',
        items: current.items.some(item => item.id === saved.id)
          ? current.items.map(item => item.id === saved.id ? saved : item) : [...current.items, saved] }))
      if (!cache.current.complete) cache.current.attempted = false
      invalidatePublicPromotions()
      afterSave?.(saved)
      return saved
    } catch (error) {
      if (!isCurrent()) return false
      reportError(error)
      throw error
    } finally {
      if (isCurrent()) { mutation.current = null; setBusyId(null) }
    }
  }
  function save(promotion) {
    return mutate(promotion.id, options => savePromotion(promotionToBackend(promotion), promotion.id, options), onSaved)
  }
  async function toggle(promotion) {
    try { return await mutate(promotion.id, options => setPromotionActive(promotion.id, !promotion.enabled, options)) }
    catch { return false } // La tarjeta presenta el error del hook; no deja un rechazo sin manejar.
  }

  return { promotions: allowed && state.userId === userId ? state.items : [],
    loading: allowed && (state.loading || (active && state.userId !== userId)),
    error: allowed ? state.error : '', busyId, refresh: () => load(true), save, toggle }
}
