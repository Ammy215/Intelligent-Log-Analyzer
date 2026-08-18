import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FileText, Sparkles, ArrowRight, Brain } from 'lucide-react'
import { incidentsAPI } from '@/lib/api'
import PageWrapper from '@/components/layout/PageWrapper'
import SeverityBadge from '@/components/shared/SeverityBadge'
import LoadingState from '@/components/shared/LoadingState'
import ErrorState from '@/components/shared/ErrorState'
import Button from '@/components/ui/Button'
import { formatTimestamp } from '@/lib/utils'

// This page was a "coming soon" placeholder in a card that filled ~40% of the
// viewport and left the rest empty. The reports it was describing already
// exist — every incident that has been through the AI Analyst carries one —
// so it now lists them for real instead of promising them.
export default function Reports() {
  const navigate = useNavigate()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['incidents', ''],
    queryFn: () => incidentsAPI.listIncidents({}),
  })

  const incidents = data?.data || []
  const withReports = useMemo(() => incidents.filter((i) => i.has_report), [incidents])
  const withoutReports = useMemo(() => incidents.filter((i) => !i.has_report), [incidents])

  if (isLoading) {
    return (
      <PageWrapper title="Reports" subtitle="Generated security analysis reports">
        <LoadingState />
      </PageWrapper>
    )
  }

  if (error) {
    return (
      <PageWrapper title="Reports" subtitle="Generated security analysis reports">
        <ErrorState error={error} onRetry={refetch} />
      </PageWrapper>
    )
  }

  return (
    <PageWrapper title="Reports" subtitle="Generated security analysis reports">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Generated reports */}
        <div className="lg:col-span-2 min-w-0">
          <div className="card p-6">
            <div className="flex items-center justify-between gap-4 mb-5">
              <h3 className="label-eyebrow flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" />
                Generated reports
              </h3>
              {withReports.length > 0 && (
                <span className="text-xs text-text-muted tabular-nums">
                  {withReports.length} {withReports.length === 1 ? 'report' : 'reports'}
                </span>
              )}
            </div>

            {withReports.length === 0 ? (
              <div className="rounded-xl border border-dashed border-bg-border px-6 py-12 text-center">
                <div className="w-11 h-11 rounded-full bg-bg-tertiary flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-5 h-5 text-text-muted" />
                </div>
                <p className="text-sm text-text-primary mb-1">No reports written yet</p>
                <p className="text-xs text-text-muted max-w-sm mx-auto leading-relaxed mb-5">
                  {incidents.length > 0
                    ? `You have ${incidents.length} ${incidents.length === 1 ? 'incident' : 'incidents'} on record. Generate a write-up on any of them and it will be listed here.`
                    : 'Once incidents are detected and analysed, their write-ups collect here.'}
                </p>
                <Button variant="secondary" onClick={() => navigate('/incidents')}>
                  Go to Incidents
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {withReports.map((inc) => (
                  <li key={inc.id}>
                    <button
                      onClick={() => navigate('/incidents')}
                      className="w-full text-left card-interactive p-4 flex items-start justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5 mb-1.5">
                          <Brain className="w-3.5 h-3.5 text-accent-purple shrink-0" />
                          <span className="text-sm font-medium text-text-primary truncate">
                            {inc.title}
                          </span>
                        </div>
                        <p className="text-xs text-text-muted">
                          <span className="font-mono">{formatTimestamp(inc.created_at)}</span>
                          {" · "}{inc.total_events} events
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <SeverityBadge severity={inc.severity} />
                        <ArrowRight className="w-4 h-4 text-text-muted" />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Side column: what's still un-analysed, and how to add to this list */}
        <div className="lg:col-span-1 min-w-0 space-y-6">
          <div className="card p-6">
            <h3 className="label-eyebrow mb-4 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-accent-purple" />
              Awaiting analysis
            </h3>
            {withoutReports.length === 0 ? (
              <p className="text-sm text-text-secondary">
                {incidents.length > 0
                  ? 'Every incident on record has a write-up.'
                  : 'No incidents detected yet.'}
              </p>
            ) : (
              <>
                <p className="text-3xl font-semibold text-text-primary tabular-nums mb-1">
                  {withoutReports.length}
                </p>
                <p className="text-xs text-text-secondary leading-relaxed mb-5">
                  {withoutReports.length === 1 ? 'incident has' : 'incidents have'} no write-up yet.
                  Each report costs 1 credit.
                </p>
                <Button variant="secondary" className="w-full" onClick={() => navigate('/incidents')}>
                  Review incidents
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>

          <div className="card p-6">
            <h3 className="label-eyebrow mb-3">How reports are made</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              Open an incident and generate an analyst write-up covering the attack chain, impact and
              recommended remediation. Reports are stored with the incident, so this list stays in step
              with it.
            </p>
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
