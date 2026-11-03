import { useState } from 'react'

export default function AlbumAddCard({ section, pageNumber, slotIndex, purchases, purchasesLoading,
  purchasesError, saving, error, onPurchase, onManual, onCancel }) {
  const [mode, setMode] = useState('purchase')
  const [orderItemId, setOrderItemId] = useState('')
  const [name, setName] = useState('')
  const [image, setImage] = useState(null)
  const available = purchases.filter(item => item.availableQuantity > 0)

  async function submit(event) {
    event.preventDefault()
    const args = { section, pageNumber, slotIndex }
    if (mode === 'purchase') {
      if (!orderItemId) return
      await onPurchase({ ...args, orderItemId: Number(orderItemId) })
    } else {
      if (!image || !name.trim()) return
      await onManual({ ...args, name: name.trim(), image })
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="album-add-title"
      className="rounded-[1.5rem] border-[2.4px] border-bordo bg-papel p-6 shadow-product">
      <h2 id="album-add-title" className="font-display text-3xl font-black uppercase">Agregar carta</h2>
      <p className="mt-1 text-sm">Página {pageNumber} · Espacio {slotIndex + 1}</p>
      <div className="mt-5 flex gap-2">
        <button type="button" aria-pressed={mode === 'purchase'} disabled={saving}
          onClick={() => setMode('purchase')}
          className={`rounded-full border-2 border-bordo px-4 py-2 font-extrabold ${mode === 'purchase' ? 'bg-amarillo' : ''}`}>
          Mis compras
        </button>
        <button type="button" aria-pressed={mode === 'manual'} disabled={saving}
          onClick={() => setMode('manual')}
          className={`rounded-full border-2 border-bordo px-4 py-2 font-extrabold ${mode === 'manual' ? 'bg-amarillo' : ''}`}>
          Carta física
        </button>
      </div>
      <form className="mt-5 grid gap-4" onSubmit={submit}>
        {mode === 'purchase' ? <>
          <label htmlFor="album-order-item" className="font-bold">Carta disponible</label>
          <select id="album-order-item" value={orderItemId} disabled={saving || purchasesLoading}
            onChange={event => setOrderItemId(event.target.value)}
            className="w-full rounded-xl border-2 border-bordo bg-crema p-3">
            <option value="">Elegí una carta comprada</option>
            {available.map(item => <option key={item.orderItemId} value={item.orderItemId}>
              {item.name} — disponibles: {item.availableQuantity}
            </option>)}
          </select>
          {purchasesLoading && <p role="status">Consultando compras…</p>}
          {purchasesError && <p role="alert" className="font-bold text-rojo">{purchasesError}</p>}
          {!purchasesLoading && !purchasesError && !available.length &&
            <p className="text-sm">Todavía no tenés cartas disponibles. Al confirmar una compra, sus cartas aparecerán acá.</p>}
        </> : <>
          <label htmlFor="album-manual-name" className="font-bold">Nombre de la carta</label>
          <input id="album-manual-name" maxLength={255} value={name} required disabled={saving}
            onChange={event => setName(event.target.value)}
            className="rounded-xl border-2 border-bordo bg-crema p-3" placeholder="Ej.: Mi carta favorita" />
          <label htmlFor="album-manual-image" className="font-bold">Foto de la carta</label>
          <input id="album-manual-image" type="file" accept="image/jpeg,image/png,image/webp"
            required disabled={saving} onChange={event => setImage(event.target.files?.[0] ?? null)}
            className="w-full rounded-xl border-2 border-bordo bg-crema p-3" />
          <p className="text-xs">JPG, PNG o WebP · Máximo 10 MB · Registro personal, sin verificación de compra.</p>
        </>}
        {error && <p role="alert" className="font-bold text-rojo">{error}</p>}
        <div className="mt-2 flex flex-wrap gap-3">
          <button type="submit" disabled={saving || (mode === 'purchase' ? !orderItemId : !name.trim() || !image)}
            className="rounded-full bg-bordo px-6 py-3 font-extrabold text-crema disabled:opacity-40">
            {saving ? 'Guardando…' : 'Guardar carta'}
          </button>
          <button type="button" disabled={saving} onClick={onCancel}
            className="rounded-full border-2 border-bordo px-6 py-3 font-extrabold">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
