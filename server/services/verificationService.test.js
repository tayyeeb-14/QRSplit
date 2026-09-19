import test from 'node:test'
import assert from 'node:assert/strict'
import { validVpa, verifyMerchantUpi } from './verificationService.js'

test('demo verification resolves a known VPA without bank claims', () => {
  assert.equal(validVpa('guptakirana@okhdfcbank'), true)
  const result = verifyMerchantUpi('guptakirana@okhdfcbank')
  assert.equal(result.verified, true)
  assert.equal(result.name, 'Gupta Kirana Store')
  assert.equal(result.verificationStatus, 'verified')
  assert.equal(result.verificationSource, 'demo-directory')
})

test('unknown valid VPAs remain explicitly unverified', () => {
  const result = verifyMerchantUpi('unknown@upi')
  assert.equal(result.verified, false)
  assert.equal(result.status, 'unverified')
  assert.equal(result.verificationStatus, 'unverified')
  assert.equal(result.verificationSource, 'qr-input')
})

test('invalid VPAs are rejected', () => {
  assert.equal(validVpa('not-a-vpa'), false)
  assert.equal(verifyMerchantUpi('not-a-vpa').status, 'invalid')
})
