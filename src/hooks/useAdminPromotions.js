import { useCallback, useEffect, useRef } from 'react'
import { useDispatch, useSelector, useStore } from 'react-redux'
import {
  fetchAdminPromotions, saveAdminPromotion, toggleAdminPromotion, promotionsSessionCleared,
} from '../Redux/promotionsSlice.js'
import { invalidatePublicPromotions } from '../services/publicPromotions.js'

// App conserva una unica instancia: Redux guarda datos y estados de las
// promesas, el hook coordina cancelación, exclusión y cambio de sesión.
export default function useAdminPromotions({ user, token, active, sessionVersion, sessionAbort,
  subscribeSessionChange, logout, setSessionError, onSaved }) {
  const dispatch = useDispatch()
  const store = useStore()
  const admin = useSelector(state => state.promotions.admin)
  const listRequest = useRef(null)
  const mutation = useRef(null)
  const mounted = useRef(false)
  const userId = user?.id
  const allowed = user?.role === 'ADMIN' && Boolean(userId && token)
  const scoped = admin.ownerId === userId && admin.generation === sessionVersion.current

  const cancelList = useCallback(() => {
    if (listRequest.current) {
      listRequest.current.controller.abort()
      listRequest.current = null
    }
  }, [])
  const cancelRequests = useCallback(() => {
    cancelList()
    mutation.current?.controller.abort()
    mutation.current = null
  }, [cancelList])
  const reset = useCallback(() => {
    cancelRequests()
    dispatch(promotionsSessionCleared())
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
    if (!mounted.current || !allowed || token !== localStorage.getItem('token') || mutation.current) return
    if (listRequest.current) return listRequest.current.promise
    const version = sessionVersion.current
    const previous = store.getState().promotions.admin
    const isSame = previous.ownerId === userId && previous.generation === version
    // Como antes, no hay un TTL nuevo: GET solo al entrar, reintentar o
    // actualizar manualmente; una respuesta fallida no dispara un loop.
    if (!force && isSame && ['succeeded', 'failed'].includes(previous.status)) return
    const pending = { controller: new AbortController() }
    const signal = AbortSignal.any([pending.controller.signal, sessionAbort.current.signal])
    const isCurrent = () => mounted.current && !signal.aborted && version === sessionVersion.current
      && token === localStorage.getItem('token') && listRequest.current === pending
    listRequest.current = pending
    const scope = { ownerId: userId, generation: version }
    pending.promise = dispatch(fetchAdminPromotions(scope, { signal })).unwrap()
      .then(() => isCurrent() ? true : false)
      .catch(error => {
        if (isCurrent() && error.status === 401) { logout(); setSessionError(error.message) }
        return false
      })
      .finally(() => {
        if (listRequest.current === pending) listRequest.current = null
      })
    return pending.promise
  }, [allowed, userId, token, sessionVersion, sessionAbort, logout, setSessionError, store, dispatch])

  useEffect(() => {
    if (!active) return
    let current = true
    // StrictMode no debe enviar dos GET en el montaje de desarrollo.
    Promise.resolve().then(() => { if (current) load() })
    return () => { current = false }
  }, [active, load, admin.busyId])

  async function mutate(operation, args, afterSave) {
    if (!mounted.current || !allowed || token !== localStorage.getItem('token')) {
      throw new Error('Ingresá con una cuenta administradora.')
    }
    if (mutation.current) throw new Error('Esperá a que termine la operación de promociones.')
    const version = sessionVersion.current
    const pending = { controller: new AbortController() }
    const signal = AbortSignal.any([pending.controller.signal, sessionAbort.current.signal])
    const isCurrent = () => mounted.current && !signal.aborted && version === sessionVersion.current
      && token === localStorage.getItem('token') && mutation.current === pending
    mutation.current = pending
    cancelList()
    try {
      const saved = await dispatch(operation({
        ...args, ownerId: userId, generation: version,
      }, { signal })).unwrap()
      if (!isCurrent()) return false
      invalidatePublicPromotions()
      afterSave?.(saved)
      return saved
    } catch (error) {
      if (!isCurrent()) return false
      if (error.status === 401) { logout(); setSessionError(error.message) }
      throw error
    } finally {
      if (mutation.current === pending) mutation.current = null
    }
  }

  function save(promotion) {
    return mutate(saveAdminPromotion, { promotion }, onSaved)
  }
  function toggle(promotion) {
    return mutate(toggleAdminPromotion, { promotionId: promotion.id, active: !promotion.enabled })
      .catch(() => false)
  }

  return {
    promotions: allowed && scoped ? admin.items : [],
    loading: allowed && (scoped ? admin.status === 'loading' : active),
    error: allowed && scoped ? admin.error : '',
    busyId: allowed && scoped ? admin.busyId : null,
    refresh: () => load(true), save, toggle,
  }
}
