import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Gift, Wallet, Sparkles, ArrowRight, ShieldAlert } from 'lucide-react'
import { billingAPI } from '@/lib/api'
import PageWrapper from '@/components/layout/PageWrapper'
import LoadingState from '@/components/shared/LoadingState'
import ErrorState from '@/components/shared/ErrorState'
import Button from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

const CREDITS_PER_TOPUP = 100
const TOPUP_PRICE_INR = 500

function formatPeriod(period) {
  if (!period) return ''
  const [year, month] = period.split('-')
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export default function Billing() {
  const [checkoutError, setCheckoutError] = useState('')
  const [checkingOut, setCheckingOut] = useState(false)

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
      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* Hero balance card */}
        <div className="col-span-2 card p-7 relative overflow-hidden">
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
          <div className="flex items-center gap-5 text-xs">
            <span className="flex items-center gap-1.5 text-text-secondary">
              <span className="w-2 h-2 rounded-full bg-accent-green" /> Free — {data.free_credits_remaining}
            </span>
            <span className="flex items-center gap-1.5 text-text-secondary">
              <span className="w-2 h-2 rounded-full bg-accent-cyan" /> Purchased — {data.purchased_credits}
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
      <div className="grid grid-cols-3 gap-6">
        <Card className="col-span-1">
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
        <div className="col-span-2 card p-6 border-accent-cyan/25 shadow-elevated">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-accent-cyan/10 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-accent-cyan" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary mb-1">{CREDITS_PER_TOPUP} credit top-up</p>
                <p className="text-xs text-text-secondary max-w-sm">
                  One-time purchase via Razorpay. Sandbox mode — no real charge is ever made. Admin-only.
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
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
    </PageWrapper>
  )
}
