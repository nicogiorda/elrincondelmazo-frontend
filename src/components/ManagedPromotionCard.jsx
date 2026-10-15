import ToggleSwitch from './ToggleSwitch.jsx'
import { promotionKinds, promotionStatus, promotionPeriod, promotionCondition } from '../data/promotionMocks.js'
import { paymentMethods } from '../data/paymentMethods.js'

function ManagedPromotionCard({ promotion, onEdit, onToggle }) {
  const status = promotionStatus(promotion)
  const active = status === 'Activa'
  const background = active ? 'bg-amarillo' : status === 'Programada' ? 'bg-rosa' : 'bg-crema'
  return <article className={`flex min-w-0 flex-col overflow-hidden rounded-3xl border-[2.4px] border-bordo bg-papel shadow-product ${!promotion.enabled ? 'opacity-70' : ''}`}>
    <div className={`flex items-start justify-between gap-2 border-b-[2.4px] border-bordo px-5 py-4.5 ${background}`}>
      <p className="font-display text-[4rem] leading-[3.4rem] font-black text-crema">{promotion.discount}%</p>
      <span className={`rounded-full border-[1.6px] border-bordo px-2.5 py-1 text-[0.6875rem] font-extrabold tracking-[0.04125rem] uppercase ${active ? 'bg-bordo text-crema' : 'bg-crema'}`}>{status}</span>
    </div>
    <div className="flex flex-1 flex-col gap-2 px-5 pt-4 pb-4.5">
      <h2 className="text-[1.125rem] leading-[1.35rem] font-extrabold text-pretty">{promotion.name}</h2>
      <p className="text-[0.875rem] leading-[1.225rem]">{promotionCondition(promotion, [], [], paymentMethods)}</p>
      <p className="text-[0.8125rem] font-semibold opacity-80">{promotionPeriod(promotion)}</p>
      <div className="flex flex-wrap gap-1.5 text-[0.75rem] font-bold"><span className="rounded-full border-[1.6px] border-bordo px-2.5 py-0.75">{promotionKinds.find((kind) => kind.value === promotion.kind)?.label}</span><span className="rounded-full border-[1.6px] border-bordo px-2.5 py-0.75">{promotion.stackable ? 'Acumulable' : 'No acumulable'}</span></div>
      <div className="mt-auto flex items-center justify-between gap-2 border-t-[1.6px] border-bordo/20 pt-3.5 text-[0.875rem] font-bold">
        <div className="flex items-center gap-2.5"><ToggleSwitch checked={promotion.enabled} onChange={() => onToggle(promotion)} label={`${promotion.enabled ? 'Desactivar' : 'Activar'} ${promotion.name}`} /><span>{promotion.enabled ? 'Activada' : 'Desactivada'}</span></div>
        <button type="button" onClick={() => onEdit(promotion)} className="underline">Editar</button>
      </div>
    </div>
  </article>
}
export default ManagedPromotionCard
