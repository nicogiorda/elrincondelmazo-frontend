import wembanyamaImage from '../assets/wembanyama-rookie.png'
import spiderManImage from '../assets/spider-man-holo.png'
import marvelUniverseImage from '../assets/marvel-universe.png'
import nbaRookiesImage from '../assets/nba-rookies.png'

// Fuente única de productos de demostración. Cada ID identifica un producto y vendedor.
// Los colores, variantes y etiquetas visuales permanecen fuera de estos objetos.
export const productMocks = [
  { id: 1, name: 'LeBron James Prizm Silver 2023', description: 'Carta Prizm Silver en estado casi perfecto, guardada en funda y toploader desde que salió del sobre.', price: 48500, type: 'CARTA', imageUrls: [], stock: 1, status: 'ACTIVO', sellerId: 2, sellerName: 'Martín G.', collectionId: 1, collectionName: 'NBA' },
  { id: 2, name: 'Sobre NBA Hoops 2024', description: 'Sobre de la colección NBA Hoops 2024.', price: 6900, type: 'SOBRE', imageUrls: [], stock: 10, status: 'ACTIVO', sellerId: 1, sellerName: 'Rincón oficial', collectionId: 1, collectionName: 'NBA' },
  { id: 3, name: 'Lootbox NBA Rookies', description: 'Lootbox de la colección NBA Rookies.', price: 32000, type: 'LOOTBOX', imageUrls: [nbaRookiesImage], stock: 5, status: 'ACTIVO', sellerId: 1, sellerName: 'Rincón oficial', collectionId: 1, collectionName: 'NBA' },
  { id: 4, name: 'Spider-Man Holo 60 aniversario', description: 'Carta holográfica de Spider-Man.', price: 27800, type: 'CARTA', imageUrls: [spiderManImage], stock: 3, status: 'ACTIVO', sellerId: 3, sellerName: 'Lucía F.', collectionId: 4, collectionName: 'Marvel' },
  { id: 5, name: 'Sobre Marvel Universe', description: 'Sobre de la colección Marvel Universe.', price: 5400, type: 'SOBRE', imageUrls: [marvelUniverseImage], stock: 10, status: 'ACTIVO', sellerId: 1, sellerName: 'Rincón oficial', collectionId: 4, collectionName: 'Marvel' },
  { id: 6, name: 'Lootbox Avengers Mystery', description: 'Lootbox de la colección Avengers.', price: 39900, type: 'LOOTBOX', imageUrls: [], stock: 0, status: 'AGOTADO', sellerId: 1, sellerName: 'Rincón oficial', collectionId: 4, collectionName: 'Marvel' },
  { id: 7, name: 'Rayo McQueen Foil dorada', description: 'Carta foil de Rayo McQueen.', price: 14200, type: 'CARTA', imageUrls: [], stock: 2, status: 'ACTIVO', sellerId: 4, sellerName: 'Diego R.', collectionId: 3, collectionName: 'Cars' },
  { id: 8, name: 'Sobre Cars Piston Cup', description: 'Sobre de la colección Cars Piston Cup.', price: 3900, type: 'SOBRE', imageUrls: [], stock: 10, status: 'ACTIVO', sellerId: 1, sellerName: 'Rincón oficial', collectionId: 3, collectionName: 'Cars' },
  { id: 9, name: 'Lootbox Radiador Springs', description: 'Lootbox de la colección Cars.', price: 21500, type: 'LOOTBOX', imageUrls: [], stock: 5, status: 'ACTIVO', sellerId: 1, sellerName: 'Rincón oficial', collectionId: 3, collectionName: 'Cars' },
  // Estos tres ejemplos permiten probar la segunda página y la colección restante.
  // Sus nombres y precios son mocks; no aparecen en el nodo de la primera página.
  { id: 10, name: 'Twilight Sparkle Holo', description: 'Carta de ejemplo de My Little Pony.', price: 12000, type: 'CARTA', imageUrls: [], stock: 2, status: 'ACTIVO', sellerId: 1, sellerName: 'Rincón oficial', collectionId: 2, collectionName: 'My Little Pony' },
  { id: 11, name: 'Sobre My Little Pony', description: 'Sobre de ejemplo de My Little Pony.', price: 4500, type: 'SOBRE', imageUrls: [], stock: 10, status: 'ACTIVO', sellerId: 1, sellerName: 'Rincón oficial', collectionId: 2, collectionName: 'My Little Pony' },
  { id: 12, name: 'Lootbox Equestria', description: 'Lootbox de ejemplo de My Little Pony.', price: 24000, type: 'LOOTBOX', imageUrls: [], stock: 5, status: 'ACTIVO', sellerId: 1, sellerName: 'Rincón oficial', collectionId: 2, collectionName: 'My Little Pony' },
  { id: 13, name: 'Wembanyama Rookie Autografiada', description: '', price: 125000, type: 'CARTA', imageUrls: [wembanyamaImage], stock: 1, status: 'ACTIVO', sellerId: 2, sellerName: 'Martín G.', collectionId: 1, collectionName: 'NBA' },
  { id: 14, name: 'Iron Man Prisma Refractor', description: '', price: 18500, type: 'CARTA', imageUrls: [], stock: 2, status: 'INACTIVO', sellerId: 2, sellerName: 'Martín G.', collectionId: 4, collectionName: 'Marvel' },
  { id: 15, name: 'Kevin Durant Mosaic Green', description: '', price: 22000, type: 'CARTA', imageUrls: [], stock: 0, status: 'AGOTADO', sellerId: 2, sellerName: 'Martín G.', collectionId: 1, collectionName: 'NBA' },
  { id: 16, name: 'Twilight Sparkle Rara', price: 12000, type: 'CARTA', stock: 2, status: 'ACTIVO', imageUrls: [], sellerId: 1, sellerName: 'Rincón oficial', collectionId: 2, collectionName: 'My Little Pony' },
  { id: 17, name: 'Sobre My Little Pony Friendship', price: 4500, type: 'SOBRE', stock: 10, status: 'ACTIVO', imageUrls: [], sellerId: 1, sellerName: 'Rincón oficial', collectionId: 2, collectionName: 'My Little Pony' },
]

export function getMockProduct(id) {
  return productMocks.find((product) => product.id === id)
}

export function getRelatedProducts(product) {
  return productMocks.filter((candidate) => candidate.collectionId === product.collectionId && candidate.id !== product.id).slice(0, 4)
}
