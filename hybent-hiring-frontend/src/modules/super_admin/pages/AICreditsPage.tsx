import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Coins, DollarSign, Sparkles } from 'lucide-react'

import { superAdminApi, type OrgAICredits } from '@/api/superAdmin'
import {
  Badge,
  Button,
  CellStack,
  type Column,
  DataTable,
  Dialog,
  Input,
  Meter,
  PageHeader,
  StatCard,
  StatGrid,
} from '@/components/hb'

/**
 * AI credits across every organization.
 *
 * 1 credit = $0.001 of provider cost, sold at $0.002. Top-up requests from
 * org admins arrive at info@hybent.com; once paid, add them here. A custom
 * monthly allowance overrides the plan's (Custom plans).
 */

const PACKS = [5000, 20000, 50000]

/** Small AI costs are fractions of a cent, so show up to four decimals under $1. */
const usd = (v: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: v !== 0 && Math.abs(v) < 1 ? 4 : 2,
  }).format(v)

export default function AICreditsPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['super-admin', 'ai-credits'],
    queryFn: () => superAdminApi.getAICredits(),
  })
  const rows = data || []

  const [editing, setEditing] = useState<OrgAICredits | null>(null)
  const [addPurchased, setAddPurchased] = useState('')
  const [monthly, setMonthly] = useState('')
  const [saving, setSaving] = useState(false)

  const open = (org: OrgAICredits) => {
    setEditing(org)
    setAddPurchased('')
    setMonthly(org.custom_monthly_credits != null ? String(org.custom_monthly_credits) : '')
  }

  const save = async (resetToPlan = false) => {
    if (!editing) return
    const add = addPurchased ? parseInt(addPurchased, 10) : 0
    const custom = monthly ? parseInt(monthly, 10) : null
    if (Number.isNaN(add) || add < 0 || (custom !== null && (Number.isNaN(custom) || custom < 0))) {
      toast.error('Enter whole numbers of credits.')
      return
    }
    const payload: Record<string, number | null> = { add_purchased: add }
    if (resetToPlan) payload.monthly_credits = null
    else if (custom !== editing.custom_monthly_credits) payload.monthly_credits = custom
    try {
      setSaving(true)
      await superAdminApi.updateAICredits(editing.organization_id, payload)
      toast.success('AI credits updated.')
      setEditing(null)
      refetch()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Could not update AI credits.')
    } finally {
      setSaving(false)
    }
  }

  const totalCost = rows.reduce((sum, r) => sum + r.provider_cost_usd, 0)
  const totalValue = rows.reduce((sum, r) => sum + r.credits_value_usd, 0)
  const totalUsed = rows.reduce((sum, r) => sum + r.used_credits, 0)

  const columns: Array<Column<OrgAICredits>> = [
    {
      key: 'org',
      header: 'Organization',
      cardTitle: true,
      cell: (r) => <CellStack primary={r.organization_name} secondary={r.plan || 'No plan'} />,
    },
    {
      key: 'used',
      header: 'Used this month',
      cell: (r) =>
        r.monthly_credits == null ? (
          <span className="text-hb-sm text-hb-muted">No AI use yet</span>
        ) : (
          <div className="min-w-[160px]">
            <span className="font-mono text-hb-sm tabular-nums text-hb-text">
              {r.used_credits.toLocaleString()} / {r.monthly_credits.toLocaleString()}
            </span>
            {r.custom_monthly_credits != null && (
              <Badge tone="info" className="ml-2">Custom</Badge>
            )}
            <div className="mt-1">
              <Meter
                value={r.used_credits}
                max={Math.max(1, r.monthly_credits)}
                size="sm"
                aria-label={`${r.organization_name} credits used`}
                tone={r.used_credits >= r.monthly_credits ? 'error' : 'brand'}
              />
            </div>
          </div>
        ),
    },
    {
      key: 'purchased',
      header: 'Purchased left',
      align: 'right',
      cell: (r) => <span className="font-mono tabular-nums">{r.purchased_credits.toLocaleString()}</span>,
    },
    {
      key: 'cost',
      header: 'Provider cost',
      align: 'right',
      cell: (r) => <span className="font-mono tabular-nums">{usd(r.provider_cost_usd)}</span>,
    },
    {
      key: 'value',
      header: 'Credits value',
      align: 'right',
      cell: (r) => <span className="font-mono tabular-nums">{usd(r.credits_value_usd)}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (r) => (
        <Button size="sm" variant="ghost" onClick={() => open(r)}>
          Manage
        </Button>
      ),
    },
  ]

  return (
    <div className="mx-auto max-w-hb-page pb-hb-10">
      <PageHeader
        eyebrow="Billing"
        title="AI credits"
        description="Each organization's monthly AI credits, top-ups and the provider cost behind them. 1 credit = $0.001 of cost, sold at $0.002."
      />

      <StatGrid>
        <StatCard label="Credits used this month" value={totalUsed.toLocaleString()} icon={<Coins />} loading={isLoading} />
        <StatCard label="Provider cost" value={usd(totalCost)} icon={<DollarSign />} loading={isLoading} />
        <StatCard label="Value at client price" value={usd(totalValue)} icon={<Sparkles />} loading={isLoading} />
      </StatGrid>

      <div className="mt-hb-6">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.organization_id}
          loading={isLoading}
          caption="AI credits by organization"
          empty={{ title: 'No organizations yet', description: 'Organizations appear here once created.' }}
        />
      </div>

      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `AI credits · ${editing.organization_name}` : 'AI credits'}
        description="Add paid top-up credits, or set a custom monthly allowance for a Custom plan. Leave the allowance empty to use the plan's."
        size="sm"
        footer={
          <>
            {editing?.custom_monthly_credits != null && (
              <Button variant="quiet" size="sm" disabled={saving} onClick={() => save(true)}>
                Use plan allowance
              </Button>
            )}
            <Button variant="quiet" size="sm" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button size="sm" loading={saving} onClick={() => save(false)}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-hb-5 pb-2">
          <div>
            <p className="font-mono text-hb-label uppercase text-hb-dim">Add top-up</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {PACKS.map((p) => (
                <Button
                  key={p}
                  size="sm"
                  fullWidth
                  variant={addPurchased === String(p) ? 'primary' : 'ghost'}
                  aria-pressed={addPurchased === String(p)}
                  onClick={() => setAddPurchased(String(p))}
                >
                  +{p.toLocaleString()}
                </Button>
              ))}
            </div>
            <div className="mt-2">
              <Input
                label="Or a custom number of credits"
                type="number"
                min={0}
                step={1000}
                value={addPurchased}
                onChange={(e) => setAddPurchased(e.target.value)}
              />
            </div>
          </div>
          <Input
            label="Custom monthly allowance"
            description="Replaces the plan's 10,000 credits a month."
            type="number"
            min={0}
            step={1000}
            placeholder="Plan allowance"
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
          />
        </div>
      </Dialog>
    </div>
  )
}
