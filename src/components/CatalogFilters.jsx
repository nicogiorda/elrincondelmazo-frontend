function CatalogFilters({ type, collection, minPrice, maxPrice, types, collections, onTypeChange, onCollectionChange, onMinPriceChange, onMaxPriceChange, onClear }) {
  return (
    <aside aria-labelledby="filters-heading" className="flex min-w-0 flex-col gap-6.5 self-start lg:min-h-[37.3125rem] rounded-[1.625rem] border-3 border-bordo bg-papel p-6 leading-[normal] text-bordo">
      <div className="flex h-[2.375rem] items-end justify-between gap-2">
        <h2 id="filters-heading" className="font-display text-[2rem] font-black uppercase">Filtros</h2>
        <button type="button" onClick={onClear} className="pb-0.75 text-[0.8125rem] font-bold underline">Limpiar</button>
      </div>

      <fieldset className="min-w-0">
        <legend className="mb-3 text-[0.8125rem] font-extrabold tracking-[0.065rem] uppercase">Tipo</legend>
        <div className="flex flex-wrap gap-2">
          {types.map((option) => (
            <button key={option.value} type="button" aria-pressed={type === option.value} onClick={() => onTypeChange(option.value)} className={`rounded-full border-2 border-bordo px-3.5 py-1.75 text-[0.875rem] font-bold ${type === option.value ? 'bg-bordo text-crema' : ''}`}>
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <hr className="border-t-3 border-bordo/15" />

      <fieldset className="min-w-0">
        <legend className="mb-2.5 text-[0.8125rem] font-extrabold tracking-[0.065rem] uppercase">Colección</legend>
        <div className="flex flex-col gap-2.5">
          {collections.map((option) => (
            <label key={option.value} className="flex items-center gap-2.5 text-[0.9375rem] font-semibold">
              <input type="radio" name="collection" value={option.value} checked={collection === option.value} onChange={(event) => onCollectionChange(event.target.value)} className="size-6 shrink-0 appearance-none rounded-full border-2 border-bordo checked:bg-bordo" />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <hr className="border-t-3 border-bordo/15" />

      <fieldset className="min-w-0">
        <legend className="mb-3 text-[0.8125rem] font-extrabold tracking-[0.065rem] uppercase">Precio (ARS)</legend>
        <div className="flex items-center gap-2">
          <input type="number" min="0" aria-label="Precio mínimo" placeholder="Mín." value={minPrice} onChange={(event) => onMinPriceChange(event.target.value)} className="h-11 min-w-0 flex-1 rounded-xl border-2 border-bordo bg-crema px-3 text-[0.9375rem] font-semibold placeholder:text-bordo/50" />
          <span aria-hidden="true" className="font-extrabold">–</span>
          <input type="number" min="0" aria-label="Precio máximo" placeholder="Máx." value={maxPrice} onChange={(event) => onMaxPriceChange(event.target.value)} className="h-11 min-w-0 flex-1 rounded-xl border-2 border-bordo bg-crema px-3 text-[0.9375rem] font-semibold placeholder:text-bordo/50" />
        </div>
      </fieldset>
    </aside>
  )
}

export default CatalogFilters
