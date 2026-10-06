function ReviewCard({ review }) {
  const date = new Date(review.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <article className="flex min-w-0 flex-col gap-2.5 rounded-[1.375rem] border-3 border-bordo bg-papel p-5 leading-[normal] text-bordo shadow-product">
      <p aria-label={`${review.rating} de 5 estrellas`} className="text-[1.25rem] tracking-[0.125rem] text-rojo">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</p>
      <p className="text-[0.9375rem] leading-[1.359375rem] text-pretty">{review.comment}</p>
      <p className="mt-auto text-[0.8125rem] font-bold">{review.userName} · {date}</p>
    </article>
  )
}

export default ReviewCard
