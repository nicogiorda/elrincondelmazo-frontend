import ProductThumbnail from './ProductThumbnail.jsx'
import { formatPrice } from '../data/purchaseMocks.js'

function PurchaseItems({ items, variant = 'review' }) {
  return <div className="w-full min-w-0">{items.map((item) => (
    <div key={item.id} className={`flex min-w-0 items-center gap-3.5 border-b-[2.4px] py-3 ${variant === 'order' ? 'border-bordo/20 py-2.5' : variant === 'review' ? 'gap-4.5 border-bordo py-3.5' : 'border-bordo'}`}>
      {variant !== 'confirmation' && <ProductThumbnail product={item.product} variant={variant === 'review' ? 'review' : 'order'} />}
      <div className="min-w-0 flex-1">
        <p className={variant === 'review' ? 'text-[1.0625rem] font-extrabold' : variant === 'confirmation' ? 'text-base font-bold' : 'text-[0.9375rem] font-extrabold'}>{variant === 'confirmation' && `${item.quantity} × `}{item.product.name}</p>
        {variant !== 'confirmation' && <p className={`mt-0.5 opacity-80 ${variant === 'review' ? 'text-[0.875rem]' : 'text-[0.8125rem]'}`}>{item.quantity} × {formatPrice(item.product.price)} · Vende {item.product.sellerName}</p>}
      </div>
      <p className={`shrink-0 font-extrabold ${variant === 'review' ? 'text-[1.125rem]' : 'text-base'}`}>{formatPrice(item.product.price * item.quantity)}</p>
    </div>
  ))}</div>
}
export default PurchaseItems
