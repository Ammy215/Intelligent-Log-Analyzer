import { FileX } from 'lucide-react'

export default function EmptyState({ message = 'No data available', icon: Icon = FileX }) {
  return (
    <div className="flex items-center justify-center py-14">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-bg-tertiary flex items-center justify-center mx-auto">
          <Icon className="w-5 h-5 text-text-muted" />
        </div>
        <p className="text-sm text-text-secondary">{message}</p>
      </div>
    </div>
  )
}
