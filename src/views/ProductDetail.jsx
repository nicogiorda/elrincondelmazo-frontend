import { useState } from 'react'
import Header from '../components/Header.jsx'
import Footer from '../components/Footer.jsx'
import ProductCard from '../components/ProductCard.jsx'
import ProductGallery from '../components/ProductGallery.jsx'
import QuantitySelector from '../components/QuantitySelector.jsx'
import ReviewCard from '../components/ReviewCard.jsx'
import { detailProduct, detailGallery, detailReviews, detailRelatedProducts, detailProductBackgrounds, detailPaymentLabel, detailTransferPromotion } from '../data/productDetailMocks.js'

const typeLabels = { CARTA: 'Carta', SOBRE: 'Sobre', LOOTBOX: 'Lootbox' }

function ProductDetail({ product = detailProduct, reviews = detailReviews, relatedProducts = detailRelatedProducts, cartCount = 0, onNavigate, onAddToCart, onBuyNow, onOpenProduct, onViewCollection }) {
  const [selectedImage, setSelectedImage] = useState(0)
  const [quantity, setQuantity] = useState(1)

  const canBuy = product.status === 'ACTIVO' && product.stock > 0
  const isLastUnit = canBuy && product.stock === 1
  const averageRating = reviews.length ? reviews.reduce((total, review) => total + review.rating, 0) / reviews.length : 0
  const ratingLabel = averageRating.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const images = detailGallery.map((image, index) => ({ ...image, url: product.imageUrls[index] }))
  const productInformation = [
    { label: 'Vendido por', value: product.sellerName },
    { label: 'Tipo', value: typeLabels[product.type] },
    { label: 'Colección', value: product.collectionName },
    { label: 'Pagos', value: detailPaymentLabel },
  ]

  function changeQuantity(nextQuantity) {
    if (canBuy && nextQuantity >= 1 && nextQuantity <= product.stock) setQuantity(nextQuantity)
  }

  return (
    <>
      <Header cartCount={cartCount} onNavigate={onNavigate} />
      <main className="mx-auto flex w-full max-w-[85rem] flex-col gap-12 px-6 pt-9 pb-18 text-bordo lg:px-10">
        <nav aria-label="Ruta del producto" className="flex flex-wrap gap-2 text-[0.875rem] leading-[normal] font-semibold">
          <button type="button" onClick={() => onNavigate?.('home')} className="underline">Inicio</button><span>/</span>
          <button type="button" onClick={() => onNavigate?.('catalog')} className="underline">Catálogo</button><span>/</span>
          <span>{product.collectionName}</span><span>/</span><span className="opacity-70">{product.name}</span>
        </nav>

        <section aria-labelledby="product-heading" className="grid min-w-0 gap-10 rounded-[2.25rem] border-3 border-bordo bg-papel p-7 2xl:min-h-[54.545rem] shadow-[0.625rem_0.625rem_0_var(--color-bordo)] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <ProductGallery images={images} selectedImage={selectedImage} onImageChange={setSelectedImage} />
          <div className="flex min-w-0 flex-col gap-5 py-3 leading-[normal] lg:pr-2">
            <div className="flex flex-wrap gap-2 text-[0.75rem] font-extrabold tracking-[0.045rem] uppercase">
              <span className="rounded-full border-2 border-bordo bg-rojo px-3 py-1.25 text-crema">{product.collectionName}</span>
              {isLastUnit && <span className="rounded-full border-2 border-bordo bg-crema px-3 py-1.25">Última unidad</span>}
            </div>
            <h1 id="product-heading" className="font-display text-[3.5rem] leading-[3.01rem] font-black text-balance uppercase xl:text-[4.75rem] xl:leading-[4.085rem]">{product.name}</h1>
            <div className="flex flex-wrap items-baseline gap-4">
              <p className="text-[2.125rem] font-extrabold">$ {product.price.toLocaleString('es-AR', { maximumFractionDigits: 2 })}</p>
              <p className="text-[0.9375rem] font-semibold opacity-80">★ {ratingLabel} · {reviews.length} reseñas</p>
            </div>
            <p className="text-[1.0625rem] leading-[1.59375rem] text-pretty">{product.description}</p>
            <div className="flex items-center gap-3.5 rounded-[1.125rem] border-3 border-bordo bg-amarillo px-4.5 py-3.5">
              <p className="font-display text-[2.125rem] leading-[2.125rem] font-black text-rojo">{detailTransferPromotion.discount}</p>
              <p className="text-[0.9375rem] leading-[1.21875rem] font-bold">{detailTransferPromotion.text}</p>
            </div>
            <div className="flex flex-wrap items-stretch gap-3">
              <QuantitySelector quantity={quantity} maxQuantity={canBuy ? product.stock : 0} onChange={changeQuantity} />
              <button type="button" disabled={!canBuy} onClick={() => { if (canBuy) onAddToCart?.(product, quantity) }} className="min-w-0 flex-1 rounded-full border-3 border-bordo bg-bordo px-6 py-4 text-[1.125rem] font-extrabold text-crema disabled:cursor-not-allowed">Agregar al carrito</button>
            </div>
            <button type="button" disabled={!canBuy} onClick={() => { if (canBuy) onBuyNow?.(product, quantity) }} className="w-full rounded-full border-3 border-bordo bg-rosa px-6 py-3.5 text-[1.0625rem] font-extrabold shadow-[0.25rem_0.25rem_0_var(--color-bordo)] disabled:cursor-not-allowed">Comprar ahora</button>
            <dl>
              {productInformation.map((item) => (
                <div key={item.label} className="flex justify-between gap-4 border-b-3 border-bordo py-3.5 text-[0.9375rem]">
                  <dt className="shrink-0 font-extrabold">{item.label}</dt><dd className="text-right font-medium">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section aria-labelledby="reviews-heading" className="grid items-start gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,2fr)]">
          <div className="flex flex-col gap-3.5">
            <h2 id="reviews-heading" className="font-display text-[4rem] leading-[3.6rem] font-black uppercase">Reseñas</h2>
            <div className="flex items-end gap-4 leading-[normal]">
              <p className="font-display text-[5.5rem] leading-[4.95rem] font-black text-rojo">{ratingLabel}</p>
              <p className="pb-0.5 text-[0.9375rem] font-bold">de 5 · {reviews.length} reseñas</p>
            </div>
            <p className="text-[0.875rem] leading-[1.26875rem] opacity-80">Solo pueden reseñar quienes compraron este producto. Una reseña por persona.</p>
          </div>
          <div className="grid min-w-0 gap-4.5 md:grid-cols-3">
            {reviews.map((review) => <ReviewCard key={review.id} review={review} />)}
          </div>
        </section>

        <section aria-labelledby="related-heading" className="flex flex-col gap-6.5 rounded-[2.25rem] border-3 border-bordo bg-amarillo p-6 lg:p-10 2xl:min-h-[35.21875rem]">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="related-heading" className="font-display text-[4rem] leading-[3.6rem] font-black uppercase">Más de {product.collectionName}</h2>
            <button type="button" onClick={() => onViewCollection?.(product.collectionId)} className="rounded-full border-3 border-bordo bg-crema px-5 py-2.5 text-[0.875rem] leading-[normal] font-extrabold tracking-[0.035rem] uppercase">Ver colección</button>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {relatedProducts.map((relatedProduct) => (
              <ProductCard key={relatedProduct.id} product={relatedProduct} variant="related" imageBackground={detailProductBackgrounds[relatedProduct.collectionId]} onOpenProduct={onOpenProduct} onAddToCart={(item) => onAddToCart?.(item, 1)} />
            ))}
          </div>
        </section>
      </main>
      <Footer onNavigate={onNavigate} />
    </>
  )
}

export default ProductDetail
