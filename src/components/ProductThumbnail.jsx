import { collectionBackgrounds } from '../data/accountMocks.js'
const backgrounds = { rojo: 'bg-rojo', rosa: 'bg-rosa', crema: 'bg-crema', amarillo: 'bg-amarillo' }

// Los rectángulos sin fotografía y la carta inclinada son elementos del diseño de estas vistas.
function ProductThumbnail({ product, variant = 'order' }) {
  const sizes = { review: 'size-16 rounded-xl', order: 'size-[3.25rem] rounded-[0.625rem]', publication: 'size-[3.25rem] rounded-xl', cart: 'size-[6.25rem] rounded-2xl', preview: 'h-[14.375rem] w-full rounded-[0.875rem]' }
  return (
    <div className={`relative flex shrink-0 items-center justify-center overflow-hidden border-[2.4px] border-bordo ${sizes[variant]} ${backgrounds[collectionBackgrounds[product.collectionId]] || 'bg-crema'}`}>
      {product.imageUrls[0] ? <img src={product.imageUrls[0]} alt={product.name} className="size-full object-contain" /> : (variant === 'cart' || variant === 'preview') && <span aria-hidden="true" className={`-rotate-6 rounded-[0.375rem] border-[1.6px] border-bordo bg-crema ${variant === 'cart' ? 'h-[4.1875rem] w-[3.0625rem]' : 'h-[9.4375rem] w-[6.8125rem] rounded-[0.625rem] border-[2.4px] shadow-[0.25rem_0.25rem_0_var(--color-bordo)]'}`} />}
    </div>
  )
}
export default ProductThumbnail
