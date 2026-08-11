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

  const items = user?.role === 'admin'
    ? [...navItems, { path: '/admin', label: 'Admin', icon: ShieldCheck }]
    : navItems

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
    <div className="w-60 bg-bg-secondary border-r border-bg-border flex flex-col h-screen fixed left-0 top-0 z-10">
      {/* Logo */}
      <div className="h-[73px] px-5 flex items-center border-b border-bg-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent-cyan/10 border border-accent-cyan/20 flex items-center justify-center">
            <Shield className="w-4 h-4 text-accent-cyan" />
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-tight text-text-primary">Log Analyzer</h1>
            <p className="text-[11px] text-text-muted leading-tight">Security Operations</p>
          </div>
        </div>
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
  )
}
