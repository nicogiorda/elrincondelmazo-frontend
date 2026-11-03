import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchPublicPromotions, publicPromotionsInvalidated } from '../Redux/promotionsSlice.js'
import { subscribePublicPromotionsInvalidation } from '../services/publicPromotions.js'

// Los datos públicos y las etapas de la promesa viven en Redux. Solo el
// identificador de reintento pertenece a la vista Home.
export default function usePublicPromotions() {
  const dispatch = useDispatch()
  const publicState = useSelector(state => state.promotions.public)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const unsubscribe = subscribePublicPromotionsInvalidation(() => {
      dispatch(publicPromotionsInvalidated())
      setAttempt(current => current + 1)
    })
    // Cada entrada real a Home verifica vigencia; no exhibir un descuento
    // vencido de una visita anterior ni conservar un GET invalidado.
    dispatch(publicPromotionsInvalidated())
    Promise.resolve().then(() => {
      if (active) dispatch(fetchPublicPromotions({}, { signal: controller.signal }))
    })
    return () => {
      active = false
      controller.abort()
      unsubscribe()
    }
  }, [dispatch, attempt])

  return {
    items: publicState.items,
    loading: publicState.status === 'loading' || publicState.status === 'idle',
    error: publicState.status === 'failed' ? publicState.error : '',
    retry: () => setAttempt(current => current + 1),
  }
}
