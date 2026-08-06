import { FileText } from 'lucide-react'
import PageWrapper from '@/components/layout/PageWrapper'

export default function Reports() {
  return (
    <PageWrapper
      title="Reports"
      subtitle="Generated security analysis reports"
    >
      <div className="card p-12 text-center">
        <FileText className="w-16 h-16 text-text-muted mx-auto mb-4" />
        <p className="text-text-secondary mb-4">
          Report history and management coming soon
        </p>
        <p className="text-sm text-text-muted">
          Use the AI Analyst page to generate new reports
        </p>
      </div>
    </PageWrapper>
  )
}
