import { sectionLabel } from '../../data/albumThemes.js'

export default function AlbumPage({ section, pageNumber, onPageChange, readOnly = false,
  onEmptySlot, onSelectedCard }) {
  const current = section?.cards.filter(card => card.pageNumber === pageNumber) ?? []
  const cells = Array.from({ length: 9 }, (_, index) => ({
    slotIndex: index,
    card: current.find(card => card.slotIndex === index),
  }))

  return (
    <section aria-label={`Página ${pageNumber} de ${sectionLabel(section.key)}`}
      className="rounded-[1.75rem] border-[2.4px] border-bordo bg-papel p-4 shadow-product sm:p-7">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-[2.25rem] font-black uppercase leading-none">
          {sectionLabel(section.key)}
        </h2>
        <span className="rounded-full border-2 border-bordo bg-crema px-4 py-1 text-sm font-extrabold">
          Página {pageNumber} / {section.pageCount}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {cells.map(({ slotIndex, card }) => {
          const label = card ? `Ver carta ${card.name}, posición ${slotIndex + 1}`
            : `Espacio ${slotIndex + 1} vacío`
          const style = 'relative flex min-h-36 min-w-0 flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-bordo p-2 text-center sm:min-h-52'
          const content = card ? <>
            {card.imageUrl
              ? <img src={card.imageUrl} alt={card.name} className="h-25 w-full object-contain sm:h-39" />
              : <span className="font-display text-xl font-black">Carta</span>}
            <span className="mt-2 w-full truncate text-xs font-extrabold sm:text-sm">{card.name}</span>
            <span className="text-[0.625rem] font-bold uppercase sm:text-xs">
              {card.origin === 'PURCHASE' ? 'Compra en la plataforma' : 'Registro personal'}
            </span>
          </> : <>
            <span className="font-display text-3xl font-black opacity-40">{slotIndex + 1}</span>
            <span className="mt-1 text-xs font-bold sm:text-sm">{readOnly ? 'Vacío' : '+ Agregar carta'}</span>
          </>
          return readOnly ? (
            <div key={slotIndex} aria-label={label} className={style + ' border-dashed bg-crema/60'}>
              {content}
            </div>
          ) : (
            <button key={slotIndex} type="button" aria-label={label}
              onClick={() => card ? onSelectedCard(card) : onEmptySlot(slotIndex)}
              className={style + (card ? ' bg-crema hover:bg-amarillo/20' : ' border-dashed bg-crema/60 hover:bg-amarillo/20')}>
              {content}
            </button>
          )
        })}
      </div>
      <div className="mt-6 flex items-center justify-between gap-3">
        <button type="button" disabled={pageNumber <= 1}
          onClick={() => onPageChange(pageNumber - 1)}
          className="rounded-full border-2 border-bordo px-5 py-2 font-extrabold disabled:opacity-40">
          Anterior
        </button>
        <span className="text-sm font-bold">{current.length} de 9 cartas</span>
        <button type="button" disabled={pageNumber >= section.pageCount}
          onClick={() => onPageChange(pageNumber + 1)}
          className="rounded-full border-2 border-bordo px-5 py-2 font-extrabold disabled:opacity-40">
          Siguiente
        </button>
      </div>
    </section>
  )
}
