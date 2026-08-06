import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Sparkles } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { analyticsApi } from '@/api/analytics'
import { candidatesApi } from '@/api/candidates'
import { talentPoolApi } from '@/api/talentPool'
import { jobsApi } from '@/api/jobs'
import { formatScore } from '@/utils/formatters'
import { Badge, Button, Card, CardHeader, Meter, PageHeader, Select, Skeleton } from '@/components/hb'

/**
 * AI insights.
 *
 * Rebuilt on the design system in phase 6. Two things this page did that the
 * design system exists to prevent:
 *
 * - The funnel bars were coloured violet / pink / teal / amber / emerald by
 *   index, so five steps of one funnel read as five unrelated metrics.
 * - The top-skills grid assigned each skill one of ten hardcoded colours by
 *   position, which meant the *same* skill changed colour whenever the ranking
 *   shifted. The count is the information; it is now shown.
 */

/** Stage and source names arrive as `hr_round`; the label slot title-cases them. */
function StageMeter({ label, value }: { label: string; value: number }) {
  return <Meter label={<span className="capitalize">{label}</span>} value={value} />
}

function MeterSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-hb-4">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-1.5 w-full" rounded="full" />
      ))}
    </div>
  )
}

/** Raw pipeline stages â†’ the five funnel buckets this page reports on. */
const FUNNEL_BUCKETS: Array<{ name: string; stages: string[] }> = [
  { name: 'Applied', stages: ['applied'] },
  { name: 'Shortlisted', stages: ['screening', 'pre_screening'] },
  { name: 'Screened', stages: ['technical_round', 'practical_round', 'techno_functional_round'] },
  { name: 'Interviewed', stages: ['management_round', 'hr_round', 'interview'] },
  { name: 'Final round', stages: ['interviewed', 'offer', 'hired'] },
]

function bucketFunnel(stages: Array<{ stage: string; count: number }> | undefined) {
  if (!stages?.length) return []
  const counts = FUNNEL_BUCKETS.map((b) => ({
    name: b.name,
    count: stages
      .filter((s) => b.stages.includes(s.stage.toLowerCase()))
      .reduce((sum, s) => sum + s.count, 0),
  })).filter((b) => b.count > 0)

  const total = counts.reduce((sum, b) => sum + b.count, 0)
  return counts.map((b) => ({ ...b, percentage: total > 0 ? (b.count / total) * 100 : 0 }))
}

export default function AnalyticsPage() {
  const { basePath } = useAuth()
  const navigate = useNavigate()
  const [funnelJobId, setFunnelJobId] = useState('')

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: () => analyticsApi.overview().then((r: any) => r.data),
  })

  const { data: funnel, isLoading: funnelLoading } = useQuery({
    queryKey: ['analytics', 'funnel', funnelJobId],
    queryFn: () => analyticsApi.funnel(funnelJobId || undefined).then((r: any) => r.data),
  })

  const { data: talentStats } = useQuery({
    queryKey: ['talent-pool', 'stats'],
    queryFn: () => talentPoolApi.getStats().then((r: any) => r.data),
  })

  const { data: fairness, isLoading: fairnessLoading } = useQuery({
    queryKey: ['analytics', 'fairness'],
    queryFn: () => analyticsApi.fairness().then((r: any) => r.data),
  })

  const { data: candidatesData } = useQuery({
    queryKey: ['candidates', 'top-skills'],
    queryFn: () => candidatesApi.list({ limit: 100 }).then((r: any) => r.data),
  })

  const { data: jobsData } = useQuery({
    queryKey: ['jobs', 'all'],
    queryFn: () => jobsApi.list({ limit: 100 }).then((r: any) => r.data),
  })

  const topSkills = useMemo(() => {
    if (!candidatesData?.items) return []
    const counts: Record<string, number> = {}
    candidatesData.items.forEach((c: any) => {
      const skills: string[] = (c.skills?.length ? c.skills : c.parsed_data?.skills) ?? []
      skills.forEach((s) => {
        const clean = s?.trim()
        if (clean) counts[clean] = (counts[clean] || 0) + 1
      })
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
  }, [candidatesData])

  const funnelBuckets = useMemo(() => bucketFunnel(funnel?.stages), [funnel])

  const summary = useMemo(() => {
    if (!overview) return null
    const title = overview.avg_match_score
      ? `${formatScore(overview.avg_match_score)} average match score`
      : overview.total_applications > 0
        ? `${overview.total_applications} applications tracked`
        : 'Pipeline intelligence active'

    const parts: string[] = []
    if (overview.avg_match_score) {
      parts.push(`${formatScore(overview.avg_match_score)} average match score this month.`)
    }
    if (talentStats?.re_matched_count) {
      parts.push(`${talentStats.re_matched_count} past candidates re-matched to new roles.`)
    }
    return {
      title,
      body: parts.join(' ') || 'Analytics are collected in real time as candidates apply.',
    }
  }, [overview, talentStats])

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Insights"
        title="AI insights"
        description="What Hybent AI has learned about your hiring pipeline."
      />

      <div className="space-y-hb-6">
        {summary && !overviewLoading && (
          <Card padding="loose" className="border-hb-border-strong bg-hb-grad-soft">
            <p className="mb-2 inline-flex items-center gap-1.5 font-mono text-hb-label uppercase text-hb-cyan">
              <Sparkles size={12} aria-hidden />
              AI summary
            </p>
            <h2 className="font-display text-hb-h2 text-hb-text">{summary.title}</h2>
            <p className="mt-2 max-w-2xl text-hb-body text-hb-muted">{summary.body}</p>
          </Card>
        )}

        <div className="grid gap-hb-6 lg:grid-cols-2">
          <Card padding="loose">
            <CardHeader
              title="Hire probability by stage"
              action={
                <Select
                  aria-label="Filter the funnel by job"
                  value={funnelJobId}
                  onChange={(e) => setFunnelJobId(e.target.value)}
                  options={[
                    { value: '', label: 'Global pipeline' },
                    ...(jobsData?.items ?? []).map((j: any) => ({ value: j.id, label: j.title })),
                  ]}
                  fieldClassName="w-[190px]"
                />
              }
            />
            {funnelLoading ? (
              <MeterSkeleton rows={5} />
            ) : funnelBuckets.length === 0 ? (
              <p className="py-6 text-center text-hb-sm text-hb-muted">
                No pipeline data for this selection yet.
              </p>
            ) : (
              <div className="space-y-hb-4">
                {funnelBuckets.map((b) => (
                  <StageMeter key={b.name} label={b.name} value={b.percentage} />
                ))}
              </div>
            )}
          </Card>

          <Card padding="loose">
            <CardHeader
              title="Top skills in the pipeline"
              subtitle="Across your 100 most recent candidates"
            />
            {topSkills.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5">
                {topSkills.map(([skill, count]) => (
                  <li key={skill}>
                    <Badge tone="info">
                      {skill}
                      <span className="ml-1 opacity-70">{count}</span>
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-hb-sm text-hb-muted">
                Analysing your candidate database for skill trends...
              </p>
            )}
          </Card>
        </div>

        <div className="grid gap-hb-6 md:grid-cols-2">
          <Card padding="loose">
            <CardHeader
              title="Talent DB match"
              action={<Badge tone="info">{talentStats?.re_matched_count ?? 0} found</Badge>}
            />
            <p className="text-hb-body text-hb-muted">
              {talentStats?.re_matched_count ?? 0} candidates in your pool match a currently active
              role. Re-engaging them can save weeks of sourcing.
            </p>
            <Button
              className="mt-hb-4"
              size="sm"
              trailingIcon={<ArrowRight size={14} />}
              to={`${basePath}/talent-pool`}
            >
              View matches
            </Button>
          </Card>

          <Card padding="loose">
            <CardHeader title="Average time to hire" />
            <p className="font-display text-hb-num text-hb-text">
              {overview?.time_to_hire_days ? `${Math.round(overview.time_to_hire_days)} days` : '—'}
            </p>
            <p className="mt-2 text-hb-body text-hb-muted">
              {overview?.time_to_hire_days
                ? 'From application to interview.'
                : 'Not enough data to calculate yet.'}
            </p>
          </Card>
        </div>

        <div className="grid gap-hb-6 lg:grid-cols-3">
          <Card padding="loose">
            <CardHeader title="Pass rates by stage" action={<Badge tone="success">Fairness</Badge>} />
            {fairnessLoading ? (
              <MeterSkeleton />
            ) : !fairness?.pass_rates_by_stage?.length ? (
              <p className="text-hb-sm text-hb-muted">No stage data available.</p>
            ) : (
              <div className="space-y-hb-4">
                {fairness.pass_rates_by_stage.map((s: any) => (
                  <StageMeter key={s.stage} label={s.stage.replace(/_/g, ' ')} value={s.pass_rate} />
                ))}
              </div>
            )}
          </Card>

          <Card padding="loose">
            <CardHeader title="Hires by source" action={<Badge tone="success">Fairness</Badge>} />
            {fairnessLoading ? (
              <MeterSkeleton />
            ) : !fairness?.pass_rates_by_source?.length ? (
              <p className="text-hb-sm text-hb-muted">No source data available.</p>
            ) : (
              <div className="space-y-hb-4">
                {fairness.pass_rates_by_source.map((s: any) => (
                  <StageMeter key={s.source} label={s.source.replace(/_/g, ' ')} value={s.pass_rate} />
                ))}
              </div>
            )}
          </Card>

          <Card padding="loose">
            <CardHeader title="Interviewer bias" action={<Badge tone="brand">Calibration</Badge>} />
            {fairnessLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={i} className="h-14 w-full" rounded="md" />
                ))}
              </div>
            ) : !fairness?.interviewer_calibration_variance?.length ? (
              <p className="text-hb-sm text-hb-muted">
                Not enough interview data for calibration.
              </p>
            ) : (
              <ul className="space-y-2">
                {fairness.interviewer_calibration_variance.map((c: any) => (
                  <li
                    key={c.interviewer_name}
                    className="flex items-center justify-between gap-3 rounded-hb-sm border border-hb-border bg-hb-surface-2 px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-hb-sm font-semibold text-hb-text">
                        {c.interviewer_name}
                      </p>
                      <p className="text-hb-xs text-hb-muted">Avg rating {c.avg_rating_given}</p>
                    </div>
                    {/* Variance is signed: harsh below the panel, generous above.
                        Both are worth flagging, so neither is "good". */}
                    <Badge
                      tone={Math.abs(c.variance) > 0.5 ? 'warning' : 'success'}
                    >
                      {c.variance > 0 ? '+' : ''}
                      {c.variance}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
