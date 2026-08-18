import { useState } from 'react'
import { Brain, Send, Loader2, CreditCard } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { reportsAPI, incidentsAPI, billingAPI } from '@/lib/api'
import PageWrapper from '@/components/layout/PageWrapper'
import ReactMarkdown from 'react-markdown'
import { markdownHeadingShift } from '@/lib/markdown'

export default function AIAnalyst() {
  const queryClient = useQueryClient()
  const [contextType, setContextType] = useState('incident')
  const [contextValue, setContextValue] = useState('')
  const [messages, setMessages] = useState([])
  const [errorBanner, setErrorBanner] = useState('')

  const { data: openIncidents } = useQuery({
    queryKey: ['incidents-for-analyst'],
    queryFn: () => incidentsAPI.listIncidents({}),
    enabled: contextType === 'incident',
  })

  const { data: credits } = useQuery({
    queryKey: ['billing-credits'],
    queryFn: billingAPI.getCredits,
  })

  // isPending, not isLoading — react-query v5 dropped isLoading from
  // useMutation. The spinner/disabled-button branches below read as
  // undefined under the old name, so this page showed no feedback at all
  // while a Gemini report was generating.
  const { mutate: generateReport, isPending: isLoading } = useMutation({
    mutationFn: async () => {
      if (contextType === 'incident') {
        return reportsAPI.generateIncidentReport(contextValue)
      } else if (contextType === 'ip') {
        return reportsAPI.generateExecutiveSummary(contextValue)
      } else {
        return reportsAPI.getSummaryStatistics()
      }
    },
    onSuccess: (data) => {
      const aiMessage = {
        role: 'assistant',
        content:
          data.incident_report ||
          data.executive_summary ||
          'Analysis completed successfully',
        timestamp: new Date(),
        data: data,
      }
      setMessages((prev) => [...prev, aiMessage])
      // Metered endpoints report their new balance directly — refetch so
      // the sidebar/billing page reflect it without a manual reload.
      if (data.credits) {
        queryClient.invalidateQueries({ queryKey: ['billing-credits'] })
        if (data.credits.spent > 0) {
          toast.success(
            `1 credit spent (${data.credits.source}) — ${data.credits.total_available} remaining`
          )
        }
      }
    },
    onError: (err) => {
      const detail = err.response?.data?.detail
      setErrorBanner(typeof detail === 'string' ? detail : 'Report generation failed')
    },
  })

  const handleSubmit = () => {
    if (contextType !== 'stats' && !contextValue) return
    setErrorBanner('')

    const label =
      contextType === 'incident'
        ? `incident "${openIncidents?.data?.find((i) => i.id === contextValue)?.title || contextValue}"`
        : contextType === 'ip'
          ? `IP ${contextValue}`
          : 'system statistics'

    const userMessage = {
      role: 'user',
      content: `Analyze ${label}`,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])

    generateReport()
  }

  return (
    <PageWrapper
      title="AI Analyst"
      subtitle="Automated threat analysis and reporting"
    >
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Context Selector */}
        <div className="lg:col-span-1 card p-4 sm:p-6 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="label-eyebrow flex items-center gap-2">
              <Brain className="w-5 h-5 text-accent-purple" />
              Analysis Context
            </h3>
            {credits && (
              <div
                className="flex items-center gap-1 text-xs text-text-secondary"
                title="Incident reports cost 1 credit each"
              >
                <CreditCard className="w-3.5 h-3.5" />
                {credits.total_available}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-text-secondary mb-2 block">
                Analyze what?
              </label>
              <select
                className="input w-full"
                value={contextType}
                onChange={(e) => {
                  setContextType(e.target.value)
                  setContextValue('')
                  setErrorBanner('')
                }}
              >
                <option value="incident">Incident (1 credit)</option>
                <option value="ip">IP Address</option>
                <option value="stats">System Statistics</option>
              </select>
            </div>

            {contextType === 'incident' && (
              <div>
                <label className="text-sm text-text-secondary mb-2 block">
                  Incident
                </label>
                <select
                  className="input w-full"
                  value={contextValue}
                  onChange={(e) => setContextValue(e.target.value)}
                >
                  <option value="">Select an incident…</option>
                  {(openIncidents?.data || []).map((inc) => (
                    <option key={inc.id} value={inc.id}>
                      {inc.title} ({inc.severity})
                    </option>
                  ))}
                </select>
                {openIncidents && openIncidents.data.length === 0 && (
                  <p className="text-xs text-text-muted mt-1">No incidents yet.</p>
                )}
              </div>
            )}

            {contextType === 'ip' && (
              <div>
                <label className="text-sm text-text-secondary mb-2 block">
                  IP Address
                </label>
                <input
                  type="text"
                  className="input w-full font-mono"
                  placeholder="192.168.1.1"
                  value={contextValue}
                  onChange={(e) => setContextValue(e.target.value)}
                />
              </div>
            )}

            {errorBanner && (
              <div className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/25 rounded-lg px-3 py-2">
                {errorBanner}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={isLoading || (contextType !== 'stats' && !contextValue)}
              className="btn btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Generate Report
                </>
              )}
            </button>

            <div className="text-xs text-text-muted">
              <p className="mb-2">Suggested prompts:</p>
              <ul className="space-y-1">
                <li>• Generate an incident report (1 credit)</li>
                <li>• Analyze specific IP behavior</li>
                <li>• Review system-wide statistics</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Chat Interface */}
        <div className="lg:col-span-3 card p-4 sm:p-6 flex flex-col h-[560px] lg:h-[700px] min-w-0">
          <h3 className="label-eyebrow mb-4">AI Analysis</h3>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 mb-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-center">
                <div>
                  <Brain className="w-16 h-16 text-text-muted mx-auto mb-4" />
                  <p className="text-text-secondary">
                    Configure analysis parameters and generate a report
                  </p>
                </div>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-4 ${
                      msg.role === 'user'
                        ? 'bg-accent-cyan/20 text-text-primary'
                        : 'bg-bg-tertiary text-text-primary'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <div className="markdown-content prose prose-invert max-w-none">
                        <ReactMarkdown components={markdownHeadingShift}>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p>{msg.content}</p>
                    )}
                    <p className="text-xs text-text-muted mt-2">
                      {msg.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-bg-tertiary rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analyzing data...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
