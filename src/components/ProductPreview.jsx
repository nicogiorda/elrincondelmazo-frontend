import ProductThumbnail from './ProductThumbnail.jsx'
import { productTypeLabels } from '../data/accountMocks.js'
import { formatPrice } from '../data/purchaseMocks.js'

function ProductPreview({ product }) {
  return (
    <aside className="flex min-w-0 flex-col gap-3">
      <h2 className="text-[0.8125rem] font-extrabold tracking-[0.04875rem] uppercase">Así se ve en el catálogo</h2>
      <article className="rounded-[1.375rem] border-[2.4px] border-bordo bg-papel shadow-product">
        <div className="relative px-3 pt-3">
          <ProductThumbnail product={product} variant="preview" />
          <span className="absolute top-6 left-6 rounded-full border-[1.6px] border-bordo bg-crema px-2.5 py-1 text-[0.625rem] font-extrabold uppercase">{productTypeLabels[product.type]}</span>
        </div>
        <div className="flex flex-col gap-1 px-4 pt-3.5 pb-4">
          <p className="text-[0.75rem] font-bold tracking-[0.0375rem] uppercase opacity-75">{product.collectionName} · {product.sellerName}</p>
          <h3 className="font-display text-[1.5625rem] leading-[1.5625rem] font-extrabold wrap-anywhere uppercase">{product.name || 'Nombre del producto'}</h3>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <strong className="text-[1.25rem]">{product.price ? formatPrice(product.price) : '$ —'}</strong>
            <button type="button" disabled className="rounded-full bg-bordo px-3.5 py-2 text-[0.8125rem] font-extrabold text-crema">Agregar</button>
          </div>
        </div>
      </article>
    </aside>
  )
}
export default ProductPreview
