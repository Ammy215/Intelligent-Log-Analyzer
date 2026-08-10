import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Shield, UserPlus } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

export default function Signup() {
  const { signup } = useAuth()
  const [fullName, setFullName] = useState('')
  const [orgName, setOrgName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await signup({ email, password, orgName, fullName })
      setResult(res)
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : detail?.msg || 'Signup failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 justify-center mb-8">
          <Shield className="w-8 h-8 text-accent-cyan" />
          <div>
            <h1 className="text-lg font-semibold">Log Analyzer</h1>
            <p className="text-xs text-text-secondary">Security Operations</p>
          </div>
        </div>

        {result ? (
          <div className="card p-6 space-y-4 text-center">
            <h2 className="text-xl font-semibold">Account created</h2>
            <p className="text-sm text-text-secondary">{result.message}</p>
            <Link to="/login" className="btn btn-primary w-full inline-block">
              Go to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card p-6 space-y-4">
            <h2 className="text-xl font-semibold mb-2">Create an account</h2>
            <p className="text-sm text-text-secondary -mt-2 mb-2">
              This creates a new organization with you as admin.
            </p>

            {error && (
              <div className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/25 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <div>
              <label className="text-sm text-text-secondary mb-1 block">Full name</label>
              <input
                type="text"
                className="input w-full"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
              />
            </div>

            <div>
              <label className="text-sm text-text-secondary mb-1 block">Organization name</label>
              <input
                type="text"
                className="input w-full"
                placeholder="Defaults to your name's Organization"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm text-text-secondary mb-1 block">Email</label>
              <input
                type="email"
                required
                className="input w-full"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div>
              <label className="text-sm text-text-secondary mb-1 block">Password</label>
              <input
                type="password"
                required
                minLength={8}
                className="input w-full"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            <button type="submit" disabled={submitting} className="btn btn-primary w-full disabled:opacity-50">
              <UserPlus className="w-4 h-4 mr-2 inline" />
              {submitting ? 'Creating account…' : 'Create account'}
            </button>

            <p className="text-sm text-text-secondary text-center">
              Already have an account?{' '}
              <Link to="/login" className="text-accent-cyan hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
