import { Link } from 'react-router-dom'
import { useState } from 'react'
import AccountLayout from '../components/AccountLayout.jsx'
import FormField from '../components/FormField.jsx'
import ProductPreview from '../components/ProductPreview.jsx'
import { productTypeLabels } from '../data/accountMocks.js'

function PublishProduct({ user, onLogout, cartCount, product, collections, collectionsLoading, collectionsError, onUploadPhoto, onPublish }) {
  const [form, setForm] = useState(() => ({ name: product?.name || '', description: product?.description || '', type: product?.type || 'CARTA', collectionId: product?.collectionId ?? '', price: product?.price ?? '', stock: product?.stock ?? 1 }))
  const [photos, setPhotos] = useState(() => (product?.imageUrls ?? []).map((url) => ({ previewUrl: url, url, file: null })))
  const [isSaving, setIsSaving] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [formError, setFormError] = useState('')
  const [isReadingPhotos, setIsReadingPhotos] = useState(false)
  const collection = collections.find((item) => item.id === (form.collectionId || collections[0]?.id))
  const preview = {
    ...form,
    id: product?.id,
    imageUrls: photos.map((photo) => photo.previewUrl),
    collectionId: collection?.id,
    price: Number(form.price),
    stock: Number(form.stock),
    collectionName: collection?.name ?? '',
    sellerId: product?.sellerId ?? user.id,
    sellerName: product?.sellerName ?? `${user.firstName} ${user.lastName[0]}.`,
    status: Number(form.stock) === 0 ? 'AGOTADO'
      : product?.status === 'INACTIVO' ? 'INACTIVO' : 'ACTIVO',
  }
  function changeField(field, value) { setForm((current) => ({ ...current, [field]: value })) }
  async function submitProduct(event) {
    event.preventDefault()
    if (isSaving) return
    if (isReadingPhotos) {
      setPhotoError('Esperá a que terminen de cargar las fotografías.')
      return
    }
    if ((!product || (product.imageUrls ?? []).length > 0) && photos.length === 0) {
      setPhotoError('Cargá al menos una fotografía para publicar el producto.')
      return
    }
    if ((!product || product.name?.trim() || form.name.length > 0) && !form.name.trim()) {
      setFormError('Ingresá un nombre válido para el producto.')
      return
    }
    if ((!product || product.description?.trim() || form.description.length > 0) && !form.description.trim()) {
      setFormError('Ingresá una descripción válida para el producto.')
      return
    }
    if (form.price === '' || !Number.isFinite(preview.price) || preview.price < 0.01
      || form.stock === '' || !Number.isInteger(preview.stock) || preview.stock < 0
      || !productTypeLabels[form.type] || !collection) {
      setFormError('Revisá el precio, stock, tipo y colección del producto.')
      return
    }
    setFormError('')
    setIsSaving(true)
    try {
      const imageUrls = []
      for (const photo of photos) {
        let url = photo.url
        if (!url) {
          url = await onUploadPhoto(photo.file)
          // Conservar las subidas exitosas si luego falla otra foto o el guardado.
          setPhotos((current) => current.map((item) => item === photo ? { ...item, url } : item))
        }
        if (url.startsWith('data:')) throw new Error('Reemplazá las fotografías que no tengan una URL válida.')
        imageUrls.push(url)
      }
      await onPublish({
        name: form.name.trim(), description: form.description.trim(),
        price: preview.price, type: form.type, imageUrls,
        stock: preview.stock, collectionId: collection.id,
      })
    } catch (error) {
      setFormError(error.message || 'No pudimos guardar la publicación. Probá nuevamente.')
    } finally {
      setIsSaving(false)
    }
  }

  function loadPhotos(event, replaceIndex = null) {
    const input = event.target
    const photos = Array.from(input.files)
    input.value = ''
    if (isReadingPhotos || isSaving || photos.length === 0) return
    if (photos.some((file) => !file.type.startsWith('image/'))) {
      setPhotoError('Seleccioná únicamente archivos de imagen válidos.')
      return
    }
    if ((replaceIndex !== null && (photos.length !== 1 || !preview.imageUrls[replaceIndex]))
      || (replaceIndex === null && preview.imageUrls.length + photos.length > 3)) {
      setPhotoError('Podés cargar hasta tres fotografías en total.')
      return
    }

    setPhotoError('')
    setIsReadingPhotos(true)
    Promise.all(photos.map((file) => new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('No se pudo leer la fotografía.'))
      reader.onabort = () => reject(new Error('Se interrumpió la lectura de la fotografía.'))
      reader.onload = () => {
        if (typeof reader.result !== 'string' || !reader.result.startsWith('data:image/')) {
          reject(new Error('El archivo no contiene una imagen válida.'))
          return
        }
        // Leer el archivo no garantiza que el navegador pueda mostrarlo.
        const image = new Image()
        image.onerror = () => reject(new Error('La imagen no se puede mostrar.'))
        image.onload = () => resolve({ file, previewUrl: reader.result, url: null })
        image.src = reader.result
      }
      reader.readAsDataURL(file)
    }))).then((newPhotos) => {
      // Incorporar el lote sólo si todas las fotografías cargaron correctamente.
      setPhotos((current) => replaceIndex === null
        ? [...current, ...newPhotos]
        : current.map((photo, index) => index === replaceIndex ? newPhotos[0] : photo))
      setPhotoError('')
    }).catch(() => {
      setPhotoError('No pudimos cargar las fotografías. Probá con imágenes válidas nuevamente.')
    }).finally(() => setIsReadingPhotos(false))
  }
  function removePhoto(index) {
    if (isReadingPhotos || isSaving) return
    setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))
    setPhotoError('')
  }
  return (
    <AccountLayout user={user} activeView="publications" cartCount={cartCount} onLogout={onLogout}>
      <div className="flex flex-col items-start gap-2.5">
        <Link to="/mis-publicaciones" className="text-[0.9375rem] font-bold underline">← Mis publicaciones</Link>
        <h1 className="font-display text-[4rem] leading-[3.52rem] font-black uppercase">{product ? 'Editar producto' : 'Publicar producto'}</h1>
      </div>
      <div className="grid min-w-0 items-start gap-7 xl:grid-cols-[minmax(0,1fr)_11.65rem]">
        <form onSubmit={submitProduct} aria-busy={isSaving} className="flex min-w-0 flex-col gap-5.5 rounded-[1.75rem] border-[2.4px] border-bordo bg-papel p-7 shadow-[0.5rem_0.5rem_0_var(--color-bordo)]">
          <div className="flex w-full max-w-[41.45rem] flex-col gap-5.5">
            <div className="flex flex-col gap-2">
              <span className="text-[0.8125rem] font-extrabold tracking-[0.04875rem] uppercase">Fotos</span>
              <div className="grid grid-cols-4 gap-3">
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-[0.875rem] border-[2.4px] border-dashed border-bordo bg-crema">
                  <input type="file" accept="image/*" multiple onChange={(event) => loadPhotos(event)} disabled={isReadingPhotos || isSaving} aria-busy={isReadingPhotos}
                    aria-invalid={Boolean(photoError)} aria-describedby={photoError || isReadingPhotos ? 'product-photo-feedback' : undefined}
                    className="sr-only" aria-label="Subir fotos" />
                  <span aria-hidden="true" className="flex size-[2.125rem] items-center justify-center rounded-full bg-bordo text-[1.5rem] font-black text-crema">+</span>
                  <span className="text-center text-[0.875rem] font-extrabold">Subir fotos</span>
                </label>
                {[0, 1, 2].map((index) => (
                  <div key={index} className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-[0.875rem] border-[2.4px] ${index < 2 || preview.imageUrls[index] ? 'border-bordo bg-rojo' : 'border-dashed border-bordo/40'}`}>
                    {preview.imageUrls[index] ? <>
                      <img src={preview.imageUrls[index]} alt={`Foto ${index + 1} del producto`} className="size-full object-contain" />
                      <button type="button" disabled={isReadingPhotos || isSaving} aria-label={`Eliminar foto ${index + 1}`}
                        onClick={() => removePhoto(index)} className="absolute top-1 right-1 rounded-full bg-crema px-1.5 text-[0.875rem] font-bold">×</button>
                      <label className="absolute right-0 bottom-0 left-0 cursor-pointer bg-crema px-1 py-0.5 text-center text-[0.625rem] font-bold">
                        Reemplazar
                        <input type="file" accept="image/*" disabled={isReadingPhotos || isSaving} onChange={(event) => loadPhotos(event, index)}
                          aria-label={`Reemplazar foto ${index + 1}`} aria-describedby={photoError ? 'product-photo-feedback' : undefined} className="sr-only" />
                      </label>
                    </> : index < 2 && <span className="rounded-sm bg-crema px-1 font-mono text-[0.625rem]">{index === 0 ? 'frente' : 'dorso'}</span>}
                  </div>
                ))}
              </div>
              {(photoError || isReadingPhotos) && (
                <p id="product-photo-feedback" role={photoError ? 'alert' : 'status'}
                  className={`text-[0.8125rem] font-semibold ${photoError ? 'text-rojo' : ''}`}>
                  {photoError || 'Cargando fotografías…'}
                </p>
              )}
            </div>
            <FormField disabled={isSaving} id="product-name" label="Nombre" required={!product || Boolean(product.name?.trim())} placeholder="Ej. Spider-Man Holo 60 aniversario" value={form.name} onChange={(e) => changeField('name', e.target.value)} />
            <FormField disabled={isSaving} id="product-description" label="Descripción" multiline required={!product || Boolean(product.description?.trim())} placeholder="Estado, edición, si viene en funda o slab…" value={form.description} onChange={(e) => changeField('description', e.target.value)} />
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-[0.8125rem] font-extrabold tracking-[0.04875rem] uppercase">Tipo</legend>
              <div className="grid grid-cols-3 gap-2.5">{Object.entries(productTypeLabels).map(([type, label]) => <button key={type} type="button" disabled={isSaving} aria-pressed={form.type === type} onClick={() => changeField('type', type)} className={`rounded-full border-[2.4px] border-bordo p-3 text-[0.9375rem] font-extrabold ${form.type === type ? 'bg-bordo text-crema' : 'bg-crema'}`}>{label}</button>)}</div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-[0.8125rem] font-extrabold tracking-[0.04875rem] uppercase">Colección</legend>
              {collectionsLoading && <p role="status" className="text-[0.8125rem] font-semibold">Cargando colecciones…</p>}
              {collectionsError && <p role="alert" className="text-[0.8125rem] font-semibold text-rojo">{collectionsError}</p>}
              {!collectionsLoading && !collectionsError && !collections.length && <p role="alert" className="text-[0.8125rem] font-semibold text-rojo">No hay colecciones disponibles para publicar.</p>}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">{collections.map((item) => <button key={item.id} type="button" disabled={isSaving} aria-pressed={collection?.id === item.id} onClick={() => changeField('collectionId', item.id)} className={`rounded-2xl border-[2.4px] border-bordo px-2 py-3.5 font-display text-[1.25rem] leading-5 font-black uppercase ${collection?.id === item.id ? 'bg-rojo text-crema shadow-[0.25rem_0.25rem_0_var(--color-bordo)]' : 'bg-crema'}`}>{item.name}</button>)}</div>
            </fieldset>
            <div className="grid grid-cols-2 gap-4.5">
              <FormField disabled={isSaving} id="product-price" label="Precio (ARS)" type="number" min="0.01" step="0.01" required placeholder="0" value={form.price} onChange={(e) => changeField('price', e.target.value)} />
              <FormField disabled={isSaving} id="product-stock" label="Stock" type="number" min="0" step="1" required value={form.stock} onChange={(e) => changeField('stock', e.target.value)} />
            </div>
          </div>
          {formError && <p role="alert" className="text-[0.8125rem] font-semibold text-rojo">{formError}</p>}
          <div className="flex justify-end gap-3">
            <Link to="/mis-publicaciones" className="rounded-full border-[2.4px] border-bordo px-6 py-3.5 text-base font-extrabold">Cancelar</Link>
            <button type="submit" disabled={isReadingPhotos || isSaving || collectionsLoading || !collection} className="rounded-full bg-bordo px-7 py-3.5 text-base font-extrabold text-crema">{isSaving ? 'Guardando…' : product ? 'Guardar cambios' : 'Publicar'}</button>
          </div>
        </form>
        <ProductPreview product={preview} />
      </div>
    </AccountLayout>
  )
}
export default PublishProduct
