import { useQuery } from '@tanstack/react-query'
import { Activity, AlertTriangle, Users, FileWarning } from 'lucide-react'
import { analysisAPI, logsAPI } from '@/lib/api'
import PageWrapper from '@/components/layout/PageWrapper'
import MetricCard from '@/components/shared/MetricCard'
import LoadingState, { LoadingCard } from '@/components/shared/LoadingState'
import ErrorState from '@/components/shared/ErrorState'
import { COLORS, REFRESH_INTERVALS } from '@/lib/constants'
import AttackTimeline from '@/components/charts/AttackTimeline'
import TopAttackersChart from '@/components/charts/TopAttackersChart'
import EventDistribution from '@/components/charts/EventDistribution'
import RecentCriticalEvents from '@/components/features/RecentCriticalEvents'

export default function Overview() {
  // Fetch summary data
  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ['analysis-summary'],
    queryFn: analysisAPI.getSummary,
    refetchInterval: REFRESH_INTERVALS.OVERVIEW,
  })

  // Fetch recent critical logs
  const {
    data: criticalLogs,
    isLoading: logsLoading,
  } = useQuery({
    queryKey: ['logs-critical'],
    queryFn: () => logsAPI.getLogs({ severity: 'CRITICAL', limit: 10 }),
    refetchInterval: REFRESH_INTERVALS.OVERVIEW,
  })

  if (summaryLoading) {
    return (
      <PageWrapper title="Overview" subtitle="Real-time security monitoring dashboard">
        <div className="grid grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <LoadingCard key={i} />
          ))}
        </div>
        <LoadingState />
      </PageWrapper>
    )
  }

  if (summaryError) {
    return (
      <PageWrapper title="Overview">
        <ErrorState error={summaryError} onRetry={refetchSummary} />
      </PageWrapper>
    )
  }

  // Calculate metrics
  const totalEvents = summary?.total_events || 0
  const criticalAlerts = summary?.critical_alerts || 0
  const uniqueAttackers = summary?.top_sources?.length || 0
  const topSources = summary?.top_sources || []

  // Mock delta values (in production, calculate from historical data)
  const metrics = [
    {
      title: 'Total Events Today',
      value: totalEvents,
      icon: Activity,
      iconColor: COLORS.accent.cyan,
      delta: 12,
      deltaType: 'positive',
    },
    {
      title: 'Critical Alerts',
      value: criticalAlerts,
      icon: AlertTriangle,
      iconColor: COLORS.accent.red,
      delta: -5,
      deltaType: 'negative',
    },
    {
      title: 'Unique Attackers',
      value: uniqueAttackers,
      icon: Users,
      iconColor: COLORS.accent.amber,
      delta: 8,
      deltaType: 'positive',
    },
    {
      title: 'Active Incidents',
      value: 0, // Will be populated from incidents API
      icon: FileWarning,
      iconColor: COLORS.accent.purple,
      delta: 0,
      deltaType: 'neutral',
    },
  ]

  return (
    <PageWrapper
      title="Overview"
      subtitle="Real-time security monitoring dashboard"
    >
      {/* Metric Cards Row */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        {metrics.map((metric, index) => (
          <MetricCard key={metric.title} {...metric} index={index} />
        ))}
      </div>

      {/* Attack Timeline - Full Width */}
      <div className="mb-8">
        <AttackTimeline />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        {/* Top Attackers - 2 columns */}
        <div className="col-span-2">
          <TopAttackersChart topSources={topSources} />
        </div>

        {/* Event Distribution - 1 column */}
        <div className="col-span-1">
          <EventDistribution />
        </div>
      </div>

      {/* Recent Critical Events Table */}
      <RecentCriticalEvents logs={criticalLogs?.data || []} isLoading={logsLoading} />
    </PageWrapper>
  )
}
