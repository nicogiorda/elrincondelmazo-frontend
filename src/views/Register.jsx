import AccountAccess from '../components/AccountAccess.jsx'

function Register({ cartCount, onRegister }) {
  return <AccountAccess mode="register" cartCount={cartCount} onSubmit={onRegister} />
}
export default Register
