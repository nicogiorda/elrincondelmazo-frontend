import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authenticate, getCurrentUser, register as registerAccount } from '../services/authApi.js'

// Una sola instancia en App. El callback limpia datos de otros dominios sin
// introducir dependencias de carrito, pedidos o publicaciones en este hook.
export default function useSession({ onSessionChange }) {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('token')))
  const [sessionError, setSessionError] = useState('')
  const sessionVersion = useRef(0)
  const sessionAbort = useRef(new AbortController())
  const sessionRequested = useRef(false)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      // StrictMode vuelve a montar los efectos en el mismo turno. El desmontaje
      // real invalida inmediatamente resultados y aborta al finalizar ese turno.
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
    onSessionChange()
  }, [onSessionChange])

  const logout = useCallback(() => {
    invalidateSession()
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
    setLoading(false)
    navigate('/ingresar', { replace: true })
  }, [invalidateSession, navigate])

  useEffect(() => {
    if (sessionRequested.current) return
    sessionRequested.current = true
    const savedToken = localStorage.getItem('token')
    if (!savedToken) return
    const version = sessionVersion.current
    const isCurrent = () => mounted.current && version === sessionVersion.current
      && savedToken === localStorage.getItem('token')
    getCurrentUser({ token: savedToken, signal: sessionAbort.current.signal })
      .then((usuario) => { if (isCurrent()) setUser(usuario) })
      .catch((error) => {
        if (!isCurrent()) return
        if (error.status === 401 || error.status === 403 || error.code === 'INVALID_USER') logout()
        setSessionError(error instanceof TypeError
          ? 'No pudimos conectar con el servidor. Revisá tu conexión y volvé a intentar.' : error.message)
      })
      .finally(() => {
        if (mounted.current && (version === sessionVersion.current || !localStorage.getItem('token'))) setLoading(false)
      })
  }, [logout])

  const startSession = useCallback(async (operation, credentials, { signal } = {}) => {
    const version = sessionVersion.current
    const previousToken = localStorage.getItem('token')
    const requestSignal = signal ? AbortSignal.any([signal, sessionAbort.current.signal]) : sessionAbort.current.signal
    const session = await operation(credentials, { signal: requestSignal })
    if (!mounted.current || requestSignal.aborted || version !== sessionVersion.current
      || previousToken !== localStorage.getItem('token')) return false
    // authApi ya verificó token y usuario. Invalidar A antes de publicar B.
    invalidateSession()
    localStorage.setItem('token', session.token)
    setToken(session.token)
    setUser(session.user)
    setSessionError('')
    setLoading(false)
    navigate('/mi-perfil', { replace: true })
    return true
  }, [invalidateSession, navigate])

  const login = useCallback((credentials, options) => startSession(authenticate, credentials, options), [startSession])
  const register = useCallback((credentials, options) => startSession(registerAccount, credentials, options), [startSession])

  // App solo lee estas refs para conservar los controles de sus operaciones.
  // La versión y el controlador se modifican exclusivamente dentro del hook.
  // setUser permite aplicar el perfil confirmado sin iniciar otra sesión.
  return { user, token, loading, sessionError, setSessionError, setUser,
    login, register, logout, sessionVersion, sessionAbort }
}
