import { Fragment } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Circle, CircleDashed, Check, FileText } from 'lucide-react'

import { portalApi } from '@/api/portal'
import { formatDate, stageLabel } from '@/utils/formatters'
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  Skeleton,
  StatusPill,
} from '@/components/hb'

/**
 * Every application the candidate has made, each with its own mini pipeline.
 *
 * Rebuilt on the design system in phase 7. The page carried its own
 * `STAGE_CFG` palette (seven legacy-var colours), its own `StageChip`
 * (replaced by `StatusPill`, which already knows every pipeline stage), hover
 * elevation written to `element.style` from mouse events, and four font
 * families named inline. The mini stage bar keeps its shape but draws from
 * tokens.
 */

const PIPELINE_STAGES = ['applied', 'screening', 'interview', 'interviewed', 'offer', 'hired'] as const

function StageBar({ stage }: { stage: string }) {
  const currentIdx = PIPELINE_STAGES.indexOf(stage as (typeof PIPELINE_STAGES)[number])

  const shownIdx = Math.max(currentIdx, 0)

  return (
    <div className="pb-1">
      {/* Phones: one compact progress line per card instead of a 520px
          stepper that scrolled sideways inside every card. */}
      <div className="md:hidden">
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <span className="text-hb-sm font-semibold capitalize text-hb-text">{stageLabel(PIPELINE_STAGES[shownIdx])}</span>
          <span className="font-mono text-hb-micro uppercase text-hb-dim">
            Step {shownIdx + 1} of {PIPELINE_STAGES.length}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-hb-border" aria-hidden>
          <div
            className="h-full rounded-full bg-hb-grad"
            style={{ width: `${((shownIdx + 1) / PIPELINE_STAGES.length) * 100}%` }}
          />
        </div>
      </div>
      <ol className="hidden items-start md:flex" aria-label="Pipeline stages">
        {PIPELINE_STAGES.map((s, i) => {
          const done = i < currentIdx
          const active = i === currentIdx
          return (
            <Fragment key={s}>
              {i > 0 && (
                <span
                  aria-hidden
                  className={`mt-2.5 h-0.5 flex-1 rounded-full ${
                    i <= currentIdx ? 'bg-hb-grad' : 'bg-hb-border'
                  }`}
                />
              )}
              <li
                aria-current={active ? 'step' : undefined}
                className="flex w-[74px] shrink-0 flex-col items-center gap-1 text-center"
              >
                <span
                  className={`grid h-5 w-5 place-items-center rounded-full border ${
                    done
                      ? 'border-transparent bg-hb-grad text-white'
                      : active
                        ? 'border-hb-cyan/50 bg-hb-cyan/12 text-hb-cyan shadow-[0_0_0_3px_rgb(var(--hb-cyan)/0.14)]'
                        : 'border-hb-border text-hb-dim'
                  }`}
                >
                  {done ? (
                    <Check size={10} aria-hidden />
                  ) : active ? (
                    <Circle size={6} fill="currentColor" aria-hidden />
                  ) : (
                    <CircleDashed size={8} aria-hidden />
                  )}
                </span>
                <span
                  className={`text-hb-micro font-semibold capitalize ${
                    active ? 'text-hb-text' : 'text-hb-dim'
                  }`}
                >
                  {stageLabel(s)}
                </span>
              </li>
            </Fragment>
          )
        })}
      </ol>
    </div>
  )
}

export default function PortalApplicationsPage() {
  const { data: applications, isLoading, isError } = useQuery({
    queryKey: ['portal', 'applications'],
    queryFn: () => portalApi.myApplications().then((r: any) => r.data),
  })

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Candidate portal"
        title="My applications"
        description={
          applications
            ? `${applications.length} application${applications.length !== 1 ? 's' : ''} on record.`
            : 'Track all your job applications.'
        }
      />

      {isLoading ? (
        <div className="space-y-hb-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 w-full" rounded="md" />
          ))}
        </div>
      ) : isError ? (
        <div
          role="alert"
          className="rounded-hb-md border border-hb-error/25 bg-hb-error/8 p-4 text-hb-sm text-hb-error"
        >
          Failed to load applications.
        </div>
      ) : !applications?.length ? (
        <Card padding="none">
          <EmptyState
            icon={<FileText />}
            title="No applications yet"
            description="You haven't applied to any jobs yet. Check back when the recruiter links you to a position."
            size="page"
          />
        </Card>
      ) : (
        <ul className="space-y-hb-3">
          {applications.map((app: any) => (
            <li key={app.id}>
              <Card variant="interactive" padding="default" className="space-y-hb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-display text-hb-h3 text-hb-text">
                      {app.job?.title ?? 'Position'}
                    </h3>
                    <p className="mt-1 text-hb-xs text-hb-muted">
                      {[app.job?.location, app.job?.is_remote ? 'Remote' : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <StatusPill status={app.stage} />
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-hb-xs text-hb-muted">
                  <span>Applied {formatDate(app.applied_at)}</span>
                  <span>Updated {formatDate(app.stage_changed_at)}</span>
                  {app.source && <span>via {app.source}</span>}
                  {app.match_score != null && (
                    <Badge
                      tone={
                        app.match_score >= 80
                          ? 'success'
                          : app.match_score >= 60
                            ? 'warning'
                            : 'error'
                      }
                    >
                      {Math.round(app.match_score)}% match
                    </Badge>
                  )}
                </div>

                {app.stage === 'rejected' ? (
                  <p className="rounded-hb-md border border-hb-error/25 bg-hb-error/8 px-3.5 py-2.5 text-hb-xs text-hb-error">
                    Application not moved forward
                    {app.rejection_reason ? ` · ${app.rejection_reason}` : ''}
                  </p>
                ) : (
                  <StageBar stage={app.stage} />
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
