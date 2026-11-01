import { canBuyProduct } from '../utils/productPurchase.js'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import Header from '../components/Header.jsx'
import Footer from '../components/Footer.jsx'
import ProductCard from '../components/ProductCard.jsx'
import ProductGallery from '../components/ProductGallery.jsx'
import QuantitySelector from '../components/QuantitySelector.jsx'
import ReviewCard from '../components/ReviewCard.jsx'
import ReviewForm from '../components/ReviewForm.jsx'
import {
  detailProductBackgrounds,
  detailPaymentLabel,
  detailPromotionLabel
} from '../data/productDetailMocks.js'

const typeLabels = { CARTA: 'Carta', SOBRE: 'Sobre', LOOTBOX: 'Lootbox' }

function ProductDetail({ cartBusy, cartError, cartMessage, cartItems = [], cartQuantity = 0, product, products, userId, user, canReview, onPublishReview, reviewsLoading, reviewsError, onRetryReviews, reviews: providedReviews, cartCount = 0, onAddToCart, onBuyNow, onOpenProduct, onViewCollection }) {
  const reviews = providedReviews ?? []
  const [selectedImage, setSelectedImage] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [showReviewForm, setShowReviewForm] = useState(true)

  const relatedProducts = products.filter((candidate) => candidate.collectionId === product.collectionId && candidate.id !== product.id).slice(0, 4)
  const availableUnits = Math.max(0, product.stock - cartQuantity)
  const canBuy = canBuyProduct(product, userId) && availableUnits > 0
  const selectedQuantity = availableUnits > 0 ? Math.min(quantity, availableUnits) : 0
  const isOwnProduct = product.sellerId === userId
  const isLastUnit = canBuy && product.stock === 1
  const averageRating = reviews.length ? reviews.reduce((total, review) => total + review.rating, 0) / reviews.length : 0
  const ratingLabel = averageRating.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const images = (product.imageUrls ?? []).map((url, index) => ({label: `Foto ${index + 1}`, url, background: 'crema',}))
  const productInformation = [
    { label: 'Vendido por', value: product.sellerName },
    { label: 'Tipo', value: typeLabels[product.type] },
    { label: 'Colección', value: product.collectionName },
    { label: 'Pagos', value: detailPaymentLabel },
  ]

  function changeQuantity(nextQuantity) {
    if (canBuy && nextQuantity >= 1 && nextQuantity <= availableUnits) setQuantity(nextQuantity)
  }

  function addSelectedQuantity() {
    if (!canBuy || cartBusy || !onAddToCart) return
    onAddToCart(product, selectedQuantity).then((saved) => { if (saved) setQuantity(1) })
  }

  return (
    <>
      <Header cartCount={cartCount} isLoggedIn={Boolean(user)} />
      <main className="mx-auto flex w-full max-w-[85rem] flex-col gap-12 px-6 pt-9 pb-18 text-bordo lg:px-10">
        <nav aria-label="Ruta del producto" className="flex flex-wrap gap-2 text-[0.875rem] leading-[normal] font-semibold">
          <Link to="/" className="underline">Inicio</Link><span>/</span>
          <Link to="/catalogo" className="underline">Catálogo</Link><span>/</span>
          <span>{product.collectionName}</span><span>/</span><span className="opacity-70">{product.name}</span>
        </nav>

        <section aria-labelledby="product-heading" className="grid min-w-0 gap-10 rounded-[2.25rem] border-3 border-bordo bg-papel p-7 2xl:min-h-[54.545rem] shadow-[0.625rem_0.625rem_0_var(--color-bordo)] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <ProductGallery images={images} selectedImage={selectedImage} onImageChange={setSelectedImage} />
          <div className="flex min-w-0 flex-col gap-5 py-3 leading-[normal] lg:pr-2">
            <div className="flex flex-wrap gap-2 text-[0.75rem] font-extrabold tracking-[0.045rem] uppercase">
              <span className="rounded-full border-2 border-bordo bg-rojo px-3 py-1.25 text-crema">{product.collectionName}</span>
              {isOwnProduct && <span className="rounded-full border-2 border-bordo bg-crema px-3 py-1.25">Tu publicación</span>}
              {isLastUnit && <span className="rounded-full border-2 border-bordo bg-crema px-3 py-1.25">Última unidad</span>}
            </div>
            <h1 id="product-heading" className="font-display text-[3.5rem] leading-[3.01rem] font-black text-balance uppercase xl:text-[4.75rem] xl:leading-[4.085rem]">{product.name}</h1>
            <div className="flex flex-wrap items-baseline gap-4">
              <p className="text-[2.125rem] font-extrabold">$ {product.price.toLocaleString('es-AR', { maximumFractionDigits: 2 })}</p>
              {reviews.length > 0 && <p className="text-[0.9375rem] font-semibold opacity-80">★ {ratingLabel} · {reviews.length} {reviews.length === 1 ? 'reseña' : 'reseñas'}</p>}
            </div>
            <p className="text-[1.0625rem] leading-[1.59375rem] text-pretty">{product.description}</p>
            <div className="flex items-center gap-3.5 rounded-[1.125rem] border-3 border-bordo bg-amarillo px-4.5 py-3.5">
              <p className="font-display text-[2.125rem] leading-[2.125rem] font-black text-rojo">Promos</p>
              <p className="text-[0.9375rem] leading-[1.21875rem] font-bold">{detailPromotionLabel}</p>
            </div>
            <div className="flex flex-wrap items-stretch gap-3">
              <QuantitySelector quantity={selectedQuantity} maxQuantity={canBuy && !cartBusy ? availableUnits : 0} onChange={changeQuantity} />
              <button type="button" disabled={!canBuy || cartBusy || !onAddToCart} onClick={addSelectedQuantity} className="min-w-0 flex-1 rounded-full border-3 border-bordo bg-bordo px-6 py-4 text-[1.125rem] font-extrabold text-crema disabled:cursor-not-allowed disabled:opacity-50">Agregar al carrito</button>
            </div>
            <button type="button" disabled={!canBuy || cartBusy || !onBuyNow} onClick={() => { if (canBuy) onBuyNow?.(product, selectedQuantity) }} className="w-full rounded-full border-3 border-bordo bg-rosa px-6 py-3.5 text-[1.0625rem] font-extrabold shadow-[0.25rem_0.25rem_0_var(--color-bordo)] disabled:cursor-not-allowed disabled:opacity-50">Comprar ahora</button>
            {cartError && <p role="alert" className="font-bold text-rojo">{cartError} <Link to="/carrito" className="underline">Revisar carrito</Link></p>}
            {cartMessage && <p role="status" className="font-bold">{cartMessage}</p>}
            {!user && <Link to="/ingresar" className="font-bold underline">Ingresá para comprar.</Link>}
            {!onAddToCart && <p className="text-[0.875rem] font-semibold">Las compras todavía no están disponibles. Podés seguir explorando el catálogo.</p>}
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
            {reviewsLoading ? <p role="status">Cargando reseñas…</p> : reviewsError ? (
              <div><p role="alert" className="font-bold text-rojo">{reviewsError}</p><button type="button" onClick={onRetryReviews} className="mt-2 font-bold underline">Reintentar</button></div>
            ) : reviews.length > 0 ? <div className="flex items-end gap-4 leading-[normal]">
              <p className="font-display text-[5.5rem] leading-[4.95rem] font-black text-rojo">{ratingLabel}</p>
              <p className="pb-0.5 text-[0.9375rem] font-bold">de 5 · {reviews.length} {reviews.length === 1 ? 'reseña' : 'reseñas'}</p>
            </div> : <p className="text-[0.9375rem] font-bold">Todavía no hay reseñas</p>}
            <p className="text-[0.875rem] leading-[1.26875rem] opacity-80">Solo pueden reseñar quienes compraron este producto. Una reseña por persona.</p>
            {!onPublishReview ? (
              <p className="text-[0.875rem] font-semibold">Publicar reseñas todavía no está disponible.</p>
            ) : !user ? (
              <Link to="/ingresar" className="self-start rounded-[0.875rem] border-2 border-dashed border-bordo px-3.5 py-2.5 text-[0.875rem] leading-[1.18125rem] font-bold">Ingresá para reseñar productos que compraste.</Link>
            ) : !reviewsLoading && !reviewsError && canReview?.(product) && (
              showReviewForm ? (
                <ReviewForm onCancel={() => setShowReviewForm(false)} onPublish={(review) => {
                  return onPublishReview(product, review).then((published) => {
                    if (published) setShowReviewForm(false)
                    return published
                  })
                }} />
              ) : (
                <button type="button" onClick={() => setShowReviewForm(true)} className="self-start rounded-full border-[2.4px] border-bordo bg-rosa px-5 py-3 text-[0.875rem] font-extrabold shadow-[0.1875rem_0.1875rem_0_var(--color-bordo)]">Dejar reseña</button>
              )
            )}
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
              <ProductCard key={relatedProduct.id} product={relatedProduct} userId={userId} cartQuantity={cartItems.find((item) => item.productId === relatedProduct.id)?.quantity ?? 0} variant="related" imageBackground={detailProductBackgrounds[relatedProduct.collectionId]} onOpenProduct={onOpenProduct} onAddToCart={onAddToCart} cartBusy={cartBusy} />
            ))}
          </div>
        </section>
      </main>
      <Footer isLoggedIn={Boolean(user)} />
    </>
  )
}

export default ProductDetail
