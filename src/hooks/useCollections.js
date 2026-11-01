import { useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchCollections } from '../Redux/catalogSlice.js'

// Home, catálogo, publicación y promociones consumen las mismas colecciones del store.
export default function useCollections() {
  const dispatch = useDispatch()
  const collections = useSelector((state) => state.catalog.collections)
  const status = useSelector((state) => state.catalog.collectionsStatus)
  const collectionsError = useSelector((state) => state.catalog.collectionsError)

  useEffect(() => {
    dispatch(fetchCollections())
  }, [dispatch])

  const catalogCollections = useMemo(() => [
    { value: '', label: 'Todas' },
    ...collections.map((collection) => ({ value: String(collection.id), label: collection.name })),
  ], [collections])

  return {
    collections,
    collectionsLoading: status === 'idle' || status === 'loading',
    collectionsError,
    catalogCollections,
  }
}
