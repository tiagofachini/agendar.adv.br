import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './layouts/AppLayout'

import LandingPage from './pages/LandingPage'
import Directory from './pages/Directory'
import Scheduler from './pages/Scheduler'
import Dashboard from './pages/Dashboard'
import Appointments from './pages/Appointments'
import Clients from './pages/Clients'
import Finance from './pages/Finance'
import Settings from './pages/Settings'
import AdminPage from './pages/AdminPage'
import MyPlan from './pages/MyPlan'
import Referrals from './pages/Referrals'
import TermsPage from './pages/TermsPage'
import PrivacyPage from './pages/PrivacyPage'

function RefCapture() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref')
    if (ref) {
      localStorage.setItem('referralCode', ref)
      params.delete('ref')
      const qs = params.toString()
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''))
    }
  }, [])
  return null
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <RefCapture />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/termos"      element={<TermsPage />} />
          <Route path="/privacidade" element={<PrivacyPage />} />
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/dashboard"    element={<Dashboard />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/clients"      element={<Clients />} />
            <Route path="/finance"      element={<Finance />} />
            <Route path="/settings"     element={<Settings />} />
            <Route path="/admin"        element={<AdminPage />} />
            <Route path="/my-plan"      element={<MyPlan />} />
            <Route path="/referrals"    element={<Referrals />} />
          </Route>
          <Route path="/advogados" element={<Directory />} />
          <Route path="/:slug" element={<Scheduler />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
