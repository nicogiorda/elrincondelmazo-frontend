function QuantitySelector({ quantity, maxQuantity, onChange }) {
  return (
    <div role="group" aria-label="Cantidad" className="flex shrink-0 items-center rounded-full border-3 border-bordo bg-crema leading-[normal] font-extrabold text-bordo">
      <button type="button" aria-label="Disminuir cantidad" disabled={maxQuantity < 1 || quantity <= 1} onClick={() => { if (maxQuantity > 0 && quantity > 1) onChange(quantity - 1) }} className="w-12 self-stretch text-[1.375rem] disabled:cursor-not-allowed">−</button>
      <output aria-label="Cantidad seleccionada" className="min-w-7 text-center text-[1.125rem]">{quantity}</output>
      <button type="button" aria-label="Aumentar cantidad" disabled={maxQuantity < 1 || quantity >= maxQuantity} onClick={() => { if (maxQuantity > 0 && quantity < maxQuantity) onChange(quantity + 1) }} className="w-12 self-stretch text-[1.375rem] disabled:cursor-not-allowed">+</button>
    </div>
  )
}

export default QuantitySelector
