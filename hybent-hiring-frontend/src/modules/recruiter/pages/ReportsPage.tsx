import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { AlertTriangle, CheckCircle2, Download, FileText, Lock, XCircle } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts'

import { useAuth } from '@/hooks/useAuth'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { reportsApi } from '@/api/reports'
import { adminApi } from '@/api/admin'
import { superAdminApi } from '@/api/superAdmin'
import type { ReportSummary } from '@/types'
import {
  Badge,
  Button,
  Card,
  ChartFrame,
  ChartTooltip,
  Input,
  PageHeader,
  Select,
  Skeleton,
  StatCard,
  StatGrid,
  axisProps,
  chartLabel,
  ChartLegend,
  useChartTheme,
} from '@/components/hb'

/**
 * Advanced analytics and export.
 *
 * Rebuilt on the design system in phase 6. This is the page `useChartTheme`
 * exists for: recharts takes hex strings rather than classes, so it had eight
 * hardcoded colours in a `COLORS` array plus five more inline, and three
 * hand-built tooltip components that each styled themselves differently. The
 * series palette and the tooltip now come from tokens and follow the theme.
 */

export default function ReportsPage() {
  const { user } = useAuth()
  const chart = useChartTheme()
  const isAdmin = user?.role === 'admin'

  const [days, setDays] = useState('30')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [recruiterId, setRecruiterId] = useState('all')
  const [recruiters, setRecruiters] = useState<Array<{ id: string; name: string }>>([])

  /* One filter object drives the on-screen data and the export, so the
     spreadsheet can never disagree with the charts above it. */
  const filterParams = useMemo(() => {
    const p: { days?: number; start_date?: string; end_date?: string; recruiter_id?: string } = {}
    if (days === 'custom') {
      if (startDate) p.start_date = startDate
      if (endDate) p.end_date = endDate
    } else if (days !== 'all') {
      p.days = parseInt(days, 10)
    }
    if (isAdmin && recruiterId !== 'all') p.recruiter_id = recruiterId
    return p
  }, [days, startDate, endDate, recruiterId, isAdmin])

  const { data: summary, isLoading } = useQuery<ReportSummary>({
    queryKey: ['reports', 'summary', filterParams],
    queryFn: () => reportsApi.getSummary(filterParams).then((r) => r.data),
  })

  const { data: globalFlags } = useQuery({
    queryKey: ['super-admin', 'global-flags'],
    queryFn: () => superAdminApi.getGlobalFlags(),
  })

  useEffect(() => {
    if (!isAdmin) return
    adminApi
      .listUsers()
      .then((res) =>
        setRecruiters(
          res.data
            .filter((u: any) => u.role !== 'candidate')
            .map((u: any) => ({ id: u.id, name: u.full_name }))
        )
      )
      .catch((err) => console.error('Failed to fetch recruiters', err))
  }, [isAdmin])

  const exportEnabled = !!globalFlags?.analytics

  const [download, downloading] = useAsyncAction(async () => {
    if (!exportEnabled) {
      toast.error('Advanced export is disabled for your organisation. Contact your administrator.')
      return
    }
    try {
      const res = await reportsApi.export(filterParams)
      const url = URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = `recruitment_report_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      toast.success('Report downloaded')
    } catch (error) {
      console.error('Download failed', error)
      toast.error('Failed to download the report')
    }
  })

  const funnelData = [
    { name: 'Applied', value: summary?.applied ?? 0 },
    { name: 'Hired', value: summary?.hired ?? 0 },
    { name: 'Backed out', value: summary?.backout ?? 0 },
    { name: 'Rejected', value: summary?.rejected ?? 0 },
  ]

  const stagesData = summary?.stages_distribution
    ? Object.entries(summary.stages_distribution).map(([key, value]) => ({
        name: key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
        value,
      }))
    : []

  const rolesData = summary?.candidates_by_role
    ? Object.entries(summary.candidates_by_role).map(([name, value]) => ({ name, value }))
    : []

  /* Outcomes are the one place a fixed semantic colour is right: hired is
     success, backed out is a warning, rejected is an error. */
  const FUNNEL_TONES = [chart.series[0], chart.success, chart.warning, chart.error]

  return (
    <div className="mx-auto max-w-hb-page pb-hb-10">
      <PageHeader
        eyebrow="Reports"
        title="Advanced analytics"
        description="Detailed recruitment metrics, with the same filters applied to the export."
        actions={
          <Button
            icon={exportEnabled ? <Download size={16} /> : <Lock size={16} />}
            disabled={!exportEnabled}
            loading={downloading}
            title={exportEnabled ? 'Download Excel report' : 'Export is disabled for your organisation'}
            onClick={() => download()}
          >
            Download Excel report
          </Button>
        }
      />

      <div className="space-y-hb-6">
        <Card padding="default">
          <div className="grid gap-hb-4 md:grid-cols-2 xl:grid-cols-4">
            <Select
              label="Date range"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              options={[
                { value: '7', label: 'Last 7 days' },
                { value: '30', label: 'Last 30 days' },
                { value: '90', label: 'Last 90 days' },
                { value: 'custom', label: 'Custom range' },
                { value: 'all', label: 'All time' },
              ]}
            />

            {days === 'custom' && (
              <>
                <Input
                  label="From"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <Input
                  label="To"
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </>
            )}

            {isAdmin && (
              <Select
                label="Recruiter"
                value={recruiterId}
                onChange={(e) => setRecruiterId(e.target.value)}
                options={[
                  { value: 'all', label: 'All recruiters' },
                  ...recruiters.map((r) => ({ value: r.id, label: r.name })),
                ]}
              />
            )}
          </div>
          <p className="mt-hb-3 font-mono text-hb-label uppercase text-hb-dim">
            Filters apply to the cards, charts and export
          </p>
        </Card>

        <StatGrid>
          <StatCard label="Total applied" value={summary?.applied ?? 0} icon={<FileText />} loading={isLoading} />
          <StatCard label="Total hired" value={summary?.hired ?? 0} icon={<CheckCircle2 />} loading={isLoading} />
          <StatCard label="Total backed out" value={summary?.backout ?? 0} icon={<AlertTriangle />} loading={isLoading} />
          <StatCard label="Total rejected" value={summary?.rejected ?? 0} icon={<XCircle />} loading={isLoading} />
        </StatGrid>

        <div className="grid gap-hb-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            {isLoading ? (
              <Skeleton className="h-[340px] w-full" rounded="md" />
            ) : (
              <ChartFrame
                title="Recruitment funnel"
                action={<Badge tone="info">Live</Badge>}
                height={300}
              >
                <BarChart data={funnelData} margin={{ top: 24, right: 12, left: 0, bottom: 4 }} barSize={56}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chart.grid} />
                  <XAxis dataKey="name" {...axisProps(chart)} dy={8} />
                  <YAxis hide />
                  <ChartTooltip />
                  <Bar dataKey="value" radius={[10, 10, 10, 10]} animationDuration={800}>
                    {funnelData.map((_, i) => (
                      <Cell key={i} fill={FUNNEL_TONES[i % FUNNEL_TONES.length]} />
                    ))}
                    <LabelList
                      dataKey="value"
                      position="top"
                      offset={12}
                      style={chartLabel(chart, { emphasis: true })}
                    />
                  </Bar>
                </BarChart>
              </ChartFrame>
            )}
          </div>

          {isLoading ? (
            <Skeleton className="h-[340px] w-full" rounded="md" />
          ) : stagesData.length === 0 ? (
            <Card padding="loose">
              <h3 className="font-display text-hb-h3 text-hb-text">Stage distribution</h3>
              <p className="mt-2 text-hb-sm text-hb-muted">No candidates in any stage yet.</p>
            </Card>
          ) : (
            <Card padding="default">
              <h3 className="mb-1 font-display text-hb-h3 text-hb-text">Stage distribution</h3>
              <p className="mb-3 text-hb-sm text-hb-muted">Spread across all active stages</p>

              <ChartFrame height={220} className="border-0 bg-transparent p-0">
                <PieChart>
                  <Pie
                    data={stagesData}
                    cx="50%"
                    cy="50%"
                    innerRadius={56}
                    outerRadius={82}
                    paddingAngle={4}
                    dataKey="value"
                    animationDuration={900}
                    stroke="none"
                  >
                    {stagesData.map((_, i) => (
                      <Cell key={i} fill={chart.series[i % chart.series.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip />
                </PieChart>
              </ChartFrame>

              {/* The legend carries the labels; the arcs alone cannot, since a
                  six-colour palette repeats past six stages. */}
              <ChartLegend items={stagesData} theme={chart} className="mt-3" />
            </Card>
          )}
        </div>

        {isLoading ? (
          <Skeleton className="h-[360px] w-full" rounded="md" />
        ) : rolesData.length === 0 ? (
          <Card padding="loose">
            <h3 className="font-display text-hb-h3 text-hb-text">Candidates by open position</h3>
            <p className="mt-2 text-hb-sm text-hb-muted">No applications against active roles yet.</p>
          </Card>
        ) : (
          <ChartFrame
            title="Candidates by open position"
            action={<Badge tone="success">High accuracy</Badge>}
            height={Math.max(240, rolesData.length * 44)}
          >
            <BarChart layout="vertical" data={rolesData} margin={{ top: 4, right: 48, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chart.grid} />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" width={130} {...axisProps(chart)} />
              <ChartTooltip />
              <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={26} fill={chart.series[0]}>
                <LabelList
                  dataKey="value"
                  position="right"
                  offset={10}
                  style={chartLabel(chart)}
                />
              </Bar>
            </BarChart>
          </ChartFrame>
        )}
      </div>
    </div>
  )
}
