import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, LogIn } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : detail?.msg || 'Login failed — check your credentials')
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

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <h2 className="text-xl font-semibold mb-2">Sign in</h2>

          {error && (
            <div className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/25 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

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
              className="input w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <button type="submit" disabled={submitting} className="btn btn-primary w-full disabled:opacity-50">
            <LogIn className="w-4 h-4 mr-2 inline" />
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="text-sm text-text-secondary text-center">
            Don't have an account?{' '}
            <Link to="/signup" className="text-accent-cyan hover:underline">
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
