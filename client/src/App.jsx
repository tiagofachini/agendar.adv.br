import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './layouts/AppLayout'

// Páginas públicas
import LandingPage from './pages/LandingPage'
import Scheduler from './pages/Scheduler'

// Páginas protegidas
import Dashboard from './pages/Dashboard'
import Appointments from './pages/Appointments'
import Clients from './pages/Clients'
import Finance from './pages/Finance'
import Settings from './pages/Settings'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Públicas */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/agendar/:slug" element={<Scheduler />} />

            {/* Protegidas com layout compartilhado */}
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard"    element={<Dashboard />} />
              <Route path="/appointments" element={<Appointments />} />
              <Route path="/clients"      element={<Clients />} />
              <Route path="/finance"      element={<Finance />} />
              <Route path="/settings"     element={<Settings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </GoogleOAuthProvider>
  )
}
