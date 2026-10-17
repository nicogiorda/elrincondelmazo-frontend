import { useState } from 'react'
import AccountLayout from '../components/AccountLayout.jsx'
import FormField from '../components/FormField.jsx'

function Profile({ user, onLogout, cartCount, onSave, saving, onDeactivate, deactivating, deactivateError }) {
  const [form, setForm] = useState({ firstName: user.firstName, lastName: user.lastName, email: user.email })
  const [error, setError] = useState("");

  function changeField(field, value) { setForm({ ...form, [field]: value }) }
  async function handleSave(form) {
    setError('')
    try {
      const updated = await onSave(form)
      // null significa que la sesión cambió, se cerró o ya hay un envío pendiente.
      if (!updated) return
      setForm({ firstName: updated.firstName, lastName: updated.lastName, email: updated.email })
    } catch (error) {
      setError(error.message)
    }
  }
  return (
    <AccountLayout user={user} activeView="profile" cartCount={cartCount} onLogout={onLogout}>
      <h1 className="font-display text-[4rem] leading-[3.52rem] font-black uppercase">Mi perfil</h1>
      <form aria-busy={saving} onSubmit={(event) => { event.preventDefault(); handleSave(form) }} className="flex flex-col items-start gap-5.5 rounded-[1.75rem] border-[2.4px] border-bordo bg-papel p-8 shadow-[0.5rem_0.5rem_0_var(--color-bordo)]">
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-[2.125rem] font-black uppercase">Datos personales</h2>
          <div className="flex gap-2 text-[0.8125rem] font-extrabold uppercase">
            <span className="rounded-full border-[1.6px] border-bordo bg-amarillo px-3 py-1.25">Usuario</span>
          </div>
        </div>
        <div className="grid w-full gap-4.5 sm:grid-cols-2">
          <FormField disabled={saving || deactivating} id="profile-name" label="Nombre" required value={form.firstName} onChange={(e) => changeField('firstName', e.target.value)} />
          <FormField disabled={saving || deactivating} id="profile-last-name" label="Apellido" required value={form.lastName} onChange={(e) => changeField('lastName', e.target.value)} />
          <div className="sm:col-span-2">
            <FormField disabled={saving || deactivating} id="profile-email" label="Email" type="email" required value={form.email} onChange={(e) => changeField('email', e.target.value)} />
          </div>
        </div>
        {error && (<p role="alert" className="font-semibold text-rojo">{error}</p>)}
        <button className="rounded-full bg-bordo px-7 py-3.75 text-base font-extrabold text-crema" type="submit" disabled={saving || deactivating}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
      </form>
      <section className="flex flex-wrap items-center justify-between gap-5 rounded-[1.75rem] border-[2.4px] border-dashed border-bordo px-8 py-7">
        <div>
          <h2 className="font-display text-[1.875rem] font-black uppercase">Eliminar cuenta</h2>
          <p className="mt-1 text-[0.9375rem] leading-[1.359375rem]">Se desactiva tu cuenta y tus publicaciones dejan de verse en el catálogo.</p>
        </div>
        <button type="button" disabled={!onDeactivate || saving || deactivating} aria-busy={deactivating} onClick={() => onDeactivate?.(user)} className="rounded-full border-[2.4px] border-rojo px-6 py-3.25 text-[0.9375rem] font-extrabold text-rojo disabled:cursor-not-allowed disabled:opacity-50">Eliminar cuenta</button>
        {deactivateError && (<p role="alert" className="font-semibold text-rojo">{deactivateError}</p>)}
      </section>
    </AccountLayout>
  )
}
export default Profile
