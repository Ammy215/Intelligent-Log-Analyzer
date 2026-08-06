import { Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { copyToClipboard } from '@/lib/utils'

export default function IPAddress({ ip, showCopy = true, className = '' }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const success = await copyToClipboard(ip)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <span className={`inline-flex items-center gap-2 font-mono text-sm ${className}`}>
      <span>{ip}</span>
      {showCopy && (
        <button
          onClick={handleCopy}
          className="text-text-secondary hover:text-accent-cyan transition-colors p-1"
          title="Copy IP"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-accent-green" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      )}
    </span>
  )
}
