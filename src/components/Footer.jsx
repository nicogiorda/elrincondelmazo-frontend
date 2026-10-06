import logo from '../assets/logo-footer.svg'

const storeLinks = ['Cartas', 'Sobres', 'Lootboxes', 'Catálogo completo']
const accountLinks = ['Ingresar', 'Crear cuenta', 'Mis pedidos', 'Publicar un producto']
const paymentMethods = ['Crédito', 'Débito', 'Mercado Pago', 'Transferencia']

function Footer({ variant = 'default', isLoggedIn = false, onNavigate }) {
  const visibleAccountLinks = isLoggedIn ? ['Mi perfil', 'Mis pedidos', 'Carrito', 'Publicar un producto'] : accountLinks
  const destinations = { Cartas: 'catalog', Sobres: 'catalog', Lootboxes: 'catalog', 'Catálogo completo': 'catalog', Ingresar: 'profile', 'Crear cuenta': 'profile', 'Mi perfil': 'profile', 'Mis pedidos': 'orders', Carrito: 'cart', 'Publicar un producto': 'publish' }
  const types = { Cartas: 'CARTA', Sobres: 'SOBRE', Lootboxes: 'LOOTBOX' }
  return (
    <footer className={`bg-bordo px-6 pt-14 pb-7 text-[0.9375rem] leading-[normal] text-crema lg:px-10 ${variant === 'home' ? 'min-h-[25.5625rem]' : ''}`}>
      <div className="mx-auto grid max-w-[80rem] grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div className="flex flex-col items-start gap-3.5">
          <div className="h-[8.125rem] w-[12.5rem]">
            <img src={logo} alt="El Rincón del Mazo" width="193" height="127.125" />
          </div>
          <p className="max-w-[18.75rem] leading-[1.359375rem] opacity-85">
            Marketplace de cartas coleccionables, sobres y lootboxes.
          </p>
        </div>

        <nav aria-label="Tienda" className="flex flex-col items-start gap-2.5">
          <h2 className="text-[0.8125rem] font-extrabold tracking-[0.065rem] text-amarillo uppercase">Tienda</h2>
          {storeLinks.map((label) => (
            <button key={label} type="button" onClick={() => onNavigate?.(destinations[label], { type: types[label] })} className="text-left">{label}</button>
          ))}
        </nav>

        <nav aria-label="Cuenta" className="flex flex-col items-start gap-2.5">
          <h2 className="text-[0.8125rem] font-extrabold tracking-[0.065rem] text-amarillo uppercase">Cuenta</h2>
          {visibleAccountLinks.map((label) => (
            <button key={label} type="button" onClick={() => onNavigate?.(destinations[label], { type: types[label] })} className="text-left">{label}</button>
          ))}
        </nav>

        <section aria-labelledby="payment-heading" className="flex flex-col items-start gap-2.5">
          <h2 id="payment-heading" className="text-[0.8125rem] font-extrabold tracking-[0.065rem] text-amarillo uppercase">Medios de pago</h2>
          <ul className="flex max-w-[17.8125rem] flex-wrap gap-2 text-[0.8125rem] font-bold">
            {paymentMethods.map((method) => (
              <li key={method} className="rounded-full border-2 border-crema px-3 py-1.25 whitespace-nowrap">
                {method}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mx-auto mt-10 flex max-w-[80rem] flex-wrap justify-between gap-4 border-t-2 border-crema/25 pt-5 text-[0.8125rem] opacity-80">
        <p>© 2026 El Rincón del Mazo</p>
        <div className="flex items-center gap-1">
          <button type="button">Términos</button>
          <span aria-hidden="true">·</span>
          <button type="button">Privacidad</button>
        </div>
      </div>
    </footer>
  )
}

export default Footer
