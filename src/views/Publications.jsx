import AccountLayout from '../components/AccountLayout.jsx'
import ProductThumbnail from '../components/ProductThumbnail.jsx'
import { productTypeLabels } from '../data/accountMocks.js'
import { formatPrice } from '../data/purchaseMocks.js'

const statusLabels = { ACTIVO: 'Activo', INACTIVO: 'Pausado', AGOTADO: 'Agotado' }
const statusStyles = { ACTIVO: 'bg-amarillo', INACTIVO: 'bg-crema', AGOTADO: 'bg-bordo text-crema' }
const columns = 'grid grid-cols-[3.25rem_minmax(0,1fr)_5.25rem_3rem_5.75rem_4rem] items-center gap-3 px-4 py-3'

function Publications({ user, products, cartCount, onNavigate, onEdit, onDelete, onToggleStatus }) {
  const stats = [{ label: 'Publicaciones', value: products.length, color: 'bg-papel' }, { label: 'Activas', value: products.filter((p) => p.status === 'ACTIVO').length, color: 'bg-amarillo' }, { label: 'Pausadas', value: products.filter((p) => p.status === 'INACTIVO').length, color: 'bg-crema' }, { label: 'Agotadas', value: products.filter((p) => p.status === 'AGOTADO').length, color: 'bg-rosa' }]
  return (
    <AccountLayout user={user} activeView="publications" cartCount={cartCount} onNavigate={onNavigate}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-[3rem] leading-[2.64rem] sm:text-[4rem] sm:leading-[3.52rem] font-black uppercase">Mis publicaciones</h1>
        <button type="button" onClick={() => onNavigate?.('publish')} className="rounded-full border-[2.4px] border-bordo bg-rosa px-6 py-3.5 text-[0.9375rem] font-extrabold shadow-[0.25rem_0.25rem_0_var(--color-bordo)]">+ Publicar producto</button>
      </div>
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">{stats.map((stat) => <div key={stat.label} className={`flex flex-col gap-0.5 rounded-[1.375rem] border-[2.4px] border-bordo px-5 py-4.5 ${stat.color}`}>
          <strong className="font-display text-[2.625rem] leading-[2.625rem] font-black">{stat.value}</strong>
          <span className="text-[0.8125rem] font-extrabold uppercase">{stat.label}</span>
        </div>)}</div>
      <div className="overflow-x-auto rounded-[1.625rem] border-[2.4px] border-bordo bg-papel">
        <div role="table" aria-label="Mis publicaciones" className="min-w-[43rem]">
          <div role="row" className={`${columns} bg-bordo text-[0.6875rem] font-extrabold tracking-[0.04125rem] text-crema uppercase`}>
            <span aria-hidden="true" />
            <span role="columnheader">Producto</span>
            <span role="columnheader">Precio</span>
            <span role="columnheader">Stock</span>
            <span role="columnheader">Estado</span>
            <span role="columnheader" className="sr-only">Acciones</span>
          </div>
          {products.map((product) => <div role="row" key={product.id} className={`${columns} border-t-[2.4px] border-bordo ${product.status === 'INACTIVO' ? 'opacity-70' : ''}`}>
            <div role="cell">
              <ProductThumbnail product={product} variant="publication" />
            </div>
            <div role="cell">
              <p className="text-[0.9375rem] font-extrabold">{product.name}</p>
              <p className="mt-1 text-[0.8125rem] opacity-80">{productTypeLabels[product.type]} · {product.collectionName}</p>
            </div>
            <strong role="cell" className="text-[0.9375rem]">{formatPrice(product.price)}</strong>
            <span role="cell" className="text-[0.9375rem]">{product.stock}</span>
            <div role="cell">
              <button type="button" disabled={product.status === 'AGOTADO'} onClick={() => onToggleStatus?.(product)} className={`rounded-full border-[1.6px] border-bordo px-3 py-1 text-[0.6875rem] font-extrabold uppercase ${statusStyles[product.status]}`}>{statusLabels[product.status]}</button>
            </div>
            <div role="cell" className="flex flex-col items-end gap-1 text-[0.8125rem] font-bold underline">
              <button type="button" onClick={() => onEdit?.(product)}>Editar</button>
              <button type="button" onClick={() => onDelete?.(product)} className="text-rojo">Eliminar</button>
            </div>
          </div>)}
        </div>
      </div>
      <p className="text-[0.875rem] opacity-80">Tocá el estado para pausar o reactivar una publicación.</p>
    </AccountLayout>
  )
}
export default Publications
