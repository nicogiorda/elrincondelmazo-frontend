import { getMockProduct } from './productMocks.js'

// label, variant e imageBackground pertenecen a la vista de comparación,
// no al objeto product ni al contrato del backend.
export const productCardExamples = [
  { label: 'Home', variant: 'home', imageBackground: 'rojo', product: getMockProduct(13) },
  { label: 'Catálogo', variant: 'catalog', imageBackground: 'amarillo', product: getMockProduct(4) },
  { label: 'Catálogo · agotada', variant: 'catalog', imageBackground: 'amarillo', product: getMockProduct(6) },
  { label: 'Relacionados', variant: 'related', imageBackground: 'rojo', product: getMockProduct(13) },
]
