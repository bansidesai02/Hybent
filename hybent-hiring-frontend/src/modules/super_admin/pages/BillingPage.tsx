import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Check, Copy, CreditCard, Link2, Receipt } from 'lucide-react'

import { superAdminApi, type PlanInfo } from '@/api/superAdmin'
import type { Payment } from '@/api/billing'
import { PaymentLinkCreatedDialog, PaymentLinkFields } from '../components/PaymentLinkFields'
import { EMPTY_PAYMENT_LINK, toPaymentLinkPayload, type PaymentLinkDraft } from '../components/paymentLink'
import {
  Badge,
  Button,
  Card,
  type Column,
  DataTable,
  Dialog,
  Input,
  PageHeader,
  Select,
  StatCard,
  StatGrid,
  Switch,
} from '@/components/hb'

/**
 * The published plans (hybent.com/pricing) and who is on which.
 *
 * Plans come from the database, so the cards always match what clients are
 * billed. Every plan includes 1 admin + 2 recruiter seats and 10,000 AI
 * credits a month; extra admin seats ($15, +1,500 credits) and recruiter
 * seats ($10, +1,000 credits) are set per organization.
 *
 * Plans are sold after a demo: "Payment link" sends a client a Stripe link
 * for a plan and seats, and paying it applies them (the Payments table
 * tracks every link, seat purchase, top-up and renewal). Admins buy extra
 * seats and AI credits online themselves; other changes they request arrive
 * at info@hybent.com and are applied here with "Change plan" (no charge).
 */

const formatUsd = (val: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val)

const STATUS_TONE: Record<string, 'success' | 'info' | 'error' | 'warning'> = {
  active: 'success',
  pending: 'info',
  past_due: 'warning',
  suspended: 'error',
  expired: 'error',
}

const PAYMENT_TONE: Record<string, 'success' | 'info' | 'error' | 'neutral'> = {
  paid: 'success',
  pending: 'info',
  failed: 'error',
  expired: 'neutral',
  canceled: 'neutral',
}

const PAYMENT_KIND_LABEL: Record<string, string> = {
  subscription: 'Plan link',
  seats: 'Extra seats',
  topup: 'AI credits',
  renewal: 'Renewal',
}

const formatUsdCents = (val: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(val)

interface ClientRow {
  id: string
  name: string
  slug: string
  plan: string
  term_months: number | null
  extra_admin_seats: number
  extra_recruiter_seats: number
  current_period_end: string | null
  status: string
  mrr: number
  users_count: number
  users_limit: number
  seats_used: number
}

function termLabel(term: number | null) {
  if (term === null) return 'Custom'
  if (term === 1) return 'Monthly'
  return `${term} months`
}

export default function BillingPage() {
  const queryClient = useQueryClient()
  const { data: clients, isLoading } = useQuery({
    queryKey: ['super-admin', 'clients'],
    queryFn: () => superAdminApi.getClients(),
  })
  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['super-admin', 'plans'],
    queryFn: () => superAdminApi.getPlans(),
  })

  const [editing, setEditing] = useState<ClientRow | null>(null)
  const [planName, setPlanName] = useState('')
  const [extraAdmins, setExtraAdmins] = useState('0')
  const [extraRecruiters, setExtraRecruiters] = useState('0')
  const [saving, setSaving] = useState(false)

  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ['super-admin', 'payments'],
    queryFn: () => superAdminApi.getPayments(),
  })
  const [linkFor, setLinkFor] = useState<ClientRow | null>(null)
  const [linkDraft, setLinkDraft] = useState<PaymentLinkDraft>(EMPTY_PAYMENT_LINK)
  const [sendEmail, setSendEmail] = useState(true)
  const [creatingLink, setCreatingLink] = useState(false)
  const [createdLink, setCreatedLink] = useState<(Payment & { emailed: boolean }) | null>(null)
  const [busyPayment, setBusyPayment] = useState<string | null>(null)

  const refreshPayments = () => queryClient.invalidateQueries({ queryKey: ['super-admin', 'payments'] })

  const openLink = (client: ClientRow) => {
    setLinkFor(client)
    const plan = client.plan === 'No plan' ? 'Standard' : client.plan
    setLinkDraft({
      ...EMPTY_PAYMENT_LINK,
      plan_name: plan,
      extra_admin_seats: String(client.extra_admin_seats || 0),
      extra_recruiter_seats: String(client.extra_recruiter_seats || 0),
    })
    setSendEmail(true)
  }

  const createLink = async () => {
    if (!linkFor) return
    const isCustom = !!planList.find((p) => p.name === linkDraft.plan_name)?.is_custom
    try {
      setCreatingLink(true)
      const created = await superAdminApi.createPaymentLink(linkFor.id, {
        ...toPaymentLinkPayload(linkDraft, isCustom),
        send_email: sendEmail,
      })
      setLinkFor(null)
      setCreatedLink(created)
      refreshPayments()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Could not create the payment link.')
    } finally {
      setCreatingLink(false)
    }
  }

  const paymentAction = async (payment: Payment, action: 'copy' | 'resend' | 'cancel') => {
    if (action === 'copy') {
      try {
        await navigator.clipboard.writeText(payment.pay_url ?? '')
        toast.success('Link copied.')
      } catch {
        toast.error('Copy failed.')
      }
      return
    }
    try {
      setBusyPayment(payment.id)
      if (action === 'resend') {
        await superAdminApi.resendPayment(payment.id)
        toast.success('Payment link emailed to the client’s admin.')
      } else {
        await superAdminApi.cancelPayment(payment.id)
        toast.success('Payment link cancelled.')
        refreshPayments()
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Something went wrong.')
    } finally {
      setBusyPayment(null)
    }
  }

  const rows = (clients ?? []) as ClientRow[]
  const planList = (plans ?? []) as PlanInfo[]
  const totalMrr = rows.reduce((sum, c) => sum + (c.mrr || 0), 0)
  const activeCount = rows.filter((c) => c.status === 'active').length

  const openChange = (client: ClientRow) => {
    setEditing(client)
    setPlanName(client.plan === 'No plan' ? planList[0]?.name ?? '' : client.plan)
    setExtraAdmins(String(client.extra_admin_seats || 0))
    setExtraRecruiters(String(client.extra_recruiter_seats || 0))
  }

  const saveChange = async () => {
    if (!editing) return
    const admins = parseInt(extraAdmins, 10)
    const recruiters = parseInt(extraRecruiters, 10)
    if ([admins, recruiters].some((n) => Number.isNaN(n) || n < 0)) {
      toast.error('Extra seats must be 0 or more.')
      return
    }
    try {
      setSaving(true)
      await superAdminApi.updateClient(editing.id, {
        plan_name: planName,
        extra_admin_seats: admins,
        extra_recruiter_seats: recruiters,
      })
      toast.success(`${editing.name} is now on ${planName}.`)
      setEditing(null)
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'clients'] })
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'plans'] })
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Could not change the plan.')
    } finally {
      setSaving(false)
    }
  }

  const columns: Array<Column<ClientRow>> = [
    {
      key: 'name',
      header: 'Organisation',
      cardTitle: true,
      cell: (client) => (
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-hb-sm bg-hb-grad font-mono text-hb-micro font-bold text-white">
            {client.name.substring(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-hb-sm font-semibold text-hb-text">{client.name}</span>
            <span className="block truncate text-hb-xs text-hb-muted">{client.slug}.hybent.com</span>
          </span>
        </span>
      ),
    },
    { key: 'plan', header: 'Plan', cell: (c) => <Badge>{c.plan}</Badge> },
    {
      key: 'term',
      header: 'Term',
      cell: (c) => <span className="text-hb-muted">{c.plan === 'No plan' ? '—' : termLabel(c.term_months)}</span>,
    },
    {
      key: 'seats',
      header: 'Seats (admins + recruiters)',
      cell: (c) => (
        <span className="font-mono text-hb-sm tabular-nums text-hb-text">
          {c.seats_used} / {c.users_limit}
          {(c.extra_admin_seats > 0 || c.extra_recruiter_seats > 0) && (
            <span className="ml-1.5 text-hb-xs text-hb-muted">
              (+{c.extra_admin_seats} admin, +{c.extra_recruiter_seats} recruiter)
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'renews',
      header: 'Renews',
      cell: (c) => (
        <span className="text-hb-sm text-hb-muted">
          {c.current_period_end ? new Date(c.current_period_end).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      key: 'mrr',
      header: 'MRR',
      align: 'right',
      cell: (c) => <span className="font-mono tabular-nums text-hb-text">{formatUsd(c.mrr)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (c) => <Badge tone={STATUS_TONE[c.status] ?? 'neutral'}>{c.status}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (c) => (
        <span className="inline-flex gap-1.5">
          <Button size="sm" variant="ghost" icon={<Link2 size={14} />} onClick={() => openLink(c)}>
            Payment link
          </Button>
          <Button size="sm" variant="ghost" onClick={() => openChange(c)}>
            Change plan
          </Button>
        </span>
      ),
    },
  ]

  const paymentColumns: Array<Column<Payment>> = [
    {
      key: 'org',
      header: 'Organisation',
      cardTitle: true,
      cell: (p) => <span className="text-hb-sm font-semibold text-hb-text">{p.organization_name}</span>,
    },
    {
      key: 'what',
      header: 'Payment',
      cell: (p) => (
        <span className="min-w-0">
          <span className="block text-hb-sm text-hb-text">{p.description}</span>
          <span className="block text-hb-xs text-hb-muted">{PAYMENT_KIND_LABEL[p.kind] ?? p.kind}</span>
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (p) => <span className="font-mono tabular-nums text-hb-text">{formatUsdCents(p.amount_usd)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (p) => <Badge tone={PAYMENT_TONE[p.status] ?? 'neutral'}>{p.status}</Badge>,
    },
    {
      key: 'date',
      header: 'Date',
      cell: (p) => (
        <span className="text-hb-sm text-hb-muted">{new Date(p.paid_at ?? p.created_at).toLocaleDateString()}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (p) =>
        p.kind === 'subscription' && p.status === 'pending' ? (
          <span className="inline-flex gap-1.5">
            <Button size="sm" variant="ghost" icon={<Copy size={14} />} onClick={() => paymentAction(p, 'copy')}>
              Copy
            </Button>
            <Button size="sm" variant="ghost" loading={busyPayment === p.id} onClick={() => paymentAction(p, 'resend')}>
              Resend
            </Button>
            <Button size="sm" variant="quiet" disabled={busyPayment === p.id} onClick={() => paymentAction(p, 'cancel')}>
              Cancel
            </Button>
          </span>
        ) : p.receipt_url ? (
          <a href={p.receipt_url} target="_blank" rel="noreferrer" className="text-hb-xs font-semibold text-hb-blue hover:underline">
            Invoice
          </a>
        ) : null,
    },
  ]

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Platform"
        title="Billing & plans"
        description="The published plans, every organisation's plan, term and seats, and their payments. Send a client a Stripe payment link after their demo; changes admins request arrive at info@hybent.com."
      />

      <div className="space-y-hb-5">
        <StatGrid className="xl:grid-cols-3">
          <StatCard label="Total MRR" value={formatUsd(totalMrr)} icon={<CreditCard />} loading={isLoading} />
          <StatCard label="Active contracts" value={activeCount} loading={isLoading} />
          <StatCard label="Total tenants" value={rows.length} loading={isLoading} />
        </StatGrid>

        <div className="grid gap-hb-4 md:grid-cols-2 xl:grid-cols-4">
          {(plansLoading ? [] : planList).map((p) => (
            <Card key={p.id} padding="loose" className="relative flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <p className="font-display text-hb-h3 text-hb-text">{p.name}</p>
                {p.discount_pct ? <Badge tone="success">Save {p.discount_pct}%</Badge> : null}
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

              <ul className="mt-hb-4 space-y-2.5 border-t border-hb-border pt-hb-4">
                {(p.is_custom
                  ? ['Seats and price set per client', 'Recruiter Copilot', 'AI credits set on the AI credits page', 'Tailored onboarding and invoicing']
                  : [
                      `${p.included_admins} admin + ${p.included_recruiters} recruiter seats`,
                      'Recruiter Copilot',
                      `${p.ai_credits_monthly.toLocaleString()} AI credits a month`,
                      'Extra admin seat: $15/month, +1,500 credits',
                      'Extra recruiter seat: $10/month, +1,000 credits',
                    ]
                ).map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5 text-hb-sm text-hb-muted">
                    <Check size={15} aria-hidden className="mt-0.5 shrink-0 text-hb-success" />
                    {feat}
                  </li>
                ))}
              </ul>
              <p className="mt-hb-4 text-hb-xs text-hb-dim">
                {p.subscribers ?? 0} organisation{p.subscribers === 1 ? '' : 's'}
              </p>
            </Card>
          ))}
        </div>

        <Card padding="none">
          <div className="border-b border-hb-border px-5 py-4 xl:px-7">
            <h2 className="inline-flex items-center gap-2 font-display text-hb-h3 text-hb-text">
              <CreditCard size={18} aria-hidden className="text-hb-cyan" />
              Billing contracts
            </h2>
          </div>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(c) => c.id}
            loading={isLoading}
            caption="Billing contracts by organisation"
            empty={{
              icon: <CreditCard />,
              title: 'No billing contracts',
              description: 'Contracts appear here once a tenant is onboarded.',
              size: 'page',
            }}
          />
        </Card>

        <Card padding="none">
          <div className="border-b border-hb-border px-5 py-4 xl:px-7">
            <h2 className="inline-flex items-center gap-2 font-display text-hb-h3 text-hb-text">
              <Receipt size={18} aria-hidden className="text-hb-cyan" />
              Payments
            </h2>
          </div>
          <DataTable
            columns={paymentColumns}
            rows={payments ?? []}
            rowKey={(p) => p.id}
            loading={paymentsLoading}
            caption="Payments and payment links"
            empty={{
              icon: <Receipt />,
              title: 'No payments yet',
              description: 'Payment links, seat purchases, top-ups and renewals appear here.',
            }}
          />
        </Card>
      </div>

      <Dialog
        open={!!linkFor}
        onClose={() => setLinkFor(null)}
        title={linkFor ? `Payment link · ${linkFor.name}` : 'Payment link'}
        description="A Stripe link for a plan and seats. Paying it applies them and starts a subscription that renews every term. It replaces any unpaid link for this client."
        size="md"
        footer={
          <>
            <Button variant="quiet" size="sm" onClick={() => setLinkFor(null)}>
              Cancel
            </Button>
            <Button size="sm" loading={creatingLink} onClick={createLink}>
              Create link
            </Button>
          </>
        }
      >
        <div className="space-y-hb-4 pb-2">
          <PaymentLinkFields draft={linkDraft} onChange={setLinkDraft} plans={planList} />
          <Switch label="Email the link to the client's admin" checked={sendEmail} onChange={setSendEmail} />
        </div>
      </Dialog>

      <PaymentLinkCreatedDialog
        payment={createdLink}
        emailed={!!createdLink?.emailed}
        onClose={() => setCreatedLink(null)}
      />

      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Change plan · ${editing.name}` : 'Change plan'}
        description="A new plan starts a new term today. Extra admin seats are $15/month (+1,500 AI credits); extra recruiter seats are $10/month (+1,000)."
        size="sm"
        footer={
          <>
            <Button variant="quiet" size="sm" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button size="sm" loading={saving} disabled={!planName} onClick={saveChange}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-hb-4 pb-2">
          <Select
            label="Plan"
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
            options={planList.map((p) => ({
              value: p.name,
              label: p.is_custom ? `${p.name} (priced by sales)` : `${p.name} · ${formatUsd(p.price_monthly)}/mo`,
            }))}
          />
          <div className="grid gap-hb-4 sm:grid-cols-2">
            <Input
              label="Extra admin seats"
              description="$15/month, +1,500 credits each"
              type="number"
              min={0}
              value={extraAdmins}
              onChange={(e) => setExtraAdmins(e.target.value)}
            />
            <Input
              label="Extra recruiter seats"
              description="$10/month, +1,000 credits each"
              type="number"
              min={0}
              value={extraRecruiters}
              onChange={(e) => setExtraRecruiters(e.target.value)}
            />
          </div>
        </div>
      </Dialog>
    </div>
  )
}
