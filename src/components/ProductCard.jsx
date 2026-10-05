const variantStyles = {
  home: {
    content: 'min-h-[9.3125rem]',
    title: 'text-[1.5625rem] leading-[1.5625rem]',
    price: 'text-[1.25rem]',
    button: 'bg-rojo',
  },
  catalog: {
    content: 'min-h-[9.3125rem]',
    title: 'text-[1.5625rem] leading-[1.5625rem]',
    price: 'text-[1.25rem]',
    button: 'bg-bordo',
  },
  related: {
    content: 'min-h-[7.8125rem]',
    title: 'text-[1.4375rem] leading-[1.4375rem]',
    price: 'text-[1.1875rem]',
    button: 'bg-bordo',
  },
}

const imageBackgrounds = {
  rojo: 'bg-rojo',
  amarillo: 'bg-amarillo',
  crema: 'bg-crema',
  rosa: 'bg-rosa',
}

// Proporciones de las imágenes de sobres y lootboxes en Home según Figma.
const homeImageSizes = {
  SOBRE: 'max-h-[16.125rem] max-w-[16.125rem]',
  LOOTBOX: 'max-h-[15.1875rem] max-w-[14.4375rem]',
}

function ProductCard({ product, variant = 'home', imageBackground = 'crema', onOpenProduct, onAddToCart }) {
  const styles = variantStyles[variant]
  const isSoldOut = product.stock === 0 || product.status === 'AGOTADO'
  const canAddToCart = product.status === 'ACTIVO' && !isSoldOut
  const imageUrl = product.imageUrls?.[0]
  const imageBackgroundClass = imageBackgrounds[imageBackground] ?? 'bg-crema'

  return (
    <article className={`relative flex w-full flex-col rounded-[1.375rem] border-3 border-bordo bg-papel leading-[normal] text-bordo shadow-product ${isSoldOut ? 'opacity-60' : ''}`}>
      <div className="px-3 pt-3">
        <button
          type="button"
          aria-label={`Ver ${product.name}`}
          onClick={() => onOpenProduct?.(product)}
          className={`flex aspect-square w-full items-center justify-center overflow-hidden rounded-[0.875rem] border-3 border-bordo ${imageBackgroundClass}`}
        >
          {imageUrl && <img src={imageUrl} alt={product.name} className={`h-full w-full object-contain ${variant === 'home' ? homeImageSizes[product.type] ?? '' : ''}`} />}
        </button>
      </div>

      <div className={`flex flex-1 flex-col gap-1 px-4 pt-3.5 pb-4 ${styles.content}`}>
        {variant !== 'related' && (
          <p className="text-[0.75rem] font-bold tracking-[0.0375rem] uppercase opacity-75">
            {product.collectionName}
            {variant === 'catalog' && product.sellerName && ` · ${product.sellerName}`}
          </p>
        )}
        <h2 className={`font-display font-extrabold uppercase ${styles.title}`}>
          <button type="button" className="text-left uppercase" onClick={() => onOpenProduct?.(product)}>
            {product.name}
          </button>
        </h2>
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <p className={`font-extrabold whitespace-nowrap ${styles.price}`}>
            $ {product.price.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
          </p>
          <button
            type="button"
            disabled={!canAddToCart}
            onClick={() => onAddToCart?.(product)}
            className={`rounded-full px-3.5 py-2 text-[0.8125rem] font-extrabold whitespace-nowrap text-crema disabled:cursor-not-allowed ${styles.button}`}
          >
            {isSoldOut ? 'Sin stock' : 'Agregar'}
          </button>
        </div>
      </div>

      {isSoldOut && (
        <span className="absolute -top-3 -right-1.5 flex size-18 rotate-14 items-center justify-center rounded-full border-3 border-bordo bg-bordo font-display text-[1rem] leading-[0.9rem] font-black text-crema uppercase">
          Agotado
        </span>
      )}
    </article>
  )
}

export default ProductCard
