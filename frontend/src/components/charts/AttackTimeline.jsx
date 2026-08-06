import { useQuery } from '@tanstack/react-query'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { analysisAPI } from '@/lib/api'
import { CHART_COLORS, REFRESH_INTERVALS } from '@/lib/constants'
import LoadingState from '@/components/shared/LoadingState'
import ErrorState from '@/components/shared/ErrorState'

export default function AttackTimeline() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['timeline', 'hour', 1],
    queryFn: () => analysisAPI.getTimeline('hour', 1),
    refetchInterval: REFRESH_INTERVALS.OVERVIEW,
  })

  if (isLoading) {
    return (
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4">Attack Timeline (Last 24 Hours)</h3>
        <LoadingState />
      </div>
    )
  }

  if (error) {
    return (
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4">Attack Timeline (Last 24 Hours)</h3>
        <ErrorState error={error} onRetry={refetch} />
      </div>
    )
  }

  const chartData = data?.data || []

  // Transform data for the chart
  const formattedData = chartData.map((item) => ({
    time: item.timestamp.split(' ')[1] || item.timestamp, // Extract time part
    CRITICAL: item.critical || 0,
    HIGH: item.total_events - item.critical - item.high || 0,
    total: item.total_events,
  }))

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="tooltip p-3">
          <p className="text-sm font-semibold mb-2">{label}</p>
          {payload.map((entry) => (
            <p key={entry.name} className="text-xs" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold mb-4">Attack Timeline (Last 24 Hours)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a2d4a" opacity={0.5} />
          <XAxis
            dataKey="time"
            stroke="#64748b"
            tick={{ fill: '#64748b', fontSize: 12 }}
            tickLine={false}
          />
          <YAxis
            stroke="#64748b"
            tick={{ fill: '#64748b', fontSize: 12 }}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="circle"
            formatter={(value) => <span className="text-sm">{value}</span>}
          />
          <Area
            type="monotone"
            dataKey="CRITICAL"
            stackId="1"
            stroke={CHART_COLORS.CRITICAL}
            fill={CHART_COLORS.CRITICAL}
            fillOpacity={0.6}
          />
          <Area
            type="monotone"
            dataKey="HIGH"
            stackId="1"
            stroke={CHART_COLORS.HIGH}
            fill={CHART_COLORS.HIGH}
            fillOpacity={0.6}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
