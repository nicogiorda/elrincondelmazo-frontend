import nbaImage from '../assets/collection-nba.png'
import ponyImage from '../assets/collection-my-little-pony.png'
import carsImage from '../assets/collection-cars.png'
import marvelImage from '../assets/collection-marvel.png'
import wembanyamaImage from '../assets/wembanyama-rookie.png'
import spiderManImage from '../assets/spider-man-holo.png'
import marvelUniverseImage from '../assets/marvel-universe.png'
import nbaRookiesImage from '../assets/nba-rookies.png'

// Mocks visuales de Home. Los campos y enums no representan DTO confirmados.
// color, wrapTitle e imageBackground son datos de presentación del prototipo.
export const homeCollections = [
  { id: 1, name: 'NBA', imageUrl: nbaImage, color: 'crema' },
  { id: 2, name: 'My Little Pony', imageUrl: ponyImage, color: 'rosa', wrapTitle: true },
  { id: 3, name: 'Cars', imageUrl: carsImage, color: 'rojo' },
  { id: 4, name: 'Marvel', imageUrl: marvelImage, color: 'amarillo' },
]

const nba = { id: 1, name: 'NBA', imageBackground: 'rojo' }
const marvel = { id: 4, name: 'Marvel', imageBackground: 'amarillo' }
const officialSeller = { id: 1, name: 'Rincón oficial' }

export const homeProducts = [
  { id: 1, name: 'Wembanyama Rookie Autografiada', price: 125000, type: 'CARD', imageUrls: [wembanyamaImage], stock: 1, status: 'AVAILABLE', seller: officialSeller, collection: nba },
  { id: 2, name: 'Spider-Man Holo 60 aniversario', price: 27800, type: 'CARD', imageUrls: [spiderManImage], stock: 3, status: 'AVAILABLE', seller: { id: 2, name: 'Lucía F.' }, collection: marvel },
  { id: 3, name: 'Sobre Marvel Universe', price: 5400, type: 'PACK', imageUrls: [marvelUniverseImage], stock: 10, status: 'AVAILABLE', seller: officialSeller, collection: marvel },
  { id: 4, name: 'Lootbox NBA Rookies', price: 32000, type: 'LOOTBOX', imageUrls: [nbaRookiesImage], stock: 5, status: 'AVAILABLE', seller: officialSeller, collection: nba },
]

export const homePromotions = [
  { id: 1, discount: '10%', title: 'Pagando con transferencia', description: 'Se aplica sobre el total del pedido.' },
  { id: 2, discount: '15%', title: 'Llevando 3 sobres o más', description: 'Válido para sobres de cualquier colección.' },
  { id: 3, discount: '5%', title: 'Compras desde $ 50.000', description: 'Acumulable con otras promociones.' },
]
