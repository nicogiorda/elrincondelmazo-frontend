export function formatPrice(value) {
  return `$ ${value.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`
}
