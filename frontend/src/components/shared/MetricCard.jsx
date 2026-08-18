import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { formatNumber } from '@/lib/utils'

export default function MetricCard({
  title,
  value,
  icon: Icon,
  iconColor,
  emphasis = false,
  delta,
  deltaType,
  sparklineData = [],
  index = 0,
}) {
  const isPositive = deltaType === 'positive'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
      className="card p-6 hover:border-text-muted/40 transition-colors"
    >
      <div className="flex items-start justify-between mb-3">
        <p className="label-eyebrow">{title}</p>
        {Icon && (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{
              backgroundColor: emphasis ? `${iconColor}18` : 'rgba(255,255,255,0.04)',
            }}
          >
            <Icon className="w-4 h-4" style={{ color: emphasis ? iconColor : '#8598b3' }} strokeWidth={1.75} />
          </div>
        )}
      </div>

      <p className="text-[28px] leading-none font-semibold text-text-primary tabular-nums">
        {formatNumber(value)}
      </p>

      {delta !== undefined && delta !== null && (
        <div className="flex items-center gap-1.5 text-xs mt-3">
          {isPositive ? (
            <TrendingUp className="w-3.5 h-3.5 text-accent-green" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-accent-red" />
          )}
          <span className={isPositive ? 'text-accent-green' : 'text-accent-red'}>
            {Math.abs(delta)}%
          </span>
          <span className="text-text-muted">vs last 24h</span>
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
                className="flex-1 bg-accent-cyan opacity-40 rounded-t"
                style={{ height: `${height}%`, minHeight: '2px' }}
              />
            )
          })}
        </div>
      )}
    </motion.div>
  )
}
