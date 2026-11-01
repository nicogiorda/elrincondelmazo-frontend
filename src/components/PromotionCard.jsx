function PromotionCard({ promotion }) {
  return (
    <article className="flex min-w-0 flex-col gap-2.5 rounded-[1.375rem] border-3 border-bordo bg-crema p-5 text-bordo shadow-product">
      <p className="font-display text-[3.375rem] leading-[2.86875rem] font-black text-rojo">{promotion.discount}</p>
      <h3 className="text-[1.0625rem] leading-[1.275rem] font-extrabold wrap-anywhere">{promotion.title}</h3>
      <p className="text-[0.875rem] leading-[1.225rem] opacity-80">{promotion.description}</p>
      {promotion.condition && <p className="text-[0.875rem]">{promotion.condition}</p>}
      {promotion.period && <p className="text-[0.8125rem]">{promotion.period}</p>}
      {typeof promotion.stackable === 'boolean' && <p className="text-[0.8125rem] font-bold">{promotion.stackable ? 'Acumulable' : 'No acumulable'}</p>}
    </article>
  )
}

export default PromotionCard
