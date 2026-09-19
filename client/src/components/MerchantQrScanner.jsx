import { useEffect, useRef, useState } from 'react'
import { Camera, CheckCircle2, CircleAlert, RotateCcw, X } from 'lucide-react'
import QrScanner from 'qr-scanner'
import api from '../services/api'

export function parseMerchantQr(rawValue) {
  const raw = String(rawValue || '').trim()
  try {
    const url = new URL(raw)
    const segments = url.pathname.split('/').filter(Boolean)
    if (segments.length === 2 && segments[0] === 'm' && segments[1]) return { type: 'application', value: segments[1] }
    if (url.protocol === 'upi:') {
      const upiId = url.searchParams.get('pa')
      if (!upiId) return { type: 'invalid' }
      const payload = { upiId, displayName: url.searchParams.get('pn') || '', amount: url.searchParams.get('am') || '', note: url.searchParams.get('tn') || '', reference: url.searchParams.get('tr') || '', currency: url.searchParams.get('cu') || '' }
      if (payload.currency && payload.currency.toUpperCase() !== 'INR') return { type: 'invalid' }
      return { type: payload.amount ? 'payment' : 'upi', ...payload }
    }
  } catch {
    if (/^MCH-[A-Z0-9]+-[A-Z0-9]+$/i.test(raw)) return { type: 'application', value: raw }
    if (/^[\w.-]+@[\w.-]+$/.test(raw)) return { type: 'upi', upiId: raw, displayName: '', amount: '', note: '', reference: '', currency: '' }
  }
  return { type: 'invalid' }
}

export default function MerchantQrScanner({ onClose, onMerchantResolved, onManual }) {
  const videoRef = useRef(null); const scannerRef = useRef(null); const [state, setState] = useState('starting'); const [message, setMessage] = useState('Allow camera access to scan a Merchant QR.')
  const stopScanner = () => { scannerRef.current?.stop(); scannerRef.current?.destroy(); scannerRef.current = null }
  const handleRawScan = async rawValue => { stopScanner(); const parsed = parseMerchantQr(rawValue); if (parsed.type === 'payment') { setState('payment'); setMessage(parsed.amount); return } if (parsed.type === 'invalid') { setState('invalid'); return } setState('resolving'); setMessage('Resolving merchant identity...'); try { if (parsed.type === 'application') { const response = await api.get(`/merchant/resolve/${encodeURIComponent(parsed.value)}`); onMerchantResolved({ existing: true, merchant: response.data.data }); return } const response = await api.post('/merchant/verify-upi', { upiId: parsed.upiId, storeName: parsed.displayName }); const result = response.data.data; onMerchantResolved(result.existing ? { existing: true, merchant: result.merchant } : { ...result.verification, qrDisplayName: parsed.displayName, qrNote: parsed.note, qrReference: parsed.reference }) } catch { setState('invalid') } }
  const startScanner = async () => { stopScanner(); setState('starting'); setMessage('Allow camera access to scan a Merchant QR.'); if (!window.isSecureContext && window.location.hostname !== 'localhost') return setState('unavailable'); if (!videoRef.current) return; try { const scanner = new QrScanner(videoRef.current, result => handleRawScan(result?.data || result), { preferredCamera: 'environment', highlightScanRegion: false, highlightCodeOutline: true, returnDetailedScanResult: true }); scannerRef.current = scanner; await scanner.start(); setState('scanning') } catch (error) { setState(error?.name === 'NotAllowedError' ? 'denied' : 'unavailable'); setMessage(error?.name === 'NotAllowedError' ? 'Camera access is required to scan a Merchant QR.' : 'Camera is unavailable on this device or browser.') } }
  // Scanner startup is intentionally once per modal mount; retry uses the same callback.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { startScanner(); return stopScanner }, [])
  return <div className="scanner-overlay" role="dialog" aria-modal="true" aria-label="Scan Merchant QR"><div className="scanner-modal"><div className="scanner-header"><button className="icon-button" onClick={onClose} aria-label="Close scanner"><X size={20} /></button><strong>Scan Merchant QR</strong><span /></div><div className="camera-stage"><video ref={videoRef} muted playsInline /><div className="scan-frame"><i /><i /><i /><i /></div>{state === 'starting' && <div className="camera-message"><Camera size={27} /><span>{message}</span></div>}{state === 'resolving' && <div className="camera-message"><CheckCircle2 size={27} /><span>{message}</span></div>}{state === 'payment' && <div className="camera-message error"><CircleAlert size={27} /><strong>Payment QR detected</strong><span>Amount: ₹{message}</span><span>This QR is intended for a payment, not merchant onboarding.</span><button className="secondary-button" onClick={startScanner}><RotateCcw size={15} /> Scan Merchant QR</button></div>}{(state === 'denied' || state === 'unavailable' || state === 'invalid') && <div className="camera-message error"><CircleAlert size={27} /><strong>{state === 'invalid' ? 'Invalid Merchant QR' : 'Camera unavailable'}</strong><span>{state === 'invalid' ? 'This QR does not contain a supported merchant identity or UPI payload.' : message}</span><button className="secondary-button" onClick={startScanner}><RotateCcw size={15} /> Scan again</button></div>}</div><p className="scan-instruction">Align the Merchant QR inside the frame</p><button className="manual-scan-button" onClick={onManual}>Enter UPI ID manually</button><small className="scanner-safety">Merchant QR identifies a profile only. It never signs you in or confirms a payment.</small></div></div>
}