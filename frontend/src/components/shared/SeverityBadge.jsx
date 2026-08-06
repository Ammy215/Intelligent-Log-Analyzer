import { getSeverityColor } from '@/lib/utils'

export default function SeverityBadge({ severity, className = '' }) {
  if (!severity) return null

  const colors = getSeverityColor(severity)

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${className} ${
        severity === 'CRITICAL' ? 'pulse-critical' : ''
      }`}
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        borderColor: colors.border,
      }}
    >
      {severity}
    </span>
  )
}
