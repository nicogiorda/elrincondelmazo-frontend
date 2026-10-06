import { getMockProduct } from './productMocks.js'

// Campos de UserResponse; usuario de demostración, sin autenticación.
export const accountUser = { id: 2, firstName: 'Martín', lastName: 'Gómez', email: 'martin.gomez@mail.com', role: 'USER' }
export const productTypeLabels = { CARTA: 'Carta', SOBRE: 'Sobre', LOOTBOX: 'Lootbox' }
export const collectionBackgrounds = { 1: 'rojo', 2: 'rosa', 3: 'crema', 4: 'amarillo' }
export const publicationCollections = [{ id: 1, name: 'NBA' }, { id: 2, name: 'My Little Pony' }, { id: 3, name: 'Cars' }, { id: 4, name: 'Marvel' }]
export const publicationProducts = [13, 1, 14, 15].map(getMockProduct)
