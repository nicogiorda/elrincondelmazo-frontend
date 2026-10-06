import { formatPrice } from '../data/purchaseMocks.js'

function PurchaseSummary({ summary, variant = 'checkout', paymentMethod, children }) {
  const compact = variant === 'order' || variant === 'confirmation'
  const styles = { checkout: 'rounded-[1.625rem] border-[2.4px] border-bordo bg-amarillo p-6.5', cart: 'rounded-[1.625rem] border-[2.4px] border-bordo bg-papel p-6.5 shadow-[0.5rem_0.5rem_0_var(--color-bordo)]', order: 'rounded-[1.25rem] border-[2.4px] border-bordo bg-crema p-5', confirmation: '' }
  return (
    <section aria-label="Resumen de compra" className={`flex min-w-0 flex-col ${variant === 'confirmation' ? 'gap-1.5' : compact ? 'gap-2.5' : 'gap-3.5'} ${styles[variant]}`}>
      {!compact && <h2 className="font-display text-[2.25rem] leading-[2.25rem] font-black uppercase">Resumen</h2>}
      <div className={`flex justify-between gap-3 font-semibold ${variant === 'order' ? 'text-[0.9375rem]' : 'text-base'}`}><span>Subtotal</span><span className="shrink-0">{formatPrice(summary.subtotal)}</span></div>
      {summary.discounts.map((discount) => <div key={discount.label} className={`flex justify-between gap-3 ${compact || variant === 'cart' ? 'text-rojo' : ''} ${variant === 'confirmation' ? 'text-base font-bold' : compact || variant === 'cart' ? 'text-[0.875rem] font-bold' : 'text-[0.9375rem] font-extrabold'}`}><span>{discount.label}</span><span className="shrink-0">− {formatPrice(discount.amount)}</span></div>)}
      <div className={`flex flex-wrap items-baseline justify-between gap-2 border-bordo ${variant === 'confirmation' ? 'pt-3' : compact ? 'border-t-3 pt-2.5' : 'border-t-3 pt-3.5'}`}><span className="font-extrabold">Total{variant === 'confirmation' && ` · ${paymentMethod}`}</span><strong className={variant === 'order' ? 'text-[1.5rem]' : 'text-[1.875rem]'}>{formatPrice(summary.total)}</strong></div>
      {variant === 'checkout' && <span className="self-start rounded-full border-[1.6px] border-bordo bg-crema px-3 py-1.25 text-[0.8125rem] font-extrabold">Ahorrás {formatPrice(summary.savings)}</span>}
      {children}
    </section>
  )
}
export default PurchaseSummary
