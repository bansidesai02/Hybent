import { type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { BadgeCent, UserCheck, Users } from 'lucide-react'

import { superAdminApi } from '@/api/superAdmin'
import ActivityRankings from '../components/ActivityRankings'
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
 * strings presented as live deltas, and the "operational highlights" figures
 * were invented; both are gone. The chips show the latest real value from
 * each series instead.
 */

/** Plan prices are USD (hybent.com/pricing); this used to format them as rupees. */
const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(val)

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
            money ? `$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}` : String(v)
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
        description="Organization activity, account growth and candidate volume across the whole platform."
      />

      <div className="mb-hb-5">
        <ActivityRankings />
      </div>

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
                Monthly recurring revenue
                <span className="font-sans text-hb-xs font-normal text-hb-muted">(current month only; no history is recorded)</span>
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
                Total accounts
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

        </div>
      )}
    </div>
  )
}
