import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Users } from 'lucide-react'
import { getThreatScoreColor } from '@/lib/utils'
import IPAddress from '@/components/shared/IPAddress'
import EmptyState from '@/components/shared/EmptyState'

export default function TopAttackersChart({ topSources = [] }) {
  const navigate = useNavigate()

  if (topSources.length === 0) {
    return (
      <div className="card p-6">
        <h3 className="label-eyebrow mb-5">Top Attackers</h3>
        <EmptyState message="No attacker data available" icon={Users} />
      </div>
    )
  }

  // Format data for chart
  const chartData = topSources.map((source) => ({
    ip: source.ip,
    count: source.count,
    // Use a default threat score if not provided
    threatScore: source.max_threat_score || 50,
  }))

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="tooltip p-3">
          <IPAddress ip={data.ip} showCopy={false} className="font-semibold mb-2" />
          <p className="text-xs text-text-secondary">Events: {data.count}</p>
          <p className="text-xs text-text-secondary">Threat Score: {data.threatScore}</p>
        </div>
      )
    }
    return null
  }

  const handleBarClick = (data) => {
    navigate(`/ip-intelligence/${data.ip}`)
  }

  return (
    <div className="card p-6">
      <h3 className="label-eyebrow mb-5">Top Attackers</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#1a2d4a" opacity={0.5} />
          <XAxis
            type="number"
            stroke="#8598b3"
            tick={{ fill: '#8598b3', fontSize: 12 }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="ip"
            stroke="#8598b3"
            tick={{ fill: '#8598b3', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
            tickLine={false}
            width={120}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
          <Bar
            dataKey="count"
            radius={[0, 4, 4, 0]}
            onClick={handleBarClick}
            cursor="pointer"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getThreatScoreColor(entry.threatScore)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-text-muted mt-4">Click any bar to view full IP profile</p>
    </div>
  )
}
