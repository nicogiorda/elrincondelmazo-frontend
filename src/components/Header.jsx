import logo from '../assets/logo-header.svg'

const categories = ['Cartas', 'Sobres', 'Lootboxes', 'Colecciones']
const categoryTypes = { Cartas: 'CARTA', Sobres: 'SOBRE', Lootboxes: 'LOOTBOX' }

function Header({ cartCount = 0, isLoggedIn = false, onNavigate }) {
  const actions = [{ label: 'Buscar', view: 'catalog' }, { label: 'Vender', view: 'publications' }, { label: isLoggedIn ? 'Mi cuenta' : 'Ingresar', view: 'profile' }]
  return (
    <header className="grid grid-cols-1 items-center gap-6 bg-bordo px-6 py-2.5 text-[0.9375rem] leading-[normal] font-bold text-crema lg:grid-cols-[minmax(0,1fr)_9.375rem_minmax(0,1fr)] lg:px-10">
      <nav aria-label="Categorías" className="flex flex-wrap justify-center gap-7 lg:justify-start">
        {categories.map((category) => (
          <button key={category} type="button" onClick={() => onNavigate?.(category === 'Colecciones' ? 'home' : 'catalog', { type: categoryTypes[category] })}>{category}</button>
        ))}
      </nav>

      <button type="button" onClick={() => onNavigate?.('home')} aria-label="Ir al inicio" className="row-start-1 mx-auto h-[6.125rem] w-[9.375rem] lg:col-start-2 lg:row-start-auto">
        <img src={logo} alt="El Rincón del Mazo" width="148" height="97.4844" />
      </button>

      <nav aria-label="Cuenta y compras" className="flex flex-wrap items-center justify-center gap-5.5 lg:justify-end">
        {actions.map((action) => (
          <button key={action.label} type="button" onClick={() => onNavigate?.(action.view)}>{action.label}</button>
        ))}
        <button type="button" onClick={() => onNavigate?.('cart')} className="flex items-center gap-2 rounded-full bg-crema py-2 pr-2 pl-4 text-bordo">
          Carrito
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-rojo px-1 text-[0.8125rem] text-crema">
            {cartCount}
          </span>
        </button>
      </nav>
    </header>
  )
}

export default Header
