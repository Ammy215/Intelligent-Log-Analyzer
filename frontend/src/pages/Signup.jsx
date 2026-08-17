import { useState } from 'react'
import { Link } from 'react-router-dom'
import { UserPlus, MailCheck } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import AuthLayout from '@/components/layout/AuthLayout'
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

  if (result) {
    return (
      <AuthLayout>
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-accent-green/10 border border-accent-green/25 flex items-center justify-center mx-auto mb-5">
            <MailCheck className="w-6 h-6 text-accent-green" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-text-primary mb-2">Check your inbox</h2>
          <p className="text-sm text-text-secondary mb-7 leading-relaxed">
            {result.message || `We sent a confirmation link to ${email}. Click it to activate your account, then sign in.`}
          </p>
          <Link to="/login" className="block">
            <Button className="w-full">Go to sign in</Button>
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className="mb-7">
        <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Create your workspace</h2>
        <p className="text-sm text-text-secondary mt-1.5">
          You'll be the first member, with full access to invite and manage the rest of your team.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/25 rounded-lg px-3 py-2.5">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="fullName" className="text-sm text-text-secondary mb-1.5 block">Your name</label>
          <input
            id="fullName"
            type="text"
            className="input w-full"
            placeholder="Alex Rivera"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
          />
        </div>

        <div>
          <label htmlFor="orgName" className="text-sm text-text-secondary mb-1.5 block">
            Team or company name
          </label>
          <input
            id="orgName"
            type="text"
            className="input w-full"
            placeholder="Acme Security"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
          />
          <p className="text-xs text-text-muted mt-1.5">
            This is the workspace your logs and teammates live in. You can leave it blank and rename it later.
          </p>
        </div>

        <div>
          <label htmlFor="email" className="text-sm text-text-secondary mb-1.5 block">Work email</label>
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
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <p className="text-xs text-text-muted mt-1.5">At least 8 characters.</p>
        </div>

        <Button type="submit" disabled={submitting} className="w-full disabled:opacity-50">
          <UserPlus className="w-4 h-4" />
          {submitting ? 'Creating your workspace…' : 'Create workspace'}
        </Button>
      </form>

      <p className="text-sm text-text-secondary text-center mt-6">
        Already have an account?{' '}
        <Link to="/login" className="text-accent-cyan hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
