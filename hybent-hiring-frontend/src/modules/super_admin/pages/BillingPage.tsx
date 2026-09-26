import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Check, CreditCard } from 'lucide-react'

import { superAdminApi, type PlanInfo } from '@/api/superAdmin'
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
} from '@/components/hb'

/**
 * The published plans (hybent.com/pricing) and who is on which.
 *
 * Plans come from the database, so the cards always match what clients are
 * billed. Every plan includes 1 admin + 2 recruiter seats and 10,000 AI
 * credits a month; extra admin seats ($15, +1,500 credits) and recruiter
 * seats ($10, +1,000 credits) are set per organization. Admins
 * request changes from their own Billing page (emailed to info@hybent.com)
 * and they're applied here with "Change plan".
 */

const formatUsd = (val: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val)

const STATUS_TONE: Record<string, 'success' | 'info' | 'error'> = {
  active: 'success',
  pending: 'info',
  suspended: 'error',
}

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
        <Button size="sm" variant="ghost" onClick={() => openChange(c)}>
          Change plan
        </Button>
      ),
    },
  ]

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Platform"
        title="Billing & plans"
        description="The published plans, and every organisation's plan, term and seats. Changes admins request arrive at info@hybent.com; apply them here."
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
                  ? ['Seats and price set per client', 'AI credits set on the AI credits page', 'Tailored onboarding and invoicing']
                  : [
                      `${p.included_admins} admin + ${p.included_recruiters} recruiter seats`,
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
      </div>

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
