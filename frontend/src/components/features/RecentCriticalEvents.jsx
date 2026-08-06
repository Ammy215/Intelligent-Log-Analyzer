import { useNavigate } from 'react-router-dom'
import { formatTimestamp } from '@/lib/utils'
import SeverityBadge from '@/components/shared/SeverityBadge'
import IPAddress from '@/components/shared/IPAddress'
import ThreatScoreBar from '@/components/shared/ThreatScoreBar'
import CountryFlag from '@/components/shared/CountryFlag'
import { LoadingTable } from '@/components/shared/LoadingState'
import EmptyState from '@/components/shared/EmptyState'
import { Search } from 'lucide-react'

export default function RecentCriticalEvents({ logs = [], isLoading }) {
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Critical Events</h3>
        <LoadingTable rows={5} />
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Critical Events</h3>
        <EmptyState message="No critical events found" />
      </div>
    )
  }

  const handleInvestigate = (ip) => {
    navigate(`/ip-intelligence/${ip}`)
  }

  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold mb-4">Recent Critical Events</h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-bg-border text-left">
              <th className="py-3 px-4 text-text-secondary text-sm font-medium">Timestamp</th>
              <th className="py-3 px-4 text-text-secondary text-sm font-medium">Source IP</th>
              <th className="py-3 px-4 text-text-secondary text-sm font-medium">Event Type</th>
              <th className="py-3 px-4 text-text-secondary text-sm font-medium">Severity</th>
              <th className="py-3 px-4 text-text-secondary text-sm font-medium">Country</th>
              <th className="py-3 px-4 text-text-secondary text-sm font-medium">Threat Score</th>
              <th className="py-3 px-4 text-text-secondary text-sm font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log, index) => (
              <tr
                key={log._id || index}
                className="border-b border-bg-border hover:bg-bg-tertiary transition-colors"
              >
                <td className="py-3 px-4 text-sm font-mono">
                  {formatTimestamp(log.timestamp)}
                </td>
                <td className="py-3 px-4">
                  <IPAddress ip={log.source_ip} />
                </td>
                <td className="py-3 px-4 text-sm">{log.event_type || 'Unknown'}</td>
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
                  <ThreatScoreBar score={log.threat_score || 0} className="w-32" />
                </td>
                <td className="py-3 px-4">
                  <button
                    onClick={() => handleInvestigate(log.source_ip)}
                    className="btn btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1"
                  >
                    <Search className="w-3.5 h-3.5" />
                    Investigate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
