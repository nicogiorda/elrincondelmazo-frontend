import { useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { changedCatalogFilters, emptyCatalogFilters, enteredCatalog,
  filtersForCatalogLocation } from '../Redux/catalogSlice.js'

// Los filtros del catálogo ahora tienen una sola fuente de estado: Redux.
// Se mantiene la restauración de filtros por entrada del historial de React Router.
export default function useCatalogFilters(location) {
  const dispatch = useDispatch()
  const catalog = useSelector((state) => state.catalog)
  const catalogFilters = useMemo(
    () => filtersForCatalogLocation(catalog, location),
    [catalog, location],
  )

  const selectedType = location.state?.type
  const selectedCollection = location.state?.collectionId
  const resetFilters = location.state?.resetFilters
  useEffect(() => {
    if (location.pathname !== '/catalogo' || catalog.locationKey === location.key) return
    dispatch(enteredCatalog({
      key: location.key,
      selection: {
        resetFilters: Boolean(resetFilters),
        type: typeof selectedType === 'string' ? selectedType : undefined,
        collectionId: selectedCollection == null ? undefined : String(selectedCollection),
      },
    }))
  }, [dispatch, location.pathname, location.key, catalog.locationKey,
    resetFilters, selectedType, selectedCollection])

  function changeFilters(filters) {
    dispatch(changedCatalogFilters({ key: location.key, filters }))
  }

  return {
    catalogFilters,
    changeCatalogFilters: changeFilters,
    clearCatalogFilters: () => changeFilters(emptyCatalogFilters()),
  }
}
