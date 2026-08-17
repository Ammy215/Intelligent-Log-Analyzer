import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Users, ScrollText, Sliders, Receipt, Save, ShieldAlert } from 'lucide-react'
import { adminAPI } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import PageWrapper from '@/components/layout/PageWrapper'
import LoadingState from '@/components/shared/LoadingState'
import ErrorState from '@/components/shared/ErrorState'
import EmptyState from '@/components/shared/EmptyState'
import { formatTimestamp } from '@/lib/utils'

function MembersSection() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-members'],
    queryFn: adminAPI.listMembers,
  })

  if (isLoading) return <LoadingState />
  if (error) return <ErrorState error={error} onRetry={refetch} />
  const members = data?.data || []

  return (
    <div className="card p-6">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <Users className="w-5 h-5 text-accent-cyan" />
        Org Members ({members.length})
      </h3>
      {members.length === 0 ? (
        <EmptyState message="No members found" />
      ) : (
        <div className="overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-bg-border text-left">
              <th className="py-2 px-3 text-text-secondary text-sm font-medium">Name</th>
              <th className="py-2 px-3 text-text-secondary text-sm font-medium">Email</th>
              <th className="py-2 px-3 text-text-secondary text-sm font-medium">Role</th>
              <th className="py-2 px-3 text-text-secondary text-sm font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-bg-border">
                <td className="py-2 px-3 text-sm">{m.full_name || '—'}</td>
                <td className="py-2 px-3 text-sm font-mono">{m.email || '—'}</td>
                <td className="py-2 px-3 text-sm">
                  <span className="severity-badge bg-accent-purple/10 text-accent-purple border-accent-purple/25">
                    {m.role}
                  </span>
                </td>
                <td className="py-2 px-3 text-sm text-text-secondary whitespace-nowrap">{formatTimestamp(m.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  )
}

function AuditLogSection() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-audit-log'],
    queryFn: adminAPI.listAuditLog,
  })

  if (isLoading) return <LoadingState />
  if (error) return <ErrorState error={error} onRetry={refetch} />
  const entries = data?.data || []

  return (
    <div className="card p-6">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <ScrollText className="w-5 h-5 text-accent-amber" />
        Audit Log ({entries.length})
      </h3>
      {entries.length === 0 ? (
        <EmptyState message="No audit log entries yet" />
      ) : (
        <div className="max-h-96 overflow-auto custom-scrollbar">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="border-b border-bg-border text-left">
                <th className="py-2 px-3 text-text-secondary text-sm font-medium">Timestamp</th>
                <th className="py-2 px-3 text-text-secondary text-sm font-medium">Actor</th>
                <th className="py-2 px-3 text-text-secondary text-sm font-medium">Action</th>
                <th className="py-2 px-3 text-text-secondary text-sm font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-bg-border">
                  <td className="py-2 px-3 text-sm font-mono">{formatTimestamp(e.created_at)}</td>
                  <td className="py-2 px-3 text-sm">
                    {e.actor_name || e.actor_email ? (
                      <span title={e.actor_email || undefined}>{e.actor_name || e.actor_email}</span>
                    ) : e.actor_id ? (
                      // Still resolvable to nothing — a member who has since
                      // been removed. Show the id rather than pretend.
                      <span className="font-mono text-text-muted" title={e.actor_id}>
                        {e.actor_id.slice(0, 8)} (removed)
                      </span>
                    ) : (
                      <span className="text-text-muted" title="No signed-in user — e.g. a failed login">—</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-sm">{e.action}</td>
                  <td className="py-2 px-3 text-sm font-mono">{e.ip_address || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function DetectionRulesSection() {
  const queryClient = useQueryClient()
  const [edited, setEdited] = useState({})

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-detection-rules'],
    queryFn: adminAPI.listDetectionRules,
  })

  // isPending, not isLoading (react-query v5) — otherwise the Save button
  // never disables while the write is in flight.
  const { mutate: saveWeight, isPending: saving } = useMutation({
    mutationFn: ({ ruleId, weight }) => adminAPI.updateDetectionRule(ruleId, weight),
    onSuccess: (_, { ruleId }) => {
      toast.success('Weight updated')
      setEdited((prev) => {
        const next = { ...prev }
        delete next[ruleId]
        return next
      })
      queryClient.invalidateQueries({ queryKey: ['admin-detection-rules'] })
      queryClient.invalidateQueries({ queryKey: ['admin-audit-log'] })
    },
    onError: () => toast.error('Failed to update weight'),
  })

  if (isLoading) return <LoadingState />
  if (error) return <ErrorState error={error} onRetry={refetch} />
  const rules = data?.data || []

  return (
    <div className="card p-6">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <Sliders className="w-5 h-5 text-accent-green" />
        Detection Rule Weights ({rules.length})
      </h3>
      {rules.length === 0 ? (
        <EmptyState message="No detection rules configured" />
      ) : (
        <div className="max-h-96 overflow-auto custom-scrollbar">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="border-b border-bg-border text-left">
                <th className="py-2 px-3 text-text-secondary text-sm font-medium">Rule</th>
                <th className="py-2 px-3 text-text-secondary text-sm font-medium">Weight</th>
                <th className="py-2 px-3 text-text-secondary text-sm font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => {
                const currentValue = edited[rule.id] ?? rule.weight
                const isDirty = edited[rule.id] !== undefined && edited[rule.id] !== rule.weight
                return (
                  <tr key={rule.id} className="border-b border-bg-border">
                    <td className="py-2 px-3 text-sm font-mono">{rule.rule_key}</td>
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="input w-24 py-1"
                        value={currentValue}
                        onChange={(e) =>
                          setEdited((prev) => ({ ...prev, [rule.id]: parseInt(e.target.value, 10) || 0 }))
                        }
                      />
                    </td>
                    <td className="py-2 px-3">
                      <button
                        disabled={!isDirty || saving}
                        onClick={() => saveWeight({ ruleId: rule.id, weight: currentValue })}
                        className="btn btn-secondary py-1 px-3 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Save className="w-3.5 h-3.5 inline mr-1" />
                        Save
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function CreditsLedgerSection() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-credits-ledger'],
    queryFn: adminAPI.getCreditsLedger,
  })

  if (isLoading) return <LoadingState />
  if (error) return <ErrorState error={error} onRetry={refetch} />
  const ledger = data?.ledger || []
  const balance = data?.balance || {}

  return (
    <div className="card p-6">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <Receipt className="w-5 h-5 text-accent-purple" />
        Credits Ledger
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-bg-tertiary p-4 rounded-lg">
          <p className="text-text-secondary text-sm mb-1">Free remaining</p>
          <p className="text-xl font-bold">{balance.free_credits_remaining ?? '—'}</p>
        </div>
        <div className="bg-bg-tertiary p-4 rounded-lg">
          <p className="text-text-secondary text-sm mb-1">Purchased</p>
          <p className="text-xl font-bold">{balance.purchased_credits ?? '—'}</p>
        </div>
        <div className="bg-bg-tertiary p-4 rounded-lg">
          <p className="text-text-secondary text-sm mb-1">Total available</p>
          <p className="text-xl font-bold text-accent-cyan">{balance.total_available ?? '—'}</p>
        </div>
      </div>

      {ledger.length === 0 ? (
        <EmptyState message="No purchased-credit transactions yet" />
      ) : (
        <div className="overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
        <table className="w-full min-w-[620px]">
          <thead>
            <tr className="border-b border-bg-border text-left">
              <th className="py-2 px-3 text-text-secondary text-sm font-medium">Timestamp</th>
              <th className="py-2 px-3 text-text-secondary text-sm font-medium">Delta</th>
              <th className="py-2 px-3 text-text-secondary text-sm font-medium">Reason</th>
              <th className="py-2 px-3 text-text-secondary text-sm font-medium">Payment ID</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((row) => (
              <tr key={row.id} className="border-b border-bg-border">
                <td className="py-2 px-3 text-sm font-mono">{formatTimestamp(row.created_at)}</td>
                <td className={`py-2 px-3 text-sm font-mono ${row.delta >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                  {row.delta >= 0 ? `+${row.delta}` : row.delta}
                </td>
                <td className="py-2 px-3 text-sm">{row.reason}</td>
                <td className="py-2 px-3 text-sm font-mono text-text-secondary">{row.razorpay_payment_id || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  )
}

export default function Admin() {
  const { user } = useAuth()

  if (user && user.role !== 'admin') {
    return (
      <PageWrapper title="Admin" subtitle="Organization administration">
        <div className="card p-12 text-center">
          <ShieldAlert className="w-16 h-16 text-accent-red mx-auto mb-4" />
          <p className="text-text-secondary">Admin access required.</p>
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper title="Admin" subtitle="Organization administration">
      <div className="space-y-6">
        <MembersSection />
        <DetectionRulesSection />
        <AuditLogSection />
        <CreditsLedgerSection />
      </div>
    </PageWrapper>
  )
}
