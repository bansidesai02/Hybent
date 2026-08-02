import { useEffect, useId, useState } from 'react'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'
import { AlertTriangle, Coins, CreditCard, Download, History, TrendingUp, Wallet } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import { aiApi } from '@/api/ai'
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
  axisProps,
  useChartTheme,
} from '@/components/hb'

/**
 * AI credits, usage and top-up.
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
      "Critical Alert: Your organization's AI Credits are exhausted! All AI features have been disabled. Click 'Buy AI Credits' above to restore operations.",
  },
  danger: {
    tone: 'error',
    message:
      'Credits Almost Finished! Only 5% of your monthly AI credits are remaining. Please purchase additional credits to prevent interruption.',
  },
  warning: {
    tone: 'warning',
    message:
      'Low AI Credits: Only 10% remaining. Consider upgrading your plan or buying additional credits.',
  },
  low: {
    tone: 'warning',
    message: 'Warning: Only 25% AI Credits Remaining.',
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

const CREDIT_PACKS = [20000, 50000, 100000]

/** `jd_generation` → `Jd Generation`. */
function formatFeatureName(name: string) {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function AICreditsPage() {
  const chart = useChartTheme()
  const packGroupId = useId()

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
  const [buyAmount, setBuyAmount] = useState(50000)
  const [isBuying, setIsBuying] = useState(false)
  const [loading, setLoading] = useState(true)

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

  useEffect(() => {
    fetchData()
  }, [])

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

  // Handle Buy Credits submission
  const handleBuyCredits = async () => {
    if (buyAmount <= 0) {
      toast.error('Please enter a valid credit amount.')
      return
    }

    try {
      setIsBuying(true)
      await aiApi.buyCredits(buyAmount)
      toast.success(`Successfully purchased ${buyAmount.toLocaleString()} AI credits!`)
      setIsBuyModalOpen(false)
      fetchData() // Refetch to update all charts/balances
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to purchase credits.')
    } finally {
      setIsBuying(false)
    }
  }

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
          {item.credits_used.toLocaleString()}
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
        description="Monitor credits consumption, usage logs, and billing cycles."
        actions={
          <Button icon={<CreditCard size={16} />} onClick={() => setIsBuyModalOpen(true)}>
            Buy AI credits
          </Button>
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
          <div className="grid gap-hb-4 md:grid-cols-3">
            <StatCard label="Quota allowed (monthly)" value="—" icon={<Coins />} loading />
            <StatCard label="Credits consumed" value="—" icon={<TrendingUp />} loading />
            <StatCard label="Remaining balance" value="—" icon={<Wallet />} loading />
          </div>
        ) : (
          balance && (
            <div className="space-y-hb-4">
              <div className="grid gap-hb-4 md:grid-cols-3">
                <StatCard
                  label="Quota allowed (monthly)"
                  value={balance.allowed_credits.toLocaleString()}
                  icon={<Coins />}
                />
                <StatCard
                  label="Credits consumed"
                  value={balance.used_credits.toLocaleString()}
                  icon={<TrendingUp />}
                />
                <StatCard
                  label="Remaining balance"
                  value={balance.remaining_credits.toLocaleString()}
                  icon={<Wallet />}
                />
              </div>

              <Card padding="compact">
                <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-mono text-hb-label uppercase text-hb-muted">
                    Quota consumed this cycle
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
        title="Purchase AI credits"
        description="Simulate adding additional credits to your organization balance. The request will automatically process and update dashboard charts."
        size="sm"
        footer={
          <>
            <Button variant="quiet" size="sm" onClick={() => setIsBuyModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              loading={isBuying}
              disabled={buyAmount <= 0}
              onClick={handleBuyCredits}
            >
              {isBuying ? 'Processing…' : 'Confirm purchase'}
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
              {CREDIT_PACKS.map((amt) => (
                <Button
                  key={amt}
                  size="sm"
                  fullWidth
                  variant={buyAmount === amt ? 'primary' : 'ghost'}
                  aria-pressed={buyAmount === amt}
                  onClick={() => setBuyAmount(amt)}
                >
                  +{amt.toLocaleString()}
                </Button>
              ))}
            </div>
          </div>

          <Input
            label="Custom credit amount"
            type="number"
            min={1000}
            step={5000}
            value={buyAmount}
            onChange={(e) => setBuyAmount(Math.max(0, parseInt(e.target.value) || 0))}
          />
        </div>
      </Dialog>
    </div>
  )
}
