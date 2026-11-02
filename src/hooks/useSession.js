import { useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector, useStore } from 'react-redux'
import {
  fetchAuthenticatedUser, loginUser, registerUser, stageAuthCredentials,
  discardAuthCredentials, sessionAuthenticated, sessionEnded,
  sessionErrorChanged, authenticatedUserUpdated,
} from '../Redux/userSlice.js'

const noop = () => {}

// Única instancia en App. Estado global en Redux como en el demo de Gisele;
// las refs solo coordinan cancelaciones, desmontaje y cambios de sesión.
export default function useSession({ onSessionChange = noop } = {}) {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const store = useStore()
  const { user, token, loading, sessionError } = useSelector(state => state.users)
  const sessionVersion = useRef(0)
  const sessionAbort = useRef(new AbortController())
  const sessionRequested = useRef(false)
  const mounted = useRef(false)
  const sessionListeners = useRef(new Set())

  const subscribeSessionChange = useCallback(listener => {
    sessionListeners.current.add(listener)
    return () => sessionListeners.current.delete(listener)
  }, [])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      queueMicrotask(() => {
        if (!mounted.current) {
          sessionVersion.current += 1
          sessionAbort.current.abort()
        }
      })
    }
  }, [])

  const invalidateSession = useCallback(() => {
    sessionVersion.current += 1
    sessionAbort.current.abort()
    sessionAbort.current = new AbortController()
    sessionListeners.current.forEach(listener => listener())
    onSessionChange()
  }, [onSessionChange])

  const setSessionError = useCallback(message => {
    dispatch(sessionErrorChanged(message))
  }, [dispatch])

  const setUser = useCallback(updater => {
    const previous = store.getState().users.user
    const updated = typeof updater === 'function' ? updater(previous) : updater
    if (updated && updated !== previous) dispatch(authenticatedUserUpdated(updated))
  }, [dispatch, store])

  const logout = useCallback(() => {
    invalidateSession()
    localStorage.removeItem('token')
    dispatch(sessionEnded())
    navigate('/ingresar', { replace: true })
  }, [invalidateSession, dispatch, navigate])

  useEffect(() => {
    if (sessionRequested.current) return
    sessionRequested.current = true
    const savedToken = localStorage.getItem('token')
    if (!savedToken) return
    const version = sessionVersion.current
    const isCurrent = () => mounted.current && version === sessionVersion.current
      && savedToken === localStorage.getItem('token')
    dispatch(fetchAuthenticatedUser()).then(action => {
      if (!isCurrent() || !fetchAuthenticatedUser.rejected.match(action) || action.meta.aborted) return
      const error = action.error
      if (error.status === 401 || error.status === 403 || error.code === 'INVALID_USER') logout()
      setSessionError(error.code === 'ERR_NETWORK'
        ? 'No pudimos conectar con el servidor. Revisá tu conexión y volvé a intentar.'
        : error.message)
    })
  }, [dispatch, logout, setSessionError])

  const startSession = useCallback(async (operation, credentials, { signal } = {}) => {
    const version = sessionVersion.current
    const previousToken = localStorage.getItem('token')
    const requestSignal = signal ? AbortSignal.any([signal, sessionAbort.current.signal]) : sessionAbort.current.signal
    const requestId = stageAuthCredentials(credentials)
    const pending = dispatch(operation(requestId))
    const abort = () => pending.abort()
    if (requestSignal.aborted) abort()
    else requestSignal.addEventListener('abort', abort, { once: true })
    try {
      const session = await pending.unwrap()
      if (!mounted.current || requestSignal.aborted || version !== sessionVersion.current
        || previousToken !== localStorage.getItem('token')) return false
      // La API verificó el usuario con /users/me: invalidar A antes de publicar B.
      invalidateSession()
      localStorage.setItem('token', session.token)
      dispatch(sessionAuthenticated(session))
      navigate('/mi-perfil', { replace: true })
      return true
    } finally {
      requestSignal.removeEventListener('abort', abort)
      discardAuthCredentials(requestId)
    }
  }, [dispatch, invalidateSession, navigate])

  const login = useCallback((credentials, options) => startSession(loginUser, credentials, options), [startSession])
  const register = useCallback((credentials, options) => startSession(registerUser, credentials, options), [startSession])

  return { user, token, loading, sessionError, setSessionError, setUser,
    login, register, logout, sessionVersion, sessionAbort, subscribeSessionChange }
}
