import { useState } from 'react'

const galleryBackgrounds = { rojo: 'bg-rojo', crema: 'bg-crema', amarillo: 'bg-amarillo', rosa: 'bg-rosa' }

function ProductGallery({ images, selectedImage, onImageChange }) {
  const [failedUrls, setFailedUrls] = useState([])

  const image = images[selectedImage] ?? images[0]
  const imageFailed = image?.url && failedUrls.includes(image.url)

  function markFailed(url) {
    setFailedUrls((previous) =>
      previous.includes(url) ? previous : [...previous, url]
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div
        className={`flex aspect-square w-full items-center justify-center overflow-hidden rounded-[1.625rem] border-3 border-bordo ${
          galleryBackgrounds[image?.background] ?? 'bg-crema'
        }`}
      >
        {image?.url && !imageFailed ? (
          <img
            src={image.url}
            alt={image.label}
            onError={() => markFailed(image.url)}
            className="max-h-[25.4375rem] max-w-[18.3125rem] object-contain"
          />
        ) : (
          <p className="px-4 text-center font-semibold">
            Imagen no disponible
          </p>
        )}
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {images.map((thumbnail, index) => (
            <button
              key={`${thumbnail.url}-${index}`}
              type="button"
              aria-label={`Mostrar ${thumbnail.label}`}
              aria-pressed={selectedImage === index}
              onClick={() => onImageChange(index)}
              className={`flex aspect-square min-w-0 items-center justify-center overflow-hidden rounded-2xl border-3 border-bordo p-1.5 ${
                galleryBackgrounds[thumbnail.background] ?? 'bg-crema'
              } ${
                selectedImage === index
                  ? 'shadow-[0.25rem_0.25rem_0_var(--color-bordo)]'
                  : ''
              }`}
            >
              {thumbnail.url && !failedUrls.includes(thumbnail.url) ? (
                <img
                  src={thumbnail.url}
                  alt={thumbnail.label}
                  onError={() => markFailed(thumbnail.url)}
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="text-center text-xs font-semibold">
                  No disponible
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default ProductGallery
