const demoDirectory = new Map([
  ['guptakirana@okhdfcbank', 'Gupta Kirana Store'],
  ['tayyeeb.demo@upi', 'Tayyeeb Services'],
])

export const validVpa = value => /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z0-9.-]{2,64}$/.test(String(value || '').trim())

export function verifyMerchantUpi(upiId, requestedName = '') {
  const normalizedUpi = String(upiId || '').trim().toLowerCase()
  if (!validVpa(normalizedUpi)) return { verified: false, status: 'invalid', message: 'Enter a valid UPI ID (VPA).' }
  const directoryName = demoDirectory.get(normalizedUpi)
  if (!directoryName) return { verified: false, status: 'unverified', verificationStatus: 'unverified', verificationSource: 'qr-input', name: requestedName || '', upiId: normalizedUpi, message: 'UPI ID format is valid. External verification is not connected.' }
  return { verified: true, status: 'verified', verificationStatus: 'verified', verificationSource: 'demo-directory', name: directoryName, upiId: normalizedUpi, source: 'demo-directory', nameWasProvided: Boolean(requestedName) }
}