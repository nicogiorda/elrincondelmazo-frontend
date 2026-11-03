import { useState } from 'react'
import { ALBUM_THEMES } from '../../data/albumThemes.js'

export default function AlbumCardActions({ card, album, saving, error, onMove, onRemove, onCancel }) {
  const [section, setSection] = useState(card.section)
  const selected = album.sections.find(item => item.key === section) ?? album.sections[0]
  const [pageNumber, setPageNumber] = useState(card.pageNumber)
  const [slotIndex, setSlotIndex] = useState(card.slotIndex)
  const [replaceExisting, setReplaceExisting] = useState(false)
  const destination = selected.cards.find(item => item.pageNumber === pageNumber
    && item.slotIndex === Number(slotIndex) && item.id !== card.id)

  function changeSection(key) {
    setSection(key)
    setPageNumber(1)
    setSlotIndex(0)
    setReplaceExisting(false)
  }

  async function submit(event) {
    event.preventDefault()
    if (destination && !replaceExisting) return
    await onMove({ cardId: card.id, section, pageNumber, slotIndex: Number(slotIndex), replaceExisting })
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="album-card-title"
      className="rounded-[1.5rem] border-[2.4px] border-bordo bg-papel p-6 shadow-product">
      <h2 id="album-card-title" className="font-display text-3xl font-black uppercase">{card.name}</h2>
      <p className="mt-1 text-sm">{card.origin === 'PURCHASE' ? 'Compra en la plataforma' : 'Registro personal'}</p>
      <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block font-bold" htmlFor="album-move-section">Sección</label>
          <select id="album-move-section" value={section} disabled={saving}
            onChange={event => changeSection(event.target.value)}
            className="w-full rounded-xl border-2 border-bordo bg-crema p-2">
            {ALBUM_THEMES.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block font-bold" htmlFor="album-move-page">Página</label>
          <select id="album-move-page" value={pageNumber} disabled={saving}
            onChange={event => { setPageNumber(Number(event.target.value)); setReplaceExisting(false) }}
            className="w-full rounded-xl border-2 border-bordo bg-crema p-2">
            {Array.from({ length: selected.pageCount }, (_, i) =>
              <option key={i + 1} value={i + 1}>{i + 1}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block font-bold" htmlFor="album-move-slot">Posición</label>
          <select id="album-move-slot" value={slotIndex} disabled={saving}
            onChange={event => { setSlotIndex(Number(event.target.value)); setReplaceExisting(false) }}
            className="w-full rounded-xl border-2 border-bordo bg-crema p-2">
            {Array.from({ length: 9 }, (_, i) => <option key={i} value={i}>{i + 1}</option>)}
          </select>
        </div>
        {destination && <label className="flex items-center gap-2 sm:col-span-3">
          <input type="checkbox" checked={replaceExisting} disabled={saving}
            onChange={event => setReplaceExisting(event.target.checked)} />
          <span className="font-bold">Reemplazar «{destination.name}» en esta posición</span>
        </label>}
        {error && <p role="alert" className="font-bold text-rojo sm:col-span-3">{error}</p>}
        <div className="flex flex-wrap gap-3 sm:col-span-3">
          <button type="submit" disabled={saving || (Boolean(destination) && !replaceExisting)}
            className="rounded-full bg-bordo px-6 py-3 font-extrabold text-crema disabled:opacity-40">
            {saving ? 'Guardando…' : 'Mover carta'}
          </button>
          <button type="button" disabled={saving} onClick={onRemove}
            className="rounded-full border-2 border-rojo px-6 py-3 font-extrabold text-rojo">
            Quitar del álbum
          </button>
          <button type="button" disabled={saving} onClick={onCancel}
            className="rounded-full border-2 border-bordo px-6 py-3 font-extrabold">
            Cerrar
          </button>
        </div>
      </form>
    </div>
  )
}
