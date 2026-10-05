import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Fragment } from 'react'
import {
  CalendarDays,
  Check,
  Circle,
  CircleDashed,
  FileText,
  Map,
  Target,
  Trophy,
} from 'lucide-react'

import { portalApi } from '@/api/portal'
import { formatDate } from '@/utils/formatters'
import { RecentActivityFeed } from '@/components/common/RecentActivityFeed'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  IconTile,
  Meter,
  PageHeader,
  Skeleton,
} from '@/components/hb'

/**
 * The candidate's home: where their application stands, what has happened,
 * and what comes next.
 *
 * Rebuilt on the design system in phase 7. The page was written against
 * `portal.css` — `.card`, `.ctitle`, `.chip`, `.tracker-*`, `.rh-*`, `.kpi` —
 * a parallel design system only these nine pages used, with its own fonts
 * (Plus Jakarta Sans, Space Grotesk) and its own palette. It also carried two
 * complete dead components: `StageChip` and `StageTracker` were defined at the
 * top of the file and never rendered — the tracker on screen was a third,
 * inline implementation.
 */

// Display stages shown in the tracker
const STAGES = [
  { key: 'applied', label: 'Applied', sublabel: '' },
  { key: 'shortlisted', label: 'Shortlisted', sublabel: 'Pre-screening' },
  { key: 'round1', label: 'Round 1', sublabel: 'Technical' },
  { key: 'round2', label: 'Round 2', sublabel: 'Techno-functional' },
  { key: 'round3', label: 'Round 3', sublabel: 'Management' },
  { key: 'hr_round', label: 'HR round', sublabel: 'Final step' },
  { key: 'offer', label: 'Offer', sublabel: '' },
] as const

// Maps backend pipeline_stage → tracker step index (0-based)
function stageIndex(stage: string): number {
  if (!stage || stage === 'applied' || stage === 'needs_review') return 0
  if (stage === 'pre_screening_selected' || stage === 'pre_screening') return 1
  if (['technical_round', 'technical_round_selected', 'technical_round_rejected', 'technical_round_back_out'].includes(stage)) return 2
  if (['practical_round', 'practical_round_selected', 'practical_round_rejected', 'practical_round_back_out',
       'techno_functional_round', 'techno_functional_selected', 'techno_functional_rejected'].includes(stage)) return 3
  if (['management_round', 'management_round_selected', 'management_round_rejected', 'interviewed', 'interview'].includes(stage)) return 4
  if (['hr_round', 'hr_round_selected', 'hr_round_rejected'].includes(stage)) return 5
  if (['offered', 'offer', 'hired', 'hired_joined'].includes(stage)) return 6
  return 0
}

const PROGRESS = [10, 25, 40, 55, 70, 85, 100]
const progressPercent = (i: number) => PROGRESS[Math.min(i, PROGRESS.length - 1)]

const STAGE_TITLE = [
  'Application received',
  'Shortlisted — pre-screening',
  'Round 1 — technical',
  'Round 2 — techno-functional',
  'Round 3 — management',
  'HR round',
  'Offer stage',
]

const STAGE_SUB = [
  'Your application has been received and is waiting to be reviewed by the team.',
  'Great news! You have been shortlisted. An HR representative will reach out to you shortly.',
  'You are in the technical round. Complete your scheduled technical interview.',
  'You have cleared round 1! You are now in the techno-functional round.',
  'Excellent progress! You are in the final management round.',
  'Almost there! The HR round is the final step before the offer.',
  'Your offer document is being prepared. Please check your offers section.',
]

/** The seven-step journey, done → active → pending. */
function StageTracker({ current }: { current: number }) {
  return (
    /* Phones: a vertical timeline (like order tracking) instead of a 720px
       strip you had to scroll sideways to find your own stage. */
    <div className="pb-2">
      <ol className="flex flex-col md:flex-row md:items-start" aria-label="Application stages">
        {STAGES.map((s, i) => {
          const done = i < current
          const active = i === current
          return (
            <Fragment key={s.key}>
              {i > 0 && (
                <span
                  aria-hidden
                  className={`ml-[13px] h-5 w-0.5 rounded-full md:ml-0 md:mt-3.5 md:h-0.5 md:w-auto md:flex-1 ${
                    i <= current ? 'bg-hb-grad' : 'bg-hb-border'
                  }`}
                />
              )}
              <li
                className="flex shrink-0 items-center gap-3 md:w-[92px] md:flex-col md:items-center md:gap-1.5 md:text-center"
                aria-current={active ? 'step' : undefined}
              >
                <span
                  className={`grid h-7 w-7 place-items-center rounded-full border transition-all duration-hb ${
                    done
                      ? 'border-transparent bg-hb-grad text-white'
                      : active
                        ? 'border-hb-cyan/50 bg-hb-cyan/12 text-hb-cyan shadow-[0_0_0_4px_rgb(var(--hb-cyan)/0.14)]'
                        : 'border-hb-border text-hb-dim'
                  }`}
                >
                  {done ? (
                    <Check size={13} aria-hidden />
                  ) : active ? (
                    <Circle size={8} fill="currentColor" aria-hidden />
                  ) : (
                    <CircleDashed size={10} aria-hidden />
                  )}
                </span>
                <span
                  className={`text-hb-xs font-semibold ${
                    active ? 'text-hb-text' : done ? 'text-hb-muted' : 'text-hb-dim'
                  }`}
                >
                  {s.label}
                </span>
                {s.sublabel && (
                  <span className="font-mono text-hb-micro uppercase text-hb-dim">
                    {s.sublabel}
                  </span>
                )}
              </li>
            </Fragment>
          )
        })}
      </ol>
    </div>
  )
}

export default function PortalDashboard() {
  const navigate = useNavigate()

  const { data: applications, isLoading: appsLoading } = useQuery({
    queryKey: ['portal', 'applications'],
    queryFn: () => portalApi.myApplications().then((r: any) => r.data),
  })

  const { data: interviews, isLoading: intLoading } = useQuery({
    queryKey: ['portal', 'interviews'],
    queryFn: () => portalApi.myInterviews().then((r: any) => r.data),
  })

  // Fetch candidate profile as fallback — recruiters may update stage before
  // an Application record exists (invite-only flow, no job linked yet)
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['portal', 'profile'],
    queryFn: () => portalApi.profile().then((r: any) => r.data),
  })

  if (appsLoading || intLoading || profileLoading) {
    return (
      <div className="pb-hb-10">
        <Skeleton className="mb-hb-6 h-12 w-80" rounded="md" />
        <Skeleton className="mb-hb-5 h-64 w-full" rounded="md" />
        <div className="grid gap-hb-4 lg:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-72 w-full" rounded="md" />
          ))}
        </div>
      </div>
    )
  }

  const activeApp =
    applications?.find((a: any) => !['hired', 'rejected'].includes(a.stage)) || applications?.[0]

  // If no Application record yet but recruiter set a pipeline_stage on the
  // candidate, build a synthetic display object so the tracker still renders.
  const syntheticApp =
    !activeApp && profile?.pipeline_stage
      ? {
          id: 'synthetic',
          stage: profile.pipeline_stage as string,
          applied_at: profile.created_at,
          job: null as any,
        }
      : null

  const displayApp = activeApp ?? syntheticApp

  if (!displayApp) {
    return (
      <div className="pb-hb-10">
        <PageHeader
          eyebrow="Candidate portal"
          title={<>Your application <span className="hb-grad-text">journey</span></>}
          description="Start applying to open roles to track your progress here."
        />
        <Card padding="none">
          <EmptyState
            icon={<Map />}
            title="Ready to begin"
            description="Browse our open positions and find the perfect fit for your skills."
            size="page"
            action={{ label: 'View openings', onClick: () => navigate('/hiring/portal/openings') }}
          />
        </Card>
      </div>
    )
  }

  const currentIdx = stageIndex(displayApp.stage)
  const isRejected = displayApp.stage === 'rejected'
  const isHired = displayApp.stage === 'hired'
  const progress = progressPercent(currentIdx)

  const history = [...(interviews || [])].sort(
    (a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()
  )

  const daysInProcess = Math.max(
    1,
    Math.floor((Date.now() - new Date(displayApp.applied_at).getTime()) / 86_400_000)
  )

  const roleTitle =
    displayApp.job?.title ||
    (syntheticApp ? profile?.applied_job_title || 'Your application' : 'Role')

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Candidate portal"
        title={<>Your application <span className="hb-grad-text">journey</span></>}
        description={
          <>
            Applying for <strong className="font-semibold text-hb-text">{roleTitle}</strong> ·
            applied {formatDate(displayApp.applied_at)}
          </>
        }
        actions={
          isRejected ? (
            <Badge tone="error" dot>Rejected</Badge>
          ) : isHired ? (
            <Badge tone="success" dot>Hired!</Badge>
          ) : (
            <Badge tone="info" dot>
              Step {Math.min(currentIdx + 1, 7)} of 7
            </Badge>
          )
        }
      />

      <div className="space-y-hb-5">
        <Card padding="loose">
          <CardHeader
            title="Stage progress"
            action={<Badge tone="info">Step {Math.min(currentIdx + 1, 7)} of 7</Badge>}
          />

          <StageTracker current={currentIdx} />

          <div className="mt-hb-4 rounded-hb-md border border-hb-border bg-hb-surface-2 p-5">
            <p className="font-mono text-hb-label uppercase text-hb-dim">
              {isRejected ? 'Application closed' : 'Current stage'}
            </p>
            <h3 className="mt-1.5 flex items-center gap-2 font-display text-hb-h3 text-hb-text">
              {isRejected ? (
                'Application closed'
              ) : isHired ? (
                <>
                  Welcome to the team!
                  <Trophy size={18} aria-hidden className="text-hb-warning" />
                </>
              ) : (
                STAGE_TITLE[currentIdx]
              )}
            </h3>
            <p className="mt-1.5 max-w-[62ch] text-hb-sm text-hb-muted">
              {isRejected
                ? "Thank you for your time. This application didn't proceed further."
                : isHired
                  ? 'You have officially accepted the offer. Congratulations!'
                  : STAGE_SUB[currentIdx]}
            </p>
            <div className="mt-hb-4 flex flex-wrap gap-2">
              {currentIdx >= 2 && currentIdx <= 5 && !isRejected && (
                <Button
                  size="sm"
                  icon={<CalendarDays size={14} />}
                  onClick={() => navigate('/hiring/portal/interviews')}
                >
                  View interviews
                </Button>
              )}
              {currentIdx === 6 && (
                <Button
                  size="sm"
                  icon={<FileText size={14} />}
                  onClick={() => navigate('/hiring/portal/offers')}
                >
                  View offer
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                icon={<Target size={14} />}
                onClick={() => navigate('/hiring/portal/prep')}
              >
                Open prep hub
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid gap-hb-4 lg:grid-cols-3">
          {/* ── Round history ─────────────────────────────────────────────── */}
          <Card padding="default">
            <CardHeader title="Round history" />
            {history.length === 0 ? (
              <EmptyState
                icon={<CalendarDays />}
                title="No interviews yet"
                description="Your interview rounds will appear here as they are scheduled."
              />
            ) : (
              <ul className="space-y-3">
                {history.map((intv) => {
                  const upcoming = intv.status === 'scheduled'
                  const passed = intv.status === 'completed' || (intv.status as string) === 'passed'
                  return (
                    <li key={intv.id} className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          upcoming ? 'bg-hb-cyan' : passed ? 'bg-hb-success' : 'bg-hb-dim'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-hb-sm font-semibold text-hb-text" title={intv.title}>
                          {intv.title}
                        </p>
                        <p className="truncate text-hb-xs text-hb-muted">
                          {intv.interview_type.replace(/_/g, ' ')} · {intv.duration_minutes} min ·{' '}
                          {formatDate(intv.scheduled_at)}
                        </p>
                      </div>
                      {upcoming ? (
                        <Badge tone="info">Upcoming</Badge>
                      ) : passed ? (
                        <Badge tone="success">Passed</Badge>
                      ) : (
                        <Badge>Closed</Badge>
                      )}
                    </li>
                  )
                })}
                {currentIdx === 2 && (
                  <li className="flex items-center gap-3">
                    <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-hb-dim" />
                    <div className="min-w-0 flex-1">
                      <p className="text-hb-sm font-semibold text-hb-text">Next rounds</p>
                      <p className="text-hb-xs text-hb-muted">Pending HR scheduling</p>
                    </div>
                    <Badge>Upcoming</Badge>
                  </li>
                )}
              </ul>
            )}
          </Card>

          {/* ── Live activity ─────────────────────────────────────────────── */}
          <Card padding="default">
            <CardHeader
              title="Live activity"
              action={<Badge tone="success" dot="pulse">Live</Badge>}
            />
            <div className="max-h-[320px] overflow-y-auto pr-2">
              <RecentActivityFeed limit={5} />
            </div>
          </Card>

          {/* ── Stats ─────────────────────────────────────────────────────── */}
          <Card padding="default">
            <CardHeader title="Your application stats" />
            <div className="space-y-hb-4">
              <div className="flex items-center gap-3.5">
                <IconTile size="sm">
                  <CalendarDays />
                </IconTile>
                <div>
                  <p className="hb-grad-text font-display text-hb-num">{daysInProcess}</p>
                  <p className="text-hb-xs text-hb-muted">Days in process</p>
                </div>
              </div>

              <div className="border-t border-hb-border pt-hb-4">
                <Meter
                  value={progress}
                  label="Process completion"
                  valueLabel={`${Math.min(currentIdx + 1, 7)} of 7 stages`}
                />
              </div>

              <div className="border-t border-hb-border pt-hb-4">
                <p className="mb-1.5 font-mono text-hb-label uppercase text-hb-dim">Applied role</p>
                <p className="text-hb-sm font-semibold text-hb-text">
                  {displayApp.job?.title ||
                    (syntheticApp ? profile?.applied_job_title || 'Invited candidate' : 'Unknown role')}
                </p>
                <p className="mt-0.5 text-hb-xs text-hb-muted">
                  {[displayApp.job?.department, displayApp.job?.location || 'Remote']
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {displayApp.job?.skills_required?.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {displayApp.job.skills_required.slice(0, 4).map((skill: string) => (
                      <Badge key={skill}>{skill}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
