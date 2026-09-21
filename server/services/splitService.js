export const MAX_TRANCHE_CENTS = 200000

export function splitAmount(amount) {
  const numericAmount = Number(amount)
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) throw new Error('Amount must be positive')
  const cents = Math.round(numericAmount * 100)
  const tranches = []
  let remaining = cents
  while (remaining > 0) {
    const tranche = Math.min(MAX_TRANCHE_CENTS, remaining)
    tranches.push(tranche / 100)
    remaining -= tranche
  }
  return tranches
}