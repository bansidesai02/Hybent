import { useEffect, useId, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'
import { AlertTriangle, Coins, CreditCard, Download, History, TrendingUp, User as UserIcon, Users, Wallet } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import { aiApi } from '@/api/ai'
import { billingApi, redirectToCheckout } from '@/api/billing'
import { useAuthStore } from '@/store/authStore'
import {
  Button,
  Card,
  CellStack,
  ChartFrame,
  ChartTooltip,
  type Column,
  DataTable,
  Dialog,
  IconTile,
  Input,
  Meter,
  Pagination,
  PageHeader,
  Select,
  StatCard,
  StatusPill,
  Toolbar,
  ToolbarSearch,
  ToolbarFilters,
  axisProps,
  useChartTheme,
} from '@/components/hb'

/**
 * AI credits, usage and top-up.
 *
 * One credit is $0.001 of provider cost, priced from what each AI call
 * actually used. The organization shares a monthly pool (plus any purchased
 * top-ups); each person has a monthly limit within it, and a daily cap.
 *
 * Rebuilt on the design system in phase 6. The breakdown chart used to colour
 * each feature from a nine-entry hex map with a seven-entry fallback, so a
 * feature's colour changed whenever the ranking shifted and none of the hues
 * meant anything. One series colour; the axis labels carry the identity.
 */

const HISTORY_PAGE_SIZE = 10

/**
 * Warning copy is server-driven — the backend picks the level from the
 * remaining percentage, so the thresholds quoted here are its thresholds.
 */
const CREDIT_WARNINGS: Record<string, { tone: 'error' | 'warning'; message: string }> = {
  critical: {
    tone: 'error',
    message:
      "This month's AI credits are used up. AI features are paused until an admin buys a top-up or the monthly reset.",
  },
  danger: {
    tone: 'error',
    message: "Only 5% of this month's AI credits remain. An admin can buy a top-up to avoid interruption.",
  },
  warning: {
    tone: 'warning',
    message: "Only 10% of this month's AI credits remain.",
  },
  low: {
    tone: 'warning',
    message: "Only 25% of this month's AI credits remain.",
  },
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All status' },
  { value: 'success', label: 'Success' },
  { value: 'failure', label: 'Failure' },
]

const PROVIDER_OPTIONS = [
  { value: 'all', label: 'All providers' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'groq', label: 'Groq' },
  { value: 'huggingface', label: 'HuggingFace' },
]


/** `jd_generation` → `Jd Generation`. */
function formatFeatureName(name: string) {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** A call's exact credits: often a fraction (an embedding is ~0.01). */
function formatCredits(value: number) {
  if (value > 0 && value < 0.01) return '<0.01'
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export default function AICreditsPage() {
  const chart = useChartTheme()
  const packGroupId = useId()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'

  const [balance, setBalance] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [usageByFeature, setUsageByFeature] = useState<any>({})
  const [usageOverTime, setUsageOverTime] = useState<any[]>([])

  // History pagination and filter states
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [providerFilter, setProviderFilter] = useState('all')

  // Modals and loading states
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false)
  const [buyAmount, setBuyAmount] = useState(20000)
  const [isBuying, setIsBuying] = useState(false)
  const [loading, setLoading] = useState(true)

  // Admin: team credit limits
  const [team, setTeam] = useState<{ items: any[]; allocated: number; pool: number } | null>(null)
  const [limitDrafts, setLimitDrafts] = useState<Record<string, string>>({})
  const [savingLimit, setSavingLimit] = useState<string | null>(null)

  // Fetch all dashboard data
  const fetchData = async () => {
    try {
      setLoading(true)
      const [balRes, featRes, timeRes] = await Promise.all([
        aiApi.getCreditsBalance(),
        aiApi.getUsageByFeature(),
        aiApi.getUsageOverTime(),
      ])

      if (balRes.data) setBalance(balRes.data)
      if (featRes.data) setUsageByFeature(featRes.data)
      if (timeRes.data) setUsageOverTime(timeRes.data)

      await fetchHistory(1)
      if (isAdmin) await fetchTeam()
    } catch (error: any) {
      toast.error('Failed to load AI credits data.')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch paginated usage logs
  const fetchHistory = async (pageNo: number) => {
    try {
      const histRes = await aiApi.getCreditsHistory(pageNo, HISTORY_PAGE_SIZE)
      if (histRes.data) {
        setHistory(histRes.data.items || [])
        setTotalPages(histRes.data.pages || 1)
        setTotalCount(histRes.data.total || 0)
        setPage(pageNo)
      }
    } catch (error) {
      console.error('Failed to fetch history:', error)
    }
  }

  const fetchTeam = async () => {
    try {
      const res = await aiApi.getUserCreditLimits()
      if (res.data) {
        setTeam(res.data)
        setLimitDrafts({})
      }
    } catch (error) {
      console.error('Failed to fetch team credit limits:', error)
    }
  }

  const saveLimit = async (userId: string) => {
    const value = parseInt(limitDrafts[userId] ?? '', 10)
    if (Number.isNaN(value) || value < 0) {
      toast.error('Enter a whole number of credits.')
      return
    }
    try {
      setSavingLimit(userId)
      await aiApi.setUserCreditLimit(userId, value)
      toast.success('Credit limit updated.')
      await fetchTeam()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Could not update the limit.')
    } finally {
      setSavingLimit(null)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Back from Stripe Checkout: add the credits now rather than waiting for the webhook.
  const [params, setParams] = useSearchParams()
  const handledReturn = useRef(false)
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
        if (payment.status === 'paid') toast.success(`Payment received: ${payment.description} added.`)
        else toast('Your payment is processing. The credits appear as soon as Stripe confirms it.')
      })
      .catch(() => toast.error('We couldn’t confirm the payment yet. Refresh in a minute.'))
      .finally(() => fetchData())
  }, [params, setParams])

  // Refetch history when page changes
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchHistory(newPage)
    }
  }

  // Filter logs locally based on search/status/provider filters
  const filteredHistory = history.filter((item: any) => {
    const matchesSearch =
      item.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.feature.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.model.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === 'all' || item.status === statusFilter

    const matchesProvider =
      providerFilter === 'all' || item.provider.toLowerCase() === providerFilter.toLowerCase()

    return matchesSearch && matchesStatus && matchesProvider
  })

  // Top-ups (admin) are paid with Stripe Checkout. Without online payments
  // it's a request: Hybent invoices and adds the credits.
  const payOnline = !!balance?.payments_enabled
  const handleBuyCredits = async () => {
    try {
      setIsBuying(true)
      if (payOnline) {
        const { url } = await billingApi.checkoutTopup(buyAmount)
        redirectToCheckout(url)
        return
      }
      await aiApi.requestTopup(buyAmount)
      toast.success('Top-up requested. The Hybent team will contact you to complete it.')
      setIsBuyModalOpen(false)
    } catch (error: any) {
      toast.error(error.response?.data?.message || (payOnline ? 'Could not start the payment.' : 'Could not send the top-up request.'))
    }
    setIsBuying(false)
  }

  const packs: Array<{ credits: number; price_usd: number }> = balance?.topup_packs || []

  // Export logs to CSV
  const handleCSVExport = () => {
    if (!history.length) {
      toast.error('No history records to export.')
      return
    }

    const headers = [
      'Timestamp',
      'User Name',
      'User Email',
      'Feature',
      'AI Provider',
      'Model Used',
      'Prompt Tokens',
      'Completion Tokens',
      'Total Tokens',
      'Credits Used',
      'Estimated Cost (USD)',
      'Duration (ms)',
      'Status',
      'Error Detail',
    ]

    const csvRows = [headers.join(',')]

    for (const item of history) {
      const values = [
        new Date(item.created_at).toLocaleString(),
        `"${item.user_name.replace(/"/g, '""')}"`,
        item.user_email,
        item.feature,
        item.provider,
        item.model,
        item.prompt_tokens,
        item.completion_tokens,
        item.total_tokens,
        item.credits_used,
        item.cost,
        item.duration_ms,
        item.status,
        `"${(item.error_detail || '').replace(/"/g, '""')}"`,
      ]
      csvRows.push(values.join(','))
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `ai_credits_usage_report_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Credits usage history exported successfully!')
  }

  const chartDataByFeature = Object.keys(usageByFeature).map((key) => ({
    name: formatFeatureName(key),
    credits: usageByFeature[key],
  }))

  /**
   * Percentage of the monthly quota still available.
   *
   * `allowed_credits` is 0 for an organisation on no plan, and dividing by it
   * produced `NaN`, which rendered literally as "NaN% available". Nothing about
   * a zero quota is "some percent remaining", so that case is reported as `null`
   * and the figure is replaced by wording rather than a number.
   */
  const hasQuota = !!balance && balance.allowed_credits > 0
  const remainingPercent = hasQuota
    ? (balance!.remaining_credits / balance!.allowed_credits) * 100
    : null

  const warning = balance ? CREDIT_WARNINGS[balance.warning_level] : undefined

  const columns: Array<Column<any>> = [
    {
      key: 'created_at',
      header: 'Timestamp',
      cell: (item) => (
        <span className="font-mono text-hb-xs tabular-nums text-hb-muted whitespace-nowrap">
          {new Date(item.created_at).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'user',
      header: 'User',
      cardTitle: true,
      cell: (item) => <CellStack primary={item.user_name} secondary={item.user_email} />,
    },
    {
      key: 'feature',
      header: 'Feature',
      cell: (item) => formatFeatureName(item.feature),
    },
    {
      key: 'model',
      header: 'Model & provider',
      cell: (item) => <CellStack primary={item.model} secondary={item.provider} />,
    },
    {
      key: 'tokens',
      header: 'Tokens used',
      cell: (item) =>
        item.total_tokens > 0 ? (
          <div>
            <span className="font-mono tabular-nums text-hb-text">
              {item.total_tokens.toLocaleString()}
            </span>
            <span className="block text-hb-xs text-hb-muted">
              in {item.prompt_tokens} / out {item.completion_tokens}
            </span>
          </div>
        ) : (
          '—'
        ),
    },
    {
      key: 'credits',
      header: 'Credits',
      align: 'right',
      cell: (item) => (
        <span className="font-mono font-semibold tabular-nums text-hb-text">
          {formatCredits(item.credits_used)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (item) =>
        item.status === 'success' ? (
          <StatusPill status="success" />
        ) : (
          /* The failure reason has nowhere else to live in a row this wide. */
          <span title={item.error_detail || 'Unknown Error'}>
            <StatusPill status="failure" />
          </span>
        ),
    },
  ]

  return (
    <div className="mx-auto max-w-hb-page pb-hb-10">
      <PageHeader
        eyebrow="Billing"
        title="AI credits & usage"
        description="Your organization's monthly AI credit pool, your own limit, and where credits go."
        actions={
          isAdmin ? (
            <Button icon={<CreditCard size={16} />} onClick={() => setIsBuyModalOpen(true)}>
              {payOnline ? 'Buy credits' : 'Request top-up'}
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-hb-6">
        {warning && (
          <div
            role="alert"
            className={clsx(
              'flex items-start gap-3 rounded-hb-md border p-hb-4',
              warning.tone === 'error'
                ? 'border-hb-error/30 bg-hb-error/10'
                : 'border-hb-warning/30 bg-hb-warning/10'
            )}
          >
            <AlertTriangle
              size={18}
              aria-hidden
              className={clsx(
                'mt-0.5 shrink-0',
                warning.tone === 'error' ? 'text-hb-error' : 'text-hb-warning'
              )}
            />
            <p className="text-hb-sm text-hb-text">{warning.message}</p>
          </div>
        )}

        {loading && !balance ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-hb-4 max-md:[&>*:last-child:nth-child(odd)]:col-span-2">
            <StatCard label="Monthly credits" value="—" icon={<Coins />} loading />
            <StatCard label="Used this month" value="—" icon={<TrendingUp />} loading />
            <StatCard label="Remaining" value="—" icon={<Wallet />} loading />
          </div>
        ) : (
          balance && (
            <div className="space-y-hb-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-hb-4 max-md:[&>*:last-child:nth-child(odd)]:col-span-2">
                <StatCard
                  label="Monthly credits"
                  value={balance.allowed_credits.toLocaleString()}
                  icon={<Coins />}
                />
                <StatCard
                  label="Used this month"
                  value={balance.used_credits.toLocaleString()}
                  icon={<TrendingUp />}
                />
                <StatCard
                  label={balance.purchased_credits > 0
                    ? `Remaining (incl. ${balance.purchased_credits.toLocaleString()} purchased)`
                    : 'Remaining'}
                  value={balance.remaining_credits.toLocaleString()}
                  icon={<Wallet />}
                />
              </div>

              {balance.my && (
                <Card padding="compact">
                  <div className="flex flex-wrap items-center gap-3">
                    <IconTile size="sm">
                      <UserIcon />
                    </IconTile>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-hb-label uppercase text-hb-muted">Your limit this month</p>
                      <p className="text-hb-sm text-hb-text">
                        <span className="font-mono tabular-nums">{balance.my.used_credits.toLocaleString()}</span>
                        {' of '}
                        <span className="font-mono tabular-nums">{balance.my.monthly_limit.toLocaleString()}</span>
                        {' credits used · today '}
                        <span className="font-mono tabular-nums">{balance.my.daily_used.toLocaleString()}</span>
                        {' / '}
                        <span className="font-mono tabular-nums">{balance.my.daily_limit.toLocaleString()}</span>
                      </p>
                    </div>
                  </div>
                  <div className="mt-2.5">
                    <Meter
                      value={balance.my.used_credits}
                      max={Math.max(1, balance.my.monthly_limit)}
                      size="sm"
                      aria-label="Your monthly AI credit limit used"
                      tone={
                        balance.my.used_credits >= balance.my.monthly_limit
                          ? 'error'
                          : balance.my.used_credits >= balance.my.monthly_limit * 0.75
                            ? 'warning'
                            : 'brand'
                      }
                    />
                  </div>
                </Card>
              )}

              <Card padding="compact">
                <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-mono text-hb-label uppercase text-hb-muted">
                    Organization pool used this month
                  </span>
                  <span className="text-hb-sm text-hb-muted">
                    {remainingPercent === null ? (
                      'No monthly quota on this plan'
                    ) : (
                      <>
                        <span className="font-mono tabular-nums text-hb-text">
                          {remainingPercent.toFixed(1)}%
                        </span>{' '}
                        available
                      </>
                    )}{' '}
                    · resets {new Date(balance.reset_at).toLocaleDateString()}
                  </span>
                </div>
                {/* The tone repeats the threshold the original bar carried: the
                    fill turns amber under a quarter remaining and red under 5%,
                    so the bar states the verdict even before the banner does. */}
                <Meter
                  value={balance.used_credits}
                  max={balance.allowed_credits}
                  size="sm"
                  aria-label="Monthly AI credit quota consumed"
                  tone={
                    remainingPercent === null
                      ? 'brand'
                      : remainingPercent <= 5
                        ? 'error'
                        : remainingPercent <= 25
                          ? 'warning'
                          : 'brand'
                  }
                />
              </Card>
            </div>
          )
        )}

        <div className="grid gap-hb-6 lg:grid-cols-2">
          {usageOverTime.length === 0 ? (
            <Card padding="loose">
              <h3 className="font-display text-hb-h3 text-hb-text">Credit consumption (daily)</h3>
              <p className="mt-2 text-hb-sm text-hb-muted">
                No credit consumption logs found for this billing cycle.
              </p>
            </Card>
          ) : (
            <ChartFrame title="Credit consumption (daily)" height={256}>
              <AreaChart data={usageOverTime} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chart.grid} />
                <XAxis
                  dataKey="date"
                  {...axisProps(chart)}
                  tickFormatter={(val) =>
                    new Date(val).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
                  }
                />
                <YAxis {...axisProps(chart)} />
                <ChartTooltip
                  labelFormatter={(val) =>
                    new Date(val).toLocaleDateString(undefined, {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  }
                />
                <Area
                  type="monotone"
                  dataKey="credits"
                  stroke={chart.series[0]}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill={chart.fill(0)}
                />
              </AreaChart>
            </ChartFrame>
          )}

          {chartDataByFeature.length === 0 ? (
            <Card padding="loose">
              <h3 className="font-display text-hb-h3 text-hb-text">Credits breakdown by feature</h3>
              <p className="mt-2 text-hb-sm text-hb-muted">No credit consumption logs found.</p>
            </Card>
          ) : (
            <ChartFrame title="Credits breakdown by feature" height={256}>
              <BarChart
                data={chartDataByFeature}
                layout="vertical"
                margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={chart.grid} />
                <XAxis type="number" {...axisProps(chart)} />
                <YAxis dataKey="name" type="category" width={120} {...axisProps(chart)} />
                <ChartTooltip />
                <Bar dataKey="credits" radius={[0, 4, 4, 0]} fill={chart.series[0]} />
              </BarChart>
            </ChartFrame>
          )}
        </div>

        {isAdmin && team && (
          <section aria-labelledby="team-limits-heading">
            <div className="mb-hb-4 flex flex-wrap items-center gap-3">
              <IconTile size="sm">
                <Users />
              </IconTile>
              <h2 id="team-limits-heading" className="font-display text-hb-h3 text-hb-text">
                Team credit limits
              </h2>
              <div className="flex-1" />
              <span className="text-hb-sm text-hb-muted">
                <span className="font-mono tabular-nums text-hb-text">{team.allocated.toLocaleString()}</span>
                {' of '}
                <span className="font-mono tabular-nums text-hb-text">{team.pool.toLocaleString()}</span>
                {' credits allocated'}
              </span>
            </div>
            <DataTable
              columns={[
                {
                  key: 'user',
                  header: 'Member',
                  cardTitle: true,
                  cell: (m: any) => <CellStack primary={m.full_name} secondary={`${m.email} · ${m.role}`} />,
                },
                {
                  key: 'used',
                  header: 'Used this month',
                  cell: (m: any) => (
                    <div className="min-w-[140px]">
                      <span className="font-mono text-hb-sm tabular-nums text-hb-text">
                        {m.used_credits.toLocaleString()} / {m.monthly_limit.toLocaleString()}
                      </span>
                      <div className="mt-1">
                        <Meter
                          value={m.used_credits}
                          max={Math.max(1, m.monthly_limit)}
                          size="sm"
                          aria-label={`${m.full_name} credits used`}
                          tone={m.used_credits >= m.monthly_limit ? 'error' : 'brand'}
                        />
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'daily',
                  header: 'Today',
                  cell: (m: any) => (
                    <span className="font-mono text-hb-xs tabular-nums text-hb-muted">
                      {m.daily_used.toLocaleString()} / {m.daily_limit.toLocaleString()}
                    </span>
                  ),
                },
                {
                  key: 'limit',
                  header: 'Monthly limit',
                  align: 'right',
                  cell: (m: any) => {
                    const draft = limitDrafts[m.user_id]
                    const dirty = draft !== undefined && draft !== String(m.monthly_limit)
                    return (
                      <div className="flex items-center justify-end gap-2">
                        <Input
                          aria-label={`Monthly limit for ${m.full_name}`}
                          type="number"
                          min={0}
                          step={500}
                          value={draft ?? String(m.monthly_limit)}
                          onChange={(e) => setLimitDrafts((d) => ({ ...d, [m.user_id]: e.target.value }))}
                          fieldClassName="w-[120px]"
                        />
                        <Button
                          size="sm"
                          variant={dirty ? 'primary' : 'ghost'}
                          disabled={!dirty}
                          loading={savingLimit === m.user_id}
                          onClick={() => saveLimit(m.user_id)}
                        >
                          Save
                        </Button>
                      </div>
                    )
                  },
                },
              ]}
              rows={team.items}
              rowKey={(m: any) => m.user_id}
              caption="Team AI credit limits"
              empty={{ title: 'No team members yet', description: 'Invited teammates appear here.' }}
            />
            {team.allocated > team.pool && (
              <p role="status" className="mt-2 text-hb-sm text-hb-warning">
                Limits add up to more than the organization&apos;s {team.pool.toLocaleString()} credits. The shared
                pool still caps total use, so lower some limits to guarantee each person their share.
              </p>
            )}
            <p className="mt-2 text-hb-xs text-hb-muted">
              Each person can use up to a fifth of their monthly limit in one day. Raising a limit can&apos;t take
              the total past the organization&apos;s credits.
            </p>
          </section>
        )}

        <section aria-labelledby="credits-history-heading">
          <div className="mb-hb-4 flex flex-wrap items-center gap-3">
            <IconTile size="sm">
              <History />
            </IconTile>
            <h2 id="credits-history-heading" className="font-display text-hb-h3 text-hb-text">
              Consumption history logs
            </h2>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              icon={<Download size={14} />}
              onClick={handleCSVExport}
            >
              Export CSV
            </Button>
          </div>

          <Toolbar>
            <ToolbarSearch
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search user or feature…"
              aria-label="Search consumption logs"
            />
            <ToolbarFilters activeCount={[statusFilter !== 'all', providerFilter !== 'all'].filter(Boolean).length} onReset={() => { setStatusFilter('all'); setProviderFilter('all') }}>
            <Select
              aria-label="Filter logs by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={STATUS_OPTIONS}
              fieldClassName="w-[150px]"
            />
            <Select
              aria-label="Filter logs by AI provider"
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              options={PROVIDER_OPTIONS}
              fieldClassName="w-[165px]"
            />
            </ToolbarFilters>
          </Toolbar>

          <DataTable
            columns={columns}
            rows={filteredHistory}
            rowKey={(item) => item.id}
            loading={loading}
            caption="AI credit consumption logs"
            empty={
              history.length === 0
                ? {
                    title: 'No AI usage yet',
                    description:
                      'Credit consumption appears here as your team uses AI features.',
                  }
                : {
                    tone: 'no-results',
                    title: 'No consumption logs found matching the filters.',
                    description: 'Try a different search term, status or provider.',
                  }
            }
          />

          <Pagination
            page={page}
            pages={totalPages}
            total={totalCount}
            limit={HISTORY_PAGE_SIZE}
            onPage={handlePageChange}
            noun="logs"
          />
        </section>
      </div>

      <Dialog
        open={isBuyModalOpen}
        onClose={() => setIsBuyModalOpen(false)}
        title={payOnline ? 'Buy AI credits' : 'Request an AI credit top-up'}
        description={
          payOnline
            ? "Choose a pack and pay securely with Stripe. The credits are added as soon as the payment goes through. Purchased credits don't expire at the monthly reset."
            : "Choose a pack. We'll send the request to the Hybent team, who will invoice you and add the credits. Purchased credits don't expire at the monthly reset."
        }
        size="sm"
        footer={
          <>
            <Button variant="quiet" size="sm" onClick={() => setIsBuyModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              loading={isBuying}
              disabled={!packs.some((p) => p.credits === buyAmount)}
              onClick={handleBuyCredits}
            >
              {payOnline ? 'Continue to payment' : isBuying ? 'Sending…' : 'Request top-up'}
            </Button>
          </>
        }
      >
        <div className="space-y-hb-5 pb-2">
          <div role="group" aria-labelledby={packGroupId}>
            <p id={packGroupId} className="font-mono text-hb-label uppercase text-hb-dim">
              Select pack
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {packs.map((pack) => (
                <Button
                  key={pack.credits}
                  size="sm"
                  fullWidth
                  variant={buyAmount === pack.credits ? 'primary' : 'ghost'}
                  aria-pressed={buyAmount === pack.credits}
                  onClick={() => setBuyAmount(pack.credits)}
                >
                  {pack.credits.toLocaleString()} · ${pack.price_usd}
                </Button>
              ))}
            </div>
          </div>
          <p className="text-hb-xs text-hb-muted">
            Need a different amount or more seats? Email{' '}
            <a className="underline" href="mailto:info@hybent.com">info@hybent.com</a>.
          </p>
        </div>
      </Dialog>
    </div>
  )
}
