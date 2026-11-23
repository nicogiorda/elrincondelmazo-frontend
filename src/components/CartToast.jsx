import { useEffect } from 'react'

export default function CartToast({ notification, onDismiss }) {
  useEffect(() => {
    if (!notification) return
    const timer = setTimeout(onDismiss, 3000)
    return () => clearTimeout(timer)
  }, [notification, onDismiss])

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 flex justify-end">
      <div className={notification ? 'flex items-center gap-3 rounded-xl border-2 border-bordo bg-papel py-1 pl-4 pr-1 font-bold text-bordo shadow-product' : 'sr-only'}>
        <p role="status" aria-atomic="true">
          {notification ? <span key={notification}>Producto agregado al carrito</span> : null}
        </p>
        {notification > 0 && (
          <button type="button" aria-label="Cerrar notificación del carrito" onClick={onDismiss}
            className="pointer-events-auto size-11 shrink-0 rounded-lg text-2xl hover:bg-crema">
            <span aria-hidden="true">×</span>
          </button>
        )}
      </div>
    </div>
  )
}
