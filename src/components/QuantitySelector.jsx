function QuantitySelector({ quantity, maxQuantity, onChange, variant = 'default' }) {
  return (
    <div role="group" aria-label="Cantidad" className={`flex shrink-0 items-center rounded-full border-bordo bg-crema leading-[normal] font-extrabold text-bordo ${variant === 'cart' ? 'h-[2.8rem] border-[2.4px]' : 'border-3'}`}>
      <button type="button" aria-label="Disminuir cantidad" disabled={maxQuantity < 1 || quantity <= 1} onClick={() => { if (maxQuantity > 0 && quantity > 1) onChange(quantity - 1) }} className={`${variant === 'cart' ? 'w-10 text-[1.25rem]' : 'w-12 text-[1.375rem]'} self-stretch disabled:cursor-not-allowed`}>−</button>
      <output aria-label="Cantidad seleccionada" className={`${variant === 'cart' ? 'min-w-6 text-base' : 'min-w-7 text-[1.125rem]'} text-center`}>{quantity}</output>
      <button type="button" aria-label="Aumentar cantidad" disabled={maxQuantity < 1 || quantity >= maxQuantity} onClick={() => { if (maxQuantity > 0 && quantity < maxQuantity) onChange(quantity + 1) }} className={`${variant === 'cart' ? 'w-10 text-[1.25rem]' : 'w-12 text-[1.375rem]'} self-stretch disabled:cursor-not-allowed`}>+</button>
    </div>
  )
}

export default QuantitySelector
