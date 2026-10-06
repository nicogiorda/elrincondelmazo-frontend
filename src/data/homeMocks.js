import { getMockProduct } from './productMocks.js'
import nbaImage from '../assets/collection-nba.png'
import ponyImage from '../assets/collection-my-little-pony.png'
import carsImage from '../assets/collection-cars.png'
import marvelImage from '../assets/collection-marvel.png'

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
export const homeProducts = [13, 4, 5, 3].map(getMockProduct)

export const homePromotions = [
  { id: 1, discount: '10%', title: 'Pagando con transferencia', description: 'Se aplica sobre el total del pedido.' },
  { id: 2, discount: '15%', title: 'Llevando 3 sobres o más', description: 'Válido para sobres de cualquier colección.' },
  { id: 3, discount: '5%', title: 'Compras desde $ 50.000', description: 'Acumulable con otras promociones.' },
]
