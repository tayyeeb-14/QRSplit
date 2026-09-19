import test from 'node:test'
import assert from 'node:assert/strict'
import { splitAmount } from './splitService.js'

for (const [amount, count] of [[100, 2], [1999, 3], [2000, 3], [2001, 3], [4500, 3], [6800, 4], [10000, 5], [99.99, 3], [100.5, 3]]) test(`splits ${amount} into ${count}`, () => { const values = splitAmount(amount, count); assert.equal(values.length, count); assert.equal(Math.round(values.reduce((sum, value) => sum + value, 0) * 100), Math.round(amount * 100)) })
test('rejects invalid amounts and counts', () => { assert.throws(() => splitAmount(0, 2)); assert.throws(() => splitAmount(-1, 2)); assert.throws(() => splitAmount(100, 0)); assert.throws(() => splitAmount(100, 101)) })