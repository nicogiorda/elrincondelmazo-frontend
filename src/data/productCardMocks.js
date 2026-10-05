import wembanyamaImage from '../assets/wembanyama-rookie.png'
import spiderManImage from '../assets/spider-man-holo.png'

// Productos mock con los campos y enums de ProductResponse.

const wembanyama = {
  id: 1,
  name: 'Wembanyama Rookie Autografiada',
  price: 125000,
  type: 'CARTA',
  imageUrls: [wembanyamaImage],
  stock: 1,
  status: 'ACTIVO',
  sellerId: 1,
  sellerName: 'Rincón oficial',
  collectionId: 1,
  collectionName: 'NBA',
}

const spiderMan = {
  id: 2,
  name: 'Spider-Man Holo 60 aniversario',
  price: 27800,
  type: 'CARTA',
  imageUrls: [spiderManImage],
  stock: 3,
  status: 'ACTIVO',
  sellerId: 2,
  sellerName: 'Lucía F.',
  collectionId: 4,
  collectionName: 'Marvel',
}

const avengers = {
  id: 3,
  name: 'Lootbox Avengers Mystery',
  price: 39900,
  type: 'LOOTBOX',
  imageUrls: [], // Figma no incluye una fotografía de este producto.
  stock: 0,
  status: 'AGOTADO',
  sellerId: 1,
  sellerName: 'Rincón oficial',
  collectionId: 4,
  collectionName: 'Marvel',
}

// label, variant e imageBackground pertenecen a la vista de comparación,
// no al objeto product ni al contrato del backend.
export const productCardExamples = [
  { label: 'Home', variant: 'home', imageBackground: 'rojo', product: wembanyama },
  { label: 'Catálogo', variant: 'catalog', imageBackground: 'amarillo', product: spiderMan },
  { label: 'Catálogo · agotada', variant: 'catalog', imageBackground: 'amarillo', product: avengers },
  { label: 'Relacionados', variant: 'related', imageBackground: 'rojo', product: wembanyama },
]
