import { useState } from 'react'
import AccountLayout from '../components/AccountLayout.jsx'
import FormField from '../components/FormField.jsx'
import ProductPreview from '../components/ProductPreview.jsx'
import { publicationCollections, productTypeLabels } from '../data/accountMocks.js'

function PublishProduct({ user, product, cartCount, onNavigate, onPublish }) {
  const [form, setForm] = useState(() => ({ name: product?.name || '', description: product?.description || '', type: product?.type || 'CARTA', collectionId: product?.collectionId || 1, price: product?.price ?? '', stock: product?.stock ?? 1, imageUrls: product?.imageUrls || [] }))
  const collection = publicationCollections.find((item) => item.id === form.collectionId)
  const preview = { ...form, id: product?.id, price: Number(form.price), stock: Number(form.stock), collectionName: collection.name, sellerId: user.id, sellerName: `${user.firstName} ${user.lastName[0]}.`, status: Number(form.stock) > 0 ? 'ACTIVO' : 'AGOTADO' }
  function changeField(field, value) { setForm((current) => ({ ...current, [field]: value })) }
  function loadPhotos(event) {
    const photos = Array.from(event.target.files).filter((file) => file.type.startsWith('image/')).slice(0, 3)
    Promise.all(photos.map((file) => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file) }))).then((imageUrls) => changeField('imageUrls', imageUrls)).catch(() => { event.target.value = '' })
  }
  return (
    <AccountLayout user={user} activeView="publications" cartCount={cartCount} onNavigate={onNavigate}>
      <div className="flex flex-col items-start gap-2.5">
        <button type="button" onClick={() => onNavigate?.('publications')} className="text-[0.9375rem] font-bold underline">← Mis publicaciones</button>
        <h1 className="font-display text-[4rem] leading-[3.52rem] font-black uppercase">{product ? 'Editar producto' : 'Publicar producto'}</h1>
      </div>
      <div className="grid min-w-0 items-start gap-7 xl:grid-cols-[minmax(0,1fr)_11.65rem]">
        <form onSubmit={(e) => { e.preventDefault(); onPublish?.(preview) }} className="flex min-w-0 flex-col gap-5.5 rounded-[1.75rem] border-[2.4px] border-bordo bg-papel p-7 shadow-[0.5rem_0.5rem_0_var(--color-bordo)]">
          <div className="flex w-full max-w-[41.45rem] flex-col gap-5.5">
            <div className="flex flex-col gap-2">
              <span className="text-[0.8125rem] font-extrabold tracking-[0.04875rem] uppercase">Fotos</span>
              <div className="grid grid-cols-4 gap-3">
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-[0.875rem] border-[2.4px] border-dashed border-bordo bg-crema">
                  <input type="file" accept="image/*" multiple onChange={loadPhotos} className="sr-only" aria-label="Subir fotos" />
                  <span aria-hidden="true" className="flex size-[2.125rem] items-center justify-center rounded-full bg-bordo text-[1.5rem] font-black text-crema">+</span>
                  <span className="text-center text-[0.875rem] font-extrabold">Subir fotos</span>
                </label>{[0, 1, 2].map((index) => <div key={index} className={`flex aspect-square items-center justify-center overflow-hidden rounded-[0.875rem] border-[2.4px] ${index < 2 || form.imageUrls[index] ? 'border-bordo bg-rojo' : 'border-dashed border-bordo/40'}`}>{form.imageUrls[index] ? <img src={form.imageUrls[index]} alt={`Foto ${index + 1} del producto`} className="size-full object-contain" /> : index < 2 && <span className="rounded-sm bg-crema px-1 font-mono text-[0.625rem]">{index === 0 ? 'frente' : 'dorso'}</span>}</div>)}</div>
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
            <button type="button" onClick={() => onNavigate?.('publications')} className="rounded-full border-[2.4px] border-bordo px-6 py-3.5 text-base font-extrabold">Cancelar</button>
            <button type="submit" className="rounded-full bg-bordo px-7 py-3.5 text-base font-extrabold text-crema">{product ? 'Guardar cambios' : 'Publicar'}</button>
          </div>
        </form>
        <ProductPreview product={preview} />
      </div>
    </AccountLayout>
  )
}
export default PublishProduct
