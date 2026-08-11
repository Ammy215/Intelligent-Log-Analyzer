import { AlertTriangle, RefreshCw } from 'lucide-react'
import { getErrorMessage } from '@/lib/utils'
import Button from '@/components/ui/Button'

export default function ErrorState({ error, onRetry, message }) {
  const errorMsg = message || (error ? getErrorMessage(error) : 'Something went wrong')

  return (
    <div className="flex items-center justify-center py-14">
      <div className="text-center space-y-3 max-w-md">
        <div className="w-12 h-12 rounded-full bg-accent-red/10 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-5 h-5 text-accent-red" />
        </div>
        <h3 className="text-sm font-semibold text-text-primary">Something went wrong</h3>
        <p className="text-sm text-text-secondary">{errorMsg}</p>
        {onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry} className="mx-auto">
            <RefreshCw className="w-3.5 h-3.5" />
            Try again
          </Button>
        )}
      </div>
    </div>
  )
}
