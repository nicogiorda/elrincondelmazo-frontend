import { useCallback, useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  fetchProductReviews, publishProductReview, reviewSessionCleared, reviewRetryRequested,
} from '../Redux/reviewsSlice.js'

// Las lecturas son públicas; el POST de una reseña se vincula a la sesión.
// Redux guarda las respuestas y estados, no hay caches locales duplicadas.
export default function useReviews({ productId, user, token, sessionVersion, sessionAbort,
  subscribeSessionChange, logout, setSessionError }) {
  const dispatch = useDispatch()
  const reviewsByProduct = useSelector(state => state.reviews.byProduct)
  const reviewErrors = useSelector(state => state.reviews.errors)
  const reviewRequest = useRef(null)
  const mounted = useRef(false)
  const currentReviews = productId ? reviewsByProduct[productId] : undefined
  const currentError = productId ? reviewErrors[productId] : undefined

  const cancelPublication = useCallback(() => {
    reviewRequest.current?.controller.abort()
    reviewRequest.current = null
    dispatch(reviewSessionCleared())
  }, [dispatch])

  useEffect(() => {
    mounted.current = true
    const unsubscribe = subscribeSessionChange(cancelPublication)
    return () => {
      mounted.current = false
      unsubscribe()
      queueMicrotask(() => { if (!mounted.current) cancelPublication() })
    }
  }, [subscribeSessionChange, cancelPublication])

  useEffect(() => {
    if (!productId || currentReviews !== undefined || currentError) return
    let active = true
    const controller = new AbortController()
    // StrictMode descarta el primer montaje antes de despachar el GET.
    queueMicrotask(() => {
      if (active) dispatch(fetchProductReviews({ productId }, { signal: controller.signal }))
    })
    return () => {
      active = false
      controller.abort()
    }
  }, [productId, currentReviews, currentError, dispatch])

  function retryReviews() {
    if (!productId || !currentError) return
    dispatch(reviewRetryRequested({ productId }))
  }

  function canReview(product) {
    return Boolean(user && reviewsByProduct[product.id]
      && !reviewsByProduct[product.id].some(review => review.userId === user.id))
  }

  function publishReview(product, { rating, comment }) {
    if (!user || !token || reviewRequest.current) {
      return Promise.reject(new Error('Ingresá o esperá a que termine el envío.'))
    }
    const trimmedComment = typeof comment === 'string' ? comment.trim() : ''
    if (!Number.isInteger(rating) || rating < 1 || rating > 5
      || !trimmedComment || trimmedComment.length > 1000) {
      return Promise.reject(new Error('Revisá la puntuación y el comentario.'))
    }
    const version = sessionVersion.current
    const operation = { controller: new AbortController() }
    const signal = AbortSignal.any([operation.controller.signal, sessionAbort.current.signal])
    const isCurrent = () => mounted.current && !signal.aborted
      && version === sessionVersion.current && reviewRequest.current === operation
    reviewRequest.current = operation

    return dispatch(publishProductReview({
      productId: product.id, rating, comment: trimmedComment,
      ownerId: user.id, generation: version,
    }, { signal })).unwrap()
      .then(() => {
        if (!isCurrent()) throw new Error('La sesión cambió.')
        return true
      })
      .catch(error => {
        if (isCurrent() && error.status === 401) {
          logout()
          setSessionError(error.message)
        }
        throw error
      })
      .finally(() => {
        if (reviewRequest.current === operation) reviewRequest.current = null
      })
  }

  return { reviewsByProduct, reviewErrors, retryReviews, canReview, publishReview }
}
