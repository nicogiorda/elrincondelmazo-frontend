import { useState } from 'react'
import { Link } from 'react-router-dom'
import Header from './Header.jsx'
import Footer from './Footer.jsx'
import FormField from './FormField.jsx'

function AccountAccess({ mode, cartCount, onSubmit, error, loading }) {
  const isRegister = mode === 'register'
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  function changeField(field, value) { setForm((current) => ({ ...current, [field]: value })) }
  return (
    <>
      <Header cartCount={cartCount} />
      <main className="mx-auto w-full max-w-[85rem] px-6 pt-9 pb-18 leading-[normal] lg:px-10">
        <div className="mx-auto grid max-w-[73.75rem] gap-8 lg:grid-cols-2">
          <section className="flex min-h-[36.25rem] min-w-0 flex-col gap-5 overflow-hidden rounded-[2.25rem] border-[2.4px] border-bordo bg-rojo p-7 text-crema shadow-[0.625rem_0.625rem_0_var(--color-bordo)] sm:p-12">
            <h1 className="font-display text-[4.5rem] leading-[3.825rem] font-black uppercase sm:text-[6rem] sm:leading-[5.1rem]">{isRegister ? 'Sumate al rincón' : 'Hola de nuevo'}</h1>
            <p className="max-w-[25rem] text-[1.125rem] leading-[1.63125rem] font-semibold text-pretty">{isRegister ? 'Con una cuenta podés comprar, seguir tus pedidos y publicar tus propias cartas, sobres y lootboxes.' : 'Ingresá para comprar, seguir tus pedidos y administrar tus publicaciones.'}</p>
            <div aria-hidden="true" className="relative min-h-[13.75rem] min-w-0 flex-1">
              <div className={`absolute ${isRegister ? 'top-[1.52rem]' : 'top-[1.75rem]'} left-[4.133rem] h-[11.6875rem] w-[8.4375rem] -rotate-12 rounded-[0.875rem] border-[2.4px] border-bordo bg-amarillo shadow-[0.3125rem_0.3125rem_0_var(--color-bordo)]`} />
              <div className={`absolute ${isRegister ? '-top-[0.181rem]' : 'top-[0.033rem]'} left-[10.049rem] h-[12.5625rem] w-[9.0625rem] rotate-2 rounded-[0.875rem] border-[2.4px] border-bordo bg-rosa shadow-[0.3125rem_0.3125rem_0_var(--color-bordo)]`} />
              <div className={`absolute ${isRegister ? 'top-[1.793rem]' : 'top-[2.027rem]'} left-[16.258rem] h-[11.6875rem] w-[8.4375rem] rotate-14 rounded-[0.875rem] border-[2.4px] border-bordo bg-crema shadow-[0.3125rem_0.3125rem_0_var(--color-bordo)]`} />
            </div>
          </section>
          <section aria-label={isRegister ? 'Crear cuenta' : 'Ingresar'} className="flex min-w-0 flex-col justify-center gap-5.5 rounded-[2.25rem] border-[2.4px] border-bordo bg-papel p-6 sm:p-10">
            <nav aria-label="Acceso a la cuenta" className="grid grid-cols-2 rounded-full border-[2.4px] border-bordo bg-crema p-1 text-center text-base font-extrabold">
              <Link to="/ingresar" aria-current={!isRegister ? 'page' : undefined} className={`rounded-full p-3 ${!isRegister ? 'bg-bordo text-crema' : ''}`}>Ingresar</Link>
              <Link to="/crear-cuenta" aria-current={isRegister ? 'page' : undefined} className={`rounded-full p-3 ${isRegister ? 'bg-bordo text-crema' : ''}`}>Crear cuenta</Link>
            </nav>
            <form onSubmit={(event) => { event.preventDefault(); onSubmit?.(form) }} className="flex flex-col gap-4.5">
              {isRegister && <div className="grid grid-cols-2 gap-3.5">
                <FormField id="access-first-name" label="Nombre" autoComplete="given-name" required value={form.firstName} onChange={(event) => changeField('firstName', event.target.value)} />
                <FormField id="access-last-name" label="Apellido" autoComplete="family-name" required value={form.lastName} onChange={(event) => changeField('lastName', event.target.value)} />
              </div>}
              <FormField id="access-email" label="Email" type="email" autoComplete="email" placeholder="tu@mail.com" required value={form.email} onChange={(event) => changeField('email', event.target.value)} />
              <label htmlFor="access-password" className="flex flex-col gap-2">
                <span className="text-[0.8125rem] font-extrabold tracking-[0.04875rem] uppercase">Contraseña</span>
                <span className="flex min-w-0 items-center rounded-[0.875rem] border-[2.4px] border-bordo bg-crema pr-2">
                  <input id="access-password" aria-label="Contraseña" type={showPassword ? 'text' : 'password'} autoComplete={isRegister ? 'new-password' : 'current-password'} required value={form.password} onChange={(event) => changeField('password', event.target.value)} className="h-[3.15rem] min-w-0 flex-1 bg-transparent px-4 text-[1.0625rem] font-semibold" />
                  <button type="button" aria-controls="access-password" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)} className="rounded-full px-2.5 py-2 text-[0.8125rem] font-extrabold">{showPassword ? 'Ocultar' : 'Mostrar'}</button>
                </span>
              </label>
              {error && <p className="error-message">{error}</p>}
              <div className="pt-1"><button type="submit" disabled={loading} className="min-h-[3.875rem] w-full rounded-full border-[2.4px] border-bordo bg-bordo px-6 py-4.25 text-[1.125rem] font-extrabold text-crema">{loading ? (isRegister ? 'Registrando...' : 'Ingresando...') : (isRegister ? 'Crear cuenta' : 'Ingresar') }</button></div>
            </form>
            <p className="flex flex-wrap justify-center gap-1.5 text-[0.9375rem] font-semibold">{isRegister ? '¿Ya tenés cuenta?' : '¿Todavía no tenés cuenta?'} <Link to={isRegister ? '/ingresar' : '/crear-cuenta'} className="font-extrabold">{isRegister ? 'Ingresá' : 'Creá una'}</Link></p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  )
}
export default AccountAccess
