import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Check, Coins, CreditCard, Receipt, Users } from 'lucide-react'

import { billingApi, redirectToCheckout, type SeatRole } from '@/api/billing'
import type { PlanInfo } from '@/api/superAdmin'
import {
  Badge,
  Button,
  Card,
  Dialog,
  IconTile,
  Input,
  Meter,
  PageHeader,
} from '@/components/hb'

/**
 * An organization admin's subscription: plan, seats, renewal and AI credits.
 *
 * Extra seats are paid online with Stripe (for the rest of the current term;
 * they then renew with the plan). Plans aren't self-serve, so changing plan,
 * removing seats, or adding seats when online payment isn't available sends a
 * request to the Hybent team (info@hybent.com), who invoice and apply it.
 *
 * Stripe Checkout returns here with `?checkout=success&session_id=…`; the page
 * confirms the payment with the server so the seats show straight away.
 */

const formatUsd = (val: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val)
const formatUsdCents = (val: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(val)

type SeatCounts = Record<SeatRole, number>
type Request = { plan?: PlanInfo; seats?: SeatCounts } | null

const PAYMENT_KIND_LABEL: Record<string, string> = {
  subscription: 'Plan',
  seats: 'Extra seats',
  topup: 'AI credits',
  renewal: 'Renewal',
}

const SEAT_ROLES: SeatRole[] = ['admin', 'recruiter']
const ROLE_LABEL: Record<SeatRole, string> = { admin: 'admin', recruiter: 'recruiter' }

export default function BillingPage() {
  const { data, isLoading } = useQuery({ queryKey: ['billing'], queryFn: () => billingApi.get() })
  const { data: payments } = useQuery({ queryKey: ['billing-payments'], queryFn: () => billingApi.payments() })
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const handledReturn = useRef(false)
  const [request, setRequest] = useState<Request>(null)
  const [buySeats, setBuySeats] = useState<SeatCounts | null>(null)
  const [redirecting, setRedirecting] = useState(false)
  const [seatDrafts, setSeatDrafts] = useState<Partial<Record<SeatRole, string>>>({})
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)

  const sub = data?.subscription ?? null
  const seatsUsed = data?.seats_used
  const credits = data?.ai_credits
  const seats = sub?.seats
  const prices = data?.extra_seats
  const currentExtra: SeatCounts = {
    admin: seats?.extra_admin_seats ?? 0,
    recruiter: seats?.extra_recruiter_seats ?? 0,
  }
  const totalExtra = currentExtra.admin + currentExtra.recruiter

  const draftCount = (role: SeatRole) => {
    const raw = seatDrafts[role]
    if (raw === undefined) return currentExtra[role]
    const n = parseInt(raw, 10)
    return Number.isNaN(n) ? NaN : Math.max(0, n)
  }
  const draft: SeatCounts = { admin: draftCount('admin'), recruiter: draftCount('recruiter') }
  const seatDraftValid = !Number.isNaN(draft.admin) && !Number.isNaN(draft.recruiter)
  const seatDraftChanged = seatDraftValid &&
    (draft.admin !== currentExtra.admin || draft.recruiter !== currentExtra.recruiter)

  // Back from Stripe Checkout: apply the payment now rather than waiting for the webhook.
  useEffect(() => {
    const outcome = params.get('checkout')
    if (!outcome || handledReturn.current) return
    handledReturn.current = true
    const sessionId = params.get('session_id')
    setParams({}, { replace: true })
    if (outcome === 'canceled') {
      toast('Payment cancelled. Nothing was charged.')
      return
    }
    if (!sessionId) return
    billingApi
      .confirmCheckout(sessionId)
      .then((payment) => {
        if (payment.status === 'paid') toast.success(`Payment received: ${payment.description}.`)
        else toast('Your payment is processing. The seats appear as soon as Stripe confirms it.')
      })
      .catch(() => toast.error('We couldn’t confirm the payment yet. Refresh in a minute.'))
      .finally(() => {
        queryClient.invalidateQueries({ queryKey: ['billing'] })
        queryClient.invalidateQueries({ queryKey: ['billing-payments'] })
      })
  }, [params, setParams, queryClient])

  // Seats can be paid online when Stripe is on and the plan isn't Custom;
  // removing seats is still a request (it takes effect at renewal).
  const seatPricesNow = data?.payments_enabled ? data.seat_prices_now : null
  const seatsToAdd: SeatCounts = {
    admin: Math.max(0, (draft.admin || 0) - currentExtra.admin),
    recruiter: Math.max(0, (draft.recruiter || 0) - currentExtra.recruiter),
  }
  const removesSeats = seatDraftValid && (draft.admin < currentExtra.admin || draft.recruiter < currentExtra.recruiter)
  const canPaySeats = !!seatPricesNow && seatDraftChanged && !removesSeats
  const proratedCost = (add: SeatCounts) =>
    Math.max(0.5, SEAT_ROLES.reduce((sum, role) => sum + add[role] * (seatPricesNow?.[role] ?? 0), 0))

  const startSeatCheckout = async () => {
    if (!buySeats) return
    try {
      setRedirecting(true)
      const { url } = await billingApi.checkoutSeats(buySeats)
      redirectToCheckout(url)
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Could not start the payment.')
      setRedirecting(false)
    }
  }

  const seatCost = (counts: SeatCounts) =>
    SEAT_ROLES.reduce((sum, role) => sum + counts[role] * (prices?.[role].price_usd ?? 0), 0)
  const seatCredits = (counts: SeatCounts) =>
    SEAT_ROLES.reduce((sum, role) => sum + counts[role] * (prices?.[role].ai_credits ?? 0), 0)

  const sendRequest = async () => {
    if (!request) return
    try {
      setSending(true)
      await billingApi.requestChange({
        plan_name: request.plan?.name,
        extra_admin_seats: request.seats?.admin,
        extra_recruiter_seats: request.seats?.recruiter,
        note: note.trim() || undefined,
      })
      toast.success('Request sent. The Hybent team will contact you to confirm the change.')
      setRequest(null)
      setNote('')
      setSeatDrafts({})
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Could not send the request.')
    } finally {
      setSending(false)
    }
  }

  const seatRow = (label: string, used: number, included: number | null) => (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-hb-sm">
        <span className="text-hb-muted">{label}</span>
        <span className="font-mono tabular-nums text-hb-text">
          {used}
          {included !== null && ` / ${included}`}
        </span>
      </div>
      {included !== null && (
        <div className="mt-1">
          <Meter
            value={used}
            max={Math.max(1, included)}
            size="sm"
            aria-label={`${label} seats used`}
            tone={used > included ? 'error' : 'brand'}
          />
        </div>
      )}
    </div>
  )

  return (
    <div className="mx-auto max-w-hb-page pb-hb-10">
      <PageHeader
        eyebrow="Billing"
        title="Plan & billing"
        description={
          data?.payments_enabled
            ? 'Your plan, seats, renewal date and AI credits. Add seats and buy AI credits here; to change your plan, send a request and the Hybent team will set it up.'
            : 'Your plan, seats, renewal date and AI credits. To change your plan or seats, send a request and the Hybent team will set it up.'
        }
      />

      <div className="space-y-hb-6">
        <div className="grid gap-hb-4 lg:grid-cols-3">
          <Card padding="loose" className="flex flex-col">
            <div className="flex items-center gap-3">
              <IconTile size="sm">
                <CreditCard />
              </IconTile>
              <p className="font-mono text-hb-label uppercase text-hb-muted">Current plan</p>
            </div>
            {isLoading ? (
              <p className="mt-4 text-hb-sm text-hb-muted">Loading…</p>
            ) : sub ? (
              <>
                <div className="mt-4 flex items-center gap-2">
                  <p className="font-display text-hb-h2 text-hb-text">{sub.plan.name}</p>
                  <Badge tone={sub.status === 'active' ? 'success' : 'info'}>{sub.status}</Badge>
                </div>
                <p className="mt-1 text-hb-sm text-hb-muted">
                  {sub.plan.is_custom ? 'Custom pricing' : `${formatUsd(sub.plan.price_monthly)}/month · ${sub.plan.billed_label}`}
                </p>
                {!sub.plan.is_custom && totalExtra > 0 && data?.monthly_total_usd != null && (
                  <p className="mt-1 text-hb-sm text-hb-muted">
                    With {totalExtra} extra seat{totalExtra === 1 ? '' : 's'}: {formatUsd(data.monthly_total_usd)}/month
                  </p>
                )}
                {sub.current_period_end && (
                  <p className="mt-3 text-hb-sm text-hb-text">
                    {data?.stripe_managed ? 'Renews automatically' : 'Renews'}{' '}
                    {new Date(sub.current_period_end).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                )}
                {sub.status === 'past_due' && (
                  <p role="status" className="mt-1 text-hb-xs text-hb-warning">
                    Your last payment failed. Stripe will retry; check the email from Stripe to update your card.
                  </p>
                )}
                {sub.trial_end && new Date(sub.trial_end) > new Date() && (
                  <p className="mt-1 text-hb-xs text-hb-muted">
                    Trial ends {new Date(sub.trial_end).toLocaleDateString()}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-4 text-hb-sm text-hb-muted">
                No plan yet. Choose one below and we&apos;ll set it up for you.
              </p>
            )}
          </Card>

          <Card padding="loose" className="flex flex-col">
            <div className="flex items-center gap-3">
              <IconTile size="sm">
                <Users />
              </IconTile>
              <p className="font-mono text-hb-label uppercase text-hb-muted">Seats</p>
            </div>
            {seatsUsed && (
              <div className="mt-4 space-y-3">
                {seatRow(
                  currentExtra.admin > 0 ? `Admins (incl. ${currentExtra.admin} extra)` : 'Admins',
                  seatsUsed.admins,
                  seats ? seats.admins_allowed : null,
                )}
                {seatRow(
                  currentExtra.recruiter > 0 ? `Recruiters (incl. ${currentExtra.recruiter} extra)` : 'Recruiters',
                  seatsUsed.recruiters,
                  seats ? seats.recruiters_allowed : null,
                )}
                <p className="text-hb-xs text-hb-muted">Interviewers don&apos;t use a seat.</p>
                {seats && seats.admins_over > 0 && (
                  <p role="status" className="text-hb-xs text-hb-warning">
                    {seats.admins_over} more admin{seats.admins_over === 1 ? '' : 's'} than admin seats. Request extra admin
                    seats below.
                  </p>
                )}
                {seats && seats.recruiters_over > 0 && (
                  <p role="status" className="text-hb-xs text-hb-warning">
                    {seats.recruiters_over} more recruiter{seats.recruiters_over === 1 ? '' : 's'} than recruiter seats.
                    Request extra recruiter seats below.
                  </p>
                )}
              </div>
            )}
          </Card>

          <Card padding="loose" className="flex flex-col">
            <div className="flex items-center gap-3">
              <IconTile size="sm">
                <Coins />
              </IconTile>
              <p className="font-mono text-hb-label uppercase text-hb-muted">AI credits this month</p>
            </div>
            {credits && (
              <div className="mt-4">
                <p className="text-hb-sm text-hb-text">
                  <span className="font-mono tabular-nums">{credits.used.toLocaleString()}</span>
                  {' of '}
                  <span className="font-mono tabular-nums">{credits.monthly.toLocaleString()}</span> used
                </p>
                <div className="mt-2">
                  <Meter value={credits.used} max={Math.max(1, credits.monthly)} size="sm" aria-label="AI credits used" />
                </div>
                {credits.purchased > 0 && (
                  <p className="mt-2 text-hb-xs text-hb-muted">
                    Plus {credits.purchased.toLocaleString()} purchased credits.
                  </p>
                )}
                <Link to="/hiring/admin/ai-credits" className="mt-3 inline-block text-hb-sm font-semibold text-hb-blue hover:underline">
                  Manage AI credits
                </Link>
              </div>
            )}
          </Card>
        </div>

        <section aria-labelledby="plans-heading">
          <h2 id="plans-heading" className="mb-hb-4 font-display text-hb-h3 text-hb-text">
            Plans
          </h2>
          <div className="grid gap-hb-4 md:grid-cols-2 xl:grid-cols-4">
            {(data?.plans ?? []).map((p) => {
              const isCurrent = sub?.plan.name === p.name
              return (
                <Card
                  key={p.id}
                  padding="loose"
                  className={`flex flex-col ${isCurrent ? 'border-hb-blue/45' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-display text-hb-h3 text-hb-text">{p.name}</p>
                    {isCurrent ? (
                      <Badge tone="brand">Current</Badge>
                    ) : p.discount_pct ? (
                      <Badge tone="success">Save {p.discount_pct}%</Badge>
                    ) : null}
                  </div>
                  <p className="mt-2 flex items-baseline gap-1.5">
                    {p.is_custom ? (
                      <span className="hb-grad-text font-display text-hb-num">Let&apos;s talk</span>
                    ) : (
                      <>
                        <span className="hb-grad-text font-display text-hb-num">{formatUsd(p.price_monthly)}</span>
                        <span className="text-hb-xs text-hb-muted">/ month</span>
                      </>
                    )}
                  </p>
                  <p className="mt-1 text-hb-xs text-hb-muted">{p.billed_label}</p>
                  <ul className="mt-hb-4 flex-1 space-y-2 border-t border-hb-border pt-hb-4">
                    {[
                      p.is_custom
                        ? 'Seats and credits sized to your team'
                        : `${p.included_admins} admin + ${p.included_recruiters} recruiter seats`,
                      p.is_custom
                        ? 'Tailored onboarding and invoicing'
                        : `${p.ai_credits_monthly.toLocaleString()} AI credits a month`,
                    ].map((feat) => (
                      <li key={feat} className="flex items-start gap-2 text-hb-sm text-hb-muted">
                        <Check size={15} aria-hidden className="mt-0.5 shrink-0 text-hb-success" />
                        {feat}
                      </li>
                    ))}
                  </ul>
                  <Button
                    size="sm"
                    fullWidth
                    className="mt-hb-4"
                    variant={isCurrent ? 'ghost' : 'primary'}
                    disabled={isCurrent}
                    onClick={() => setRequest({ plan: p })}
                  >
                    {isCurrent ? 'Your plan' : p.is_custom ? 'Talk to sales' : 'Request this plan'}
                  </Button>
                </Card>
              )
            })}
          </div>
        </section>

        {sub && (
          <Card padding="loose">
            <h2 className="font-display text-hb-h3 text-hb-text">Extra seats</h2>
            <p className="mt-1 text-hb-sm text-hb-muted">
              Your plan includes {sub.plan.included_admins} admin and {sub.plan.included_recruiters} recruiter seats.
              Each extra seat adds AI credits to your monthly pool.
            </p>
            <div className="mt-hb-4 flex flex-wrap items-end gap-3">
              {SEAT_ROLES.map((role) => (
                <Input
                  key={role}
                  label={`Extra ${ROLE_LABEL[role]} seats`}
                  description={
                    prices
                      ? `${formatUsd(prices[role].price_usd)}/month, +${prices[role].ai_credits.toLocaleString()} credits each`
                      : undefined
                  }
                  type="number"
                  min={0}
                  max={100}
                  value={seatDrafts[role] ?? String(currentExtra[role])}
                  onChange={(e) => setSeatDrafts((d) => ({ ...d, [role]: e.target.value }))}
                  fieldClassName="w-[230px]"
                />
              ))}
              {canPaySeats ? (
                <Button size="sm" onClick={() => setBuySeats(seatsToAdd)}>
                  Add seats · {formatUsdCents(proratedCost(seatsToAdd))}
                </Button>
              ) : (
                <Button size="sm" disabled={!seatDraftChanged} onClick={() => setRequest({ seats: draft })}>
                  Request seats
                </Button>
              )}
            </div>
            {seatPricesNow && sub.current_period_end && (
              <p className="mt-3 text-hb-xs text-hb-muted">
                New seats are charged for the rest of this term (until{' '}
                {new Date(sub.current_period_end).toLocaleDateString()}), then renew with your plan. Removing seats is a
                request to the Hybent team.
              </p>
            )}
          </Card>
        )}

        {payments && payments.length > 0 && (
          <Card padding="loose">
            <div className="flex items-center gap-3">
              <IconTile size="sm">
                <Receipt />
              </IconTile>
              <h2 className="font-display text-hb-h3 text-hb-text">Payments</h2>
            </div>
            <ul className="mt-hb-4 divide-y divide-hb-border">
              {payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-hb-sm">
                  <span className="min-w-0">
                    <span className="text-hb-text">{p.description}</span>
                    <span className="ml-2 text-hb-xs text-hb-muted">{PAYMENT_KIND_LABEL[p.kind] ?? p.kind}</span>
                  </span>
                  <span className="flex items-baseline gap-3">
                    <span className="text-hb-xs text-hb-muted">
                      {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : ''}
                    </span>
                    <span className="font-mono tabular-nums text-hb-text">{formatUsdCents(p.amount_usd)}</span>
                    {p.receipt_url && (
                      <a href={p.receipt_url} target="_blank" rel="noreferrer" className="text-hb-xs font-semibold text-hb-blue hover:underline">
                        Invoice
                      </a>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <Dialog
        open={!!buySeats}
        onClose={() => setBuySeats(null)}
        title="Add seats"
        description="You'll pay securely with Stripe. The seats are added as soon as the payment goes through."
        size="sm"
        footer={
          <>
            <Button variant="quiet" size="sm" onClick={() => setBuySeats(null)}>
              Cancel
            </Button>
            <Button size="sm" loading={redirecting} onClick={startSeatCheckout}>
              Continue to payment
            </Button>
          </>
        }
      >
        {buySeats && (
          <div className="space-y-2 pb-2 text-hb-sm">
            {SEAT_ROLES.filter((role) => buySeats[role] > 0).map((role) => (
              <p key={role} className="flex justify-between gap-3 text-hb-text">
                <span>
                  {buySeats[role]} extra {ROLE_LABEL[role]} seat{buySeats[role] === 1 ? '' : 's'}
                </span>
                <span className="font-mono tabular-nums">{formatUsdCents(buySeats[role] * (seatPricesNow?.[role] ?? 0))}</span>
              </p>
            ))}
            <p className="flex justify-between gap-3 border-t border-hb-border pt-2 font-semibold text-hb-text">
              <span>Due now</span>
              <span className="font-mono tabular-nums">{formatUsdCents(proratedCost(buySeats))}</span>
            </p>
            <p className="text-hb-xs text-hb-muted">
              Covers the rest of this term{sub?.current_period_end ? ` (until ${new Date(sub.current_period_end).toLocaleDateString()})` : ''}.
              {data?.stripe_managed
                ? ` From then on each seat renews with your plan (${formatUsd(seatCost(buySeats))}/month more), adding ${seatCredits(buySeats).toLocaleString()} AI credits a month.`
                : ` Adds ${seatCredits(buySeats).toLocaleString()} AI credits a month.`}
            </p>
          </div>
        )}
      </Dialog>

      <Dialog
        open={!!request}
        onClose={() => setRequest(null)}
        title={request?.plan ? `Request ${request.plan.name}` : 'Request extra seats'}
        description="We'll send this to the Hybent team. They'll confirm the change and send an invoice before anything changes on your account."
        size="sm"
        footer={
          <>
            <Button variant="quiet" size="sm" onClick={() => setRequest(null)}>
              Cancel
            </Button>
            <Button size="sm" loading={sending} onClick={sendRequest}>
              Send request
            </Button>
          </>
        }
      >
        <div className="space-y-hb-4 pb-2">
          <p className="text-hb-sm text-hb-text">
            {request?.plan
              ? request.plan.is_custom
                ? 'A Custom plan, with seats and credits sized to your team.'
                : `${request.plan.name}: ${formatUsd(request.plan.price_monthly)}/month, ${request.plan.billed_label.toLowerCase()}.`
              : request?.seats
                ? `${request.seats.admin} extra admin and ${request.seats.recruiter} extra recruiter seat${request.seats.recruiter === 1 ? '' : 's'} (currently ${currentExtra.admin} and ${currentExtra.recruiter}): ${formatUsd(seatCost(request.seats))}/month, adding ${seatCredits(request.seats).toLocaleString()} AI credits a month.`
                : null}
          </p>
          <Input
            label="Anything we should know? (optional)"
            value={note}
            maxLength={1000}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </Dialog>
    </div>
  )
}
