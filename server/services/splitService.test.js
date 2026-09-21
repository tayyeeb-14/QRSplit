import test from 'node:test'
import assert from 'node:assert/strict'
import { MAX_TRANCHE_CENTS, splitAmount } from './splitService.js'

const cents = value => Math.round(value * 100)

for (const [amount, expected] of [[100, [100]], [1999, [1999]], [2000, [2000]], [2001, [2000, 1]], [4500, [2000, 2000, 500]], [6800, [2000, 2000, 2000, 800]], [10000, [2000, 2000, 2000, 2000, 2000]], [20000, Array(10).fill(2000)], [99.99, [99.99]], [100.5, [100.5]]]) test(`caps ${amount} into exact tranches`, () => {
  const values = splitAmount(amount)
  assert.deepEqual(values, expected)
  assert.equal(values.every(value => cents(value) <= MAX_TRANCHE_CENTS), true)
  assert.equal(cents(values.reduce((sum, value) => sum + value, 0)), cents(amount))
})

test('rejects invalid amounts', () => {
  assert.throws(() => splitAmount(0))
  assert.throws(() => splitAmount(-1))
  assert.throws(() => splitAmount('not-an-amount'))
})
