import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Clock, Loader2, Lock, XCircle } from 'lucide-react'

import { paymentLinkApi, redirectToCheckout, type PaymentLink } from '@/api/billing'
import { Badge, Button, Card } from '@/components/hb'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

/**
 * The page a client pays their Hybent plan on, reached from the payment link
 * the Hybent team sends after a demo (/pay/<token>). No sign-in: the token is
 * the secret. "Pay" opens Stripe Checkout; Stripe sends the client back here
 * with `?checkout=success&session_id=…`, and the page confirms the payment
 * with the server so the result shows even before Stripe's webhook lands.
 *
 * Renders outside the app shell, so it wraps itself in `.hb-app`.
 */

const formatUsd = (val: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(val)

const TERM_LABEL: Record<number, string> = { 1: 'month', 6: '6 months', 12: 'year' }

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="hb-app flex min-h-screen items-center justify-center p-4">{children}</div>
}

function StatusCard({
  tone,
  icon,
  title,
  children,
}: {
  tone: 'success' | 'error' | 'warning'
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  const ring = {
    success: 'border-hb-success/25 bg-hb-success/10 text-hb-success',
    error: 'border-hb-error/25 bg-hb-error/10 text-hb-error',
    warning: 'border-hb-warning/25 bg-hb-warning/10 text-hb-warning',
  }[tone]
  return (
    <Card padding="loose" className="w-full max-w-md text-center">
      <span className={`mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border ${ring}`}>{icon}</span>
      <h1 className="mb-2 font-display text-hb-h2 text-hb-text">{title}</h1>
      <div className="text-hb-sm text-hb-muted">{children}</div>
    </Card>
  )
}

export default function PayPage() {
  useDocumentTitle('Pay your Hybent plan — HYBENT', 'Review and pay your Hybent subscription securely with Stripe.')
  const { token = '' } = useParams<{ token: string }>()
  const [params] = useSearchParams()
  const [link, setLink] = useState<PaymentLink | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [starting, setStarting] = useState(false)
  const confirmed = useRef(false)

  const sessionId = params.get('checkout') === 'success' ? params.get('session_id') : null
  const canceled = params.get('checkout') === 'canceled'

  useEffect(() => {
    if (!token) return
    const load = async () => {
      try {
        if (sessionId && !confirmed.current) {
          confirmed.current = true
          setConfirming(true)
          setLink(await paymentLinkApi.confirm(token, sessionId))
        } else {
          setLink(await paymentLinkApi.get(token))
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'This payment link isn’t valid.')
      } finally {
        setConfirming(false)
      }
    }
    load()
  }, [token, sessionId])

  const pay = async () => {
    try {
      setStarting(true)
      const { url } = await paymentLinkApi.checkout(token)
      redirectToCheckout(url)
    } catch (err: any) {
      setError(err.response?.data?.message || 'We couldn’t start the payment. Please try again.')
      setStarting(false)
    }
  }

  if (error) {
    return (
      <Shell>
        <StatusCard tone="error" icon={<XCircle size={28} aria-hidden />} title="Payment link unavailable">
          <p>{error}</p>
          <p className="mt-3">
            Need help? Email <a className="text-hb-blue hover:underline" href="mailto:info@hybent.com">info@hybent.com</a>.
          </p>
        </StatusCard>
      </Shell>
    )
  }

  if (!link || confirming) {
    return (
      <Shell>
        <p role="status" className="flex items-center gap-2.5 text-hb-body text-hb-muted">
          <Loader2 size={22} aria-hidden className="animate-spin text-hb-cyan" />
          {confirming ? 'Confirming your payment…' : 'Loading your payment link…'}
        </p>
      </Shell>
    )
  }

  if (link.status === 'paid') {
    return (
      <Shell>
        <StatusCard tone="success" icon={<CheckCircle2 size={28} aria-hidden />} title="Payment received">
          <p>
            Thank you{link.organization_name ? `, ${link.organization_name}` : ''}. Your Hybent workspace is active.
          </p>
          <p className="mt-3">
            We&apos;ve emailed your admin a link to set a password and sign in. Stripe sends your receipt separately.
          </p>
        </StatusCard>
      </Shell>
    )
  }

  if (link.status === 'pending' && sessionId) {
    // Back from Checkout but the payment hasn't settled (e.g. a bank debit).
    return (
      <Shell>
        <StatusCard tone="warning" icon={<Clock size={28} aria-hidden />} title="Payment processing">
          <p>Stripe is still processing your payment. We&apos;ll activate your workspace and email you as soon as it clears.</p>
        </StatusCard>
      </Shell>
    )
  }

  if (link.status !== 'pending') {
    return (
      <Shell>
        <StatusCard tone="warning" icon={<Clock size={28} aria-hidden />} title="This link is no longer active">
          <p>
            {link.status === 'expired' ? 'It has expired.' : 'It was replaced or cancelled.'} Please ask the Hybent team
            for a new one at <a className="text-hb-blue hover:underline" href="mailto:info@hybent.com">info@hybent.com</a>.
          </p>
        </StatusCard>
      </Shell>
    )
  }

  const term = TERM_LABEL[link.term_months ?? 1] ?? `${link.term_months} months`

  return (
    <Shell>
      <Card padding="loose" className="w-full max-w-lg">
        <p className="font-mono text-hb-label uppercase text-hb-muted">Hybent subscription</p>
        <h1 className="mt-2 font-display text-hb-h2 text-hb-text">
          {link.organization_name ? `${link.organization_name}’s plan` : 'Your plan'}
        </h1>
        {canceled && (
          <p role="status" className="mt-3 text-hb-sm text-hb-warning">
            Payment was cancelled. You can try again whenever you&apos;re ready.
          </p>
        )}

        <ul className="mt-hb-5 space-y-2 border-t border-hb-border pt-hb-4">
          {link.lines.map((line) => (
            <li key={line.label} className="flex items-baseline justify-between gap-3 text-hb-sm">
              <span className="text-hb-text">{line.label}</span>
              <span className="font-mono tabular-nums text-hb-text">{formatUsd(line.amount_usd)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-hb-4 flex items-baseline justify-between gap-3 border-t border-hb-border pt-hb-4">
          <span className="font-semibold text-hb-text">Total</span>
          <span className="flex items-baseline gap-1.5">
            <span className="hb-grad-text font-display text-hb-num">{formatUsd(link.amount_usd)}</span>
            <span className="text-hb-xs text-hb-muted">/ {term}</span>
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge tone={link.recurring ? 'brand' : 'info'}>
            {link.recurring ? `Renews every ${term}` : `One payment for ${term}`}
          </Badge>
          {link.recurring && <span className="text-hb-xs text-hb-muted">Cancel any time before renewal.</span>}
        </div>

        <Button fullWidth className="mt-hb-6" loading={starting} onClick={pay}>
          Pay {formatUsd(link.amount_usd)} with Stripe
        </Button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-hb-xs text-hb-muted">
          <Lock size={12} aria-hidden /> Card details are handled by Stripe and never reach Hybent.
        </p>
        {link.expires_at && (
          <p className="mt-1 text-center text-hb-xs text-hb-muted">
            Link valid until {new Date(link.expires_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        )}
      </Card>
    </Shell>
  )
}
