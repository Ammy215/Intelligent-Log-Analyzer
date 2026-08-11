import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute, { PublicOnlyRoute } from './components/auth/ProtectedRoute'
import Sidebar from './components/layout/Sidebar'
import Login from './pages/Login'
import Signup from './pages/Signup'
import SetPassword from './pages/SetPassword'
import Overview from './pages/Overview'
import LiveFeed from './pages/LiveFeed'
import ThreatHunting from './pages/ThreatHunting'
import IPIntelligence from './pages/IPIntelligence'
import Incidents from './pages/Incidents'
import AIAnalyst from './pages/AIAnalyst'
import AttackMap from './pages/AttackMap'
import Billing from './pages/Billing'
import Admin from './pages/Admin'
import SuperAdmin from './pages/SuperAdmin'
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
          <Route path="/admin" element={<Admin />} />
          <Route path="/superadmin" element={<SuperAdmin />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}

// Supabase invite/recovery emails redirect to the project's Site URL root
// with the session token in the URL hash — there's no way to point that
// redirect at /set-password directly without changing the Supabase
// project's global Site URL (which every other auth email also uses).
// This has to be read synchronously during render, not in a useEffect:
// ProtectedRoute's own "not logged in, go to /login" redirect fires from
// an effect too, and effects run child-first, so ProtectedRoute's Navigate
// (nested deeper in the tree) always won it and wiped the hash — including
// the token — before App's effect got a turn. Reading it here, before
// Routes ever mounts, means that race never happens.
const hasInviteToken =
  typeof window !== 'undefined' &&
  window.location.hash.includes('access_token=') &&
  window.location.pathname !== '/set-password'

function App() {
  if (hasInviteToken) {
    return (
      <>
        <SetPassword />
        <Toaster position="top-right" theme="dark" />
      </>
    )
  }

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
          path="/set-password"
          element={
            <PublicOnlyRoute>
              <SetPassword />
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
