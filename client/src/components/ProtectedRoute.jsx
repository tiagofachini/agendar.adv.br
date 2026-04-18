import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { lawyer, loading } = useAuth()
  if (loading) return <div className="loading-screen">Carregando...</div>
  if (!lawyer) return <Navigate to="/" replace />
  return children
}
