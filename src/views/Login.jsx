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
      const response = await fetch('http://localhost:8080/api/v1/auth/authenticate', {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, password: form.password }),
      })
      if (response.status === 401) throw new Error('El correo o la contraseña son incorrectos')
      if (!response.ok) throw new Error('No pudimos iniciar sesión (HTTP ' + response.status + '). Volvé a intentar.')
      const data = await response.json().catch(() => { throw new Error('El servidor devolvió una respuesta de autenticación inválida.') })
      const token = data.access_token
      if (typeof token !== 'string' || !token.trim()) throw new Error('La autenticación no devolvió un token válido.')

      // El token candidato no se guarda hasta verificar la cuenta completa.
      const responseUsuario = await fetch('http://localhost:8080/users/me', {
        headers: { Authorization: 'Bearer ' + token }, signal: controller.signal,
      })
      if (!responseUsuario.ok) throw new Error('No pudimos verificar tu cuenta (HTTP ' + responseUsuario.status + '). Volvé a ingresar.')
      const usuario = await responseUsuario.json().catch(() => { throw new Error('El servidor devolvió datos de usuario inválidos.') })
      if (!Number.isSafeInteger(usuario.id) || usuario.id < 1 || !usuario.email
        || typeof usuario.firstName !== 'string' || typeof usuario.lastName !== 'string'
        || !['USUARIO', 'ADMIN'].includes(usuario.role) || usuario.active === false) {
        throw new Error('El servidor devolvió datos de usuario inválidos.')
      }
      if (controller.signal.aborted) return
      localStorage.setItem('token', token)
      onLogin(usuario)
    } catch (error) {
      if (controller.signal.aborted) return
      setError(error instanceof TypeError
        ? 'No pudimos conectar con el servidor. Revisá tu conexión y volvé a intentar.' : error.message)
    } finally {
      request.current = null
      setLoading(false)
    }
  }
  return <AccountAccess mode="login" cartCount={cartCount} onSubmit={handleLogin} error={error} loading={loading} />
}

export default Login
