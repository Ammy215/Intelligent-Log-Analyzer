import { useNavigate } from 'react-router-dom'
import { formatTimestamp } from '@/lib/utils'
import SeverityBadge from '@/components/shared/SeverityBadge'
import IPAddress from '@/components/shared/IPAddress'
import ThreatScoreBar from '@/components/shared/ThreatScoreBar'
import CountryFlag from '@/components/shared/CountryFlag'
import { LoadingTable } from '@/components/shared/LoadingState'
import EmptyState from '@/components/shared/EmptyState'
import Button from '@/components/ui/Button'
import { Search } from 'lucide-react'

export default function RecentCriticalEvents({ logs = [], isLoading }) {
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <div className="card p-6">
        <h3 className="label-eyebrow mb-5">Recent Critical Events</h3>
        <LoadingTable rows={5} />
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="card p-6">
        <h3 className="label-eyebrow mb-5">Recent Critical Events</h3>
        <EmptyState message="No critical events found" />
      </div>
    )
  }

  const handleInvestigate = (ip) => {
    navigate(`/ip-intelligence/${ip}`)
  }

  return (
    <div className="card p-6">
      <h3 className="label-eyebrow mb-5">Recent Critical Events</h3>
      <div className="overflow-x-auto -mx-6">
        <table className="w-full">
          <thead>
            <tr className="border-b border-bg-border text-left">
              <th className="py-2.5 px-6 text-text-muted text-[11px] font-semibold uppercase tracking-wider">Timestamp</th>
              <th className="py-2.5 px-4 text-text-muted text-[11px] font-semibold uppercase tracking-wider">Source IP</th>
              <th className="py-2.5 px-4 text-text-muted text-[11px] font-semibold uppercase tracking-wider">Event Type</th>
              <th className="py-2.5 px-4 text-text-muted text-[11px] font-semibold uppercase tracking-wider">Severity</th>
              <th className="py-2.5 px-4 text-text-muted text-[11px] font-semibold uppercase tracking-wider">Country</th>
              <th className="py-2.5 px-4 text-text-muted text-[11px] font-semibold uppercase tracking-wider">Threat Score</th>
              <th className="py-2.5 px-6 text-text-muted text-[11px] font-semibold uppercase tracking-wider text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log, index) => (
              <tr
                key={log._id || index}
                className="border-b border-bg-border last:border-0 hover:bg-bg-tertiary/60 transition-colors"
              >
                <td className="py-3 px-6 text-xs font-mono text-text-secondary whitespace-nowrap">
                  {formatTimestamp(log.timestamp)}
                </td>
                <td className="py-3 px-4">
                  <IPAddress ip={log.source_ip} />
                </td>
                <td className="py-3 px-4 text-sm text-text-primary">{log.event_type || 'Unknown'}</td>
                <td className="py-3 px-4">
                  <SeverityBadge severity={log.severity} />
                </td>
                <td className="py-3 px-4">
                  {log.geo?.country ? (
                    <CountryFlag
                      countryCode={log.geo.country_code}
                      countryName={log.geo.country}
                    />
                  ) : (
                    <span className="text-text-muted text-sm">N/A</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <ThreatScoreBar score={log.threat_score || 0} className="w-28" />
                </td>
                <td className="py-3 px-6 text-right">
                  <Button variant="secondary" size="sm" onClick={() => handleInvestigate(log.source_ip)}>
                    <Search className="w-3.5 h-3.5" />
                    Investigate
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
