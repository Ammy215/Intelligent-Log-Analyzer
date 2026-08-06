import { FileX } from 'lucide-react'

export default function EmptyState({ message = 'No data available', icon: Icon = FileX }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center space-y-4">
        <Icon className="w-12 h-12 text-text-muted mx-auto" />
        <p className="text-text-secondary">{message}</p>
      </div>
    </div>
  )
}
