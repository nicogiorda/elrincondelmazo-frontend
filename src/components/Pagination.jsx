function Pagination({ page, totalPages, onPageChange }) {
  // Como máximo siete números; no construimos un array del tamaño del catálogo.
  const start = Math.max(1, Math.min(page - 1, totalPages - 4))
  const candidates = totalPages <= 7
    ? Array.from({ length: totalPages }, (_, index) => index)
    : [0, start, start + 1, start + 2, totalPages - 1]
  const pages = []
  candidates.forEach((index, position) => {
    const previous = candidates[position - 1]
    if (position > 0 && index - previous === 2) pages.push(index - 1)
    else if (position > 0 && index - previous > 2) pages.push('gap-' + index)
    pages.push(index)
  })
  const buttonClass = 'flex size-12.5 items-center justify-center rounded-full border-3 border-bordo font-extrabold'

  return (
    <nav aria-label="Paginación de productos" className="flex flex-wrap items-center justify-between gap-4 leading-[normal] text-bordo">
      <p className="text-[0.875rem] font-semibold">Página {page + 1} de {totalPages}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" aria-label="Página anterior" disabled={page === 0} onClick={() => onPageChange(page - 1)} className={`${buttonClass} bg-papel disabled:cursor-not-allowed`}>←</button>
        {pages.map((pageIndex) => (
          typeof pageIndex === 'string' ? <span key={pageIndex} aria-hidden="true" className="flex h-12.5 items-center px-1 font-extrabold">…</span> : <button key={pageIndex} type="button" aria-label={`Página ${pageIndex + 1}`} aria-current={page === pageIndex ? 'page' : undefined} onClick={() => onPageChange(pageIndex)} className={`${buttonClass} ${page === pageIndex ? 'bg-bordo text-crema' : 'bg-papel'}`}>
            {pageIndex + 1}
          </button>
        ))}
        <button type="button" aria-label="Página siguiente" disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)} className={`${buttonClass} bg-papel disabled:cursor-not-allowed`}>→</button>
      </div>
    </nav>
  )
}

export default Pagination
