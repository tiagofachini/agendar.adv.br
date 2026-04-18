import { createContext, useContext, useEffect, useState } from 'react'
import api from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [lawyer, setLawyer] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { setLoading(false); return }

    api.get('/auth/me')
      .then((res) => setLawyer(res.data))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false))
  }, [])

  const login = (token, lawyerData) => {
    localStorage.setItem('token', token)
    setLawyer(lawyerData)
  }

  const logout = () => {
    localStorage.removeItem('token')
    setLawyer(null)
  }

  return (
    <AuthContext.Provider value={{ lawyer, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
