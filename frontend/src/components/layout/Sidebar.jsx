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

  // Get total events count
  const { data: summary } = useQuery({
    queryKey: ['summary'],
    queryFn: analysisAPI.getSummary,
    refetchInterval: 30000, // Refresh every 30s
  })

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="w-60 bg-bg-secondary border-r border-bg-border flex flex-col h-screen fixed left-0 top-0">
      {/* Logo */}
      <div className="p-6 border-b border-bg-border">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-accent-cyan" />
          <div>
            <h1 className="text-lg font-semibold">Log Analyzer</h1>
            <p className="text-xs text-text-secondary">Security Operations</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-bg-tertiary text-accent-cyan border border-accent-cyan/20'
                  : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer stats */}
      <div className="p-4 border-t border-bg-border space-y-3">
        {/* Total events */}
        {summary?.total_events !== undefined && (
          <div className="text-sm">
            <p className="text-text-secondary mb-1">Total Events</p>
            <p className="text-xl font-bold text-accent-cyan">
              {formatNumber(summary.total_events)}
            </p>
          </div>
        )}

        {/* Signed-in user + logout */}
        <div className="pt-2 border-t border-bg-border">
          <p className="text-xs text-text-secondary truncate mb-2" title={user?.email}>
            {user?.email}
          </p>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-text-secondary hover:text-accent-red transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
