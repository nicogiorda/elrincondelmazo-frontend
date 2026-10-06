import Header from '../components/Header.jsx'
import Footer from '../components/Footer.jsx'
import PurchaseItems from '../components/PurchaseItems.jsx'
import PurchaseSummary from '../components/PurchaseSummary.jsx'

function OrderConfirmation({ order, onNavigate }) {
  return (
    <>
      <Header cartCount={0} isLoggedIn onNavigate={onNavigate} />
      <main className="mx-auto w-full max-w-[66.25rem] px-6 pt-9 pb-18 leading-[normal] lg:px-10">
        <div className="flex min-w-0 flex-col gap-8">
          <section className="relative flex min-h-[25.0375rem] flex-col items-start gap-4.5 overflow-hidden rounded-[2.25rem] border-[2.4px] border-bordo bg-amarillo px-6 py-13 shadow-[0.625rem_0.625rem_0_var(--color-bordo)] sm:px-12">
            <span className="rounded-full border-[2.4px] border-bordo bg-crema px-3.5 py-1.5 text-[0.8125rem] font-extrabold uppercase">Estado: Pendiente</span>
            <h1 className="max-w-[38.75rem] font-display text-[3rem] leading-[2.55rem] font-black text-crema uppercase sm:text-[6.25rem] sm:leading-[5.3125rem]">¡Pedido confirmado!</h1>
            <p className="max-w-[32.5rem] text-[1.125rem] leading-[1.63125rem] font-semibold">Registramos tu pedido el {order.date}. Podés seguir su estado desde Mis pedidos.</p>
            <span className="mt-3 flex size-[8.4375rem] rotate-12 flex-col items-center justify-center self-end rounded-full border-[2.4px] border-bordo bg-rosa font-display text-[1.625rem] leading-[1.54375rem] font-black uppercase shadow-[0.25rem_0.25rem_0_var(--color-bordo)] sm:absolute sm:right-12 sm:bottom-12">
              <span>Pedido</span>
              <span>#{order.id}</span>
            </span>
          </section>
          <section className="flex flex-col gap-3 rounded-[1.75rem] border-[2.4px] border-bordo bg-papel px-8 py-7">
            <PurchaseItems items={order.items} variant="confirmation" />
            <PurchaseSummary summary={order.summary} variant="confirmation" paymentMethod={order.paymentMethod} />
          </section>
          <div className="flex flex-wrap justify-center gap-3.5">
            <button type="button" onClick={() => onNavigate?.('orders')} className="rounded-full bg-bordo px-8 py-4.5 text-base font-extrabold text-crema">Ver mis pedidos</button>
            <button type="button" onClick={() => onNavigate?.('catalog')} className="rounded-full border-[2.4px] border-bordo px-7 py-4 text-base font-extrabold shadow-[0.1875rem_0.1875rem_0_var(--color-bordo)]">Seguir comprando</button>
          </div>
        </div>
      </main>
      <Footer isLoggedIn onNavigate={onNavigate} />
    </>
  )
}
export default OrderConfirmation
