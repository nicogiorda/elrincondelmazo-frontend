function Pagination({ page, totalPages, onPageChange }) {
  const pages = Array.from({ length: totalPages }, (_, index) => index)
  const buttonClass = 'flex size-12.5 items-center justify-center rounded-full border-3 border-bordo font-extrabold'

  return (
    <nav aria-label="Paginación de productos" className="flex flex-wrap items-center justify-between gap-4 leading-[normal] text-bordo">
      <p className="text-[0.875rem] font-semibold">Página {page + 1} de {totalPages}</p>
      <div className="flex gap-2">
        <button type="button" aria-label="Página anterior" disabled={page === 0} onClick={() => onPageChange(page - 1)} className={`${buttonClass} bg-papel disabled:cursor-not-allowed`}>←</button>
        {pages.map((pageIndex) => (
          <button key={pageIndex} type="button" aria-label={`Página ${pageIndex + 1}`} aria-current={page === pageIndex ? 'page' : undefined} onClick={() => onPageChange(pageIndex)} className={`${buttonClass} ${page === pageIndex ? 'bg-bordo text-crema' : 'bg-papel'}`}>
            {pageIndex + 1}
          </button>
        ))}
        <button type="button" aria-label="Página siguiente" disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)} className={`${buttonClass} bg-papel disabled:cursor-not-allowed`}>→</button>
      </div>
    </nav>
  )
}

export default Pagination
