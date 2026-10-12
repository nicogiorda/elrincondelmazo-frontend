import AccountAccess from '../components/AccountAccess.jsx'

function Login({ cartCount, onLogin }) {
  return <AccountAccess mode="login" cartCount={cartCount} onSubmit={onLogin} />
}
export default Login
