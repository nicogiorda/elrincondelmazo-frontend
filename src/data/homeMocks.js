import nbaImage from '../assets/collection-nba.png'
import ponyImage from '../assets/collection-my-little-pony.png'
import carsImage from '../assets/collection-cars.png'
import marvelImage from '../assets/collection-marvel.png'
import wembanyamaImage from '../assets/wembanyama-rookie.png'
import spiderManImage from '../assets/spider-man-holo.png'
import marvelUniverseImage from '../assets/marvel-universe.png'
import nbaRookiesImage from '../assets/nba-rookies.png'

// Mocks visuales de colecciones; color y wrapTitle son datos de presentación.
export const homeCollections = [
  { id: 1, name: 'NBA', imageUrl: nbaImage, color: 'crema' },
  { id: 2, name: 'My Little Pony', imageUrl: ponyImage, color: 'rosa', wrapTitle: true },
  { id: 3, name: 'Cars', imageUrl: carsImage, color: 'rojo' },
  { id: 4, name: 'Marvel', imageUrl: marvelImage, color: 'amarillo' },
]

// Configuración visual separada de ProductResponse, indexada por collectionId.
export const homeProductBackgrounds = { 1: 'rojo', 4: 'amarillo' }

// Productos mock con los campos y enums de ProductResponse.
export const homeProducts = [
  { id: 1, name: 'Wembanyama Rookie Autografiada', price: 125000, type: 'CARTA', imageUrls: [wembanyamaImage], stock: 1, status: 'ACTIVO', sellerId: 1, sellerName: 'Rincón oficial', collectionId: 1, collectionName: 'NBA' },
  { id: 2, name: 'Spider-Man Holo 60 aniversario', price: 27800, type: 'CARTA', imageUrls: [spiderManImage], stock: 3, status: 'ACTIVO', sellerId: 2, sellerName: 'Lucía F.', collectionId: 4, collectionName: 'Marvel' },
  { id: 3, name: 'Sobre Marvel Universe', price: 5400, type: 'SOBRE', imageUrls: [marvelUniverseImage], stock: 10, status: 'ACTIVO', sellerId: 1, sellerName: 'Rincón oficial', collectionId: 4, collectionName: 'Marvel' },
  { id: 4, name: 'Lootbox NBA Rookies', price: 32000, type: 'LOOTBOX', imageUrls: [nbaRookiesImage], stock: 5, status: 'ACTIVO', sellerId: 1, sellerName: 'Rincón oficial', collectionId: 1, collectionName: 'NBA' },
]

export const homePromotions = [
  { id: 1, discount: '10%', title: 'Pagando con transferencia', description: 'Se aplica sobre el total del pedido.' },
  { id: 2, discount: '15%', title: 'Llevando 3 sobres o más', description: 'Válido para sobres de cualquier colección.' },
  { id: 3, discount: '5%', title: 'Compras desde $ 50.000', description: 'Acumulable con otras promociones.' },
]
