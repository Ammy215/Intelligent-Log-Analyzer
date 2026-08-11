import Badge from '@/components/ui/Badge'

const VARIANT_BY_SEVERITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  SAFE: 'safe',
}

export default function SeverityBadge({ severity, className = '' }) {
  if (!severity) return null

  return (
    <Badge
      variant={VARIANT_BY_SEVERITY[severity] || 'muted'}
      pulse={severity === 'CRITICAL'}
      className={className}
    >
      {severity}
    </Badge>
  )
}
