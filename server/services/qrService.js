import QRCode from 'qrcode'

export function paymentIntent({ upiId, merchantName, amount, reference }) {
  const query = new URLSearchParams({ pa: upiId, pn: merchantName, am: Number(amount).toFixed(2), cu: 'INR', tr: reference })
  return `upi://pay?${query.toString()}`
}

export function paymentQrDataUrl(details) {
  return QRCode.toDataURL(paymentIntent(details))
}