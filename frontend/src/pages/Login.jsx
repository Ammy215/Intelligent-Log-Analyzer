import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import AuthLayout from '@/components/layout/AuthLayout'
import Button from '@/components/ui/Button'
import PasswordInput from '@/components/ui/PasswordInput'

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
    <AuthLayout>
      <div className="mb-7">
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Sign in</h1>
        <p className="text-sm text-text-secondary mt-1.5">Welcome back to your security operations.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/25 rounded-lg px-3 py-2.5">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="email" className="text-sm text-text-secondary mb-1.5 block">Email</label>
          <input
            id="email"
            type="email"
            required
            className="input w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <div>
          <label htmlFor="password" className="text-sm text-text-secondary mb-1.5 block">Password</label>
          <PasswordInput
            id="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        <Button type="submit" disabled={submitting} className="w-full disabled:opacity-50">
          <LogIn className="w-4 h-4" />
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <p className="text-sm text-text-secondary text-center mt-6">
        Don't have an account?{' '}
        <Link to="/signup" className="text-accent-cyan hover:underline">
          Create one
        </Link>
      </p>
    </AuthLayout>
  )
}
