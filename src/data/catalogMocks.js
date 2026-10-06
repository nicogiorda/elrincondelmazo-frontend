import { getMockProduct } from './productMocks.js'

// Conserva las identidades y el orden de las doce tarjetas del catálogo.
export const catalogProducts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(getMockProduct)

export const catalogTypes = [
  { value: '', label: 'Todos' },
  { value: 'CARTA', label: 'Cartas' },
  { value: 'SOBRE', label: 'Sobres' },
  { value: 'LOOTBOX', label: 'Lootboxes' },
]

export const catalogCollections = [
  { value: '', label: 'Todas' },
  { value: '1', label: 'NBA' },
  { value: '2', label: 'My Little Pony' },
  { value: '3', label: 'Cars' },
  { value: '4', label: 'Marvel' },
]

// Configuración visual del frontend, separada de los productos del backend.
export const catalogProductBackgrounds = { 1: 'rojo', 2: 'rosa', 3: 'crema', 4: 'amarillo' }
