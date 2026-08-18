import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Pause, Play, Trash2 } from 'lucide-react'
import { logsAPI } from '@/lib/api'
import PageWrapper from '@/components/layout/PageWrapper'
import SeverityBadge from '@/components/shared/SeverityBadge'
import IPAddress from '@/components/shared/IPAddress'
import LogUpload from '@/components/features/LogUpload'
import { formatTimestamp } from '@/lib/utils'
import { REFRESH_INTERVALS } from '@/lib/constants'

export default function LiveFeed() {
  const [isPaused, setIsPaused] = useState(false)
  const [logs, setLogs] = useState([])
  const [newLogsCount, setNewLogsCount] = useState(0)
  const feedRef = useRef(null)
  const [autoScroll, setAutoScroll] = useState(true)

  // Fetch logs with auto-refresh
  const { data } = useQuery({
    queryKey: ['logs-live'],
    queryFn: () => logsAPI.getLogs({ limit: 100, page: 1 }),
    refetchInterval: isPaused ? false : REFRESH_INTERVALS.LIVE_FEED,
    enabled: !isPaused,
  })

  useEffect(() => {
    if (data?.data) {
      const newLogs = data.data

      if (isPaused) {
        // Count new logs while paused
        setNewLogsCount((prev) => prev + newLogs.length)
      } else {
        // Update logs
        setLogs((prevLogs) => {
          const combined = [...newLogs, ...prevLogs]
          return combined.slice(0, 500) // Keep max 500 logs in memory
        })

        // Auto-scroll to bottom if enabled
        if (autoScroll && feedRef.current) {
          setTimeout(() => {
            feedRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
          }, 100)
        }
      }
    }
  }, [data, isPaused, autoScroll])

  const handleTogglePause = () => {
    if (isPaused) {
      setNewLogsCount(0)
    }
    setIsPaused(!isPaused)
  }

  const handleClearFeed = () => {
    setLogs([])
    setNewLogsCount(0)
  }

  const getSeverityStyle = (severity) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-accent-red/10 border-l-4 border-accent-red'
      case 'HIGH':
        return 'bg-accent-amber/10 border-l-4 border-accent-amber'
      case 'MEDIUM':
        return 'bg-accent-cyan/10 border-l-4 border-accent-cyan'
      default:
        return 'bg-bg-tertiary/50'
    }
  }

  return (
    <PageWrapper
      title="Live Feed"
      subtitle="Real-time log stream"
      actions={
        <>
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className="btn btn-secondary"
          >
            Auto-scroll: {autoScroll ? 'ON' : 'OFF'}
          </button>
          <button onClick={handleTogglePause} className="btn btn-secondary">
            {isPaused ? (
              <>
                <Play className="w-4 h-4 mr-2" />
                Resume
              </>
            ) : (
              <>
                <Pause className="w-4 h-4 mr-2" />
                Pause
              </>
            )}
          </button>
          <button onClick={handleClearFeed} className="btn btn-secondary">
            <Trash2 className="w-4 h-4 mr-2" />
            Clear
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card p-4 sm:p-6">
          <p className="text-text-secondary text-sm mb-1">Events per Second</p>
          <p className="text-2xl font-bold">{logs.length > 0 ? '~2.5' : '0'}</p>
        </div>
        <div className="card p-4 sm:p-6">
          <p className="text-text-secondary text-sm mb-1">Total in Feed</p>
          <p className="text-2xl font-bold">{logs.length}</p>
        </div>
        <div className="card p-4 sm:p-6">
          <p className="text-text-secondary text-sm mb-1">Status</p>
          <p className="text-lg font-semibold">
            {isPaused ? (
              <span className="text-accent-amber">Paused</span>
            ) : (
              <span className="text-accent-green">Live</span>
            )}
          </p>
        </div>
        <div className="card p-4 sm:p-6">
          <p className="text-text-secondary text-sm mb-1">New While Paused</p>
          <p className="text-2xl font-bold text-accent-cyan">{newLogsCount}</p>
        </div>
      </div>

      {/* Upload — the only entry point in the app for getting log files in */}
      <div className="mb-6">
        <LogUpload />
      </div>

      {/* Log Stream */}
      <div className="card p-4 sm:p-6">
        <h3 className="label-eyebrow mb-4">Log Stream</h3>
        <div
          ref={feedRef}
          className="bg-bg-primary rounded-lg p-4 h-[600px] overflow-y-auto custom-scrollbar font-mono text-sm space-y-2"
        >
          {logs.length === 0 ? (
            <div className="text-center text-text-muted py-12">
              Waiting for log events...
            </div>
          ) : (
            logs.map((log, index) => (
              <div
                key={`${log._id}-${index}`}
                className={`p-3 rounded transition-all ${getSeverityStyle(log.severity)}`}
              >
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="text-text-secondary">
                    {formatTimestamp(log.timestamp).split(' ')[1] || formatTimestamp(log.timestamp)}
                  </span>
                  <SeverityBadge severity={log.severity} />
                  <IPAddress ip={log.source_ip} showCopy={false} />
                  <span className="text-text-primary">{log.event_type}</span>
                  {log.username && (
                    <span className="text-accent-amber">{log.username}</span>
                  )}
                  {log.target_service && (
                    <span className="text-accent-cyan">{log.target_service}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </PageWrapper>
  )
}
