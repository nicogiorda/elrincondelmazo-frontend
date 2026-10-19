import { paymentMethodLabel } from '../data/paymentMethods.js'
import { useEffect, useState } from 'react'
import AccountLayout from '../components/AccountLayout.jsx'
import ProgressSteps from '../components/ProgressSteps.jsx'
import PurchaseItems from '../components/PurchaseItems.jsx'
import PurchaseSummary from '../components/PurchaseSummary.jsx'
import { formatPrice } from '../utils/formatPrice.js'

const filters = ['Todos', 'En curso', 'Entregados', 'Cancelados']
const statusLabels = { PENDIENTE: 'Pendiente', PAGO: 'Pagado', ENVIADO: 'Enviado', ENTREGADO: 'Entregado', CANCELADO: 'Cancelado' }
const statusStyles = { PENDIENTE: 'bg-crema', PAGO: 'bg-amarillo', ENVIADO: 'bg-rosa', ENTREGADO: 'bg-bordo text-crema', CANCELADO: 'bg-papel' }
const progress = { PENDIENTE: 1, PAGO: 2, ENVIADO: 3, ENTREGADO: 4 }

function Orders({ user, onLogout, orders, loading, error, onRefresh, details, onLoadDetail, cartCount }) {
  const [filter, setFilter] = useState('Todos')
  const [openOrderId, setOpenOrderId] = useState(null)

  useEffect(() => {
    if (openOrderId === null || details[openOrderId] || !orders.some((order) => order.id === openOrderId)) return
    // Si el listado actualizado invalida un detalle abierto, lo recuperamos bajo demanda.
    let active = true
    Promise.resolve().then(() => { if (active) onLoadDetail(openOrderId) })
    return () => { active = false }
  }, [openOrderId, details, orders, onLoadDetail])

  function toggleOrder(orderId) {
    if (openOrderId === orderId) setOpenOrderId(null)
    else {
      setOpenOrderId(orderId)
      onLoadDetail(orderId)
    }
  }

  const visibleOrders = [...orders].sort((a, b) => b.orderDate.localeCompare(a.orderDate) || b.id - a.id)
    .filter((order) => filter === 'Todos' || (filter === 'En curso' && ['PENDIENTE', 'PAGO', 'ENVIADO'].includes(order.state)) || (filter === 'Entregados' && order.state === 'ENTREGADO') || (filter === 'Cancelados' && order.state === 'CANCELADO'))

  return (
    <AccountLayout user={user} activeView="orders" cartCount={cartCount} onLogout={onLogout}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-[4rem] leading-[3.52rem] font-black uppercase">Mis pedidos</h1>
        <div className="flex flex-wrap gap-2" aria-label="Filtrar pedidos">{filters.map((label) => <button key={label} type="button" aria-pressed={filter === label} onClick={() => setFilter(label)} className={`rounded-full border-[1.6px] border-bordo px-3.5 py-1.75 text-[0.875rem] font-bold ${filter === label ? 'bg-bordo text-crema' : ''}`}>{label}</button>)}</div>
      </div>
      <button type="button" onClick={onRefresh} disabled={loading} className="self-start rounded-full border-[1.6px] border-bordo px-4 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-50">Actualizar pedidos</button>
      {loading && <p role="status" className="rounded-[1.375rem] border-[2.4px] border-bordo bg-papel p-6 font-bold">Cargando pedidos…</p>}
      {error && <div role="alert" className="rounded-[1.375rem] border-[2.4px] border-bordo bg-papel p-6 font-bold"><p>{error}</p><button type="button" onClick={onRefresh} disabled={loading} className="mt-3 rounded-full border-[1.6px] border-bordo px-3.5 py-1.75 text-[0.875rem] font-bold">Reintentar</button></div>}
      {!loading && !error && !visibleOrders.length && <p className="rounded-[1.375rem] border-[2.4px] border-bordo bg-papel p-6 font-bold">{orders.length ? 'No hay pedidos con ese filtro' : 'Todavía no tenés pedidos'}</p>}
      {visibleOrders.map((order) => {
        const isOpen = openOrderId === order.id
        const detail = details[order.id]
        const data = detail?.data
        const discounts = (data?.promotions ?? []).map((promotion) => ({ label: promotion.promotionName, amount: promotion.discountApplied }))
        if (data && !discounts.length && Number(data.totalDiscount) > 0) discounts.push({ label: 'Descuentos', amount: data.totalDiscount })
        const summary = data && { subtotal: data.subtotal, discounts, total: data.total }
        return (
        <article key={order.id} className="overflow-hidden rounded-[1.625rem] border-[2.4px] border-bordo bg-papel shadow-product">
          <button type="button" aria-label={`Ver detalle del pedido ${order.id}`} aria-expanded={isOpen} aria-controls={`order-${order.id}`} onClick={() => toggleOrder(order.id)} className="flex w-full flex-wrap items-center gap-4.5 px-5.5 py-4.5 text-left">
            <strong className="font-display text-[2.25rem] leading-9 font-black">#{order.id}</strong>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.9375rem] font-bold">{new Date(order.orderDate).toLocaleDateString('es-AR')} · {paymentMethodLabel(order.paymentMethod)}</span>
              <span className="mt-0.5 block text-[0.8125rem] opacity-80">{(data?.items ?? order.items ?? []).map((item) => `${item.quantity} × ${item.productName}`).join(', ')}</span>
            </span>
            <span className={`rounded-full border-[1.6px] border-bordo px-3.5 py-1.5 text-[0.75rem] font-extrabold uppercase ${statusStyles[order.state] ?? ''}`}>{statusLabels[order.state] ?? order.state}</span>
            <strong className="text-[1.375rem]">{formatPrice(order.total)}</strong>
            <span aria-hidden="true" className="flex size-[2.8rem] items-center justify-center rounded-full border-[2.4px] border-bordo text-[1.0625rem] font-extrabold">{isOpen ? '↑' : '↓'}</span>
          </button>
          {isOpen && <div id={`order-${order.id}`} className="grid min-w-0 items-start gap-7 border-t-[2.4px] border-bordo p-6 xl:grid-cols-2">
            {detail?.loading && <p role="status">Cargando detalle…</p>}
            {detail?.error && <div role="alert"><p>{detail.error}</p><button type="button" onClick={() => onLoadDetail(order.id)} className="mt-3 rounded-full border-[1.6px] border-bordo px-3.5 py-1.75 text-[0.875rem] font-bold">Reintentar detalle</button></div>}
            {data && <>
              <div className="flex min-w-0 flex-col gap-4.5">{progress[order.state] && <ProgressSteps step={progress[order.state]} variant="order" />}<PurchaseItems items={data.items} variant="order" /></div>
              <PurchaseSummary summary={summary} variant="order" />
            </>}
          </div>}
        </article>
        )
      })}
    </AccountLayout>
  )
}
export default Orders
