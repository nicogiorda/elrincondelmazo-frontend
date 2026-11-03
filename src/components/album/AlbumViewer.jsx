import AlbumSections from './AlbumSections.jsx'
import AlbumPage from './AlbumPage.jsx'

export default function AlbumViewer({ album, sectionKey, onSectionChange, pageNumber, onPageChange,
  readOnly = false, onEmptySlot, onSelectedCard }) {
  const section = album.sections.find(item => item.key === sectionKey) ?? album.sections[0]
  if (!section) return <p>Este álbum todavía no tiene secciones.</p>
  return (
    <div className="flex flex-col gap-6">
      <AlbumSections activeSection={section.key} onChange={onSectionChange} />
      <AlbumPage section={section} pageNumber={pageNumber} onPageChange={onPageChange}
        readOnly={readOnly} onEmptySlot={onEmptySlot} onSelectedCard={onSelectedCard} />
    </div>
  )
}
