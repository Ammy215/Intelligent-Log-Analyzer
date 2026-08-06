import { AlertTriangle, RefreshCw } from 'lucide-react'
import { getErrorMessage } from '@/lib/utils'

export default function ErrorState({ error, onRetry, message }) {
  const errorMsg = message || (error ? getErrorMessage(error) : 'Something went wrong')

  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center space-y-4 max-w-md">
        <AlertTriangle className="w-12 h-12 text-accent-red mx-auto" />
        <h3 className="text-lg font-semibold text-text-primary">Error</h3>
        <p className="text-text-secondary">{errorMsg}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="btn btn-primary inline-flex items-center gap-2 mx-auto"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        )}
      </div>
    </div>
  )
}
