import { Link } from 'react-router-dom'
import { useState } from 'react'
import AccountLayout from '../components/AccountLayout.jsx'
import FormField from '../components/FormField.jsx'
import ProductPreview from '../components/ProductPreview.jsx'
import { publicationCollections, productTypeLabels } from '../data/accountMocks.js'

function PublishProduct({ user, onLogout, cartCount, product, onPublish }) {
  const [form, setForm] = useState(() => ({ name: product?.name || '', description: product?.description || '', type: product?.type || 'CARTA', collectionId: product?.collectionId || 1, price: product?.price ?? '', stock: product?.stock ?? 1, imageUrls: product?.imageUrls || [] }))
  const [photoError, setPhotoError] = useState('')
  const [isReadingPhotos, setIsReadingPhotos] = useState(false)
  const collection = publicationCollections.find((item) => item.id === form.collectionId)
  const preview = {
    ...form,
    id: product?.id,
    price: Number(form.price),
    stock: Number(form.stock),
    collectionName: collection.name,
    sellerId: product?.sellerId ?? user.id,
    sellerName: product?.sellerName ?? `${user.firstName} ${user.lastName[0]}.`,
    status: Number(form.stock) === 0 ? 'AGOTADO'
      : product?.status === 'INACTIVO' ? 'INACTIVO' : 'ACTIVO',
  }
  function changeField(field, value) { setForm((current) => ({ ...current, [field]: value })) }
  function submitProduct(event) {
    event.preventDefault()
    if (isReadingPhotos) {
      setPhotoError('Esperá a que terminen de cargar las fotografías.')
      return
    }
    if (!product && form.imageUrls.length === 0) {
      setPhotoError('Cargá al menos una fotografía para publicar el producto.')
      return
    }
    onPublish?.(preview)
  }

  function loadPhotos(event) {
    const input = event.target
    const photos = Array.from(input.files)
    input.value = ''
    if (isReadingPhotos || photos.length === 0) return
    if (photos.some((file) => !file.type.startsWith('image/'))) {
      setPhotoError('Seleccioná únicamente archivos de imagen válidos.')
      return
    }
    if (form.imageUrls.length + photos.length > 3) {
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
        image.onload = () => resolve(reader.result)
        image.src = reader.result
      }
      reader.readAsDataURL(file)
    }))).then((imageUrls) => {
      // Incorporar el lote sólo si todas las fotografías cargaron correctamente.
      setForm((current) => ({ ...current, imageUrls: [...current.imageUrls, ...imageUrls] }))
      setPhotoError('')
    }).catch(() => {
      setPhotoError('No pudimos cargar las fotografías. Probá con imágenes válidas nuevamente.')
    }).finally(() => setIsReadingPhotos(false))
  }
  return (
    <AccountLayout user={user} activeView="publications" cartCount={cartCount} onLogout={onLogout}>
      <div className="flex flex-col items-start gap-2.5">
        <Link to="/mis-publicaciones" className="text-[0.9375rem] font-bold underline">← Mis publicaciones</Link>
        <h1 className="font-display text-[4rem] leading-[3.52rem] font-black uppercase">{product ? 'Editar producto' : 'Publicar producto'}</h1>
      </div>
      <div className="grid min-w-0 items-start gap-7 xl:grid-cols-[minmax(0,1fr)_11.65rem]">
        <form onSubmit={submitProduct} className="flex min-w-0 flex-col gap-5.5 rounded-[1.75rem] border-[2.4px] border-bordo bg-papel p-7 shadow-[0.5rem_0.5rem_0_var(--color-bordo)]">
          <div className="flex w-full max-w-[41.45rem] flex-col gap-5.5">
            <div className="flex flex-col gap-2">
              <span className="text-[0.8125rem] font-extrabold tracking-[0.04875rem] uppercase">Fotos</span>
              <div className="grid grid-cols-4 gap-3">
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-[0.875rem] border-[2.4px] border-dashed border-bordo bg-crema">
                  <input type="file" accept="image/*" multiple onChange={loadPhotos} disabled={isReadingPhotos} aria-busy={isReadingPhotos}
                    aria-invalid={Boolean(photoError)} aria-describedby={photoError || isReadingPhotos ? 'product-photo-feedback' : undefined}
                    className="sr-only" aria-label="Subir fotos" />
                  <span aria-hidden="true" className="flex size-[2.125rem] items-center justify-center rounded-full bg-bordo text-[1.5rem] font-black text-crema">+</span>
                  <span className="text-center text-[0.875rem] font-extrabold">Subir fotos</span>
                </label>{[0, 1, 2].map((index) => <div key={index} className={`flex aspect-square items-center justify-center overflow-hidden rounded-[0.875rem] border-[2.4px] ${index < 2 || form.imageUrls[index] ? 'border-bordo bg-rojo' : 'border-dashed border-bordo/40'}`}>{form.imageUrls[index] ? <img src={form.imageUrls[index]} alt={`Foto ${index + 1} del producto`} className="size-full object-contain" /> : index < 2 && <span className="rounded-sm bg-crema px-1 font-mono text-[0.625rem]">{index === 0 ? 'frente' : 'dorso'}</span>}</div>)}</div>
              {(photoError || isReadingPhotos) && (
                <p id="product-photo-feedback" role={photoError ? 'alert' : 'status'}
                  className={`text-[0.8125rem] font-semibold ${photoError ? 'text-rojo' : ''}`}>
                  {photoError || 'Cargando fotografías…'}
                </p>
              )}
            </div>
            <FormField id="product-name" label="Nombre" required placeholder="Ej. Spider-Man Holo 60 aniversario" value={form.name} onChange={(e) => changeField('name', e.target.value)} />
            <FormField id="product-description" label="Descripción" multiline placeholder="Estado, edición, si viene en funda o slab…" value={form.description} onChange={(e) => changeField('description', e.target.value)} />
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-[0.8125rem] font-extrabold tracking-[0.04875rem] uppercase">Tipo</legend>
              <div className="grid grid-cols-3 gap-2.5">{Object.entries(productTypeLabels).map(([type, label]) => <button key={type} type="button" aria-pressed={form.type === type} onClick={() => changeField('type', type)} className={`rounded-full border-[2.4px] border-bordo p-3 text-[0.9375rem] font-extrabold ${form.type === type ? 'bg-bordo text-crema' : 'bg-crema'}`}>{label}</button>)}</div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-[0.8125rem] font-extrabold tracking-[0.04875rem] uppercase">Colección</legend>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">{publicationCollections.map((item) => <button key={item.id} type="button" aria-pressed={form.collectionId === item.id} onClick={() => changeField('collectionId', item.id)} className={`rounded-2xl border-[2.4px] border-bordo px-2 py-3.5 font-display text-[1.25rem] leading-5 font-black uppercase ${form.collectionId === item.id ? 'bg-rojo text-crema shadow-[0.25rem_0.25rem_0_var(--color-bordo)]' : 'bg-crema'}`}>{item.name}</button>)}</div>
            </fieldset>
            <div className="grid grid-cols-2 gap-4.5">
              <FormField id="product-price" label="Precio (ARS)" type="number" min="0.01" step="0.01" required placeholder="0" value={form.price} onChange={(e) => changeField('price', e.target.value)} />
              <FormField id="product-stock" label="Stock" type="number" min="0" step="1" required value={form.stock} onChange={(e) => changeField('stock', e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Link to="/mis-publicaciones" className="rounded-full border-[2.4px] border-bordo px-6 py-3.5 text-base font-extrabold">Cancelar</Link>
            <button type="submit" disabled={isReadingPhotos} className="rounded-full bg-bordo px-7 py-3.5 text-base font-extrabold text-crema">{product ? 'Guardar cambios' : 'Publicar'}</button>
          </div>
        </form>
        <ProductPreview product={preview} />
      </div>
    </AccountLayout>
  )
}
export default PublishProduct
