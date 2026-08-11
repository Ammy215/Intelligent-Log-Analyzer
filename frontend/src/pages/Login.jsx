import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, LogIn } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Card } from '@/components/ui/Card'
import Button from '@/components/ui/Button'

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
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-full bg-accent-cyan/10 border border-accent-cyan/30 flex items-center justify-center mb-4">
            <Shield className="w-6 h-6 text-accent-cyan" />
          </div>
          <h1 className="text-lg font-semibold">Log Analyzer</h1>
          <p className="label-eyebrow mt-1">Security Operations</p>
        </div>

        <Card className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-xl font-semibold mb-1">Sign in</h2>

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

            <Button type="submit" disabled={submitting} className="w-full disabled:opacity-50">
              <LogIn className="w-4 h-4" />
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>

            <p className="text-sm text-text-secondary text-center pt-1">
              Don't have an account?{' '}
              <Link to="/signup" className="text-accent-cyan hover:underline">
                Sign up
              </Link>
            </p>
          </form>
        </Card>
      </div>
    </div>
  )
}
