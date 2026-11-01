export function productIdFrom(value) {
  const text = String(value ?? '')
  return /^[1-9]\d*$/.test(text) && Number.isSafeInteger(Number(text)) ? Number(text) : null
}
