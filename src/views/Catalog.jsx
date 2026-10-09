import { useLocation } from 'react-router-dom'
import { useState } from 'react'
import Header from '../components/Header.jsx'
import Footer from '../components/Footer.jsx'
import ProductCard from '../components/ProductCard.jsx'
import CatalogFilters from '../components/CatalogFilters.jsx'
import Pagination from '../components/Pagination.jsx'
import { catalogProducts, catalogTypes, catalogCollections, catalogProductBackgrounds } from '../data/catalogMocks.js'

const pageSize = 9

function Catalog({ cartCount = 0, onOpenProduct, onAddToCart }) {
  const location = useLocation()
  const [search, setSearch] = useState('')
  const [type, setType] = useState(location.state?.type ?? '')
  const [collection, setCollection] = useState(String(location.state?.collectionId ?? ''))
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [page, setPage] = useState(0)

  const filteredProducts = catalogProducts.filter((product) => (
    product.name.toLocaleLowerCase('es-AR').includes(search.trim().toLocaleLowerCase('es-AR'))
    && (type === '' || product.type === type)
    && (collection === '' || product.collectionId === Number(collection))
    && (minPrice === '' || product.price >= Number(minPrice))
    && (maxPrice === '' || product.price <= Number(maxPrice))
  ))
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize))
  const visibleProducts = filteredProducts.slice(page * pageSize, (page + 1) * pageSize)

  function changeFilter(setFilter, value) {
    setFilter(value)
    setPage(0)
  }

  function clearFilters() {
    setSearch('')
    setType('')
    setCollection('')
    setMinPrice('')
    setMaxPrice('')
    setPage(0)
  }

  return (
    <>
      <Header cartCount={cartCount} />
      <main className="mx-auto flex w-full max-w-[85rem] flex-col gap-8 px-6 pt-9 pb-18 text-bordo lg:px-10 2xl:min-h-[113.475rem]">
        <section aria-labelledby="catalog-heading" className="flex flex-wrap items-end justify-between gap-8 min-h-[11.8125rem] rounded-[2rem] border-3 border-bordo bg-rojo px-6 py-9 text-crema shadow-[0.5rem_0.5rem_0_var(--color-bordo)] lg:px-10">
          <div className="flex flex-col gap-2 leading-[normal]">
            <h1 id="catalog-heading" className="font-display text-[4rem] leading-[3.4rem] font-black sm:text-[6rem] sm:leading-[5.1rem] uppercase">Catálogo</h1>
            <p className="font-bold">{filteredProducts.length} {filteredProducts.length === 1 ? 'producto' : 'productos'}</p>
          </div>
          <form role="search" onSubmit={(event) => { event.preventDefault(); setPage(0) }} className="flex w-full max-w-[30.875rem] items-center gap-2.5 rounded-full border-3 border-bordo bg-crema py-1.5 pr-1.5 pl-5.5 text-bordo">
            <input type="search" aria-label="Buscar productos" placeholder="Buscar por nombre de carta, sobre o jugador" value={search} onChange={(event) => changeFilter(setSearch, event.target.value)} className="min-w-0 flex-1 bg-transparent py-2.5 leading-[normal] font-semibold placeholder:text-bordo/50" />
            <button type="submit" className="shrink-0 rounded-full bg-bordo px-5 py-3 text-[0.875rem] leading-[normal] font-extrabold text-crema">Buscar</button>
          </form>
        </section>

        <div className="grid min-w-0 gap-8 lg:grid-cols-[16.875rem_minmax(0,1fr)]">
          <CatalogFilters type={type} collection={collection} minPrice={minPrice} maxPrice={maxPrice} types={catalogTypes} collections={catalogCollections} onTypeChange={(value) => changeFilter(setType, value)} onCollectionChange={(value) => changeFilter(setCollection, value)} onMinPriceChange={(value) => changeFilter(setMinPrice, value)} onMaxPriceChange={(value) => changeFilter(setMaxPrice, value)} onClear={clearFilters} />
          <div className="flex min-w-0 flex-col gap-8">
            <div aria-label="Productos del catálogo" className="grid min-w-0 grid-cols-1 gap-6.5 sm:grid-cols-2 xl:grid-cols-3">
              {visibleProducts.map((product) => (
                <ProductCard key={product.id} product={product} variant="catalog" imageBackground={catalogProductBackgrounds[product.collectionId]} onOpenProduct={onOpenProduct} onAddToCart={onAddToCart} />
              ))}
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}

export default Catalog
