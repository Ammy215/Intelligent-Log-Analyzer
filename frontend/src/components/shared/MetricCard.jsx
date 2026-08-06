import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { formatNumber } from '@/lib/utils'

export default function MetricCard({
  title,
  value,
  icon: Icon,
  iconColor,
  delta,
  deltaType,
  sparklineData = [],
  index = 0,
}) {
  const isPositive = deltaType === 'positive'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className="card p-6 hover:bg-bg-tertiary transition-colors"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-text-secondary text-sm mb-2">{title}</p>
          <motion.p
            className="text-3xl font-bold"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
          >
            {formatNumber(value)}
          </motion.p>
        </div>
        {Icon && (
          <div className="p-3 rounded-lg" style={{ backgroundColor: `${iconColor}20` }}>
            <Icon className="w-6 h-6" style={{ color: iconColor }} />
          </div>
        )}
      </div>

      {delta !== undefined && delta !== null && (
        <div className="flex items-center gap-2 text-sm">
          {isPositive ? (
            <TrendingUp className="w-4 h-4 text-accent-green" />
          ) : (
            <TrendingDown className="w-4 h-4 text-accent-red" />
          )}
          <span className={isPositive ? 'text-accent-green' : 'text-accent-red'}>
            {Math.abs(delta)}%
          </span>
          <span className="text-text-secondary">vs last 24h</span>
        </div>
      )}

      {sparklineData.length > 0 && (
        <div className="mt-4 h-8 flex items-end gap-0.5">
          {sparklineData.map((val, i) => {
            const maxVal = Math.max(...sparklineData)
            const height = maxVal > 0 ? (val / maxVal) * 100 : 0
            return (
              <div
                key={i}
                className="flex-1 bg-accent-cyan opacity-50 rounded-t"
                style={{ height: `${height}%`, minHeight: '2px' }}
              />
            )
          })}
        </div>
      )}
    </motion.div>
  )
}
