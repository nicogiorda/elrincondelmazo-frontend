import { Link } from 'react-router-dom'
import Header from './Header.jsx'
import Footer from './Footer.jsx'

function PurchaseNotice({ title, onRetry, isLoggedIn = false, cartCount = 0, message = 'Las compras todavía no están disponibles. Podés seguir explorando el catálogo.' }) {
  return (
    <>
      <Header isLoggedIn={isLoggedIn} cartCount={cartCount} />
      <main className="mx-auto flex max-w-[85rem] flex-col items-start gap-6 px-6 py-12">
        <h1 className="font-display text-[3rem] font-black uppercase">{title}</h1>
        <p role="status" className="font-semibold">{message}</p>
        {onRetry && <button type="button" onClick={onRetry} className="font-bold underline">Reintentar</button>}
        <Link to="/catalogo" className="rounded-full bg-bordo px-6 py-3 font-bold text-crema">Volver al catálogo</Link>
      </main>
      <Footer isLoggedIn={isLoggedIn} />
    </>
  )
}
export default PurchaseNotice
