// La invalidación es una notificación entre vistas, no un transporte HTTP.
// Los datos, loading y error de promociones públicas viven en Redux.
const invalidationListeners = new Set()

export function subscribePublicPromotionsInvalidation(listener) {
  invalidationListeners.add(listener)
  return () => invalidationListeners.delete(listener)
}

export function invalidatePublicPromotions() {
  for (const listener of invalidationListeners) listener()
}
