export default function CartAddedNotice({ feedback, source }) {
  const active = feedback?.source === source

  return (
    <div className={active ? 'mb-2 ml-auto flex w-fit max-w-full items-center gap-2 rounded-xl border-2 border-bordo bg-crema pl-3 pr-1 text-sm font-extrabold text-bordo' : 'sr-only'}>
      <p role="status" aria-atomic="true">
        {active && <span key={feedback.count}>Producto agregado al carrito</span>}
      </p>
      {active && (
        <button type="button" aria-label="Cerrar notificación del carrito" onClick={feedback.onDismiss}
          className="size-11 shrink-0 rounded-lg text-xl hover:bg-papel">
          <span aria-hidden="true">×</span>
        </button>
      )}
    </div>
  )
}
