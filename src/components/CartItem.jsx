import { canBuyProduct } from '../utils/productPurchase.js'
import ProductThumbnail from './ProductThumbnail.jsx'
import QuantitySelector from './QuantitySelector.jsx'
import { productTypeLabels } from '../data/accountMocks.js'
import { formatPrice } from '../data/purchaseMocks.js'

function CartItem({ item, userId, onQuantityChange, onRemove }) {
  const { product, quantity } = item
  if (!product) return (
    <article className="rounded-3xl border-[2.4px] border-bordo bg-papel p-4">
      <p className="font-bold">Este producto ya no está disponible.</p>
      <button type="button" onClick={() => onRemove?.(item.id)} className="text-[0.875rem] font-bold underline">Quitar</button>
    </article>
  )
  return (
    <article className="grid min-w-0 grid-cols-[6.25rem_minmax(0,1fr)] items-center gap-5 rounded-3xl border-[2.4px] border-bordo bg-papel p-4 shadow-product">
      <ProductThumbnail product={product} variant="cart" />
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="text-[0.75rem] font-bold tracking-[0.0375rem] uppercase opacity-75">{productTypeLabels[product.type]} · {product.collectionName} · {product.sellerName}</p>
        <h2 className="font-display text-[1.625rem] leading-[1.625rem] font-extrabold uppercase">{product.name}</h2>
        <p className="text-[0.9375rem] font-semibold">{formatPrice(product.price)} c/u</p>
        <div className="flex flex-wrap items-center gap-4 pt-1.5">
          <QuantitySelector quantity={quantity} maxQuantity={canBuyProduct(product, userId) ? product.stock : 0} onChange={(value) => onQuantityChange?.(item.id, value)} variant="cart" />
          <button type="button" onClick={() => onRemove?.(item.id)} className="text-[0.875rem] font-bold underline">Quitar</button>
          <strong className="ml-auto text-[1.375rem]">{formatPrice(product.price * quantity)}</strong>
        </div>
      </div>
    </article>
  )
}
export default CartItem
