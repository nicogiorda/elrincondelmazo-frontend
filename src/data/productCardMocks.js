import wembanyamaImage from '../assets/wembanyama-rookie.png'
import spiderManImage from '../assets/spider-man-holo.png'

// Datos de ejemplo para la comparación visual; no son respuestas del backend.
// imageBackground es un dato visual provisional, no un campo confirmado del contrato.
const nba = { id: 1, name: 'NBA', imageBackground: 'rojo' }
const marvel = { id: 2, name: 'Marvel', imageBackground: 'amarillo' }

const wembanyama = {
  id: 1,
  name: 'Wembanyama Rookie Autografiada',
  price: 125000,
  type: 'CARD',
  imageUrls: [wembanyamaImage],
  stock: 1,
  status: 'AVAILABLE',
  seller: { id: 1, name: 'Rincón oficial' },
  collection: nba,
}

const spiderMan = {
  id: 2,
  name: 'Spider-Man Holo 60 aniversario',
  price: 27800,
  type: 'CARD',
  imageUrls: [spiderManImage],
  stock: 3,
  status: 'AVAILABLE',
  seller: { id: 2, name: 'Lucía F.' },
  collection: marvel,
}

const avengers = {
  id: 3,
  name: 'Lootbox Avengers Mystery',
  price: 39900,
  type: 'LOOTBOX',
  imageUrls: [], // Figma no incluye una fotografía de este producto.
  stock: 0,
  status: 'OUT_OF_STOCK',
  seller: { id: 1, name: 'Rincón oficial' },
  collection: marvel,
}

export const productCardExamples = [
  { label: 'Home', variant: 'home', product: wembanyama },
  { label: 'Catálogo', variant: 'catalog', product: spiderMan },
  { label: 'Catálogo · agotada', variant: 'catalog', product: avengers },
  { label: 'Relacionados', variant: 'related', product: wembanyama },
]
