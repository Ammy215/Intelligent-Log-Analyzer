import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Building2, Users, AlertTriangle, FileText, Wallet, MousePointerClick, Plus, Minus, ShieldAlert } from 'lucide-react'
import { superadminAPI } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import PageWrapper from '@/components/layout/PageWrapper'
import MetricCard from '@/components/shared/MetricCard'
import LoadingState from '@/components/shared/LoadingState'
import ErrorState from '@/components/shared/ErrorState'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { formatTimestamp, formatNumber } from '@/lib/utils'

const ROLE_VARIANT = { admin: 'neutral', analyst: 'medium', viewer: 'muted' }

function OrganizationsSection({ selectedOrgId, setSelectedOrgId }) {
  const queryClient = useQueryClient()
  const [creditDelta, setCreditDelta] = useState(100)
  const [creditReason, setCreditReason] = useState('')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['superadmin-orgs'],
    queryFn: superadminAPI.listOrganizations,
  })

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['superadmin-org-detail', selectedOrgId],
    queryFn: () => superadminAPI.getOrganization(selectedOrgId),
    enabled: !!selectedOrgId,
  })

  const { mutate: adjustCredits, isLoading: adjusting } = useMutation({
    mutationFn: () => superadminAPI.adjustCredits(selectedOrgId, Number(creditDelta), creditReason || 'superadmin adjustment'),
    onSuccess: () => {
      toast.success('Credits adjusted')
      setCreditReason('')
      queryClient.invalidateQueries({ queryKey: ['superadmin-org-detail', selectedOrgId] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-orgs'] })
    },
    onError: () => toast.error('Failed to adjust credits'),
  })

  if (isLoading) return <LoadingState />
  if (error) return <ErrorState error={error} onRetry={refetch} />
  const orgs = data?.data || []

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-1 space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar pr-0.5">
        {orgs.map((org) => {
          const isSelected = selectedOrgId === org.id
          return (
            <div
              key={org.id}
              onClick={() => setSelectedOrgId(org.id)}
              className={`relative pl-4 pr-4 py-3 rounded-xl border cursor-pointer transition-all ${
                isSelected ? 'bg-accent-cyan/[0.06] border-accent-cyan/30' : 'bg-bg-secondary border-bg-border hover:border-text-muted/40'
              }`}
            >
              {isSelected && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5 rounded-full bg-accent-cyan" />}
              <p className="text-sm font-medium text-text-primary mb-1">{org.name}</p>
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>{org.member_count} members</span>
                <span className="tabular-nums">{org.free_credits_remaining + org.purchased_credits} credits</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="col-span-2">
        {!selectedOrgId && (
          <div className="card flex flex-col items-center justify-center py-24 text-center">
            <div className="w-12 h-12 rounded-full bg-bg-tertiary flex items-center justify-center mb-3">
              <MousePointerClick className="w-5 h-5 text-text-muted" />
            </div>
            <p className="text-sm text-text-secondary">Select an organization to view details</p>
          </div>
        )}

        {selectedOrgId && detailLoading && (
          <div className="card"><LoadingState /></div>
        )}

        {selectedOrgId && detail && (
          <div className="space-y-5">
            <div className="card">
              <h2 className="text-lg font-semibold text-text-primary mb-4">{detail.organization.name}</h2>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <p className="label-eyebrow mb-1.5">Members</p>
                  <p className="text-xl font-semibold text-text-primary tabular-nums">{detail.members.length}</p>
                </div>
                <div>
                  <p className="label-eyebrow mb-1.5">Free Credits</p>
                  <p className="text-xl font-semibold text-text-primary tabular-nums">{detail.balance.free_credits_remaining}</p>
                </div>
                <div>
                  <p className="label-eyebrow mb-1.5">Purchased</p>
                  <p className="text-xl font-semibold text-text-primary tabular-nums">{detail.balance.purchased_credits}</p>
                </div>
                <div>
                  <p className="label-eyebrow mb-1.5">Incidents / Logs</p>
                  <p className="text-xl font-semibold text-text-primary tabular-nums">
                    {detail.incident_count} / {formatNumber(detail.log_count)}
                  </p>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="label-eyebrow mb-4">Members</h3>
              <div className="space-y-2">
                {detail.members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-2 border-b border-bg-border last:border-0">
                    <div>
                      <p className="text-sm text-text-primary">{m.full_name || '—'}</p>
                      <p className="text-xs text-text-muted font-mono">{m.email}</p>
                    </div>
                    <Badge variant={ROLE_VARIANT[m.role] || 'muted'} className="capitalize">{m.role}</Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="label-eyebrow mb-4 flex items-center gap-2">
                <Wallet className="w-3.5 h-3.5" />
                Adjust purchased credits
              </h3>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCreditDelta((d) => Number(d) - 100)}
                  className="btn btn-secondary px-2.5"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  className="input w-28 text-center tabular-nums"
                  value={creditDelta}
                  onChange={(e) => setCreditDelta(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setCreditDelta((d) => Number(d) + 100)}
                  className="btn btn-secondary px-2.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="text"
                  placeholder="Reason (e.g. support comp)"
                  className="input flex-1"
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                />
                <Button size="sm" disabled={adjusting || !creditDelta} onClick={() => adjustCredits()}>
                  {adjusting ? 'Applying…' : 'Apply'}
                </Button>
              </div>
              <p className="text-xs text-text-muted mt-2">
                Positive adds, negative deducts. Only affects purchased credits — free monthly allowance is untouched.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function UsersSection() {
  const queryClient = useQueryClient()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['superadmin-users'],
    queryFn: superadminAPI.listUsers,
  })

  const { mutate: changeRole } = useMutation({
    mutationFn: ({ userId, role }) => superadminAPI.changeUserRole(userId, role),
    onSuccess: () => {
      toast.success('Role updated — takes effect on that user\'s next login')
      queryClient.invalidateQueries({ queryKey: ['superadmin-users'] })
    },
    onError: () => toast.error('Failed to change role'),
  })

  if (isLoading) return <LoadingState />
  if (error) return <ErrorState error={error} onRetry={refetch} />
  const users = data?.data || []

  return (
    <div className="card">
      <h3 className="label-eyebrow mb-4 flex items-center gap-2">
        <Users className="w-3.5 h-3.5" />
        All users ({users.length})
      </h3>
      <div className="overflow-x-auto -mx-6">
        <table className="w-full">
          <thead>
            <tr className="border-b border-bg-border text-left">
              <th className="py-2.5 px-6 text-text-muted text-[11px] font-semibold uppercase tracking-wider">Name</th>
              <th className="py-2.5 px-4 text-text-muted text-[11px] font-semibold uppercase tracking-wider">Email</th>
              <th className="py-2.5 px-4 text-text-muted text-[11px] font-semibold uppercase tracking-wider">Organization</th>
              <th className="py-2.5 px-4 text-text-muted text-[11px] font-semibold uppercase tracking-wider">Joined</th>
              <th className="py-2.5 px-6 text-text-muted text-[11px] font-semibold uppercase tracking-wider text-right">Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-bg-border last:border-0 hover:bg-bg-tertiary/60 transition-colors">
                <td className="py-3 px-6 text-sm text-text-primary">{u.full_name || '—'}</td>
                <td className="py-3 px-4 text-sm font-mono text-text-secondary">{u.email}</td>
                <td className="py-3 px-4 text-sm text-text-primary">{u.org_name}</td>
                <td className="py-3 px-4 text-xs font-mono text-text-secondary">{formatTimestamp(u.created_at)}</td>
                <td className="py-3 px-6 text-right">
                  <select
                    className="input py-1 text-xs w-28 inline-block"
                    value={u.role}
                    onChange={(e) => changeRole({ userId: u.id, role: e.target.value })}
                  >
                    <option value="admin">admin</option>
                    <option value="analyst">analyst</option>
                    <option value="viewer">viewer</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function SuperAdmin() {
  const { user } = useAuth()
  const [selectedOrgId, setSelectedOrgId] = useState(null)

  if (user && !user.is_superadmin) {
    return (
      <PageWrapper title="Super Admin" subtitle="Platform-wide oversight">
        <div className="card p-12 text-center">
          <ShieldAlert className="w-16 h-16 text-accent-red mx-auto mb-4" />
          <p className="text-text-secondary">Super admin access required.</p>
        </div>
      </PageWrapper>
    )
  }

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['superadmin-stats'],
    queryFn: superadminAPI.getStats,
  })

  const metrics = [
    { title: 'Organizations', value: stats?.total_organizations ?? 0, icon: Building2 },
    { title: 'Users', value: stats?.total_users ?? 0, icon: Users },
    { title: 'Incidents (all orgs)', value: stats?.total_incidents ?? 0, icon: AlertTriangle },
    { title: 'Logs (all orgs)', value: stats?.total_logs ?? 0, icon: FileText },
    { title: 'Credits purchased', value: stats?.total_credits_purchased ?? 0, icon: Wallet },
  ]

  return (
    <PageWrapper title="Super Admin" subtitle="Platform-wide oversight — not scoped to any single organization">
      {statsLoading ? (
        <LoadingState />
      ) : (
        <div className="grid grid-cols-5 gap-4 mb-6">
          {metrics.map((m, i) => (
            <MetricCard key={m.title} {...m} index={i} />
          ))}
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-sm font-semibold text-text-primary mb-3">Organizations</h2>
        <OrganizationsSection selectedOrgId={selectedOrgId} setSelectedOrgId={setSelectedOrgId} />
      </div>

      <UsersSection />
    </PageWrapper>
  )
}
