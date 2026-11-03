import { useState } from 'react'
import AccountLayout from '../components/AccountLayout.jsx'
import AlbumViewer from '../components/album/AlbumViewer.jsx'
import AlbumAddCard from '../components/album/AlbumAddCard.jsx'
import AlbumCardActions from '../components/album/AlbumCardActions.jsx'
import useAlbum from '../hooks/useAlbum.js'

export default function MyAlbum({ user, cartCount, onLogout }) {
  const album = useAlbum({ userId: user.id, onUnauthorized: onLogout })
  const [sectionKey, setSectionKey] = useState('NBA')
  const [pageNumber, setPageNumber] = useState(1)
  const [selected, setSelected] = useState(null)

  function changeSection(key) {
    setSectionKey(key)
    setPageNumber(1)
    setSelected(null)
    album.clearError()
  }

  function openSlot(slotIndex) {
    album.clearError()
    setSelected({ type: 'add', section: sectionKey, pageNumber, slotIndex })
  }

  function openCard(card) {
    album.clearError()
    setSelected({ type: 'edit', card: { ...card, section: sectionKey } })
  }

  async function add(method, args) {
    if (await method(args)) setSelected(null)
  }

  async function move(args) {
    if (await album.moveCard(args)) {
      setSectionKey(args.section)
      setPageNumber(args.pageNumber)
      setSelected(null)
    }
  }

  async function remove() {
    if (!window.confirm('¿Quitar esta carta del álbum? Podrás volver a incorporarla si la compraste.')) return
    if (await album.removeCard(selected.card.id)) setSelected(null)
  }

  const placed = album.album?.sections.reduce((total, section) => total + section.cards.length, 0) ?? 0
  return (
    <AccountLayout user={user} cartCount={cartCount} onLogout={onLogout} activeView="album">
      <header>
        <h1 className="font-display text-[3.5rem] leading-none font-black uppercase sm:text-[4.5rem]">Mi álbum</h1>
        <p className="mt-2 max-w-3xl font-semibold">Coleccioná cartas de NBA, My Little Pony, Cars y Marvel.
          Podés mezclarlas, repetirlas y organizarlas como prefieras.</p>
      </header>
      {album.loading && !album.album && <p role="status">Cargando tu álbum…</p>}
      {album.error && <div role="alert" className="rounded-xl border-2 border-rojo p-4">
        <p>{album.error}</p>
        <button type="button" onClick={album.retry} className="mt-2 font-extrabold underline">Reintentar</button>
      </div>}
      {album.album && <>
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[1.25rem] border-2 border-bordo bg-papel p-4">
          <div>
            <p className="font-display text-2xl font-black uppercase">{placed} cartas colocadas</p>
            <p className="text-sm font-semibold">Cada página tiene 9 espacios.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-extrabold">{album.album.visibility === 'PUBLIC' ? 'Álbum público' : 'Álbum privado'}</span>
            <button type="button" disabled={album.saving}
              onClick={() => album.setVisibility(album.album.visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC')}
              className="rounded-full border-2 border-bordo bg-amarillo px-4 py-2 font-extrabold disabled:opacity-40">
              {album.album.visibility === 'PUBLIC' ? 'Hacer privado' : 'Hacer público'}
            </button>
          </div>
        </div>
        <AlbumViewer album={album.album} sectionKey={sectionKey} onSectionChange={changeSection}
          pageNumber={pageNumber} onPageChange={setPageNumber}
          onEmptySlot={openSlot} onSelectedCard={openCard} />
      </>}
      {selected && album.album && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-bordo/60 p-4 pt-16"
          onClick={event => { if (event.target === event.currentTarget && !album.saving) setSelected(null) }}>
          <div className="w-full max-w-xl">
            {selected.type === 'add'
              ? <AlbumAddCard key={sectionKey + ':' + pageNumber + ':' + selected.slotIndex}
                  {...selected} purchases={album.purchases} purchasesLoading={album.loadingPurchases}
                  purchasesError={album.purchasesError} saving={album.saving}
                  error={album.mutationError} onPurchase={args => add(album.addPurchase, args)}
                  onManual={args => add(album.addManual, args)} onCancel={() => setSelected(null)} />
              : <AlbumCardActions card={selected.card} album={album.album} saving={album.saving}
                  error={album.mutationError} onMove={move} onRemove={remove}
                  onCancel={() => setSelected(null)} />}
          </div>
        </div>
      )}
      {album.mutationError && !selected && <p role="alert" className="font-bold text-rojo">{album.mutationError}</p>}
    </AccountLayout>
  )
}
