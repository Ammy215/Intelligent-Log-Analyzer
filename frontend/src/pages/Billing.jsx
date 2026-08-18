import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Gift, Wallet, Sparkles, ArrowRight, ShieldAlert, Receipt, Lock } from 'lucide-react'
import { billingAPI, adminAPI } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import PageWrapper from '@/components/layout/PageWrapper'
import LoadingState from '@/components/shared/LoadingState'
import ErrorState from '@/components/shared/ErrorState'
import Button from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { formatTimestamp } from '@/lib/utils'

const CREDITS_PER_TOPUP = 100
const TOPUP_PRICE_INR = 500

function formatPeriod(period) {
  if (!period) return ''
  const [year, month] = period.split('-')
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

// The ledger stores raw reason strings written by whatever created the row
// (webhook, superadmin adjustment). Render them as something a person reads
// rather than leaking the internal token.
function describeReason(reason) {
  if (!reason) return 'Credit adjustment'
  if (reason.startsWith('superadmin_adjustment:')) {
    const note = reason.split(':').slice(1).join(':').trim()
    return note ? `Manual adjustment — ${note}` : 'Manual adjustment'
  }
  if (reason === 'razorpay_topup' || reason.includes('topup')) return `${CREDITS_PER_TOPUP} credit top-up`
  return reason.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

function TransactionHistory({ isAdmin }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-credits-ledger'],
    queryFn: adminAPI.getCreditsLedger,
    // The ledger endpoint is admin-only server-side; don't fire a request
    // that can only come back 403.
    enabled: isAdmin,
  })

  if (!isAdmin) {
    return (
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-bg-tertiary flex items-center justify-center">
            <Lock className="w-4 h-4 text-text-muted" />
          </div>
          <p className="label-eyebrow">Payment history</p>
        </div>
        <p className="text-sm text-text-secondary">
          Only organization admins can view billing history and purchase credits. Your balance above
          is shared across the whole team.
        </p>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <p className="label-eyebrow mb-4">Payment history</p>
        <LoadingState />
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <p className="label-eyebrow mb-4">Payment history</p>
        <ErrorState error={error} onRetry={refetch} />
      </Card>
    )
  }

  const ledger = data?.ledger || []

  return (
    <Card>
      <div className="flex items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent-purple/10 flex items-center justify-center">
            <Receipt className="w-4 h-4 text-accent-purple" />
          </div>
          <p className="label-eyebrow">Payment history</p>
        </div>
        {ledger.length > 0 && (
          <span className="text-xs text-text-muted tabular-nums">
            {ledger.length} {ledger.length === 1 ? 'transaction' : 'transactions'}
          </span>
        )}
      </div>

      {ledger.length === 0 ? (
        <div className="rounded-xl border border-dashed border-bg-border px-6 py-10 text-center">
          <div className="w-11 h-11 rounded-full bg-bg-tertiary flex items-center justify-center mx-auto mb-3">
            <Receipt className="w-5 h-5 text-text-muted" />
          </div>
          <p className="text-sm text-text-primary mb-1">No purchases yet</p>
          <p className="text-xs text-text-muted max-w-xs mx-auto leading-relaxed">
            You're running on the monthly free allowance. Any credits you buy will show up here with
            their payment reference.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="border-b border-bg-border text-left">
                <th className="py-2.5 pr-4 text-text-muted text-[11px] font-semibold uppercase tracking-wider">Date</th>
                <th className="py-2.5 px-4 text-text-muted text-[11px] font-semibold uppercase tracking-wider">Description</th>
                <th className="py-2.5 px-4 text-text-muted text-[11px] font-semibold uppercase tracking-wider">Reference</th>
                <th className="py-2.5 pl-4 text-text-muted text-[11px] font-semibold uppercase tracking-wider text-right">Credits</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((row) => (
                <tr key={row.id} className="border-b border-bg-border last:border-0">
                  <td className="py-3 pr-4 text-xs font-mono text-text-secondary whitespace-nowrap">
                    {formatTimestamp(row.created_at)}
                  </td>
                  <td className="py-3 px-4 text-sm text-text-primary">{describeReason(row.reason)}</td>
                  <td className="py-3 px-4 text-xs font-mono text-text-muted">
                    {row.razorpay_payment_id || <span title="No payment reference — not a card purchase">—</span>}
                  </td>
                  <td
                    className={`py-3 pl-4 text-sm font-mono text-right tabular-nums ${
                      row.delta >= 0 ? 'text-accent-green' : 'text-accent-red'
                    }`}
                  >
                    {row.delta >= 0 ? `+${row.delta}` : row.delta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

export default function Billing() {
  const { user } = useAuth()
  const [checkoutError, setCheckoutError] = useState('')
  const [checkingOut, setCheckingOut] = useState(false)
  const isAdmin = user?.role === 'admin'

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['billing-credits'],
    queryFn: billingAPI.getCredits,
  })

  const handleBuyCredits = async () => {
    setCheckoutError('')
    setCheckingOut(true)
    try {
      const result = await billingAPI.checkout()
      if (result.checkout_url) {
        window.location.href = result.checkout_url
      }
    } catch (err) {
      const detail = err.response?.data?.detail
      setCheckoutError(
        typeof detail === 'string'
          ? detail
          : err.response?.status === 403
            ? 'Only org admins can purchase credits'
            : 'Could not start checkout'
      )
    } finally {
      setCheckingOut(false)
    }
  }

  if (isLoading) {
    return (
      <PageWrapper title="Billing" subtitle="Credit balance and top-ups">
        <LoadingState />
      </PageWrapper>
    )
  }

  if (error) {
    return (
      <PageWrapper title="Billing" subtitle="Credit balance and top-ups">
        <ErrorState error={error} onRetry={refetch} />
      </PageWrapper>
    )
  }

  const freeCap = 20
  const freePct = Math.min(100, Math.round((data.free_credits_remaining / freeCap) * 100))

  return (
    <PageWrapper title="Billing" subtitle="Credit balance and top-ups">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Hero balance card */}
        <div className="lg:col-span-2 card p-4 sm:p-6 relative overflow-hidden">
          <div
            className="absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-[0.07] pointer-events-none"
            style={{ background: 'radial-gradient(circle, #00d4ff 0%, transparent 70%)' }}
          />
          <p className="label-eyebrow mb-2">Total available balance</p>
          <div className="flex items-baseline gap-3 mb-1">
            <span className="text-5xl font-bold text-text-primary tabular-nums tracking-tight">
              {data.total_available}
            </span>
            <span className="text-sm text-text-secondary">credits</span>
          </div>
          <p className="text-xs text-text-muted mb-6">Billing period: {formatPeriod(data.period)}</p>

          <div className="flex items-center gap-1.5 h-2 rounded-full overflow-hidden bg-bg-tertiary mb-3">
            <div
              className="h-full bg-accent-green transition-all"
              style={{ width: data.total_available > 0 ? `${(data.free_credits_remaining / data.total_available) * 100}%` : '0%' }}
            />
            <div className="h-full bg-accent-cyan flex-1 transition-all" />
          </div>
          <div className="flex items-center gap-5 text-xs flex-wrap">
            <span className="flex items-center gap-1.5 text-text-secondary whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-accent-green shrink-0" /> Free — {data.free_credits_remaining}
            </span>
            <span className="flex items-center gap-1.5 text-text-secondary whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-accent-cyan shrink-0" /> Purchased — {data.purchased_credits}
            </span>
          </div>
        </div>

        {/* Free tier detail */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-accent-green/10 flex items-center justify-center">
              <Gift className="w-4 h-4 text-accent-green" />
            </div>
            <p className="label-eyebrow">Free tier</p>
          </div>
          <p className="text-2xl font-semibold text-text-primary tabular-nums mb-1">
            {data.free_credits_remaining}
            <span className="text-sm font-normal text-text-muted"> / {freeCap}</span>
          </p>
          <div className="h-1.5 rounded-full bg-bg-tertiary overflow-hidden mb-3">
            <div className="h-full bg-accent-green transition-all" style={{ width: `${freePct}%` }} />
          </div>
          <p className="text-xs text-text-muted">Resets monthly — unused credits don't roll over</p>
        </Card>
      </div>

      {/* Purchased credits + top-up */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-accent-cyan/10 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-accent-cyan" />
            </div>
            <p className="label-eyebrow">Purchased credits</p>
          </div>
          <p className="text-2xl font-semibold text-text-primary tabular-nums mb-1">{data.purchased_credits}</p>
          <p className="text-xs text-text-muted">Never expire, spent only after free credits run out</p>
        </Card>

        {/* Top-up plan card — the one deliberate accent-ring highlight on this page, since it's the primary CTA */}
        <div className="lg:col-span-2 card p-4 sm:p-6 border-accent-cyan/25 shadow-elevated">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6">
            <div className="flex items-start gap-4 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-accent-cyan/10 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-accent-cyan" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-primary mb-1">{CREDITS_PER_TOPUP} credit top-up</p>
                <p className="text-xs text-text-secondary max-w-sm">
                  One-time purchase via Razorpay. Sandbox mode — no real charge is ever made. Admin-only.
                </p>
              </div>
            </div>
            <div className="sm:text-right shrink-0">
              <p className="text-2xl font-bold text-text-primary tabular-nums">₹{TOPUP_PRICE_INR}</p>
              <p className="text-xs text-text-muted">one-time</p>
            </div>
          </div>

          {checkoutError && (
            <div className="flex items-center gap-2 text-sm text-accent-red bg-accent-red/10 border border-accent-red/25 rounded-lg px-3 py-2 mt-4">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              {checkoutError}
            </div>
          )}

          <Button onClick={handleBuyCredits} disabled={checkingOut} className="w-full mt-5">
            {checkingOut ? 'Starting checkout…' : `Buy ${CREDITS_PER_TOPUP} credits`}
            {!checkingOut && <ArrowRight className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Payment history — the data existed on the Admin page but never
          appeared where someone looking at billing would go for it. */}
      <TransactionHistory isAdmin={isAdmin} />
    </PageWrapper>
  )
}
