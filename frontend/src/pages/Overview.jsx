import { useQuery } from '@tanstack/react-query'
import { Activity, AlertTriangle, Users, FileWarning, CreditCard } from 'lucide-react'
import { analysisAPI, logsAPI, incidentsAPI, billingAPI } from '@/lib/api'
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

  // Fetch open incident count
  const { data: openIncidents } = useQuery({
    queryKey: ['incidents-open-count'],
    queryFn: () => incidentsAPI.listIncidents({ status: 'open' }),
    refetchInterval: REFRESH_INTERVALS.OVERVIEW,
  })

  // Fetch credit balance
  const { data: credits } = useQuery({
    queryKey: ['billing-credits'],
    queryFn: billingAPI.getCredits,
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

  // Delta values aren't computed from historical data yet — omitted (0/neutral)
  // rather than faked, since there's no trend baseline to compare against.
  // Color is reserved for what's actually alarming (critical alerts) —
  // every other metric stays neutral so the one that matters still stands out.
  const metrics = [
    {
      title: 'Total Events Today',
      value: totalEvents,
      icon: Activity,
      delta: null,
      deltaType: 'neutral',
    },
    {
      title: 'Critical Alerts',
      value: criticalAlerts,
      icon: AlertTriangle,
      iconColor: COLORS.accent.red,
      emphasis: criticalAlerts > 0,
      delta: null,
      deltaType: 'neutral',
    },
    {
      title: 'Unique Attackers',
      value: uniqueAttackers,
      icon: Users,
      delta: null,
      deltaType: 'neutral',
    },
    {
      title: 'Active Incidents',
      value: openIncidents?.total_count ?? 0,
      icon: FileWarning,
      iconColor: COLORS.accent.amber,
      emphasis: (openIncidents?.total_count ?? 0) > 0,
      delta: null,
      deltaType: 'neutral',
    },
    {
      title: 'Credit Balance',
      value: credits?.total_available ?? 0,
      icon: CreditCard,
      delta: null,
      deltaType: 'neutral',
    },
  ]

  return (
    <PageWrapper
      title="Overview"
      subtitle="Real-time security monitoring dashboard"
    >
      {/* Metric Cards Row */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {metrics.map((metric, index) => (
          <MetricCard key={metric.title} {...metric} index={index} />
        ))}
      </div>

      {/* Attack Timeline - Full Width */}
      <div className="mb-6">
        <AttackTimeline />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-3 gap-6 mb-6">
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
