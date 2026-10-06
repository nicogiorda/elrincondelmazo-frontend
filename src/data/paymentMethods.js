// Valores de PaymentMethod del backend; los textos son solo presentación.
export const paymentMethods = [
  { value: 'TARJETA_DE_CREDITO', label: 'Tarjeta de crédito' },
  { value: 'TARJETA_DE_DEBITO', label: 'Tarjeta de débito' },
  { value: 'MERCADO_PAGO', label: 'Mercado Pago' },
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
]

export function paymentMethodLabel(value) {
  return paymentMethods.find((method) => method.value === value)?.label ?? 'Medio de pago desconocido'
}
