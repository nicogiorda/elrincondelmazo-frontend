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

// Colores por nombre, independientes de los IDs asignados por PostgreSQL.
export const homeProductBackgrounds = { NBA: 'rojo', 'My Little Pony': 'rosa', Marvel: 'amarillo' }
