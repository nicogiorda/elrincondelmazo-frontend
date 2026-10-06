// Datos de demostración del prototipo. No representan contratos de usuario u orden confirmados.
// Los productos sí mantienen los campos y enums de ProductResponse.
export const accountUser = { id: 2, name: 'Martín', lastName: 'Gómez', email: 'martin.gomez@mail.com', memberSince: '03/2026' }
export const productTypeLabels = { CARTA: 'Carta', SOBRE: 'Sobre', LOOTBOX: 'Lootbox' }
export const collectionBackgrounds = { 1: 'rojo', 2: 'rosa', 3: 'crema', 4: 'amarillo' }
export const publicationCollections = [{ id: 1, name: 'NBA' }, { id: 2, name: 'My Little Pony' }, { id: 3, name: 'Cars' }, { id: 4, name: 'Marvel' }]
export const publicationProducts = [
  { id: 13, name: 'Wembanyama Rookie Autografiada', description: '', price: 125000, type: 'CARTA', imageUrls: [], stock: 1, status: 'ACTIVO', sellerId: 2, sellerName: 'Martín G.', collectionId: 1, collectionName: 'NBA' },
  { id: 1, name: 'LeBron James Prizm Silver 2023', description: '', price: 48500, type: 'CARTA', imageUrls: [], stock: 1, status: 'ACTIVO', sellerId: 2, sellerName: 'Martín G.', collectionId: 1, collectionName: 'NBA' },
  { id: 14, name: 'Iron Man Prisma Refractor', description: '', price: 18500, type: 'CARTA', imageUrls: [], stock: 2, status: 'INACTIVO', sellerId: 2, sellerName: 'Martín G.', collectionId: 4, collectionName: 'Marvel' },
  { id: 15, name: 'Kevin Durant Mosaic Green', description: '', price: 22000, type: 'CARTA', imageUrls: [], stock: 0, status: 'AGOTADO', sellerId: 2, sellerName: 'Martín G.', collectionId: 1, collectionName: 'NBA' },
]
