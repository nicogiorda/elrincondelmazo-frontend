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

function Orders({ user, onLogout, token, details, onLoadDetail, onUnauthorized, cartCount }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [filter, setFilter] = useState('Todos')
  const [openOrderId, setOpenOrderId] = useState(null)

  useEffect(() => {
    let active = true
    // StrictMode limpia el primer efecto antes de iniciar esta petición.
    Promise.resolve().then(async () => {
      if (!active) return
      try {
        const response = await fetch('http://localhost:8080/orders', { headers: { Authorization: 'Bearer ' + token } })
        if (!active) return
        if (response.status === 401) {
          onUnauthorized()
          return
        }
        if (!response.ok) throw new Error(response.status === 403
          ? 'No tenés permiso para consultar estos pedidos.'
          : 'No pudimos cargar tus pedidos (HTTP ' + response.status + ').')
        const data = await response.json()
        if (!Array.isArray(data)) throw new Error('La respuesta de pedidos no contiene una lista.')
        if (active) setOrders(data)
      } catch (error) {
        if (active) setError(error.message)
      } finally {
        if (active) setLoading(false)
      }
    })
    return () => { active = false }
  }, [token, attempt, onUnauthorized])

  function retry() {
    setLoading(true)
    setError('')
    setAttempt((current) => current + 1)
  }
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
      {loading && <p role="status" className="rounded-[1.375rem] border-[2.4px] border-bordo bg-papel p-6 font-bold">Cargando pedidos…</p>}
      {error && <div role="alert" className="rounded-[1.375rem] border-[2.4px] border-bordo bg-papel p-6 font-bold"><p>{error}</p><button type="button" onClick={retry} className="mt-3 rounded-full border-[1.6px] border-bordo px-3.5 py-1.75 text-[0.875rem] font-bold">Reintentar</button></div>}
      {!loading && !error && !visibleOrders.length && <p className="rounded-[1.375rem] border-[2.4px] border-bordo bg-papel p-6 font-bold">{orders.length ? 'No hay pedidos con ese filtro' : 'Todavía no tenés pedidos'}</p>}
      {!loading && !error && visibleOrders.map((order) => {
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
