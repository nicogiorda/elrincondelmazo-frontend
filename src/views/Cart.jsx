import { Link } from 'react-router-dom'
import Header from '../components/Header.jsx'
import Footer from '../components/Footer.jsx'
import CartItem from '../components/CartItem.jsx'
import PurchaseSummary from '../components/PurchaseSummary.jsx'
import PurchaseNotice from '../components/PurchaseNotice.jsx'

function Cart({ loading, cartBusy, quantitySyncItemId, cartError, cartMessage, onRetry, userId, cart, products = [], metadata = {}, cartCount, onQuantityChange, onRemove, onCheckout }) {
  if (!cart) return <PurchaseNotice title="Tu carrito" isLoggedIn
    message={cartError || 'Cargando carrito…'} onRetry={!loading && cartError ? onRetry : undefined} />
  const items = cart.items
  const summary = { subtotal: cart.subtotal, discounts: [] }
  return (
    <>
      <Header cartCount={cartCount} isLoggedIn />
      <main className="mx-auto flex w-full max-w-[85rem] flex-col gap-8 px-6 pt-9 pb-18 leading-[normal] lg:px-10">
        <section className="flex flex-wrap items-end justify-between gap-5 rounded-[2rem] border-[2.4px] border-bordo bg-rosa px-10 py-9 shadow-[0.5rem_0.5rem_0_var(--color-bordo)]">
          <h1 className="font-display text-[4rem] leading-[3.4rem] font-black text-crema uppercase sm:text-[6rem] sm:leading-[5.1rem]">Tu carrito</h1>
          <p className="text-[1.125rem] font-extrabold">{cartCount} {cartCount === 1 ? 'producto' : 'productos'}</p>
        </section>
        {cartError && <p role="alert" className="font-bold text-rojo">{cartError} <button type="button" disabled={cartBusy} onClick={onRetry} className="underline">Actualizar carrito</button></p>}
        {cartMessage && <p role="status" className="font-bold">{cartMessage}</p>}
        <div className="grid min-w-0 items-start gap-7 lg:grid-cols-[minmax(0,1fr)_21.25rem]">
          <div className="flex min-w-0 flex-col items-stretch gap-4.5">
            {!items.length && <p className="rounded-[1.375rem] border-[2.4px] border-bordo bg-papel p-6 font-bold">Tu carrito está vacío</p>}
            {items.map((item) => <CartItem key={item.id} item={item} product={products.find((product) => product.id === item.productId)} userId={userId} busy={cartBusy && quantitySyncItemId !== item.id} quantitySyncing={quantitySyncItemId === item.id} metadata={metadata[item.productId]} onRetry={onRetry} onQuantityChange={onQuantityChange} onRemove={onRemove} />)}<Link to="/catalogo" className="self-start text-[0.9375rem] font-bold underline">← Seguir comprando</Link>
          </div>
          <PurchaseSummary summary={summary} variant="cart">
            <button type="button" disabled={!items.length || cartBusy || !onCheckout} onClick={onCheckout} className="rounded-full bg-bordo px-6 py-4 text-[1.0625rem] font-extrabold text-crema disabled:opacity-50">Iniciar compra</button>
            <p className="text-[0.8125rem] leading-[1.1375rem] opacity-80">Podés revisar los descuentos y el total final en el siguiente paso, antes de confirmar.</p>
          </PurchaseSummary>
        </div>
      </main>
      <Footer isLoggedIn />
    </>
  )
}
export default Cart
