export function LoadingSkeleton({ className = '' }) {
  return (
    <div className={`shimmer rounded-lg ${className}`} style={{ minHeight: '20px' }} />
  )
}

export function LoadingCard() {
  return (
    <div className="card p-6 space-y-4">
      <LoadingSkeleton className="h-6 w-1/3" />
      <LoadingSkeleton className="h-4 w-2/3" />
      <LoadingSkeleton className="h-4 w-1/2" />
    </div>
  )
}

export function LoadingTable({ rows = 5 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <LoadingSkeleton key={i} className="h-12" />
      ))}
    </div>
  )
}

export default function LoadingState({ message = 'Loading...', fullscreen = false }) {
  if (fullscreen) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-accent-cyan border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-text-secondary">{message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-4 border-accent-cyan border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-text-secondary">{message}</p>
      </div>
    </div>
  )
}
