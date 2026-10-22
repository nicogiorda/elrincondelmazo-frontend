import AccountAccess from '../components/AccountAccess.jsx'
import { useEffect, useRef, useState } from 'react'

function Login({ cartCount, onLogin }) {
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const request = useRef(null)
  useEffect(() => () => request.current?.abort(), [])

  async function handleLogin(form) {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setError('')
    setLoading(true)
    try {
      await onLogin({ email: form.email, password: form.password }, { signal: controller.signal })
    } catch (error) {
      if (controller.signal.aborted) return
      setError(error instanceof TypeError
        ? 'No pudimos conectar con el servidor. Revisá tu conexión y volvé a intentar.' : error.message)
    } finally {
      request.current = null
      if (!controller.signal.aborted) setLoading(false)
    }
  }
  return <AccountAccess mode="login" cartCount={cartCount} onSubmit={handleLogin} error={error} loading={loading} />
}

export default Login
