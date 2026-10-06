const galleryBackgrounds = { rojo: 'bg-rojo', crema: 'bg-crema', amarillo: 'bg-amarillo', rosa: 'bg-rosa' }

function ProductGallery({ images, selectedImage, onImageChange }) {
  const image = images[selectedImage]

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div role="img" aria-label={`Imagen del producto: ${image?.label ?? ''}`} className={`flex aspect-square w-full items-center justify-center overflow-hidden rounded-[1.625rem] border-3 border-bordo ${galleryBackgrounds[image?.background] ?? 'bg-crema'}`}>
        {image?.url && <img src={image.url} alt={image.label} className="max-h-[25.4375rem] max-w-[18.3125rem] object-contain" />}
      </div>
      <div className="grid grid-cols-4 gap-3">
        {images.map((thumbnail, index) => (
          <button key={thumbnail.label} type="button" aria-label={`Mostrar ${thumbnail.label}`} aria-pressed={selectedImage === index} onClick={() => onImageChange(index)} className={`flex aspect-square min-w-0 items-center justify-center overflow-hidden rounded-2xl border-3 border-bordo p-1.5 ${galleryBackgrounds[thumbnail.background] ?? 'bg-crema'} ${selectedImage === index ? 'shadow-[0.25rem_0.25rem_0_var(--color-bordo)]' : ''}`}>
            {thumbnail.url ? <img src={thumbnail.url} alt={thumbnail.label} className="h-full w-full object-contain" /> : <span className="rounded-[0.1875rem] bg-crema px-1 py-0.5 text-center font-mono text-[0.625rem] leading-[0.8125rem] font-medium text-bordo">{thumbnail.label}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

export default ProductGallery
