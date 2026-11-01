import { useCallback, useEffect, useRef, useState } from 'react'
import { createReview, getReviews } from '../services/reviewsApi.js'

// Las reseñas son públicas; solo publicar depende de la sesión autenticada.
export default function useReviews({ productId, user, token, sessionVersion, sessionAbort,
  subscribeSessionChange, logout, setSessionError }) {
  const [reviewsByProduct, setReviewsByProduct] = useState({})
  const [reviewErrors, setReviewErrors] = useState({})
  const [reviewAttempt, setReviewAttempt] = useState(0)
  const requestedReviews = useRef(new Set())
  const reviewRequest = useRef(null)
  const mounted = useRef(false)

  const cancelPublication = useCallback(() => {
    reviewRequest.current?.controller.abort()
    reviewRequest.current = null
  }, [])

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
    if (!productId || requestedReviews.current.has(productId)) return
    let active = true
    let finished = false
    const controller = new AbortController()
    queueMicrotask(() => {
      if (!active || requestedReviews.current.has(productId)) return
      requestedReviews.current.add(productId)
      getReviews(productId, { signal: controller.signal })
        .then((reviews) => {
          if (!active || controller.signal.aborted) return
          finished = true
          setReviewsByProduct((current) => ({ ...current, [productId]: reviews }))
          setReviewErrors((current) => ({ ...current, [productId]: '' }))
        })
        .catch(() => {
          if (!active || controller.signal.aborted) return
          finished = true
          setReviewErrors((current) => ({ ...current, [productId]: 'No pudimos cargar las reseñas.' }))
        })
    })
    return () => {
      active = false
      if (!finished) {
        controller.abort()
        requestedReviews.current.delete(productId)
      }
    }
  }, [productId, reviewAttempt])

  function retryReviews() {
    if (!productId || !reviewErrors[productId]) return
    requestedReviews.current.delete(productId)
    setReviewErrors((current) => ({ ...current, [productId]: '' }))
    setReviewAttempt((current) => current + 1)
  }

  function canReview(product) {
    return Boolean(user && reviewsByProduct[product.id]
      && !reviewsByProduct[product.id].some((review) => review.userId === user.id))
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
    const sameSession = () => mounted.current && !signal.aborted && version === sessionVersion.current
    const isCurrent = () => sameSession() && reviewRequest.current === operation
    reviewRequest.current = operation

    return createReview(product.id, { rating, comment: trimmedComment }, { token, signal })
      .then((review) => {
        if (!isCurrent()) throw new Error('La sesión cambió.')
        setReviewsByProduct((current) => sameSession() ? {
          ...current,
          [product.id]: [review, ...(current[product.id] ?? []).filter((item) => item.id !== review.id)],
        } : current)
        return true
      })
      .catch((error) => {
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
