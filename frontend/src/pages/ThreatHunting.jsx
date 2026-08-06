import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Download, Filter } from 'lucide-react'
import { logsAPI } from '@/lib/api'
import PageWrapper from '@/components/layout/PageWrapper'
import SeverityBadge from '@/components/shared/SeverityBadge'
import IPAddress from '@/components/shared/IPAddress'
import ThreatScoreBar from '@/components/shared/ThreatScoreBar'
import { formatTimestamp } from '@/lib/utils'
import LoadingState from '@/components/shared/LoadingState'
import EmptyState from '@/components/shared/EmptyState'

export default function ThreatHunting() {
  const [filters, setFilters] = useState({
    source_ip: '',
    severity: '',
    event_type: '',
    page: 1,
    limit: 50,
  })

  const [appliedFilters, setAppliedFilters] = useState(filters)

  const { data, isLoading } = useQuery({
    queryKey: ['logs', appliedFilters],
    queryFn: () => logsAPI.getLogs(appliedFilters),
  })

  const handleApplyFilters = () => {
    setAppliedFilters({ ...filters, page: 1 })
  }

  const handleClearFilters = () => {
    const cleared = {
      source_ip: '',
      severity: '',
      event_type: '',
      page: 1,
      limit: 50,
    }
    setFilters(cleared)
    setAppliedFilters(cleared)
  }

  const logs = data?.data || []
  const totalCount = data?.total_count || 0

  return (
    <PageWrapper
      title="Threat Hunting"
      subtitle="Deep log investigation with advanced filtering"
      actions={
        <button className="btn btn-primary">
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </button>
      }
    >
      {/* Filter Panel */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-accent-cyan" />
          <h3 className="text-lg font-semibold">Filters</h3>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-4">
          <input
            type="text"
            placeholder="IP Address"
            className="input"
            value={filters.source_ip}
            onChange={(e) => setFilters({ ...filters, source_ip: e.target.value })}
          />

          <select
            className="input"
            value={filters.severity}
            onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
          >
            <option value="">All Severities</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>

          <select
            className="input"
            value={filters.event_type}
            onChange={(e) => setFilters({ ...filters, event_type: e.target.value })}
          >
            <option value="">All Event Types</option>
            <option value="failed_login">Failed Login</option>
            <option value="brute_force">Brute Force</option>
            <option value="port_scan">Port Scan</option>
            <option value="sql_injection">SQL Injection</option>
          </select>

          <select
            className="input"
            value={filters.limit}
            onChange={(e) => setFilters({ ...filters, limit: parseInt(e.target.value) })}
          >
            <option value="25">25 per page</option>
            <option value="50">50 per page</option>
            <option value="100">100 per page</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handleApplyFilters} className="btn btn-primary">
            <Search className="w-4 h-4 mr-2" />
            Apply Filters
          </button>
          <button onClick={handleClearFilters} className="btn btn-secondary">
            Clear All
          </button>
          <span className="text-text-secondary ml-auto">
            Results: {totalCount} logs
          </span>
        </div>
      </div>

      {/* Results Table */}
      <div className="card p-6">
        {isLoading ? (
          <LoadingState />
        ) : logs.length === 0 ? (
          <EmptyState message="No logs match your filters" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-bg-border text-left">
                    <th className="py-3 px-4 text-text-secondary text-sm font-medium">
                      Timestamp
                    </th>
                    <th className="py-3 px-4 text-text-secondary text-sm font-medium">
                      Source IP
                    </th>
                    <th className="py-3 px-4 text-text-secondary text-sm font-medium">
                      Event Type
                    </th>
                    <th className="py-3 px-4 text-text-secondary text-sm font-medium">
                      Severity
                    </th>
                    <th className="py-3 px-4 text-text-secondary text-sm font-medium">
                      Username
                    </th>
                    <th className="py-3 px-4 text-text-secondary text-sm font-medium">
                      Threat Score
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr
                      key={log._id}
                      className="border-b border-bg-border hover:bg-bg-tertiary transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 text-sm font-mono">
                        {formatTimestamp(log.timestamp)}
                      </td>
                      <td className="py-3 px-4">
                        <IPAddress ip={log.source_ip} />
                      </td>
                      <td className="py-3 px-4 text-sm">{log.event_type}</td>
                      <td className="py-3 px-4">
                        <SeverityBadge severity={log.severity} />
                      </td>
                      <td className="py-3 px-4 text-sm font-mono">
                        {log.username || 'N/A'}
                      </td>
                      <td className="py-3 px-4">
                        <ThreatScoreBar score={log.threat_score || 0} className="w-32" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-6">
              <button
                onClick={() =>
                  setAppliedFilters({ ...appliedFilters, page: appliedFilters.page - 1 })
                }
                disabled={appliedFilters.page === 1}
                className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-text-secondary">
                Page {appliedFilters.page} of {Math.ceil(totalCount / appliedFilters.limit)}
              </span>
              <button
                onClick={() =>
                  setAppliedFilters({ ...appliedFilters, page: appliedFilters.page + 1 })
                }
                disabled={appliedFilters.page >= Math.ceil(totalCount / appliedFilters.limit)}
                className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </PageWrapper>
  )
}
