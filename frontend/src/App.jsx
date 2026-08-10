import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute, { PublicOnlyRoute } from './components/auth/ProtectedRoute'
import Sidebar from './components/layout/Sidebar'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Overview from './pages/Overview'
import LiveFeed from './pages/LiveFeed'
import ThreatHunting from './pages/ThreatHunting'
import IPIntelligence from './pages/IPIntelligence'
import Incidents from './pages/Incidents'
import AIAnalyst from './pages/AIAnalyst'
import AttackMap from './pages/AttackMap'
import Billing from './pages/Billing'
import Reports from './pages/Reports'
import Settings from './pages/Settings'

function AuthenticatedLayout() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <Sidebar />
      <main className="min-h-screen">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/live-feed" element={<LiveFeed />} />
          <Route path="/threat-hunting" element={<ThreatHunting />} />
          <Route path="/ip-intelligence" element={<IPIntelligence />} />
          <Route path="/ip-intelligence/:ip" element={<IPIntelligence />} />
          <Route path="/incidents" element={<Incidents />} />
          <Route path="/ai-analyst" element={<AIAnalyst />} />
          <Route path="/attack-map" element={<AttackMap />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <Login />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicOnlyRoute>
              <Signup />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AuthenticatedLayout />
            </ProtectedRoute>
          }
        />
      </Routes>
      <Toaster position="top-right" theme="dark" />
    </AuthProvider>
  )
}

export default App
