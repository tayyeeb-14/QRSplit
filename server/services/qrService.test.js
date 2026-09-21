import test from 'node:test'
import assert from 'node:assert/strict'
import { paymentIntent } from './qrService.js'

test('payment intent contains safely encoded UPI payment fields', () => {
  const value = paymentIntent({ upiId: 'tayyeeb00-2@okaxis', merchantName: 'Muhammad Tayyeebur Rohman Talukder', amount: 1999, reference: 'SP-TEST123' })
  const url = new URL(value)
  assert.equal(url.protocol, 'upi:')
  assert.equal(url.searchParams.get('pa'), 'tayyeeb00-2@okaxis')
  assert.equal(url.searchParams.get('pn'), 'Muhammad Tayyeebur Rohman Talukder')
  assert.equal(url.searchParams.get('am'), '1999.00')
  assert.equal(url.searchParams.get('cu'), 'INR')
  assert.equal(url.searchParams.get('tr'), 'SP-TEST123')
})