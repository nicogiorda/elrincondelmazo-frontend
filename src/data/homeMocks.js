import nbaImage from '../assets/collection-nba.png'
import ponyImage from '../assets/collection-my-little-pony.png'
import carsImage from '../assets/collection-cars.png'
import marvelImage from '../assets/collection-marvel.png'

// Metadata visual por nombre: los IDs y nombres mostrados llegan de /collections.
export const homeCollectionVisuals = {
  NBA: { imageUrl: nbaImage, color: 'crema' },
  'My Little Pony': { imageUrl: ponyImage, color: 'rosa', wrapTitle: true },
  Cars: { imageUrl: carsImage, color: 'rojo' },
  Marvel: { imageUrl: marvelImage, color: 'amarillo' },
}

// Configuración visual separada de ProductResponse, indexada por collectionId.
export const homeProductBackgrounds = { 1: 'rojo', 2: 'rosa', 4: 'amarillo' }

// Ejemplos de presentación pendientes de integración; no intervienen en los totales.
export const homePromotions = [
  { id: 1, discount: '10%', title: 'Pagando con transferencia', description: 'Se aplica sobre el total del pedido.' },
  { id: 2, discount: '15%', title: 'Llevando 3 sobres o más', description: 'Válido para sobres de cualquier colección.' },
  { id: 3, discount: '5%', title: 'Compras desde $ 50.000', description: 'Acumulable con otras promociones.' },
]
