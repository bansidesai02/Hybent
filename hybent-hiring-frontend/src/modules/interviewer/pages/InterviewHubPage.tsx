import { useQuery } from '@tanstack/react-query'
import { Brain, CalendarDays, ClipboardCheck, Clock, Lock, Video } from 'lucide-react'

import { interviewsApi } from '@/api/interviews'
import type { Interview } from '@/types'
import { formatDateTime } from '@/utils/formatters'
import { groupInterviewsByCandidate } from '@/utils/grouping'
import { useInterviewStore } from '@/store/interviewStore'
import { useAuthStore } from '@/store/authStore'
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  IconTile,
  PageHeader,
  Skeleton,
  StatusPill,
} from '@/components/hb'

/**
 * "Pick an interview" — the landing page for all three interviewer tools.
 *
 * Rebuilt on the design system in phase 8. Each mode used to carry its own
 * accent colour and CTA gradient (violet for scorecards, amber for prep kits,
 * emerald for the live room), painted as an accent bar, a pill, a shadow tint
 * and a button background. That is colour distinguishing three *pages*, not
 * three meanings, which is exactly what the one-appearance-per-role rule
 * exists to stop — the mode is already named in the heading and the button.
 *
 * All three modes were also unreachable until phase 8: the sidebar linked to
 * `scorecard-hub` / `prep-kit-hub` / `live-room-hub` while the routes were
 * registered under `hub/scorecard` and friends.
 */

export type HubMode = 'scorecard' | 'prepkit' | 'liveroom'

interface ModeConfig {
  icon: React.ReactNode
  title: string
  subtitle: string
  /** Which interviews this tool can act on. */
  filter: (i: Interview) => boolean
  scopeNote: string
  ctaLabel: (i: Interview) => string
  ctaPath: (id: string) => string
  emptyTitle: string
  emptyDesc: string
}

const MODE: Record<HubMode, ModeConfig> = {
  scorecard: {
    icon: <ClipboardCheck />,
    title: 'Scoreboard',
    subtitle: 'Pick an interview to submit or review your evaluation.',
    filter: () => true,
    scopeNote: 'All statuses',
    ctaLabel: (i) => (i.status === 'completed' ? 'View scorecard' : 'Submit scorecard'),
    ctaPath: (id) => `/hiring/interviewer/scorecard/${id}`,
    emptyTitle: 'No interviews assigned yet',
    emptyDesc: 'Interviews assigned to you will appear here.',
  },
  prepkit: {
    icon: <Brain />,
    title: 'Prep kit',
    subtitle: "Open AI-generated questions tailored to the candidate's résumé.",
    filter: (i) => i.status === 'scheduled',
    scopeNote: 'Upcoming only',
    ctaLabel: () => 'Open prep kit',
    ctaPath: (id) => `/hiring/interviewer/prep-kit/${id}`,
    emptyTitle: 'No upcoming interviews',
    emptyDesc: 'Scheduled interviews will show their prep kit here.',
  },
  liveroom: {
    icon: <Video />,
    title: 'Live room',
    subtitle: 'Enter the live room — ratings, running notes and the meeting link.',
    filter: (i) => i.status === 'scheduled',
    scopeNote: 'Upcoming only',
    ctaLabel: () => 'Enter live room',
    ctaPath: (id) => `/hiring/interviewer/live-room/${id}`,
    emptyTitle: 'No scheduled interviews',
    emptyDesc: 'Scheduled interviews will appear here when it is time to run them.',
  },
}

export default function InterviewHubPage({ mode }: { mode: HubMode }) {
  const { user } = useAuthStore()
  const isUnlocked = useInterviewStore((s) => s.isComplete)
  const cfg = MODE[mode]

  const { data: interviews, isLoading, isError } = useQuery({
    queryKey: ['my-interviews'],
    queryFn: () => interviewsApi.list().then((r) => r.data),
  })

  const filtered = (interviews ?? [])
    .filter(cfg.filter)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow={cfg.title}
        title="Pick an interview"
        description={cfg.subtitle}
        actions={
          !isLoading && !isError ? (
            <>
              <Badge tone="info">
                {filtered.length} interview{filtered.length === 1 ? '' : 's'}
              </Badge>
              <Badge>{cfg.scopeNote}</Badge>
            </>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="space-y-hb-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full" rounded="md" />
          ))}
        </div>
      ) : isError ? (
        <div
          role="alert"
          className="rounded-hb-md border border-hb-error/25 bg-hb-error/8 p-4 text-hb-sm text-hb-error"
        >
          Could not load your interviews. Please refresh.
        </div>
      ) : filtered.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={<CalendarDays />}
            title={cfg.emptyTitle}
            description={cfg.emptyDesc}
            size="page"
          />
        </Card>
      ) : (
        <ul className="space-y-hb-4">
          {groupInterviewsByCandidate(filtered).map((group) => (
            <li key={group.candidate_id}>
              <Card padding="default">
                <div className="mb-hb-3 flex items-center gap-2.5">
                  <Avatar name={group.candidate_name} size="sm" />
                  <span className="font-display text-hb-h3 text-hb-text">
                    {group.candidate_name}
                  </span>
                  <Badge>
                    {group.interviews.length} round{group.interviews.length === 1 ? '' : 's'}
                  </Badge>
                </div>

                <ul className="space-y-2">
                  {group.interviews.map((interview) => {
                    const linkOpen =
                      isUnlocked(interview.id) || user?.role !== 'interviewer'
                    const done = interview.status === 'completed'

                    return (
                      <li key={interview.id}>
                        <Card
                          variant="interactive"
                          padding="compact"
                          className="flex flex-wrap items-center gap-hb-4"
                        >
                          <IconTile size="sm">{cfg.icon}</IconTile>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-hb-sm font-semibold text-hb-text">
                                {/* Some rows carry the candidate's name as the
                                    title, which reads as a duplicate inside a
                                    group already headed by that name. */}
                                {!interview.title || interview.title === group.candidate_name
                                  ? 'General interview'
                                  : interview.title}
                              </span>
                              <StatusPill status={interview.status} />
                              <Badge>{interview.interview_type.replace(/_/g, ' ')}</Badge>
                            </div>

                            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-hb-xs text-hb-muted">
                              <span className="inline-flex items-center gap-1.5">
                                <CalendarDays size={12} aria-hidden />
                                {formatDateTime(interview.scheduled_at)}
                              </span>
                              <span className="inline-flex items-center gap-1.5">
                                <Clock size={12} aria-hidden />
                                {interview.duration_minutes} min
                              </span>
                              {interview.meeting_link &&
                                (linkOpen ? (
                                  <a
                                    href={interview.meeting_link}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1.5 font-semibold text-hb-cyan transition-colors duration-hb hover:text-hb-text"
                                  >
                                    <Video size={12} aria-hidden />
                                    Link available
                                  </a>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5">
                                    <Lock size={12} aria-hidden />
                                    Prep required
                                  </span>
                                ))}
                            </div>
                          </div>

                          <Button
                            size="sm"
                            variant={done && mode === 'scorecard' ? 'ghost' : 'primary'}
                            to={cfg.ctaPath(interview.id)}
                            className="shrink-0"
                          >
                            {cfg.ctaLabel(interview)}
                          </Button>
                        </Card>
                      </li>
                    )
                  })}
                </ul>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
