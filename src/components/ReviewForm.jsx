import { useState } from 'react'

function ReviewForm({ onPublish, onCancel }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const canPublish = Number.isInteger(rating) && rating >= 1 && rating <= 5 && comment.length <= 1000 && comment.trim().length > 0 && Boolean(onPublish)

  function submitReview(event) {
    event.preventDefault()
    if (!canPublish) return
    onPublish({ rating, comment: comment.trim() })
  }

  return (
    <form aria-label="Dejar reseña" onSubmit={submitReview} className="flex min-w-0 flex-col gap-3.5 rounded-[1.375rem] border-[2.4px] border-bordo bg-papel p-5 shadow-product">
      <fieldset className="flex flex-col gap-1">
        <legend className="sr-only">Puntuación</legend>
        <div className="flex gap-0.5 text-[2.125rem] leading-[2.125rem] text-rojo">
          {[1, 2, 3, 4, 5].map((value) => (
            <button key={value} type="button" aria-label={`${value} ${value === 1 ? 'estrella' : 'estrellas'}`} aria-pressed={rating === value} onClick={() => setRating(value)}>{value <= rating ? '★' : '☆'}</button>
          ))}
        </div>
        <p className="text-[0.8125rem] leading-[normal] font-bold">Elegí una puntuación</p>
      </fieldset>
      <textarea aria-label="Comentario de la reseña" value={comment} onChange={(event) => setComment(event.target.value)} required maxLength={1000} placeholder="Contá cómo llegó, el estado y si coincide con las fotos" className="h-[7.2375rem] w-full resize-y rounded-[0.875rem] border-[2.4px] border-bordo bg-crema px-3.5 py-3 text-[0.9375rem] leading-[1.359375rem] font-medium placeholder:text-[#757575]" />
      <p className="text-[0.75rem] leading-[normal] font-bold">{comment.length} / 1000</p>
      <div className="flex flex-wrap gap-2.5 text-[0.875rem] leading-[normal] font-extrabold">
        <button type="button" onClick={onCancel} className="rounded-full border-[2.4px] border-bordo px-4.5 py-2.75">Cancelar</button>
        <button type="submit" disabled={!canPublish} className="min-w-0 flex-1 rounded-full border-[2.4px] border-bordo bg-bordo px-4.5 py-2.75 text-crema disabled:cursor-not-allowed">Publicar reseña</button>
      </div>
    </form>
  )
}

export default ReviewForm
