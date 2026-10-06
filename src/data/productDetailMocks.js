import { getMockProduct } from './productMocks.js'

export const detailProduct = getMockProduct(1)

// Etiquetas y fondos del prototipo: no son campos de ProductResponse.
export const detailGallery = [
  { label: 'frente', background: 'rojo' },
  { label: 'dorso', background: 'crema' },
  { label: 'detalle esquina', background: 'crema' },
  { label: 'en funda', background: 'crema' },
]
export const detailProductBackgrounds = { 1: 'rojo', 4: 'amarillo' }
export const detailPaymentLabel = 'Crédito, débito, Mercado Pago o transferencia'
export const detailTransferPromotion = { discount: '10%', text: 'Pagando con transferencia tenés 10% off sobre el total.' }

// Reseñas mock con la estructura de ReviewResponse.
export const detailReviews = [
  { id: 1, productId: 1, userId: 5, rating: 5, comment: 'Llegó tal cual las fotos, bien protegida. El vendedor respondió rápido.', userName: 'Tomás B.', createdAt: '2026-09-12T12:00:00' },
  { id: 2, productId: 1, userId: 6, rating: 4, comment: 'Muy buen estado. Una esquina tenía una marca mínima que no se veía en la foto.', userName: 'Carla P.', createdAt: '2026-09-03T12:00:00' },
  { id: 3, productId: 1, userId: 7, rating: 5, comment: 'Segunda compra en la tienda. Precio justo para lo que cuesta conseguirla.', userName: 'Nicolás A.', createdAt: '2026-08-28T12:00:00' },
]
