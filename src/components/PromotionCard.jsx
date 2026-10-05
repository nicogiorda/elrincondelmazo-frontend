function PromotionCard({ promotion }) {
  return (
    <article className="flex min-w-0 flex-col gap-2.5 rounded-[1.375rem] border-3 border-bordo bg-crema p-5 text-bordo shadow-product">
      <p className="font-display text-[3.375rem] leading-[2.86875rem] font-black text-rojo">{promotion.discount}</p>
      <h3 className="text-[1.0625rem] leading-[1.275rem] font-extrabold 2xl:whitespace-nowrap">{promotion.title}</h3>
      <p className="text-[0.875rem] leading-[1.225rem] opacity-80">{promotion.description}</p>
    </article>
  )
}

export default PromotionCard
