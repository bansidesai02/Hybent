import { useQuery } from '@tanstack/react-query'
import { Check, CreditCard } from 'lucide-react'

import { superAdminApi } from '@/api/superAdmin'
import {
  Badge,
  Card,
  type Column,
  DataTable,
  PageHeader,
  StatCard,
  StatGrid,
} from '@/components/hb'

/**
 * The three subscription tiers, and who is on which.
 *
 * Rebuilt on the design system in phase 9. Beyond appearance:
 *
 * - Each plan card carried its own accent hex and tinted background (blue,
 *   violet, pink) alongside a "POPULAR" ribbon. The ribbon already says which
 *   one is being recommended; the other two colours said nothing.
 * - Every card ended in a full-width button reading "Default plan parameters"
 *   with no `onClick`. A control that cannot be actioned should not look like
 *   one — the limits are stated in the card body instead.
 * - One table header was `text(--text-light)`, which is not a class and never
 *   resolved.
 */

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val)

const PLANS = [
  {
    name: 'Starter',
    price: 8000,
    users: 20,
    jobs: 10,
    features: ['Basic AI parser', 'Phone interview scheduling', 'Basic analytics dashboard'],
  },
  {
    name: 'Pro',
    price: 24000,
    users: 50,
    jobs: 20,
    features: ['Deep AI scoring engine', 'Recorded video interviews', 'Bulk candidate import'],
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 60000,
    users: 999,
    jobs: 999,
    features: ['Unlimited AI scoring', 'Dedicated custom subdomain', 'Full CSV/Excel report export'],
  },
]

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
  status: string
  mrr: number
}

export default function BillingPage() {
  const { data: clients, isLoading } = useQuery({
    queryKey: ['super-admin', 'clients'],
    queryFn: () => superAdminApi.getClients(),
  })

  const rows = (clients ?? []) as ClientRow[]
  const totalMrr = rows.reduce((sum, c) => sum + (c.mrr || 0), 0)
  const activeCount = rows.filter((c) => c.status === 'active').length

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
            <span className="block truncate text-hb-sm font-semibold text-hb-text">
              {client.name}
            </span>
            <span className="block truncate text-hb-xs text-hb-muted">
              {client.slug}.hirreon.com
            </span>
          </span>
        </span>
      ),
    },
    { key: 'plan', header: 'Plan', width: '140px', cell: (c) => <Badge>{c.plan}</Badge> },
    {
      key: 'cycle',
      header: 'Cycle',
      width: '130px',
      cell: () => <span className="text-hb-muted">Monthly</span>,
    },
    {
      key: 'mrr',
      header: 'MRR',
      width: '140px',
      align: 'right',
      cell: (c) => (
        <span className="font-mono tabular-nums text-hb-text">{formatCurrency(c.mrr)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '120px',
      cell: (c) => <Badge tone={STATUS_TONE[c.status] ?? 'neutral'}>{c.status}</Badge>,
    },
  ]

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Platform"
        title="Billing & plans"
        description="Standard subscription packages, their limits, and every active billing contract."
      />

      <div className="space-y-hb-5">
        <StatGrid className="xl:grid-cols-3">
          <StatCard
            label="Total MRR"
            value={formatCurrency(totalMrr)}
            icon={<CreditCard />}
            loading={isLoading}
          />
          <StatCard label="Active contracts" value={activeCount} loading={isLoading} />
          <StatCard label="Total tenants" value={rows.length} loading={isLoading} />
        </StatGrid>

        <div className="grid gap-hb-4 md:grid-cols-3">
          {PLANS.map((p) => (
            <Card
              key={p.name}
              padding="loose"
              className={`relative flex flex-col ${p.popular ? 'border-hb-blue/45' : ''}`}
            >
              {p.popular && (
                <Badge tone="brand" className="absolute right-4 top-4">
                  Popular
                </Badge>
              )}

              <p className="font-display text-hb-h3 text-hb-text">{p.name}</p>
              <p className="mt-2 flex items-baseline gap-1.5">
                <span className="hb-grad-text font-display text-hb-num">
                  {formatCurrency(p.price)}
                </span>
                <span className="text-hb-xs text-hb-muted">/ month</span>
              </p>
              <p className="mt-1 text-hb-xs text-hb-muted">10% discount on yearly payments.</p>

              <ul className="mt-hb-4 space-y-2.5 border-t border-hb-border pt-hb-4">
                {[
                  `Up to ${p.users === 999 ? 'unlimited' : p.users} user accounts`,
                  `Up to ${p.jobs === 999 ? 'unlimited' : p.jobs} active jobs`,
                  ...p.features,
                ].map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5 text-hb-sm text-hb-muted">
                    <Check size={15} aria-hidden className="mt-0.5 shrink-0 text-hb-success" />
                    {feat}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>

        <Card padding="none">
          <div className="border-b border-hb-border px-5 py-4 xl:px-7">
            <h2 className="inline-flex items-center gap-2 font-display text-hb-h3 text-hb-text">
              <CreditCard size={18} aria-hidden className="text-hb-cyan" />
              Active billing contracts
            </h2>
          </div>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(c) => c.id}
            loading={isLoading}
            caption="Active billing contracts by organisation"
            empty={{
              icon: <CreditCard />,
              title: 'No billing contracts',
              description: 'Contracts appear here once a tenant is onboarded.',
              size: 'page',
            }}
          />
        </Card>
      </div>
    </div>
  )
}
