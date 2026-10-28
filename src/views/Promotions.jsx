import { useState } from 'react'
import { Link } from 'react-router-dom'
import AccountLayout from '../components/AccountLayout.jsx'
import ManagedPromotionCard from '../components/ManagedPromotionCard.jsx'
import { promotionStatus } from '../data/promotionMocks.js'

const tabs = [{ label: 'Todas' }, { label: 'Activas', status: 'Activa' }, { label: 'Programadas', status: 'Programada' }, { label: 'Vencidas', status: 'Vencida' }, { label: 'Inactivas', status: 'Inactiva' }]
function Promotions({ user, onLogout, cartCount, promotions, onEdit, onToggle, onRefresh, loading, error, busyId = null }) {
  const [filter, setFilter] = useState('Todas')
  const selectedTab = tabs.find((tab) => tab.label === filter)
  const visiblePromotions = loading ? [] : promotions.filter((promotion) => !selectedTab.status || promotionStatus(promotion) === selectedTab.status)
  return <AccountLayout user={user} cartCount={cartCount} onLogout={onLogout} activeView="promotions">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col items-start gap-2.5"><span className="rounded-full bg-bordo px-3 py-1 text-[0.75rem] font-extrabold tracking-[0.06rem] text-crema uppercase">Administración</span><h1 className="font-display text-[3rem] leading-[2.64rem] font-black uppercase sm:text-[4rem] sm:leading-[3.52rem]">Promociones</h1></div>
      <Link to="/nueva-promocion" className="rounded-full border-[2.4px] border-bordo bg-rosa px-6.5 py-3.75 text-base font-extrabold shadow-[0.25rem_0.25rem_0_var(--color-bordo)]">+ Nueva promoción</Link>
    </div>
    <button type="button" onClick={onRefresh} disabled={loading || busyId !== null} className="self-start font-bold underline">{error ? 'Reintentar' : 'Actualizar promociones'}</button>
    {loading && <p role="status">Cargando promociones…</p>}
    {error && <p role="alert">{error}</p>}
    <nav aria-label="Filtrar promociones" className="flex flex-wrap gap-2">{tabs.map((tab) => <button key={tab.label} type="button" aria-pressed={filter === tab.label} onClick={() => setFilter(tab.label)} className={`flex items-center gap-2 rounded-full border-[1.6px] border-bordo py-1.75 pr-2 pl-3.5 text-[0.875rem] font-bold ${filter === tab.label ? 'bg-bordo text-crema' : ''}`}>{tab.label}<span className="flex h-5.5 min-w-5.5 items-center justify-center rounded-full border-[1.6px] border-current px-1 text-[0.75rem] font-extrabold">{promotions.filter((promotion) => !tab.status || promotionStatus(promotion) === tab.status).length}</span></button>)}</nav>
    {!loading && !error && !visiblePromotions.length && <p className="rounded-[1.375rem] border-[2.4px] border-bordo bg-papel p-6 font-bold">No hay promociones en esta pestaña</p>}
    <div className="grid min-w-0 gap-5.5 md:grid-cols-2 xl:grid-cols-3">{visiblePromotions.map((promotion) => <ManagedPromotionCard key={promotion.id} promotion={promotion} onEdit={onEdit} onToggle={onToggle} disabled={busyId !== null} />)}</div>
    <p className="max-w-[45rem] text-[0.875rem] leading-[1.26875rem] opacity-85">Las promociones activas y vigentes se aplican solas en el carrito y el checkout. Si aplica una no acumulable, se compara con la suma de las acumulables y queda el descuento mayor.</p>
  </AccountLayout>
}
export default Promotions
