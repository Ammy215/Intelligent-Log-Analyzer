import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute, { PublicOnlyRoute } from './components/auth/ProtectedRoute'
import Sidebar from './components/layout/Sidebar'
import LoadingState from './components/shared/LoadingState'

// Route-based code splitting: each page is its own chunk, fetched only when
// that route is actually visited, instead of every page (charts, maps,
// admin panels, all of it) being bundled into the one script the login
// page used to have to download before it could render a single input box.
const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const SetPassword = lazy(() => import('./pages/SetPassword'))
const Overview = lazy(() => import('./pages/Overview'))
const LiveFeed = lazy(() => import('./pages/LiveFeed'))
const ThreatHunting = lazy(() => import('./pages/ThreatHunting'))
const IPIntelligence = lazy(() => import('./pages/IPIntelligence'))
const Incidents = lazy(() => import('./pages/Incidents'))
const AIAnalyst = lazy(() => import('./pages/AIAnalyst'))
const AttackMap = lazy(() => import('./pages/AttackMap'))
const Billing = lazy(() => import('./pages/Billing'))
const Admin = lazy(() => import('./pages/Admin'))
const SuperAdmin = lazy(() => import('./pages/SuperAdmin'))
const Reports = lazy(() => import('./pages/Reports'))
const Settings = lazy(() => import('./pages/Settings'))

function AuthenticatedLayout() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <Sidebar />
      <main className="min-h-screen">
        <Suspense fallback={<LoadingState fullscreen />}>
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
        </Suspense>
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
      <Suspense fallback={<LoadingState fullscreen />}>
        <SetPassword />
        <Toaster position="top-right" theme="dark" />
      </Suspense>
    )
  }

  return (
    <AuthProvider>
      <Suspense fallback={<LoadingState fullscreen />}>
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
      </Suspense>
      <Toaster position="top-right" theme="dark" />
    </AuthProvider>
  )
}

export default App
