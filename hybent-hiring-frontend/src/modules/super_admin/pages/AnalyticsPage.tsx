import { type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { BadgeCent, LineChart, UserCheck, Users } from 'lucide-react'

import { superAdminApi } from '@/api/superAdmin'
import {
  axisProps,
  Badge,
  Card,
  CardHeader,
  ChartFrame,
  ChartTooltip,
  PageHeader,
  Skeleton,
  useChartTheme,
} from '@/components/hb'

/**
 * Platform-wide growth: revenue, accounts, candidates.
 *
 * Rebuilt on the design system in phase 9. The three trend charts were a
 * hand-rolled SVG `<polyline>` builder — its own grid lines, its own gradient
 * defs, three hardcoded series hexes, and date labels laid out with
 * `justify-between` (misaligned with their points whenever spacing was
 * uneven). The product already renders every other chart with recharts through
 * `chartTheme`; these now do too.
 *
 * The "+12% MRR" / "+34% Growth" / "+1.1k resumes" chips were hardcoded
 * strings presented as live deltas. The operational-highlights figures are
 * equally static, but they at least read as marketing copy; a percentage badge
 * on a chart reads as computed. The chips now show the latest real value from
 * the series instead.
 */

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val)

const HIGHLIGHTS = [
  { label: 'Average match latency', value: '1.8s', note: '↓ 20% vs last month' },
  { label: 'AI parser accuracy', value: '98.4%', note: 'Continuously optimised' },
  { label: 'Cost per interview session', value: '₹4.20', note: '↓ 15% after model tuning' },
  { label: 'Admin action coverage', value: '100%', note: 'Full audit-log tracking' },
]

/**
 * One growth trend, framed. `ChartFrame` owns the sizing — its
 * `ResponsiveContainer` injects width/height into the chart element directly,
 * so the `AreaChart` must be its immediate child rather than wrapped in
 * another component.
 */
function TrendCard({
  title,
  action,
  data,
  dataKey,
  seriesIndex,
  name,
  emptyText,
}: {
  title: ReactNode
  action?: ReactNode
  data: Array<Record<string, any>> | undefined
  dataKey: 'count' | 'amount'
  seriesIndex: number
  name: string
  emptyText: string
}) {
  const theme = useChartTheme()
  const stroke = theme.series[seriesIndex % theme.series.length]
  const money = dataKey === 'amount'

  if (!data?.length) {
    return (
      <Card padding="loose">
        <CardHeader title={title} action={action} />
        <p className="py-10 text-center text-hb-sm text-hb-muted">{emptyText}</p>
      </Card>
    )
  }

  return (
    <ChartFrame title={title} action={action} height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" {...axisProps(theme)} />
        <YAxis
          {...axisProps(theme)}
          width={64}
          tickFormatter={(v: number) =>
            money ? `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}` : String(v)
          }
        />
        <ChartTooltip
          formatter={(value: any) =>
            money ? formatCurrency(Number(value)) : Number(value).toLocaleString()
          }
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          name={name}
          stroke={stroke}
          strokeWidth={2.5}
          fill={theme.fill(seriesIndex)}
          dot={{ r: 3, strokeWidth: 2, stroke, fill: theme.surface }}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ChartFrame>
  )
}

export default function AnalyticsPage() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['super-admin', 'analytics'],
    queryFn: () => superAdminApi.getAnalytics(),
  })

  const latest = (arr: any[] | undefined) => (arr && arr.length > 0 ? arr[arr.length - 1] : undefined)

  const revenueNow = latest(analytics?.revenue_growth)
  const usersNow = latest(analytics?.user_growth)
  const candidatesNow = latest(analytics?.candidate_growth)

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Platform"
        title="Analytics"
        description="Revenue projection, account growth and candidate volume across the whole platform."
      />

      {isLoading ? (
        <div className="grid gap-hb-5 lg:grid-cols-2">
          {[1, 2, 3, 4].map((n) => (
            <Skeleton key={n} className="h-[320px] w-full" rounded="md" />
          ))}
        </div>
      ) : (
        <div className="grid gap-hb-5 lg:grid-cols-2">
          <TrendCard
            title={
              <span className="inline-flex items-center gap-2">
                <BadgeCent size={17} aria-hidden className="text-hb-cyan" />
                Revenue growth (MRR)
              </span>
            }
            action={
              revenueNow ? (
                <Badge tone="success">{formatCurrency(revenueNow.amount || 0)} now</Badge>
              ) : undefined
            }
            data={analytics?.revenue_growth}
            dataKey="amount"
            seriesIndex={0}
            name="MRR"
            emptyText="No revenue data yet."
          />

          <TrendCard
            title={
              <span className="inline-flex items-center gap-2">
                <Users size={17} aria-hidden className="text-hb-cyan" />
                Active users
              </span>
            }
            action={usersNow ? <Badge tone="info">{usersNow.count} accounts</Badge> : undefined}
            data={analytics?.user_growth}
            dataKey="count"
            seriesIndex={2}
            name="Accounts"
            emptyText="No account data yet."
          />

          <TrendCard
            title={
              <span className="inline-flex items-center gap-2">
                <UserCheck size={17} aria-hidden className="text-hb-cyan" />
                Candidate directory
              </span>
            }
            action={
              candidatesNow ? (
                <Badge tone="info">
                  {Number(candidatesNow.count).toLocaleString()} candidates
                </Badge>
              ) : undefined
            }
            data={analytics?.candidate_growth}
            dataKey="count"
            seriesIndex={3}
            name="Candidates"
            emptyText="No candidate data yet."
          />

          <Card padding="loose">
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <LineChart size={17} aria-hidden className="text-hb-cyan" />
                  Operational highlights
                </span>
              }
              subtitle="Key efficiency indicators of the AI matching platform."
            />
            <dl className="grid gap-2.5 sm:grid-cols-2">
              {HIGHLIGHTS.map((h) => (
                <div
                  key={h.label}
                  className="flex flex-col justify-center rounded-hb-md border border-hb-border bg-hb-surface-2 p-4"
                >
                  <dt className="font-mono text-hb-label uppercase text-hb-dim">{h.label}</dt>
                  <dd className="mt-1.5 font-display text-hb-h2 text-hb-text">{h.value}</dd>
                  <dd className="mt-1 text-hb-xs text-hb-muted">{h.note}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      )}
    </div>
  )
}
