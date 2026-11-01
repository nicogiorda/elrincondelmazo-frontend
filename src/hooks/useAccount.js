import { useCallback, useEffect, useRef, useState } from 'react'
import { updateProfile, deactivateAccount } from '../services/accountApi.js'

export default function useAccount({ user, token, setUser, logout, setSessionError,
  sessionVersion, sessionAbort, subscribeSessionChange }) {
  const [busy, setBusy] = useState(null)
  const [deactivateError, setDeactivateError] = useState('')
  const request = useRef(null)
  const mounted = useRef(false)
  const cancel = useCallback(() => {
    request.current?.controller.abort()
    request.current = null
  }, [])
  const reset = useCallback(() => {
    cancel()
    setBusy(null)
    setDeactivateError('')
  }, [cancel])
  useEffect(() => {
    mounted.current = true
    const unsubscribe = subscribeSessionChange(reset)
    return () => {
      mounted.current = false
      unsubscribe()
      queueMicrotask(() => { if (!mounted.current) cancel() })
    }
  }, [subscribeSessionChange, reset, cancel])

  async function run(kind, operation) {
    if (!mounted.current || !user || !token || token !== localStorage.getItem('token')) return null
    if (request.current) return null
    const pending = { controller: new AbortController() }
    const version = sessionVersion.current, userId = user.id, previousEmail = user.email
    const signal = AbortSignal.any([pending.controller.signal, sessionAbort.current.signal])
    const sameSession = () => mounted.current && !signal.aborted && version === sessionVersion.current
      && token === localStorage.getItem('token')
    const isCurrent = () => sameSession() && request.current === pending
    request.current = pending
    setBusy(kind)
    setDeactivateError('')
    try {
      const updated = await operation({ userId, token, signal })
      if (!isCurrent()) return null
      if (kind === 'deactivate' || updated.email !== previousEmail) {
        logout()
        return null
      }
      // El updater puede ejecutarse después de liberar el bloqueo, pero nunca en otra sesión.
      setUser(current => sameSession() && current?.id === userId ? updated : current)
      return updated
    } catch (error) {
      if (!isCurrent()) return null
      if (error.status === 401) {
        logout()
        setSessionError(error.message)
        return null
      }
      const message = error instanceof TypeError || error.code === 'ACCOUNT_UNCONFIRMED'
        ? 'No pudimos confirmar el resultado. La operación puede haberse aplicado. Verificá el estado de tu cuenta antes de volver a enviar.'
        : error.message
      if (kind === 'deactivate') { setDeactivateError(message); return null }
      throw new Error(message, { cause: error })
    } finally {
      if (isCurrent()) { request.current = null; setBusy(null) }
    }
  }

  return { profileSaving: busy === 'save', deactivating: busy === 'deactivate', deactivateError,
    saveProfile: form => run('save', options => updateProfile(form, options)),
    deactivateAccount: () => run('deactivate', deactivateAccount) }
}
