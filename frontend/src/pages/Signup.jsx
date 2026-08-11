import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Shield, UserPlus } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Card } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import PasswordInput from '@/components/ui/PasswordInput'

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
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-full bg-accent-cyan/10 border border-accent-cyan/30 flex items-center justify-center mb-4">
            <Shield className="w-6 h-6 text-accent-cyan" />
          </div>
          <h1 className="text-lg font-semibold">Log Analyzer</h1>
          <p className="label-eyebrow mt-1">Security Operations</p>
        </div>

        {result ? (
          <Card className="space-y-4 text-center">
            <h2 className="text-xl font-semibold">Account created</h2>
            <p className="text-sm text-text-secondary">{result.message}</p>
            <Link to="/login">
              <Button className="w-full">Go to sign in</Button>
            </Link>
          </Card>
        ) : (
          <Card className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="mb-1">
                <h2 className="text-xl font-semibold">Create an account</h2>
                <p className="text-sm text-text-secondary mt-1">
                  This creates a new organization with you as admin.
                </p>
              </div>

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
                <PasswordInput
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              <Button type="submit" disabled={submitting} className="w-full disabled:opacity-50">
                <UserPlus className="w-4 h-4" />
                {submitting ? 'Creating account…' : 'Create account'}
              </Button>

              <p className="text-sm text-text-secondary text-center pt-1">
                Already have an account?{' '}
                <Link to="/login" className="text-accent-cyan hover:underline">
                  Sign in
                </Link>
              </p>
            </form>
          </Card>
        )}
      </div>
    </div>
  )
}
