import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { UploadCloud, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react'
import { logsAPI } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

// Mirrors ALLOWED_LOG_EXTENSIONS in backend config — the server rejects
// anything else with a 400, so catching it here just saves a round trip.
const ACCEPTED = ['.log', '.txt', '.xml', '.evtx', '.csv']
const MAX_MB = 50

export default function LogUpload() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [localError, setLocalError] = useState('')
  const [result, setResult] = useState(null)

  // Upload is admin/analyst only server-side (require_role on /logs/upload).
  // Hiding it for viewers avoids offering an action that can only 403.
  const canUpload = user?.role === 'admin' || user?.role === 'analyst'

  // isPending, not isLoading — react-query v5 removed isLoading from
  // useMutation, so the v4 name silently reads undefined and every
  // in-flight UI branch behind it never renders.
  const { mutate: upload, isPending: isLoading } = useMutation({
    mutationFn: (file) => logsAPI.uploadLogFile(file),
    onSuccess: (data) => {
      setResult(data)
      setLocalError('')
      // The feed, counters and charts are all derived from this data —
      // refetch them rather than making the user reload to see their upload.
      queryClient.invalidateQueries({ queryKey: ['logs-live'] })
      queryClient.invalidateQueries({ queryKey: ['logs'] })
      queryClient.invalidateQueries({ queryKey: ['analysis-summary'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
    },
    onError: (err) => {
      const detail = err.response?.data?.detail
      setResult(null)
      setLocalError(
        typeof detail === 'string' ? detail : detail?.msg || 'Upload failed — please try again'
      )
    },
  })

  const validateAndUpload = (file) => {
    if (!file) return
    setResult(null)
    setLocalError('')

    const ext = file.name.includes('.') ? `.${file.name.split('.').pop().toLowerCase()}` : ''
    if (!ACCEPTED.includes(ext)) {
      setLocalError(`Can't read ${ext || 'that file type'}. Accepted formats: ${ACCEPTED.join(', ')}`)
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setLocalError(`That file is ${(file.size / 1024 / 1024).toFixed(1)}MB. The limit is ${MAX_MB}MB.`)
      return
    }
    upload(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    if (isLoading) return
    validateAndUpload(e.dataTransfer.files?.[0])
  }

  if (!canUpload) return null

  return (
    <div className="card p-4 sm:p-6">
      <h3 className="label-eyebrow mb-4">Upload Logs</h3>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!isLoading) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !isLoading && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isLoading) {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        aria-label="Upload a log file"
        className={`rounded-xl border border-dashed px-6 py-10 text-center transition-colors focus:outline-none focus:ring-2 focus:ring-accent-cyan/40 ${
          isLoading
            ? 'cursor-wait border-bg-border bg-bg-tertiary/40'
            : dragging
            ? 'cursor-pointer border-accent-cyan bg-accent-cyan/5'
            : 'cursor-pointer border-bg-border hover:border-accent-cyan/40 hover:bg-bg-tertiary/40'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={ACCEPTED.join(',')}
          onChange={(e) => {
            validateAndUpload(e.target.files?.[0])
            e.target.value = ''
          }}
        />

        {isLoading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-7 h-7 text-accent-cyan animate-spin" />
            <div>
              <p className="text-sm text-text-primary font-medium">Parsing your log file…</p>
              <p className="text-xs text-text-muted mt-1">
                Large files take a moment — this page will update when it's done.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-bg-tertiary flex items-center justify-center">
              <UploadCloud className="w-5 h-5 text-text-secondary" />
            </div>
            <div>
              <p className="text-sm text-text-primary">
                <span className="text-accent-cyan font-medium">Choose a file</span> or drag it here
              </p>
              <p className="text-xs text-text-muted mt-1">
                {ACCEPTED.join(' · ')} — up to {MAX_MB}MB
              </p>
            </div>
          </div>
        )}
      </div>

      {localError && (
        <div className="mt-4 flex items-start gap-2.5 text-sm text-accent-red bg-accent-red/10 border border-accent-red/25 rounded-lg px-3 py-2.5">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="flex-1">{localError}</span>
          <button onClick={() => setLocalError('')} aria-label="Dismiss error" className="shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {result && (
        <div className="mt-4 flex items-start gap-2.5 text-sm text-accent-green bg-accent-green/10 border border-accent-green/25 rounded-lg px-3 py-2.5">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">
              Stored {result.parsed_count} of {result.total_lines} lines
            </p>
            {result.parsed_count === 0 ? (
              <p className="text-xs text-text-secondary mt-1">
                No lines matched a known log format. Supported today: SSH auth logs and Windows .evtx.
              </p>
            ) : (
              result.enrichment_queued_for?.length > 0 && (
                <p className="text-xs text-text-secondary mt-1">
                  Looking up threat intel for {result.enrichment_queued_for.length} flagged{' '}
                  {result.enrichment_queued_for.length === 1 ? 'address' : 'addresses'} in the background.
                </p>
              )
            )}
          </div>
          <button onClick={() => setResult(null)} aria-label="Dismiss" className="shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
