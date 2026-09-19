import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CheckCircle2, ShieldCheck } from 'lucide-react'
import api from '../services/api'

export default function MerchantResolvePage() {
  const { token } = useParams(); const [merchant, setMerchant] = useState(null); const [error, setError] = useState('')
  useEffect(() => { api.get(`/merchant/resolve/${token}`).then(response => setMerchant(response.data.data)).catch(requestError => setError(requestError.response?.data?.message || 'Merchant QR could not be resolved.')) }, [token])
  return <div className="resolve-page"><div className="auth-brand"><div className="brand-mark">S</div><span>split<span>pay</span></span></div><div className="resolve-card panel">{error ? <><h2>Merchant not found</h2><p className="muted">{error}</p><Link className="primary-button" to="/register">Enter a UPI ID</Link></> : merchant ? <><CheckCircle2 className="verified-icon" size={39} /><p className="eyebrow">PUBLIC MERCHANT PROFILE</p><h1>{merchant.businessName}</h1><p className="verified-upi">{merchant.upiId}</p><div className="merchant-id-box"><span>Merchant ID</span><strong>{merchant.merchantId}</strong></div><p className="verification-note"><ShieldCheck size={14} /> Identity QR only. Sign in is still required for private dashboard access.</p><Link className="primary-button full" to="/login">Continue to login</Link></> : <p className="muted">Resolving merchant profile...</p>}</div></div>
}
