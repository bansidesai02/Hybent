import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, ChartColumn, Sparkles } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { analyticsApi, type Insights } from '@/api/analytics'
import { jobsApi } from '@/api/jobs'
import { formatScore } from '@/utils/formatters'
import { Badge, Button, Card, CardHeader, Meter, PageHeader, Select, Skeleton } from '@/components/hb'

/**
 * AI insights.
 *
 * Every number comes from one call, `GET /v1/analytics/insights`, computed
 * from live applications. The page used to stitch together the overview,
 * funnel and fairness endpoints plus 100 candidates fetched in the browser,
 * and most of it never moved: rounds stored as `technical_round_selected`
 * etc. were dropped from the funnel, time to hire was never computed, and
 * Talent DB placeholder applications were counted as hiring activity.
 *
 * The job filter applies to the whole page, not only the funnel.
 */

function MeterSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-hb-4">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-1.5 w-full" rounded="full" />
      ))}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-hb-sm text-hb-muted">{children}</p>
}

const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export default function AnalyticsPage() {
  const { basePath } = useAuth()
  const [jobId, setJobId] = useState('')

  const { data: insights, isLoading } = useQuery({
    queryKey: ['analytics', 'insights', jobId],
    queryFn: () => analyticsApi.insights(jobId || undefined).then((r: any) => r.data as Insights),
  })

  const { data: jobsData } = useQuery({
    queryKey: ['jobs', 'all'],
    queryFn: () => jobsApi.list({ limit: 100 }).then((r: any) => r.data),
  })

  const d = insights
  const hasPipeline = !!d?.total_applications

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Insights"
        title="AI insights"
        description="What Hybent AI has learned about your hiring pipeline."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="Show insights for one job"
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              options={[
                { value: '', label: 'All open positions' },
                ...(jobsData?.items ?? []).map((j: any) => ({ value: j.id, label: j.title })),
              ]}
              fieldClassName="w-[200px]"
            />
            <Button
              variant="ghost"
              icon={<ChartColumn size={16} />}
              trailingIcon={<ArrowRight size={14} />}
              to={`${basePath}/reports`}
            >
              Reports &amp; Analytics
            </Button>
          </div>
        }
      />

      <div className="space-y-hb-6">
        <Card padding="loose" className="border-hb-border-strong bg-hb-grad-soft">
          <p className="mb-2 inline-flex items-center gap-1.5 font-mono text-hb-label uppercase text-hb-cyan">
            <Sparkles size={12} aria-hidden />
            AI summary
          </p>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-7 w-2/3" rounded="md" />
              <Skeleton className="h-4 w-full" rounded="md" />
            </div>
          ) : (
            <>
              <h2 className="font-display text-hb-h2 text-hb-text">
                {d?.avg_match_score != null
                  ? `${formatScore(d.avg_match_score)} average match score`
                  : hasPipeline
                    ? `${d!.total_applications} applications tracked`
                    : 'Waiting for pipeline activity'}
              </h2>
              <ul className="mt-3 max-w-3xl list-disc space-y-1 pl-5 text-hb-body text-hb-muted">
                {(d?.highlights ?? []).map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <div className="grid gap-hb-6 lg:grid-cols-2">
          <Card padding="loose">
            <CardHeader
              title="Hiring funnel"
              subtitle="Share of applications that reached each step"
            />
            {isLoading ? (
              <MeterSkeleton rows={6} />
            ) : !hasPipeline ? (
              <Empty>No pipeline data for this selection yet.</Empty>
            ) : (
              <div className="space-y-hb-4">
                {d!.funnel.map((f) => (
                  <Meter
                    key={f.step}
                    label={f.step}
                    value={f.percentage}
                    valueLabel={`${f.count} · ${Math.round(f.percentage)}%`}
                  />
                ))}
              </div>
            )}
          </Card>

          <Card padding="loose">
            <CardHeader
              title="Top skills in the pipeline"
              subtitle={
                d ? `Across ${d.candidates_in_scope.toLocaleString()} candidates` : undefined
              }
            />
            {isLoading ? (
              <MeterSkeleton rows={3} />
            ) : d?.top_skills.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {d.top_skills.map(({ skill, count }) => (
                  <li key={skill}>
                    <Badge tone="info">
                      {skill}
                      <span className="ml-1 opacity-70">{count}</span>
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No skills parsed from resumes yet.</Empty>
            )}
          </Card>
        </div>

        <div className="grid gap-hb-6 md:grid-cols-2">
          <Card padding="loose">
            <CardHeader
              title="Talent DB match"
              action={<Badge tone="info">{d?.talent_matches ?? 0} found</Badge>}
            />
            <p className="text-hb-body text-hb-muted">
              {d?.talent_matches
                ? `${d.talent_matches} candidates in your Talent DB score 60%+ for an open role but aren't in its pipeline yet. Re-engaging them can save weeks of sourcing.`
                : 'No Talent DB candidates are waiting on an open role right now.'}
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
              {d?.time_to_hire_days != null ? `${d.time_to_hire_days} days` : '—'}
            </p>
            <p className="mt-2 text-hb-body text-hb-muted">
              {d?.time_to_hire_days != null
                ? `From application to hire, across ${d.hires} hire${d.hires === 1 ? '' : 's'}.`
                : 'Appears once a candidate is marked hired.'}
            </p>
          </Card>
        </div>

        <div className="grid gap-hb-6 lg:grid-cols-3">
          <Card padding="loose">
            <CardHeader title="Pass rates by step" action={<Badge tone="success">Fairness</Badge>} />
            {isLoading ? (
              <MeterSkeleton />
            ) : !d?.pass_rates.length ? (
              <Empty>No stage data available.</Empty>
            ) : (
              <div className="space-y-hb-4">
                {d.pass_rates.map((p) => (
                  <Meter
                    key={p.to_step}
                    label={`${p.from_step} → ${p.to_step}`}
                    value={p.pass_rate}
                    tone={p.entered >= 5 && p.pass_rate < 20 ? 'warning' : 'brand'}
                  />
                ))}
              </div>
            )}
          </Card>

          <Card padding="loose">
            <CardHeader
              title="Source quality"
              subtitle="Share reaching final interviews"
              action={<Badge tone="success">Fairness</Badge>}
            />
            {isLoading ? (
              <MeterSkeleton />
            ) : !d?.sources.length ? (
              <Empty>No source data available.</Empty>
            ) : (
              <div className="space-y-hb-4">
                {d.sources.map((s) => (
                  <Meter
                    key={s.source}
                    label={titleCase(s.source)}
                    value={s.rate}
                    valueLabel={`${Math.round(s.rate)}% of ${s.applications}`}
                  />
                ))}
              </div>
            )}
          </Card>

          <Card padding="loose">
            <CardHeader title="Interviewer bias" action={<Badge tone="brand">Calibration</Badge>} />
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={i} className="h-14 w-full" rounded="md" />
                ))}
              </div>
            ) : !d?.interviewer_calibration.length ? (
              <Empty>Not enough interview data for calibration.</Empty>
            ) : (
              <ul className="space-y-2">
                {d.interviewer_calibration.map((c) => (
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
                    <Badge tone={Math.abs(c.variance) > 0.5 ? 'warning' : 'success'}>
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
