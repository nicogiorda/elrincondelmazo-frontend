import { Link } from 'react-router-dom'
import { paymentMethods, paymentMethodLabel } from '../data/paymentMethods.js'
import { useState } from 'react'
import Header from '../components/Header.jsx'
import Footer from '../components/Footer.jsx'
import ProgressSteps from '../components/ProgressSteps.jsx'
import PurchaseItems from '../components/PurchaseItems.jsx'
import PurchaseSummary from '../components/PurchaseSummary.jsx'
import { calculateMockSummary, formatPrice } from '../data/purchaseMocks.js'

const headings = ['Revisá tu pedido', '¿Cómo querés pagar?', 'Confirmá tu pedido']

function Checkout({ items, cartCount, onConfirm }) {
  const [step, setStep] = useState(1)
  const [paymentMethod, setPaymentMethod] = useState('TRANSFERENCIA')
  const summary = calculateMockSummary(items, step > 1 ? paymentMethod : '')
  return (
    <>
      <Header cartCount={cartCount} isLoggedIn />
      <main className="mx-auto flex w-full max-w-[85rem] flex-col gap-8 px-6 pt-9 pb-18 leading-[normal] lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <h1 className="font-display text-[4.5rem] leading-[3.825rem] font-black uppercase">Finalizar compra</h1>
          <div className="w-full max-w-[30.4875rem]">
            <ProgressSteps step={step} />
          </div>
        </div>
        <div className="grid min-w-0 items-start gap-7 lg:grid-cols-[minmax(0,1fr)_21.25rem]">
          <section className="flex min-w-0 flex-col gap-6 rounded-[1.875rem] border-[2.4px] border-bordo bg-papel p-8 shadow-[0.5rem_0.5rem_0_var(--color-bordo)]">
            <div className="flex flex-col gap-1.5">
              <p className="text-[0.8125rem] font-extrabold tracking-[0.065rem] text-rojo uppercase">Paso {step} de 3</p>
              <h2 className="font-display text-[3rem] leading-[2.85rem] font-black uppercase">{headings[step - 1]}</h2>
            </div>
            {step === 1 && <PurchaseItems items={items} />}
            {step === 2 && <div role="group" aria-label="Medio de pago" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{paymentMethods.map((method) => <button key={method.value} type="button" aria-pressed={paymentMethod === method.value} onClick={() => setPaymentMethod(method.value)} className={`relative flex min-w-0 items-center gap-4 rounded-[1.375rem] border-[2.4px] border-bordo p-5.5 text-left text-[1.1875rem] font-extrabold ${paymentMethod === method.value ? 'bg-amarillo shadow-[0.3125rem_0.3125rem_0_var(--color-bordo)]' : 'bg-crema'}`}>
                <span aria-hidden="true" className={`size-[1.925rem] shrink-0 rounded-full border-[2.4px] border-bordo ${paymentMethod === method.value ? 'bg-bordo' : ''}`} />
                <span>{method.label}</span>{method.value === 'TRANSFERENCIA' && <span className="absolute -top-3 right-0 rotate-6 rounded-full border-[2.4px] border-bordo bg-amarillo px-3 py-1 font-display text-[1.125rem] font-black uppercase">10% off</span>}</button>)}</div>}
            {step === 3 && <>
              <div className="grid gap-4 sm:grid-cols-2">{[{ label: 'Productos', value: `${cartCount} productos`, step: 1 }, { label: 'Medio de pago', value: paymentMethodLabel(paymentMethod), step: 2 }].map((item) => <div key={item.label} className="flex flex-col items-start gap-1.5 rounded-[1.25rem] border-[2.4px] border-bordo bg-papel px-5 py-4.5">
                  <span className="text-[0.75rem] font-extrabold tracking-[0.06rem] uppercase opacity-75">{item.label}</span>
                  <strong className="text-[1.25rem]">{item.value}</strong>
                  <button type="button" onClick={() => setStep(item.step)} className="text-[0.875rem] font-bold underline">Cambiar</button>
                </div>)}</div>
              <p className="text-[0.9375rem] leading-[1.359375rem]">Al confirmar se crea el pedido en estado Pendiente y se descuenta el stock de cada producto.</p>
            </>}
            <div className="flex flex-wrap items-center justify-between gap-4">
              {step === 1 ? <Link to="/carrito" className="text-[0.9375rem] font-bold underline">← Editar carrito</Link> : <button type="button" onClick={() => setStep(step - 1)} className="text-[0.9375rem] font-bold underline">← Volver</button>}
              <button type="button" disabled={!items.length} onClick={() => step < 3 ? setStep(step + 1) : onConfirm?.({ items, paymentMethod, summary })} className={`rounded-full px-7.5 py-4 text-[1.0625rem] font-extrabold disabled:opacity-50 ${step === 3 ? 'border-[2.4px] border-bordo bg-rosa shadow-[0.25rem_0.25rem_0_var(--color-bordo)]' : 'bg-bordo text-crema'}`}>{step === 1 ? 'Continuar al pago' : step === 2 ? 'Revisar y confirmar' : `Confirmar pedido · ${formatPrice(summary.total)}`}</button>
            </div>
          </section>
          <PurchaseSummary summary={summary} />
        </div>
      </main>
      <Footer isLoggedIn />
    </>
  )
}
export default Checkout
