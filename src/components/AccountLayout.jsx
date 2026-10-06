import Header from './Header.jsx'
import Footer from './Footer.jsx'

const links = [{ view: 'orders', label: 'Mis pedidos' }, { view: 'profile', label: 'Mi perfil' }, { view: 'publications', label: 'Mis publicaciones' }]

function AccountLayout({ user, activeView, cartCount, onNavigate, children }) {
  return (
    <>
      <Header cartCount={cartCount} isLoggedIn onNavigate={onNavigate} />
      <main className="mx-auto w-full max-w-[85rem] px-6 pt-9 pb-18 leading-[normal] lg:px-10">
        <div className="grid min-w-0 items-start gap-7 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <aside className="flex min-w-0 flex-col gap-4" aria-label="Mi cuenta">
            <div className="flex flex-col items-start gap-3 rounded-[1.625rem] border-[2.4px] border-bordo bg-rojo p-5.5 text-crema shadow-product">
              <span className="flex size-[4.3rem] items-center justify-center rounded-full border-[2.4px] border-bordo bg-crema font-display text-[1.875rem] font-black text-bordo">{user.firstName[0]}{user.lastName[0]}</span>
              <p className="font-display text-[2rem] leading-[1.9rem] font-black uppercase">{user.firstName} {user.lastName}</p>
              <p className="max-w-full text-[0.875rem] font-semibold wrap-anywhere">{user.email}</p>
            </div>
            <nav className="flex flex-col gap-1 rounded-[1.625rem] border-[2.4px] border-bordo bg-papel p-2.5">
              {links.map((link) => <button key={link.view} type="button" aria-current={activeView === link.view ? 'page' : undefined} onClick={() => onNavigate?.(link.view)} className={`rounded-2xl px-4 py-3 text-left text-base font-extrabold ${activeView === link.view ? 'bg-bordo text-crema' : ''}`}>{link.label}</button>)}
            </nav>
          </aside>
          <div className="flex min-w-0 flex-col gap-6">{children}</div>
        </div>
      </main>
      <Footer isLoggedIn onNavigate={onNavigate} />
    </>
  )
}
export default AccountLayout
