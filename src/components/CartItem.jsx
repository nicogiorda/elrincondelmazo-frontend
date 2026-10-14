import { canBuyProduct } from '../utils/productPurchase.js'
import ProductThumbnail from './ProductThumbnail.jsx'
import QuantitySelector from './QuantitySelector.jsx'
import { productTypeLabels } from '../data/accountMocks.js'
import { formatPrice } from '../utils/formatPrice.js'

// El item es CartItemResponse. Solo completamos metadata con un producto real ya cargado.
function CartItem({ item, product, userId, onQuantityChange, onRemove }) {
  const canChange = Boolean(product && onQuantityChange && canBuyProduct(product, userId))
  const thumbnail = { name: item.productName, imageUrls: item.productImages ?? [], collectionId: product?.collectionId }
  return (
    <article className="grid min-w-0 grid-cols-[6.25rem_minmax(0,1fr)] items-center gap-5 rounded-3xl border-[2.4px] border-bordo bg-papel p-4 shadow-product">
      <ProductThumbnail product={thumbnail} variant="cart" />
      <div className="flex min-w-0 flex-col gap-1.5">
        {product && <p className="text-[0.75rem] font-bold tracking-[0.0375rem] uppercase opacity-75">{productTypeLabels[product.type]} · {product.collectionName} · {product.sellerName}</p>}
        <h2 className="font-display text-[1.625rem] leading-[1.625rem] font-extrabold uppercase">{item.productName}</h2>
        <p className="text-[0.9375rem] font-semibold">{formatPrice(item.unitPrice)} c/u</p>
        {!product && <p className="text-[0.875rem]">La disponibilidad de este producto aún no está confirmada.</p>}
        <div className="flex flex-wrap items-center gap-4 pt-1.5">
          <QuantitySelector quantity={item.quantity} maxQuantity={canChange ? product.stock : 0} onChange={(value) => onQuantityChange(item.id, value)} variant="cart" />
          <button type="button" disabled={!onRemove} onClick={() => onRemove?.(item.id)} className="text-[0.875rem] font-bold underline disabled:opacity-50">Quitar</button>
          <strong className="ml-auto text-[1.375rem]">{formatPrice(item.subtotal)}</strong>
        </div>
      </div>
    </article>
  )
}
export default CartItem
