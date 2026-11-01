import { useEffect, useRef, useState } from 'react'
import { getCollections } from '../services/productsApi.js'

export default function useCollections() {
  const [collections, setCollections] = useState([])
  const [collectionsLoading, setLoading] = useState(true)
  const [collectionsError, setError] = useState('')
  const request = useRef(null)
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    Promise.resolve().then(() => {
      if (!active || request.current) return
      request.current = controller
      getCollections({ signal: controller.signal }).then(data => { if (active) setCollections(data) })
        .catch(() => { if (active) setError('No pudimos cargar las colecciones. Recargá la página para reintentar.') })
        .finally(() => { if (active) setLoading(false) })
    })
    return () => { active = false; controller.abort() }
  }, [])
  const catalogCollections = [{ value: '', label: 'Todas' },
    ...collections.map(collection => ({ value: String(collection.id), label: collection.name }))]
  return { collections, collectionsLoading, collectionsError, catalogCollections }
}
