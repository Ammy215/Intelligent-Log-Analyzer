import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CreditCard, Gift, ShoppingCart } from 'lucide-react'
import { billingAPI } from '@/lib/api'
import PageWrapper from '@/components/layout/PageWrapper'
import LoadingState from '@/components/shared/LoadingState'
import ErrorState from '@/components/shared/ErrorState'

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

  return (
    <PageWrapper title="Billing" subtitle="Credit balance and top-ups">
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-3">
            <Gift className="w-5 h-5 text-accent-green" />
            <p className="text-text-secondary text-sm">Free credits (this month)</p>
          </div>
          <p className="text-3xl font-bold">{data.free_credits_remaining}</p>
          <p className="text-xs text-text-muted mt-2">Resets monthly, no rollover</p>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="w-5 h-5 text-accent-cyan" />
            <p className="text-text-secondary text-sm">Purchased credits</p>
          </div>
          <p className="text-3xl font-bold">{data.purchased_credits}</p>
          <p className="text-xs text-text-muted mt-2">Never expire</p>
        </div>

        <div className="card p-6 border-accent-cyan/30">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingCart className="w-5 h-5 text-accent-purple" />
            <p className="text-text-secondary text-sm">Total available</p>
          </div>
          <p className="text-3xl font-bold text-accent-cyan">{data.total_available}</p>
          <p className="text-xs text-text-muted mt-2">Period: {data.period}</p>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-semibold mb-2">Buy more credits</h3>
        <p className="text-sm text-text-secondary mb-4">
          Top up via Razorpay (sandbox mode — no real charge). Admin-only.
        </p>
        {checkoutError && (
          <div className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/25 rounded-lg px-3 py-2 mb-4">
            {checkoutError}
          </div>
        )}
        <button onClick={handleBuyCredits} disabled={checkingOut} className="btn btn-primary disabled:opacity-50">
          {checkingOut ? 'Starting checkout…' : 'Buy 100 credits'}
        </button>
      </div>
    </PageWrapper>
  )
}
