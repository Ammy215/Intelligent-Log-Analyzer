import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { authAPI } from '@/lib/api'
import AuthLayout from '@/components/layout/AuthLayout'
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

  if (missing) {
    return (
      <AuthLayout>
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary mb-2">
            This link has expired
          </h1>
          <p className="text-sm text-text-secondary mb-7 leading-relaxed">
            Password links can only be used once. Open the most recent invite or reset email, or
            ask an admin to send you a new one.
          </p>
          <Link to="/login" className="block">
            <Button className="w-full">Back to sign in</Button>
          </Link>
        </div>
      </AuthLayout>
    )
  }

  if (done) {
    return (
      <AuthLayout>
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary mb-2">
            Password set
          </h1>
          <p className="text-sm text-text-secondary">Taking you to sign in…</p>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className="mb-7">
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
          {linkType === 'recovery' ? 'Reset your password' : 'Set your password'}
        </h1>
        <p className="text-sm text-text-secondary mt-1.5">
          Pick something you don't use anywhere else.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/25 rounded-lg px-3 py-2.5">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="new-password" className="text-sm text-text-secondary mb-1.5 block">New password</label>
          <PasswordInput
            id="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <p className="text-xs text-text-muted mt-1.5">At least 8 characters.</p>
        </div>

        <div>
          <label htmlFor="confirm-password" className="text-sm text-text-secondary mb-1.5 block">Confirm password</label>
          <PasswordInput
            id="confirm-password"
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
    </AuthLayout>
  )
}
