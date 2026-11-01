import { request, readResponse } from './httpClient.js'
import { productIdFrom } from '../utils/productId.js'

function reviewPath(productId) {
  const id = productIdFrom(productId)
  if (id === null) throw new Error('El producto no tiene un ID válido.')
  return '/products/' + id + '/reviews'
}

// La lectura es pública; el backend decide si un producto puede reseñarse.
export async function getReviews(productId, { signal } = {}) {
  const response = await request(reviewPath(productId), { signal })
  const data = await readResponse(response)
  if (!Array.isArray(data)) throw new Error('La respuesta de reseñas no es una lista')
  return data
}

export async function createReview(productId, { rating, comment }, { token, signal } = {}) {
  const response = await request(reviewPath(productId), {
    method: 'POST', token, signal, body: { rating, comment },
  })
  const review = await readResponse(response)
  if (response.status !== 201 || !Number.isSafeInteger(review?.id) || review.id <= 0
    || review.productId !== Number(productId)) {
    throw new Error('La respuesta no contiene la reseña esperada.')
  }
  return review
}
