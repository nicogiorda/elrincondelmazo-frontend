import { useEffect, useState } from 'react'
import Pagination from '../components/Pagination.jsx'
import { Link } from 'react-router-dom'
import Header from '../components/Header.jsx'
import Footer from '../components/Footer.jsx'
import ProductCard from '../components/ProductCard.jsx'
import CatalogFilters from '../components/CatalogFilters.jsx'
import { catalogTypes, catalogProductBackgrounds } from '../data/catalogMocks.js'


const pageSize = 9

function Catalog({ loadPage, cacheVersion, isLoggedIn, cartBusy, cartError, cartMessage, collectionsError, cartItems = [], collections, userId, cartCount = 0, filters, onFiltersChange, onClearFilters, onOpenProduct, onAddToCart }) {


  const { search, type, collection, minPrice, maxPrice, page } = filters

  const params = new URLSearchParams({ page: String(page), size: String(pageSize) })
  if (search.trim()) params.set('search', search.trim())
  if (type) params.set('type', type)
  if (collection) params.set('collectionId', collection)
  if (minPrice !== '') params.set('minPrice', minPrice)
  if (maxPrice !== '') params.set('maxPrice', maxPrice)
  const query = params.toString()
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState(null)
  const loading = result?.query !== query || result?.attempt !== attempt || result?.cacheVersion !== cacheVersion
  const error = loading ? '' : result.error
  const visibleProducts = loading ? [] : result.content
  const totalProducts = loading ? 0 : result.totalElements
  const totalPages = loading ? 0 : result.totalPages
  const currentPage = loading ? page : result.number

  useEffect(() => {
    let active = true
    // Agrupa cambios rápidos de búsqueda/filtros sin agregar otro estado.
    const timeout = setTimeout(async () => {
      try {
        const data = await loadPage(query)
        if (active) setResult({ ...data, query, attempt, cacheVersion, error: '' })
      } catch (error) {
        if (active) setResult({ query, attempt, cacheVersion, content: [], totalElements: 0, totalPages: 0, number: page,
          error: error.message || 'No pudimos cargar el catálogo.' })
      }
    }, 250)
    return () => { active = false; clearTimeout(timeout) }
  }, [query, attempt, page, loadPage, cacheVersion])

  function changeFilter(field, value) {
    onFiltersChange({ ...filters, [field]: value, page: 0 })
  }

  function changePage(page) {
    onFiltersChange({ ...filters, page })
  }

  return (
    <>
      <Header cartCount={cartCount} isLoggedIn={isLoggedIn} />
      <main className="mx-auto flex w-full max-w-[85rem] flex-col gap-8 px-6 pt-9 pb-18 text-bordo lg:px-10 2xl:min-h-[113.475rem]">
        <section aria-labelledby="catalog-heading" className="flex flex-wrap items-end justify-between gap-8 min-h-[11.8125rem] rounded-[2rem] border-3 border-bordo bg-rojo px-6 py-9 text-crema shadow-[0.5rem_0.5rem_0_var(--color-bordo)] lg:px-10">
          <div className="flex flex-col gap-2 leading-[normal]">
            <h1 id="catalog-heading" className="font-display text-[4rem] leading-[3.4rem] font-black sm:text-[6rem] sm:leading-[5.1rem] uppercase">Catálogo</h1>
            <p className="font-bold">{totalProducts} {totalProducts === 1 ? 'producto' : 'productos'}</p>
          </div>
          <form role="search" onSubmit={(event) => { event.preventDefault(); changePage(0) }} className="flex w-full max-w-[30.875rem] items-center gap-2.5 rounded-full border-3 border-bordo bg-crema py-1.5 pr-1.5 pl-5.5 text-bordo">
            <input type="search" aria-label="Buscar productos" placeholder="Buscar por nombre de carta, sobre o jugador" value={search} onChange={(event) => changeFilter('search', event.target.value)} className="min-w-0 flex-1 bg-transparent py-2.5 leading-[normal] font-semibold placeholder:text-bordo/50" />
            <button type="submit" className="shrink-0 rounded-full bg-bordo px-5 py-3 text-[0.875rem] leading-[normal] font-extrabold text-crema">Buscar</button>
          </form>
        </section>

        {cartError && <p role="alert" className="font-bold text-rojo">{cartError} <Link to="/carrito" className="underline">Revisar carrito</Link></p>}
        {cartMessage && <p role="status" className="font-bold">{cartMessage}</p>}
        {loading && <p role="status">Cargando productos…</p>}
        {error && <p role="alert" className="font-bold text-rojo">{error} <button type="button" onClick={() => setAttempt((current) => current + 1)} className="underline">Reintentar</button></p>}
        {collectionsError && <p role="alert" className="font-bold text-rojo">{collectionsError}</p>}
        <div className="grid min-w-0 gap-8 lg:grid-cols-[16.875rem_minmax(0,1fr)]">
          <CatalogFilters type={type} collection={collection} minPrice={minPrice} maxPrice={maxPrice} types={catalogTypes} collections={collections} onTypeChange={(value) => changeFilter('type', value)} onCollectionChange={(value) => changeFilter('collection', value)} onMinPriceChange={(value) => changeFilter('minPrice', value)} onMaxPriceChange={(value) => changeFilter('maxPrice', value)} onClear={onClearFilters} />
          <div className="flex min-w-0 flex-col gap-8">
            {visibleProducts.length > 0 ? <>
            <div aria-label="Productos del catálogo" className="grid min-w-0 grid-cols-1 gap-6.5 sm:grid-cols-2 xl:grid-cols-3">
              {visibleProducts.map((product) => (
                <ProductCard key={product.id} product={product} userId={userId} cartQuantity={cartItems.find((item) => item.productId === product.id)?.quantity ?? 0} variant="catalog" imageBackground={catalogProductBackgrounds[product.collectionId]} onOpenProduct={onOpenProduct} onAddToCart={onAddToCart} cartBusy={cartBusy} />
              ))}
            </div>
            <Pagination page={currentPage} totalPages={totalPages} onPageChange={changePage} />
            </> : !loading && !error && (
              <div className="flex flex-col items-start gap-4 rounded-[1.375rem] border-3 border-bordo bg-papel p-6">
                <p className="font-bold">No encontramos productos con esos filtros</p>
                <button type="button" onClick={onClearFilters} className="rounded-full bg-bordo px-5 py-3 font-extrabold text-crema">Limpiar filtros</button>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer isLoggedIn={isLoggedIn} />
    </>
  )
}

export default Catalog
