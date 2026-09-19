import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute() {
  const { merchant, loading } = useAuth()
  if (loading) return <div className="auth-loading">Restoring your workspace...</div>
  return merchant ? <Outlet /> : <Navigate to="/login" replace />
}
