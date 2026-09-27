import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Copy } from 'lucide-react'

import { superAdminApi, type PlanInfo } from '@/api/superAdmin'
import type { Payment } from '@/api/billing'
import { Badge, Button, Dialog, Input, Select } from '@/components/hb'
import { toPaymentLinkPayload, type PaymentLinkDraft } from './paymentLink'

/**
 * What a plan payment link charges: the plan, extra admin and recruiter
 * seats, or a Custom plan's agreed price and term, with the server's quote
 * shown live. Used by the onboarding wizard and by "Payment link" on the
 * Billing page for existing clients.
 */

const TERM_OPTIONS = [
  { value: '1', label: '1 month' },
  { value: '6', label: '6 months' },
  { value: '12', label: '12 months' },
]

const TERM_LABEL: Record<number, string> = { 1: 'month', 6: '6 months', 12: 'year' }

const formatUsd = (val: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(val)

export function PaymentLinkFields({
  draft,
  onChange,
  plans,
  showPlan = true,
}: {
  draft: PaymentLinkDraft
  onChange: (next: PaymentLinkDraft) => void
  plans: PlanInfo[]
  /** The wizard has its own plan picker. */
  showPlan?: boolean
}) {
  const plan = plans.find((p) => p.name === draft.plan_name)
  const isCustom = !!plan?.is_custom
  const payload = toPaymentLinkPayload(draft, isCustom)
  const ready = !!plan && (!isCustom || (payload.custom_amount_usd ?? 0) >= 0.5)

  const { data: quote, error } = useQuery({
    queryKey: ['super-admin', 'payment-quote', payload],
    queryFn: () => superAdminApi.quotePaymentLink(payload),
    enabled: ready,
    retry: false,
  })

  const set = (patch: Partial<PaymentLinkDraft>) => onChange({ ...draft, ...patch })

  return (
    <div className="space-y-hb-4">
      {showPlan && (
        <Select
          label="Plan"
          value={draft.plan_name}
          onChange={(e) => set({ plan_name: e.target.value })}
          options={plans.map((p) => ({
            value: p.name,
            label: p.is_custom ? `${p.name} (agreed price)` : `${p.name} · ${p.billed_label}`,
          }))}
        />
      )}

      {isCustom ? (
        <div className="grid gap-hb-4 sm:grid-cols-2">
          <Input
            label="Agreed price (USD)"
            type="number"
            min={1}
            step="0.01"
            value={draft.custom_amount_usd}
            onChange={(e) => set({ custom_amount_usd: e.target.value })}
            description="Charged once for the whole term."
          />
          <Select
            label="Term"
            value={draft.custom_term_months}
            onChange={(e) => set({ custom_term_months: e.target.value })}
            options={TERM_OPTIONS}
          />
        </div>
      ) : (
        <div className="grid gap-hb-4 sm:grid-cols-2">
          <Input
            label="Extra admin seats"
            description={`${plan?.included_admins ?? 1} included · $15/month each`}
            type="number"
            min={0}
            max={100}
            value={draft.extra_admin_seats}
            onChange={(e) => set({ extra_admin_seats: e.target.value })}
          />
          <Input
            label="Extra recruiter seats"
            description={`${plan?.included_recruiters ?? 2} included · $10/month each`}
            type="number"
            min={0}
            max={100}
            value={draft.extra_recruiter_seats}
            onChange={(e) => set({ extra_recruiter_seats: e.target.value })}
          />
        </div>
      )}

      <div className="rounded-hb-md border border-hb-border p-3.5" aria-live="polite">
        {!ready ? (
          <p className="text-hb-sm text-hb-muted">Enter the agreed price to see the total.</p>
        ) : error ? (
          <p className="text-hb-sm text-hb-error">
            {(error as any).response?.data?.message || 'Could not price this link.'}
          </p>
        ) : quote ? (
          <>
            <ul className="space-y-1">
              {quote.lines.map((line) => (
                <li key={line.label} className="flex justify-between gap-3 text-hb-sm text-hb-muted">
                  <span>{line.label}</span>
                  <span className="font-mono tabular-nums">{formatUsd(line.amount_usd)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 flex items-baseline justify-between gap-3 border-t border-hb-border pt-2 text-hb-sm font-semibold text-hb-text">
              <span>
                Client pays{' '}
                <Badge tone={quote.recurring ? 'brand' : 'info'}>
                  {quote.recurring ? `every ${TERM_LABEL[quote.term_months] ?? `${quote.term_months} months`}` : 'once'}
                </Badge>
              </span>
              <span className="font-mono tabular-nums">{formatUsd(quote.amount_usd)}</span>
            </p>
            {!quote.payments_enabled && (
              <p className="mt-2 text-hb-xs text-hb-warning">
                Stripe isn&apos;t configured (STRIPE_SECRET_KEY), so payment links can&apos;t be created yet.
              </p>
            )}
          </>
        ) : (
          <p className="text-hb-sm text-hb-muted">Calculating…</p>
        )}
      </div>
    </div>
  )
}

/** Shown once a link is created: the URL to send, and whether it was emailed. */
export function PaymentLinkCreatedDialog({
  payment,
  emailed,
  onClose,
  closeLabel = 'Done',
}: {
  payment: Payment | null
  emailed: boolean
  onClose: () => void
  closeLabel?: string
}) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    if (!payment?.pay_url) return
    try {
      await navigator.clipboard.writeText(payment.pay_url)
      setCopied(true)
      toast.success('Link copied.')
    } catch {
      toast.error('Copy failed. Select the link and copy it.')
    }
  }
  return (
    <Dialog
      open={!!payment}
      onClose={onClose}
      title="Payment link ready"
      description={
        emailed
          ? "We've emailed it to the client's admin. You can also copy it and send it yourself."
          : 'Copy the link and send it to the client.'
      }
      size="sm"
      footer={
        <Button size="sm" onClick={onClose}>
          {closeLabel}
        </Button>
      }
    >
      {payment && (
        <div className="space-y-hb-4 pb-2">
          <p className="text-hb-sm text-hb-text">
            {payment.description}: <span className="font-mono tabular-nums">{formatUsd(payment.amount_usd)}</span>
          </p>
          <div className="flex items-end gap-2">
            <Input label="Payment link" readOnly value={payment.pay_url ?? ''} onFocus={(e) => e.target.select()} fieldClassName="flex-1" />
            <Button size="sm" variant="ghost" icon={<Copy size={14} />} onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <p className="text-hb-xs text-hb-muted">
            Valid until {payment.expires_at ? new Date(payment.expires_at).toLocaleDateString() : '—'}. Once it&apos;s paid,
            the plan and seats apply automatically. A new client&apos;s workspace and admin are activated, and the admin
            gets an email to set a password.
          </p>
        </div>
      )}
    </Dialog>
  )
}
