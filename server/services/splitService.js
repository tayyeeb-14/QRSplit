export function splitAmount(amount, count) {
  const numericAmount = Number(amount)
  const numericCount = Number(count)
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) throw new Error('Amount must be positive')
  if (!Number.isInteger(numericCount) || numericCount < 1 || numericCount > 100) throw new Error('Count must be an integer between 1 and 100')
  const cents = Math.round(numericAmount * 100)
  const base = Math.floor(cents / numericCount)
  const remainder = cents % numericCount
  return Array.from({ length: numericCount }, (_, index) => (base + (index === numericCount - 1 ? remainder : 0)) / 100)
}