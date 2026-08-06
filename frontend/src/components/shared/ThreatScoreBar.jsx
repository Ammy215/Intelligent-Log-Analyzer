import { getThreatScoreColor } from '@/lib/utils'

export default function ThreatScoreBar({ score, showLabel = true, className = '' }) {
  const safeScore = Math.max(0, Math.min(100, score || 0))
  const color = getThreatScoreColor(safeScore)

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1 bg-bg-tertiary rounded-full h-2 overflow-hidden">
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${safeScore}%`,
            backgroundColor: color,
          }}
        />
      </div>
      {showLabel && (
        <span className="font-mono text-sm font-medium" style={{ color }}>
          {safeScore}
        </span>
      )}
    </div>
  )
}
