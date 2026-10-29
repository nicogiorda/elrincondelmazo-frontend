import { useEffect, useState } from 'react'
import { loadPublicPromotions, subscribePublicPromotionsInvalidation } from '../services/publicPromotions.js'

export default function usePublicPromotions() {
  const [state, setState] = useState({ items: [], loading: true, error: '' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    const unsubscribe = subscribePublicPromotionsInvalidation(() => {
      active = false
      setState({ items: [], loading: true, error: '' })
      setAttempt((current) => current + 1)
    })
    // StrictMode cancela el primer efecto antes de iniciar la petición.
    Promise.resolve().then(async () => {
      if (!active) return
      setState({ items: [], loading: true, error: '' })
      try {
        const items = await loadPublicPromotions()
        if (active) setState({ items, loading: false, error: '' })
      } catch (error) {
        if (active) setState({ items: [], loading: false, error: error.message })
      }
    })
    return () => { active = false; unsubscribe() }
  }, [attempt])
  return { ...state, retry: () => setAttempt((current) => current + 1) }
}
