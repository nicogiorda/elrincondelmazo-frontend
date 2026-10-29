const kinds = { CANTIDAD: 'quantity', COLECCION: 'collection', TIPO_PRODUCTO: 'type', METODO_PAGO: 'payment', MONTO_MINIMO: 'minimum', PRODUCTO: 'product' }
let pending
const invalidationListeners = new Set()

export function subscribePublicPromotionsInvalidation(listener) {
  invalidationListeners.add(listener)
  return () => invalidationListeners.delete(listener)
}

export function invalidatePublicPromotions() {
  pending = undefined
  for (const listener of invalidationListeners) listener()
}

// Comparte solamente requests en curso. Cada visita real a Home consulta la vigencia
// del servidor; no conserva promociones vencidas ni una lista anterior a una edición.
export function loadPublicPromotions() {
  if (!pending) {
    const request = fetch('http://localhost:8080/promotions/public')
      .then(async (response) => {
        if (!response.ok) throw new Error(`No pudimos cargar las promociones (HTTP ${response.status}).`)
        const data = await response.json()
        if (!Array.isArray(data)) throw new Error('La respuesta de promociones no es una lista.')
        return data.map((promotion) => ({
          ...promotion,
          kind: kinds[promotion.type],
          discount: Number(promotion.discountPercentage),
          enabled: promotion.active,
          description: promotion.description ?? '',
          startDate: promotion.startDate ?? '',
          endDate: promotion.endDate ?? '',
        }))
      })
      .finally(() => { if (pending === request) pending = undefined })
    pending = request
  }
  return pending
}
