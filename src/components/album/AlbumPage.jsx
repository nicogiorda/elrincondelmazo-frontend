import { ALBUM_THEMES, sectionLabel } from '../../data/albumThemes.js'

export default function AlbumPage({ section, pageNumber, onPageChange, readOnly = false,
  onEmptySlot, onSelectedCard }) {
  const current = section?.cards.filter(card => card.pageNumber === pageNumber) ?? []
  const cells = Array.from({ length: 9 }, (_, index) => ({
    slotIndex: index,
    card: current.find(card => card.slotIndex === index),
  }))
  const theme = ALBUM_THEMES.find(item => item.key === section.key)
  const themeStyle = {
    '--album-accent': theme?.accent ?? '#66060e',
    '--album-paper': theme?.paper ?? '#fbf3e6',
  }

  return (
    <section aria-label={'Página ' + pageNumber + ' de ' + sectionLabel(section.key)}
      data-album-theme={section.key} data-watermark={theme?.watermark ?? ''}
      className="album-sheet" style={themeStyle}>
      <img src={theme?.pageArt ?? theme?.cover} alt="" aria-hidden="true" className="album-sheet__art" />
      <div className="album-sheet__content">
        <header className="album-sheet__header">
          <div className="min-w-0">
            <p className="album-sheet__eyebrow">{theme?.detail ?? 'TU COLECCIÓN'}</p>
            <h2 className="album-sheet__title">{sectionLabel(section.key)}</h2>
          </div>
          <span className="album-sheet__counter">Página {pageNumber} / {section.pageCount}</span>
        </header>

        <div className="album-sheet__grid">
          {cells.map(({ slotIndex, card }) => {
            const label = card ? 'Ver carta ' + card.name + ', posición ' + (slotIndex + 1)
              : 'Espacio ' + (slotIndex + 1) + ' vacío'
            const className = 'album-slot' + (card ? ' album-slot--filled' : ' album-slot--empty')
              + (readOnly ? ' album-slot--read-only' : '')
            const content = card ? (
              <>
                <span className="album-slot__media">
                  {card.imageUrl ? (
                    <>
                      <img src={card.imageUrl} alt="" aria-hidden="true"
                        className="album-slot__image-backdrop" />
                      <img src={card.imageUrl} alt={card.name} className="album-slot__image" />
                    </>
                  ) : <span className="album-slot__fallback">CARTA</span>}
                </span>
                <span className="album-slot__caption">
                  <span className="album-slot__name" title={card.name}>{card.name}</span>
                  <span className="album-slot__origin">
                    {card.origin === 'PURCHASE' ? 'Comprada' : 'Carta física'}
                  </span>
                </span>
              </>
            ) : (
              <span className="album-slot__placeholder">
                <span className="album-slot__number" aria-hidden="true">{slotIndex + 1}</span>
                <span className="album-slot__action">{readOnly ? 'Vacío' : '+ Agregar carta'}</span>
              </span>
            )
            return readOnly ? (
              <div key={slotIndex} data-album-slot={slotIndex} aria-label={label} className={className}>
                {content}
              </div>
            ) : (
              <button key={slotIndex} data-album-slot={slotIndex} type="button" aria-label={label}
                onClick={() => card ? onSelectedCard(card) : onEmptySlot(slotIndex)}
                className={className}>
                {content}
              </button>
            )
          })}
        </div>

        <footer className="album-sheet__footer">
          <button type="button" disabled={pageNumber <= 1}
            onClick={() => onPageChange(pageNumber - 1)} className="album-sheet__page-button">
            <span aria-hidden="true">‹</span> Anterior
          </button>
          <span className="album-sheet__progress">{current.length} de 9 cartas</span>
          <button type="button" disabled={pageNumber >= section.pageCount}
            onClick={() => onPageChange(pageNumber + 1)} className="album-sheet__page-button">
            Siguiente <span aria-hidden="true">›</span>
          </button>
        </footer>
      </div>
    </section>
  )
}
