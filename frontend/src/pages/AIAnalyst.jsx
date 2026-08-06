import { useState } from 'react'
import { Brain, Send, Loader2 } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { reportsAPI } from '@/lib/api'
import PageWrapper from '@/components/layout/PageWrapper'
import ReactMarkdown from 'react-markdown'

export default function AIAnalyst() {
  const [contextType, setContextType] = useState('ip')
  const [contextValue, setContextValue] = useState('')
  const [messages, setMessages] = useState([])

  const { mutate: generateReport, isLoading } = useMutation({
    mutationFn: async () => {
      if (contextType === 'ip') {
        return reportsAPI.generateExecutiveSummary(contextValue)
      } else {
        return reportsAPI.getSummaryStatistics()
      }
    },
    onSuccess: (data) => {
      const aiMessage = {
        role: 'assistant',
        content:
          data.executive_summary ||
          data.incident_report ||
          'Analysis completed successfully',
        timestamp: new Date(),
        data: data,
      }
      setMessages((prev) => [...prev, aiMessage])
    },
  })

  const handleSubmit = () => {
    if (!contextValue && contextType === 'ip') return

    const userMessage = {
      role: 'user',
      content: `Analyze ${contextType === 'ip' ? `IP ${contextValue}` : 'system statistics'}`,
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
      <div className="grid grid-cols-4 gap-6">
        {/* Context Selector */}
        <div className="col-span-1 card p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Brain className="w-5 h-5 text-accent-purple" />
            Analysis Context
          </h3>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-text-secondary mb-2 block">
                Analyze what?
              </label>
              <select
                className="input w-full"
                value={contextType}
                onChange={(e) => setContextType(e.target.value)}
              >
                <option value="ip">IP Address</option>
                <option value="stats">System Statistics</option>
              </select>
            </div>

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

            <button
              onClick={handleSubmit}
              disabled={isLoading || (contextType === 'ip' && !contextValue)}
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
                <li>• Analyze specific IP behavior</li>
                <li>• Review system-wide statistics</li>
                <li>• Generate executive summary</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Chat Interface */}
        <div className="col-span-3 card p-6 flex flex-col h-[700px]">
          <h3 className="font-semibold mb-4">AI Analysis</h3>

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
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
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
