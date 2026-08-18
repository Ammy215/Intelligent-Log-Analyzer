import { useQuery } from '@tanstack/react-query'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { PieChart as PieChartIcon } from 'lucide-react'
import { analysisAPI } from '@/lib/api'
import LoadingState from '@/components/shared/LoadingState'
import ErrorState from '@/components/shared/ErrorState'
import EmptyState from '@/components/shared/EmptyState'

const COLORS = ['#00d4ff', '#9c74f7', '#ffb800', '#ff3366', '#00ff88', '#8598b3']

export default function EventDistribution() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['event-types'],
    queryFn: analysisAPI.getEventTypes,
    refetchInterval: 30000,
  })

  if (isLoading) {
    return (
      <div className="card p-6">
        <h3 className="label-eyebrow mb-5">Event Distribution</h3>
        <LoadingState />
      </div>
    )
  }

  if (error) {
    return (
      <div className="card p-6">
        <h3 className="label-eyebrow mb-5">Event Distribution</h3>
        <ErrorState error={error} onRetry={refetch} />
      </div>
    )
  }

  const eventData = data?.data || []

  if (eventData.length === 0) {
    return (
      <div className="card p-6">
        <h3 className="label-eyebrow mb-5">Event Distribution</h3>
        <EmptyState message="No event data available" icon={PieChartIcon} />
      </div>
    )
  }

  const chartData = eventData.map((item) => ({
    name: item.event_type || 'Unknown',
    value: item.count,
    percentage: item.percentage,
  }))

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0]
      return (
        <div className="tooltip p-3">
          <p className="text-sm font-semibold mb-1">{data.name}</p>
          <p className="text-xs text-text-secondary">Count: {data.value}</p>
          <p className="text-xs text-text-secondary">
            Percentage: {data.payload.percentage}%
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="card p-6">
      <h3 className="label-eyebrow mb-5">Event Distribution</h3>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Custom Legend — gap-3 and a truncating label keep the event name off
          the count when the card narrows; without it they render flush against
          each other as e.g. "failed_login10". */}
      <div className="mt-4 space-y-2">
        {chartData.slice(0, 6).map((item, index) => (
          <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="text-text-secondary truncate" title={item.name}>{item.name}</span>
            </div>
            <span className="font-mono text-text-primary tabular-nums shrink-0">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
