import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle, Play, Filter, Network, Globe2, Brain, MousePointerClick, Loader2, Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { incidentsAPI, reportsAPI } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import PageWrapper from '@/components/layout/PageWrapper'
import SeverityBadge from '@/components/shared/SeverityBadge'
import IPAddress from '@/components/shared/IPAddress'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { formatTimestamp, formatNumber } from '@/lib/utils'
import LoadingState from '@/components/shared/LoadingState'
import EmptyState from '@/components/shared/EmptyState'
import ErrorState from '@/components/shared/ErrorState'

// Status is workflow info, not a second severity signal — only "closed"
// (an earned resolution) gets a color; open/investigating stay neutral so
// they don't visually duplicate the severity badge sitting right next to them.
const STATUS_VARIANT = { open: 'muted', investigating: 'muted', closed: 'safe' }

export default function Incidents() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [selectedIncident, setSelectedIncident] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [reportError, setReportError] = useState('')

  // Report generation is admin/analyst only server-side (require_role on
  // /reports/*), so viewers don't get an action that can only 403.
  const canGenerate = user?.role === 'admin' || user?.role === 'analyst'

  const { mutate: generateReport, isPending: generating } = useMutation({
    mutationFn: (incidentId) => reportsAPI.generateIncidentReport(incidentId),
    onSuccess: (data) => {
      setReportError('')
      queryClient.invalidateQueries({ queryKey: ['incident-detail', selectedIncident] })
      queryClient.invalidateQueries({ queryKey: ['billing-credits'] })
      if (data?.credits?.spent > 0) {
        toast.success(
          `1 credit spent (${data.credits.source}) — ${data.credits.total_available} remaining`
        )
      }
    },
    onError: (err) => {
      const detail = err.response?.data?.detail
      setReportError(
        typeof detail === 'string' ? detail : detail?.msg || 'Could not generate the report'
      )
    },
  })

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['incidents', statusFilter],
    queryFn: () => incidentsAPI.listIncidents({ status: statusFilter }),
    refetchInterval: 60000,
  })

  const { data: incidentDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['incident-detail', selectedIncident],
    queryFn: () => incidentsAPI.getIncident(selectedIncident),
    enabled: !!selectedIncident,
  })

  const incidents = data?.data || []
  const detail = incidentDetail?.data

  return (
    <PageWrapper
      title="Incidents"
      subtitle="Security incident management and tracking"
      actions={
        <Button onClick={() => incidentsAPI.detectIncidents()}>
          <Play className="w-4 h-4" />
          Detect New Incidents
        </Button>
      }
    >
      {/* Stacks below lg — side-by-side list+detail on a phone leaves both
          columns too narrow to read. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Incident List */}
        <div className="lg:col-span-1 space-y-3 min-w-0">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <select
              className="input w-full"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {/* Capped-height scroll region only from lg — on mobile a nested
              scroller inside the page scroll is a trap, so it just flows. */}
          <div className="space-y-2 lg:max-h-[720px] lg:overflow-y-auto custom-scrollbar pr-0.5">
            {isLoading && <LoadingState />}
            {error && <ErrorState error={error} onRetry={refetch} />}
            {!isLoading && incidents.length === 0 && (
              <div className="card">
                <EmptyState message="No incidents found" icon={AlertTriangle} />
              </div>
            )}
            {incidents.map((incident) => {
              const isSelected = selectedIncident === incident.id
              return (
                <div
                  key={incident.id}
                  onClick={() => setSelectedIncident(incident.id)}
                  className={`relative pl-4 pr-4 py-3.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-accent-cyan/[0.06] border-accent-cyan/30'
                      : 'bg-bg-secondary border-bg-border hover:border-text-muted/40'
                  }`}
                >
                  {isSelected && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5 rounded-full bg-accent-cyan" />
                  )}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h4 className="font-medium text-sm text-text-primary leading-snug">{incident.title}</h4>
                    <SeverityBadge severity={incident.severity} className="shrink-0" />
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={STATUS_VARIANT[incident.status] || 'muted'} className="capitalize">
                      {incident.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-text-muted">
                    <span className="font-mono">{formatTimestamp(incident.created_at)}</span>
                    <span>{incident.total_events} events · {incident.source_ips?.length || 0} IPs</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Incident Detail */}
        <div className="lg:col-span-2 min-w-0">
          {!selectedIncident && (
            <div className="card flex flex-col items-center justify-center py-24 text-center">
              <div className="w-12 h-12 rounded-full bg-bg-tertiary flex items-center justify-center mb-3">
                <MousePointerClick className="w-5 h-5 text-text-muted" />
              </div>
              <p className="text-sm text-text-secondary">Select an incident to view details</p>
            </div>
          )}

          {selectedIncident && detailLoading && (
            <div className="card">
              <LoadingState />
            </div>
          )}

          {selectedIncident && detail && (
            <div className="space-y-5">
              {/* Header */}
              <div className="card">
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-text-primary mb-1.5">{detail.title}</h2>
                    <p className="text-sm text-text-secondary">{detail.description}</p>
                  </div>
                  <SeverityBadge severity={detail.severity} className="text-sm px-3 py-1.5 shrink-0" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5 border-t border-bg-border">
                  <div>
                    <p className="label-eyebrow mb-1.5">Status</p>
                    <Badge variant={STATUS_VARIANT[detail.status] || 'muted'} className="capitalize">
                      {detail.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="label-eyebrow mb-1.5">Total Events</p>
                    <p className="text-xl font-semibold text-text-primary tabular-nums">
                      {formatNumber(detail.total_events)}
                    </p>
                  </div>
                  <div>
                    <p className="label-eyebrow mb-1.5">Source IPs</p>
                    <p className="text-xl font-semibold text-text-primary tabular-nums">
                      {detail.source_ips?.length || 0}
                    </p>
                  </div>
                  <div>
                    <p className="label-eyebrow mb-1.5">Created</p>
                    <p className="text-sm font-mono text-text-primary pt-1">{formatTimestamp(detail.created_at)}</p>
                  </div>
                </div>
              </div>

              {/* Attack Chain */}
              {detail.attack_chain && detail.attack_chain.length > 0 && (
                <div className="card">
                  <h3 className="label-eyebrow mb-4 flex items-center gap-2">
                    <Network className="w-3.5 h-3.5" />
                    Attack Chain
                  </h3>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {detail.attack_chain.map((step, index) =>
                      step === '---' ? (
                        <div key={index} className="text-text-muted px-1 shrink-0">→</div>
                      ) : (
                        <div
                          key={index}
                          className="bg-bg-tertiary border border-bg-border px-3.5 py-2 rounded-lg text-xs font-medium text-text-primary whitespace-nowrap shrink-0"
                        >
                          {step}
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Involved IPs */}
              {detail.source_ips && detail.source_ips.length > 0 && (
                <div className="card">
                  <h3 className="label-eyebrow mb-4 flex items-center gap-2">
                    <Globe2 className="w-3.5 h-3.5" />
                    Involved IP Addresses
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {detail.source_ips.map((ip, index) => (
                      <div key={index} className="bg-bg-tertiary border border-bg-border px-3.5 py-2.5 rounded-lg">
                        <IPAddress ip={ip} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Report — or, when there isn't one yet, the offer to make
                  it. Report generation used to live only on the AI Analyst
                  page, leaving this panel dead below the fold. */}
              {detail.ai_report ? (
                <div className="card">
                  <h3 className="label-eyebrow mb-4 flex items-center gap-2 text-accent-purple">
                    <Brain className="w-3.5 h-3.5" />
                    AI Analysis
                  </h3>
                  <div className="markdown-content text-sm prose-sm">
                    <ReactMarkdown>{detail.ai_report}</ReactMarkdown>
                  </div>
                </div>
              ) : (
                <div className="card border-accent-purple/20">
                  <h3 className="label-eyebrow mb-4 flex items-center gap-2 text-accent-purple">
                    <Brain className="w-3.5 h-3.5" />
                    AI Analysis
                  </h3>

                  {generating ? (
                    <div className="rounded-xl border border-dashed border-accent-purple/30 bg-accent-purple/[0.04] px-6 py-10 text-center">
                      <Loader2 className="w-6 h-6 text-accent-purple animate-spin mx-auto mb-3" />
                      <p className="text-sm text-text-primary font-medium">Writing the report…</p>
                      <p className="text-xs text-text-muted mt-1">
                        Summarising the attack chain and recommending next steps.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-bg-border px-6 py-9 text-center">
                      <div className="w-11 h-11 rounded-full bg-accent-purple/10 flex items-center justify-center mx-auto mb-3">
                        <Sparkles className="w-5 h-5 text-accent-purple" />
                      </div>
                      <p className="text-sm text-text-primary mb-1">No write-up for this incident yet</p>
                      <p className="text-xs text-text-muted max-w-sm mx-auto leading-relaxed mb-5">
                        Generate an analyst report covering what happened, how the events connect and
                        what to do about it. Costs 1 credit.
                      </p>

                      {reportError && (
                        <div className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/25 rounded-lg px-3 py-2 mb-4 text-left">
                          {reportError}
                        </div>
                      )}

                      {canGenerate ? (
                        <Button onClick={() => generateReport(selectedIncident)}>
                          <Sparkles className="w-4 h-4" />
                          Generate AI report
                        </Button>
                      ) : (
                        <p className="text-xs text-text-muted">
                          Analysts and admins can generate reports.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  )
}
