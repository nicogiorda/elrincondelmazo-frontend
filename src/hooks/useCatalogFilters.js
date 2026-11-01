import { useState } from 'react'

const emptyFilters = { search: '', type: '', collection: '', minPrice: '', maxPrice: '', page: 0 }

export default function useCatalogFilters(location) {
  const [filters, setFilters] = useState(emptyFilters)
  const [byLocation, setByLocation] = useState({})
  const [locationKey, setLocationKey] = useState(null)
  // Restaurar durante render evita una consulta intermedia con los filtros de
  // otra entrada del historial. La condición converge en el siguiente render.
  if (location.pathname === '/catalogo' && locationKey !== location.key) {
    const selection = location.state
    const hasSelection = selection?.type !== undefined || selection?.collectionId !== undefined
    const initial = selection?.resetFilters ? emptyFilters : hasSelection ? {
      ...emptyFilters, type: selection.type ?? '', collection: String(selection.collectionId ?? ''),
    } : filters
    const restored = byLocation[location.key] ?? initial
    setLocationKey(location.key)
    setFilters(restored)
    setByLocation({ ...byLocation, [location.key]: restored })
  }
  function changeFilters(next) {
    setFilters(next)
    setByLocation(current => ({ ...current, [location.key]: next }))
  }
  return { catalogFilters: filters, changeCatalogFilters: changeFilters,
    clearCatalogFilters: () => changeFilters(emptyFilters) }
}
