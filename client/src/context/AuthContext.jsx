import { createContext, useContext, useEffect, useState } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)
export function AuthProvider({ children }) {
  const [merchant, setMerchant] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const token = localStorage.getItem('splitpay_token')
    if (!token) return setLoading(false)
    api.get('/auth/me').then(response => setMerchant(response.data.data)).catch(() => localStorage.removeItem('splitpay_token')).finally(() => setLoading(false))
    const logout = () => { localStorage.removeItem('splitpay_token'); setMerchant(null) }
    window.addEventListener('splitpay:unauthorized', logout)
    return () => window.removeEventListener('splitpay:unauthorized', logout)
  }, [])
  const login = async credentials => { const response = await api.post('/auth/login', credentials); localStorage.setItem('splitpay_token', response.data.data.token); setMerchant(response.data.data.merchant); return response.data.data }
  const register = async details => { const response = await api.post('/auth/register', details); localStorage.setItem('splitpay_token', response.data.data.token); setMerchant(response.data.data.merchant); return response.data.data }
  const logout = () => { localStorage.removeItem('splitpay_token'); setMerchant(null) }
  return <AuthContext.Provider value={{ merchant, loading, login, register, logout }}>{children}</AuthContext.Provider>
}
export function useAuth() { return useContext(AuthContext) }
