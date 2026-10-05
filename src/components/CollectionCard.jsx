const collectionColors = {
  crema: 'bg-crema text-bordo',
  rosa: 'bg-rosa text-bordo',
  rojo: 'bg-rojo text-crema',
  amarillo: 'bg-amarillo text-bordo',
}

function CollectionCard({ collection, onSelectCollection }) {
  return (
    <button
      type="button"
      onClick={() => onSelectCollection?.(collection)}
      className={`flex min-h-[20.796875rem] min-w-0 flex-col gap-4.5 rounded-[1.75rem] border-3 border-bordo p-5.5 text-left leading-[normal] shadow-product ${collectionColors[collection.color]}`}
    >
      <div className={`w-full overflow-hidden rounded-[1.125rem] border-3 border-bordo bg-crema/35 ${collection.wrapTitle ? 'h-[11.875rem]' : 'h-[12.046875rem]'}`}>
        <img src={collection.imageUrl} alt="" className="h-full w-full object-cover" />
      </div>
      <div className={`flex w-full justify-between gap-2 ${collection.wrapTitle ? 'items-start' : 'items-end'}`}>
        <h3 className="min-w-0 flex-1 font-display text-[2.5rem] leading-[2.25rem] font-black uppercase">
          {collection.name}
        </h3>
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-bordo text-[1.125rem] font-extrabold text-crema">→</span>
      </div>
    </button>
  )
}

export default CollectionCard
