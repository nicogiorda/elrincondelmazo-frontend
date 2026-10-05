import Header from '../components/Header.jsx'
import Footer from '../components/Footer.jsx'
import ProductCard from '../components/ProductCard.jsx'
import CollectionCard from '../components/CollectionCard.jsx'
import PromotionCard from '../components/PromotionCard.jsx'
import hero from '../assets/home-hero.png'
import { homeCollections, homeProducts, homePromotions, homeProductBackgrounds } from '../data/homeMocks.js'

function Home({ cartCount = 0, onSelectCollection, onViewCollections, onViewCatalog, onOpenProduct, onAddToCart, onStartSelling }) {
  return (
    <>
      <Header cartCount={cartCount} />
      <main>
        <section aria-label="Cartas Topps NBA" className="px-6 py-10.5">
          <img src={hero} alt="Cartas coleccionables Topps NBA" className="mx-auto aspect-[1358/579] w-full max-w-[84.875rem] rounded-[0.5625rem] object-cover" />
        </section>

        <div className="mx-auto flex w-full max-w-[85rem] flex-col gap-14 px-6 pt-9 pb-18 lg:px-10 2xl:min-h-[109.625rem] 2xl:justify-end">
          <section aria-labelledby="collections-heading" className="flex flex-col gap-5.5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h1 id="collections-heading" className="font-display text-[4rem] leading-[3.6rem] font-black uppercase">Colecciones</h1>
              <button type="button" onClick={onViewCollections} className="rounded-full bg-rojo px-5 py-2.5 text-[0.875rem] leading-[normal] font-extrabold tracking-[0.035rem] text-crema uppercase">Ver todo</button>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {homeCollections.map((collection) => (
                <CollectionCard key={collection.id} collection={collection} onSelectCollection={onSelectCollection} />
              ))}
            </div>
          </section>

          <section aria-labelledby="products-heading" className="flex flex-col gap-5.5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 id="products-heading" className="font-display text-[4rem] leading-[3.6rem] font-black uppercase">Recién publicados</h2>
              <button type="button" onClick={onViewCatalog} className="rounded-full bg-rojo px-5 py-2.5 text-[0.875rem] leading-[normal] font-extrabold tracking-[0.035rem] text-crema uppercase">Ver catálogo</button>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {homeProducts.map((product) => (
                <ProductCard key={product.id} product={product} variant="home" imageBackground={homeProductBackgrounds[product.collectionId]} onOpenProduct={onOpenProduct} onAddToCart={onAddToCart} />
              ))}
            </div>
          </section>

          <section aria-labelledby="promotions-heading" className="grid items-center gap-10 rounded-[2.25rem] bg-amarillo px-6 py-11 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,2fr)] lg:px-12 2xl:grid-cols-[22.0732421875rem_minmax(0,1fr)]">
            <h2 id="promotions-heading" className="max-w-[22.125rem] font-display text-[4.5rem] leading-[3.87rem] font-black text-crema uppercase text-shadow-product">Promos activas</h2>
            <div className="grid min-w-0 gap-4.5 md:grid-cols-3 2xl:pr-1.5">
              {homePromotions.map((promotion) => (
                <PromotionCard key={promotion.id} promotion={promotion} />
              ))}
            </div>
          </section>

          <section aria-labelledby="sell-heading" className="flex min-h-[17.3125rem] flex-wrap items-center justify-between gap-8 rounded-[2.25rem] bg-bordo p-6 text-crema lg:p-12">
            <div className="flex max-w-[40rem] flex-col gap-3">
              <h2 id="sell-heading" className="font-display text-[4rem] leading-[3.6rem] font-black uppercase">¿Tenés cartas repetidas?</h2>
              <p className="text-[1.125rem] leading-[1.63125rem] opacity-90">Publicalas en tu cuenta: cargás fotos, precio y stock, y aparecen en el catálogo.</p>
            </div>
            <button type="button" onClick={onStartSelling} className="rounded-full bg-rojo px-8 py-4.5 text-[1.125rem] leading-[normal] font-extrabold">Empezar a vender</button>
          </section>
        </div>
      </main>
      <Footer variant="home" />
    </>
  )
}

export default Home
