// Producto mock con la estructura de ProductResponse.
export const detailProduct = {
  id: 1,
  name: 'LeBron James Prizm Silver 2023',
  description: 'Carta Prizm Silver en estado casi perfecto, guardada en funda y toploader desde que salió del sobre.',
  price: 48500,
  type: 'CARTA',
  imageUrls: [], // El nodo 75:2 no contiene fotografías del producto.
  stock: 1,
  status: 'ACTIVO',
  createdAt: '2026-09-01T12:00:00',
  sellerId: 2,
  sellerName: 'Martín G.',
  collectionId: 1,
  collectionName: 'NBA',
}

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

export const detailRelatedProducts = [
  { id: 2, name: 'Sobre NBA Hoops 2024', description: 'Sobre NBA Hoops 2024.', price: 6900, type: 'SOBRE', imageUrls: [], stock: 10, status: 'ACTIVO', createdAt: '2026-09-01T12:00:00', sellerId: 1, sellerName: 'Rincón oficial', collectionId: 1, collectionName: 'NBA' },
  { id: 3, name: 'Lootbox NBA Rookies', description: 'Lootbox NBA Rookies.', price: 32000, type: 'LOOTBOX', imageUrls: [], stock: 5, status: 'ACTIVO', createdAt: '2026-09-01T12:00:00', sellerId: 1, sellerName: 'Rincón oficial', collectionId: 1, collectionName: 'NBA' },
  { id: 13, name: 'Wembanyama Rookie Autografiada', description: 'Carta NBA autografiada.', price: 125000, type: 'CARTA', imageUrls: [], stock: 1, status: 'ACTIVO', createdAt: '2026-09-01T12:00:00', sellerId: 1, sellerName: 'Rincón oficial', collectionId: 1, collectionName: 'NBA' },
  // Figma incluye este producto Marvel dentro de la sección «Más de NBA».
  { id: 4, name: 'Spider-Man Holo 60 aniversario', description: 'Carta holográfica de Spider-Man.', price: 27800, type: 'CARTA', imageUrls: [], stock: 3, status: 'ACTIVO', createdAt: '2026-09-01T12:00:00', sellerId: 3, sellerName: 'Lucía F.', collectionId: 4, collectionName: 'Marvel' },
]
