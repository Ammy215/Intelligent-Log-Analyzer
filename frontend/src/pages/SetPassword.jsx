import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, KeyRound } from 'lucide-react'
import { authAPI } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import PasswordInput from '@/components/ui/PasswordInput'

// Supabase invite/recovery links redirect here with the session token in
// the URL hash (#access_token=...&type=invite|recovery), not a query
// string or route param — this app has no Supabase client on the frontend,
// so that token is parsed by hand and forwarded to our own backend, which
// exchanges it for a real password on the account.
function useHashToken() {
  const [token, setToken] = useState(null)
  const [linkType, setLinkType] = useState(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const accessToken = hash.get('access_token')
    if (accessToken) {
      setToken(accessToken)
      setLinkType(hash.get('type'))
    } else {
      setMissing(true)
    }
  }, [])

  return { token, linkType, missing }
}

export default function SetPassword() {
  const navigate = useNavigate()
  const { token, linkType, missing } = useHashToken()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError("Passwords don't match")
      return
    }
    setSubmitting(true)
    try {
      await authAPI.setPassword(token, password)
      setDone(true)
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : detail?.msg || 'Could not set password')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-full bg-accent-cyan/10 border border-accent-cyan/30 flex items-center justify-center mb-4">
            <Shield className="w-6 h-6 text-accent-cyan" />
          </div>
          <h1 className="text-lg font-semibold">Log Analyzer</h1>
          <p className="label-eyebrow mt-1">Security Operations</p>
        </div>

        {missing ? (
          <Card className="space-y-4 text-center">
            <h2 className="text-xl font-semibold">Link expired or invalid</h2>
            <p className="text-sm text-text-secondary">
              Open this page from the link in your invite or password-reset email.
            </p>
            <Link to="/login">
              <Button className="w-full">Back to sign in</Button>
            </Link>
          </Card>
        ) : done ? (
          <Card className="space-y-4 text-center">
            <h2 className="text-xl font-semibold">Password set</h2>
            <p className="text-sm text-text-secondary">Redirecting you to sign in…</p>
          </Card>
        ) : (
          <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-xl font-semibold mb-1">
              {linkType === 'recovery' ? 'Reset your password' : 'Set your password'}
            </h2>

            {error && (
              <div className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/25 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <div>
              <label className="text-sm text-text-secondary mb-1 block">New password</label>
              <PasswordInput
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="text-sm text-text-secondary mb-1 block">Confirm password</label>
              <PasswordInput
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            <Button type="submit" disabled={submitting} className="w-full disabled:opacity-50">
              <KeyRound className="w-4 h-4" />
              {submitting ? 'Setting password…' : 'Set password'}
            </Button>
          </form>
          </Card>
        )}
      </div>
    </div>
  )
}
