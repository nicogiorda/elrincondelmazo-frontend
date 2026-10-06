import { useState } from 'react'
import AccountLayout from '../components/AccountLayout.jsx'
import ProgressSteps from '../components/ProgressSteps.jsx'
import PurchaseItems from '../components/PurchaseItems.jsx'
import PurchaseSummary from '../components/PurchaseSummary.jsx'
import { formatPrice } from '../data/purchaseMocks.js'

const filters = ['Todos', 'En curso', 'Entregados', 'Cancelados']
const statusLabels = { PENDIENTE: 'Pendiente', PAGADO: 'Pagado', ENVIADO: 'Enviado', ENTREGADO: 'Entregado', CANCELADO: 'Cancelado' }
const statusStyles = { PENDIENTE: 'bg-crema', PAGADO: 'bg-amarillo', ENVIADO: 'bg-rosa', ENTREGADO: 'bg-bordo text-crema', CANCELADO: 'bg-papel' }
const progress = { PENDIENTE: 1, PAGADO: 2, ENVIADO: 3, ENTREGADO: 4 }

function Orders({ user, orders, cartCount, onNavigate, onReview }) {
  const [filter, setFilter] = useState('Todos')
  const [openOrderId, setOpenOrderId] = useState(1032)
  const visibleOrders = orders.filter((order) => filter === 'Todos' || (filter === 'En curso' && ['PENDIENTE', 'PAGADO', 'ENVIADO'].includes(order.status)) || (filter === 'Entregados' && order.status === 'ENTREGADO') || (filter === 'Cancelados' && order.status === 'CANCELADO'))
  return (
    <AccountLayout user={user} activeView="orders" cartCount={cartCount} onNavigate={onNavigate}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-[4rem] leading-[3.52rem] font-black uppercase">Mis pedidos</h1>
        <div className="flex flex-wrap gap-2" aria-label="Filtrar pedidos">{filters.map((label) => <button key={label} type="button" aria-pressed={filter === label} onClick={() => setFilter(label)} className={`rounded-full border-[1.6px] border-bordo px-3.5 py-1.75 text-[0.875rem] font-bold ${filter === label ? 'bg-bordo text-crema' : ''}`}>{label}</button>)}</div>
      </div>
      {visibleOrders.map((order) => {
        const isOpen = openOrderId === order.id
        const subtotal = order.items.reduce((sum, item) => sum + item.quantity * item.product.price, 0)
        const summary = { subtotal, discounts: order.discounts, total: order.total }
        return (
        <article key={order.id} className="overflow-hidden rounded-[1.625rem] border-[2.4px] border-bordo bg-papel shadow-product">
          <button type="button" aria-expanded={isOpen} aria-controls={`order-${order.id}`} onClick={() => setOpenOrderId(isOpen ? null : order.id)} className="flex w-full flex-wrap items-center gap-4.5 px-5.5 py-4.5 text-left">
            <strong className="font-display text-[2.25rem] leading-9 font-black">#{order.id}</strong>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.9375rem] font-bold">{order.date} · {order.paymentMethod}</span>
              <span className="mt-0.5 block text-[0.8125rem] opacity-80">{order.items.map((item) => `${item.quantity} × ${item.product.name}`).join(', ')}</span>
            </span>
            <span className={`rounded-full border-[1.6px] border-bordo px-3.5 py-1.5 text-[0.75rem] font-extrabold uppercase ${statusStyles[order.status]}`}>{statusLabels[order.status]}</span>
            <strong className="text-[1.375rem]">{formatPrice(order.total)}</strong>
            <span aria-hidden="true" className="flex size-[2.8rem] items-center justify-center rounded-full border-[2.4px] border-bordo text-[1.0625rem] font-extrabold">{isOpen ? '↑' : '↓'}</span>
          </button>
          {isOpen && <div id={`order-${order.id}`} className="grid min-w-0 items-start gap-7 border-t-[2.4px] border-bordo p-6 xl:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-4.5">{progress[order.status] && <ProgressSteps step={progress[order.status]} variant="order" />}<PurchaseItems items={order.items} variant="order" />
            </div>
            <PurchaseSummary summary={summary} variant="order">{order.status === 'ENTREGADO' && <button type="button" onClick={() => onReview?.(order.items[0].product)} className="rounded-full border-[2.4px] border-bordo bg-rosa px-5 py-3 text-[0.875rem] font-extrabold shadow-[0.1875rem_0.1875rem_0_var(--color-bordo)]">Dejar reseña</button>}</PurchaseSummary>
          </div>}
        </article>
        )
      })}
    </AccountLayout>
  )
}
export default Orders
