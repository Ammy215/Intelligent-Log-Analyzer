import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Play } from 'lucide-react'
import { incidentsAPI } from '@/lib/api'
import PageWrapper from '@/components/layout/PageWrapper'
import SeverityBadge from '@/components/shared/SeverityBadge'
import { formatTimestamp, formatNumber } from '@/lib/utils'
import LoadingState from '@/components/shared/LoadingState'
import EmptyState from '@/components/shared/EmptyState'
import ErrorState from '@/components/shared/ErrorState'
import { STATUS_COLORS } from '@/lib/constants'

export default function Incidents() {
  const [selectedIncident, setSelectedIncident] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')

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

  return (
    <PageWrapper
      title="Incidents"
      subtitle="Security incident management and tracking"
      actions={
        <button
          onClick={() => incidentsAPI.detectIncidents()}
          className="btn btn-primary"
        >
          <Play className="w-4 h-4 mr-2" />
          Detect New Incidents
        </button>
      }
    >
      <div className="grid grid-cols-3 gap-6">
        {/* Incident List */}
        <div className="col-span-1 space-y-4">
          {/* Status Filter */}
          <div className="card p-4">
            <select
              className="input w-full"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {/* Incident Cards */}
          <div className="space-y-3 max-h-[700px] overflow-y-auto custom-scrollbar">
            {isLoading && <LoadingState />}
            {error && <ErrorState error={error} onRetry={refetch} />}
            {!isLoading && incidents.length === 0 && (
              <EmptyState message="No incidents found" icon={AlertTriangle} />
            )}
            {incidents.map((incident) => {
              const statusColor = STATUS_COLORS[incident.status] || STATUS_COLORS.open
              return (
                <div
                  key={incident.id}
                  onClick={() => setSelectedIncident(incident.id)}
                  className={`card p-4 cursor-pointer transition-all hover:border-accent-cyan ${
                    selectedIncident === incident.id
                      ? 'border-accent-cyan bg-bg-tertiary'
                      : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-sm">{incident.title}</h4>
                    <SeverityBadge severity={incident.severity} />
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-xs px-2 py-1 rounded border"
                      style={{
                        backgroundColor: statusColor.bg,
                        color: statusColor.text,
                        borderColor: statusColor.border,
                      }}
                    >
                      {incident.status}
                    </span>
                  </div>
                  <div className="text-xs text-text-secondary space-y-1">
                    <p>{formatTimestamp(incident.created_at)}</p>
                    <p>
                      {incident.total_events} events • {incident.source_ips?.length || 0}{' '}
                      IPs
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Incident Detail */}
        <div className="col-span-2">
          {!selectedIncident && (
            <div className="card p-12 text-center">
              <AlertTriangle className="w-16 h-16 text-text-muted mx-auto mb-4" />
              <p className="text-text-secondary">
                Select an incident to view details
              </p>
            </div>
          )}

          {selectedIncident && detailLoading && (
            <div className="card p-6">
              <LoadingState />
            </div>
          )}

          {selectedIncident && incidentDetail?.data && (
            <div className="space-y-6">
              {/* Header */}
              <div className="card p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h2 className="text-2xl font-semibold mb-2">
                      {incidentDetail.data.title}
                    </h2>
                    <p className="text-text-secondary">
                      {incidentDetail.data.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <SeverityBadge
                      severity={incidentDetail.data.severity}
                      className="text-base px-4 py-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-text-secondary text-sm mb-1">Status</p>
                    <p className="font-semibold">{incidentDetail.data.status}</p>
                  </div>
                  <div>
                    <p className="text-text-secondary text-sm mb-1">Total Events</p>
                    <p className="font-semibold text-xl">
                      {formatNumber(incidentDetail.data.total_events)}
                    </p>
                  </div>
                  <div>
                    <p className="text-text-secondary text-sm mb-1">Source IPs</p>
                    <p className="font-semibold text-xl">
                      {incidentDetail.data.source_ips?.length || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-text-secondary text-sm mb-1">Created</p>
                    <p className="font-semibold text-sm">
                      {formatTimestamp(incidentDetail.data.created_at)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Attack Chain */}
              {incidentDetail.data.attack_chain &&
                incidentDetail.data.attack_chain.length > 0 && (
                  <div className="card p-6">
                    <h3 className="font-semibold mb-4">Attack Chain</h3>
                    <div className="flex items-center gap-3 overflow-x-auto pb-2">
                      {incidentDetail.data.attack_chain.map((step, index) => (
                        <div key={index}>
                          {step === '---' ? (
                            <div className="text-text-muted px-3">→</div>
                          ) : (
                            <div className="bg-bg-tertiary px-4 py-2 rounded-lg text-sm whitespace-nowrap">
                              {step}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Involved IPs */}
              {incidentDetail.data.source_ips &&
                incidentDetail.data.source_ips.length > 0 && (
                  <div className="card p-6">
                    <h3 className="font-semibold mb-4">Involved IP Addresses</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {incidentDetail.data.source_ips.map((ip, index) => (
                        <div
                          key={index}
                          className="bg-bg-tertiary p-3 rounded-lg font-mono text-sm"
                        >
                          {ip}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* AI Report */}
              {incidentDetail.data.ai_report && (
                <div className="card p-6">
                  <h3 className="font-semibold mb-4">AI Analysis</h3>
                  <p className="text-text-secondary whitespace-pre-wrap">
                    {incidentDetail.data.ai_report}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  )
}
