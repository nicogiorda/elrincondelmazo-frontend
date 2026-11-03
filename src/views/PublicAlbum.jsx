import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import Header from '../components/Header.jsx'
import Footer from '../components/Footer.jsx'
import AlbumViewer from '../components/album/AlbumViewer.jsx'
import usePublicAlbum from '../hooks/usePublicAlbum.js'

export default function PublicAlbum({ viewer, cartCount, onLogout }) {
  const { userId } = useParams()
  const ownerId = /^[1-9]\d*$/.test(userId ?? '') ? Number(userId) : null
  const validOwner = Number.isSafeInteger(ownerId) && ownerId > 0
  const view = usePublicAlbum({ ownerId: validOwner ? ownerId : null,
    viewerId: viewer.id, onUnauthorized: onLogout })
  const [sectionKey, setSectionKey] = useState('NBA')
  const [pageNumber, setPageNumber] = useState(1)

  if (validOwner && ownerId === viewer.id) return <Navigate to="/mi-album" replace />

  function changeSection(key) {
    setSectionKey(key)
    setPageNumber(1)
  }

  return (
    <>
      <Header cartCount={cartCount} isLoggedIn />
      <main className="mx-auto flex w-full max-w-[85rem] flex-col gap-6 px-6 pt-9 pb-18 text-bordo lg:px-10">
        <nav aria-label="Ruta del álbum" className="flex flex-wrap gap-3 text-sm font-semibold">
          <Link to="/" className="underline">Inicio</Link>
          <span>/</span>
          <Link to="/catalogo" className="underline">Catálogo</Link>
          <span>/</span>
          <span>Álbum público</span>
        </nav>
        <header>
          <h1 className="font-display text-[3.5rem] leading-none font-black uppercase sm:text-[4.5rem]">Álbum público</h1>
          {validOwner && <p className="mt-2 font-semibold">Colección del usuario #{ownerId} · Solo lectura</p>}
        </header>
        {!validOwner && <p role="alert" className="rounded-xl border-2 border-rojo p-4 font-bold">El enlace del álbum no es válido.</p>}
        {validOwner && view.loading && !view.album && <p role="status">Cargando álbum público…</p>}
        {validOwner && view.error && <div className="rounded-xl border-2 border-rojo bg-papel p-5">
          <p role="alert" className="font-bold">{view.error}</p>
          <button type="button" onClick={view.retry} className="mt-2 font-extrabold underline">Reintentar</button>
        </div>}
        {validOwner && view.album && (
          <AlbumViewer album={view.album} sectionKey={sectionKey} pageNumber={pageNumber}
            onSectionChange={changeSection} onPageChange={setPageNumber} readOnly />
        )}
      </main>
      <Footer isLoggedIn />
    </>
  )
}
