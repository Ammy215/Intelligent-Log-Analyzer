import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Activity,
  Search,
  Globe,
  AlertTriangle,
  Brain,
  Map,
  FileText,
  Settings,
  Shield,
  CreditCard,
  LogOut,
  ShieldCheck,
  Crown,
  Menu,
  X,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { analysisAPI } from '@/lib/api'
import { formatNumber } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'

const navItems = [
  { path: '/', label: 'Overview', icon: LayoutDashboard },
  { path: '/live-feed', label: 'Live Feed', icon: Activity },
  { path: '/threat-hunting', label: 'Threat Hunting', icon: Search },
  { path: '/ip-intelligence', label: 'IP Intelligence', icon: Globe },
  { path: '/incidents', label: 'Incidents', icon: AlertTriangle },
  { path: '/ai-analyst', label: 'AI Analyst', icon: Brain },
  { path: '/attack-map', label: 'Attack Map', icon: Map },
  { path: '/billing', label: 'Billing', icon: CreditCard },
  { path: '/reports', label: 'Reports', icon: FileText },
  { path: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  // Below lg the sidebar is a slide-in drawer rather than a permanent rail —
  // at 240px wide it otherwise ate ~60% of a 390px phone screen on every page.
  const [mobileOpen, setMobileOpen] = useState(false)

  // Navigating always closes the drawer, otherwise it stays open over the
  // page the user just asked for.
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  // A drawer over the page shouldn't leave the page behind it scrolling.
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  let items = user?.role === 'admin'
    ? [...navItems, { path: '/admin', label: 'Admin', icon: ShieldCheck }]
    : navItems
  if (user?.is_superadmin) {
    items = [...items, { path: '/superadmin', label: 'Super Admin', icon: Crown }]
  }

  const { data: summary } = useQuery({
    queryKey: ['summary'],
    queryFn: analysisAPI.getSummary,
    refetchInterval: 30000,
  })

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const initial = user?.email?.[0]?.toUpperCase() || '?'

  return (
    <>
      {/* Mobile top bar — the only nav affordance below lg, since the rail is
          hidden there. Fixed so it stays reachable on long scrolling pages. */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 z-30 bg-bg-secondary border-b border-bg-border flex items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-accent-cyan/10 border border-accent-cyan/20 flex items-center justify-center">
            <Shield className="w-4 h-4 text-accent-cyan" />
          </div>
          <p className="text-sm font-semibold text-text-primary">Log Analyzer</p>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 -mr-2 text-text-secondary hover:text-text-primary transition-colors"
          aria-label="Open navigation menu"
          aria-expanded={mobileOpen}
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Scrim — tapping outside the drawer closes it */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        className={`w-60 bg-bg-secondary border-r border-bg-border flex flex-col h-screen fixed left-0 top-0 z-50 transition-transform duration-200 lg:z-10 lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="h-[73px] px-5 flex items-center justify-between border-b border-bg-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent-cyan/10 border border-accent-cyan/20 flex items-center justify-center">
              <Shield className="w-4 h-4 text-accent-cyan" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight text-text-primary">Log Analyzer</p>
              <p className="text-[11px] text-text-muted leading-tight">Security Operations</p>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 -mr-1.5 text-text-muted hover:text-text-primary transition-colors"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto custom-scrollbar">
          {items.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-accent-cyan/10 text-accent-cyan font-medium'
                    : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-full bg-accent-cyan" />
                )}
                <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={isActive ? 2.25 : 1.75} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-bg-border">
          {summary?.total_events !== undefined && (
            <div className="px-5 py-3 border-b border-bg-border">
              <p className="label-eyebrow mb-1">Total Events</p>
              <p className="text-lg font-semibold text-text-primary tabular-nums">
                {formatNumber(summary.total_events)}
              </p>
            </div>
          )}

          <div className="p-3">
            <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
              <div className="w-7 h-7 rounded-full bg-bg-elevated border border-bg-border flex items-center justify-center text-xs font-semibold text-text-secondary shrink-0">
                {initial}
              </div>
              <p className="text-xs text-text-secondary truncate flex-1" title={user?.email}>
                {user?.email}
              </p>
              <button
                onClick={handleLogout}
                className="text-text-muted hover:text-accent-red transition-colors p-1 shrink-0"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
