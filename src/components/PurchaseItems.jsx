import ProductThumbnail from './ProductThumbnail.jsx'
import { formatPrice } from '../utils/formatPrice.js'

function PurchaseItems({ items, products = [], variant = 'review' }) {
  return <div className="w-full min-w-0">{items.map((item) => {
    const name = item.productName
    const price = variant === 'review' ? item.unitPrice : item.price
    const product = variant === 'order' ? null : products.find((product) => product.id === item.productId)
    const thumbnail = { name, imageUrls: variant === 'order' ? [] : item.productImages ?? [], collectionId: product?.collectionId }
    const seller = variant === 'order' ? item.sellerEmail : product?.sellerName
    const subtotal = variant === 'review' ? item.subtotal : price * item.quantity
    return (
    <div key={item.id} className={`flex min-w-0 items-center gap-3.5 border-b-[2.4px] py-3 ${variant === 'order' ? 'border-bordo/20 py-2.5' : variant === 'review' ? 'gap-4.5 border-bordo py-3.5' : 'border-bordo'}`}>
      {variant !== 'confirmation' && <ProductThumbnail product={thumbnail} variant={variant === 'review' ? 'review' : 'order'} />}
      <div className="min-w-0 flex-1">
        <p className={variant === 'review' ? 'text-[1.0625rem] font-extrabold' : variant === 'confirmation' ? 'text-base font-bold' : 'text-[0.9375rem] font-extrabold'}>{variant === 'confirmation' && `${item.quantity} × `}{name}</p>
        {variant !== 'confirmation' && <p className={`mt-0.5 opacity-80 ${variant === 'review' ? 'text-[0.875rem]' : 'text-[0.8125rem]'}`}>{item.quantity} × {formatPrice(price)}{seller && ` · Vende ${seller}`}</p>}
      </div>
      <p className={`shrink-0 font-extrabold ${variant === 'review' ? 'text-[1.125rem]' : 'text-base'}`}>{formatPrice(subtotal)}</p>
    </div>
  )})}</div>
}
export default PurchaseItems
