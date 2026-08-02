import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, CalendarDays, CheckCircle2, Clock, Lock, Monitor, Video } from 'lucide-react'

import { interviewsApi } from '@/api/interviews'
import type { Interview } from '@/types'
import { useInterviewStore } from '@/store/interviewStore'
import { useAuthStore } from '@/store/authStore'
import { groupInterviewsByCandidate } from '@/utils/grouping'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Skeleton,
  SkeletonStats,
  StatCard,
  StatGrid,
} from '@/components/hb'

/**
 * The interviewer's landing page.
 *
 * Rebuilt on the design system in phase 8. Two things beyond appearance:
 *
 * - "Fill Scorecard" pointed at `/interviewer/scorecard/:id`, which is not a
 *   route — the workspace lives under `/hiring`, and the scorecard route had no
 *   `:interviewId` segment at all. Every interviewer who clicked it landed on
 *   the marketing homepage.
 * - Candidate initials were tinted by hashing the name to one of seven
 *   hardcoded hexes. `Avatar` gives every person the same appearance, which is
 *   the point: the name identifies the person, not the colour.
 */

const isSameDay = (a: Date, b: Date) =>
  a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()

const isToday = (iso: string) => isSameDay(new Date(iso), new Date())

function isThisMonth(iso: string) {
  const d = new Date(iso)
  const n = new Date()
  return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()
}

/** Live from five minutes before the start until the scheduled end. */
function isLiveNow(i: Interview) {
  if (i.status !== 'scheduled') return false
  const start = new Date(i.scheduled_at).getTime()
  const end = start + (i.duration_minutes ?? 60) * 60_000
  const now = Date.now()
  return now >= start - 5 * 60_000 && now <= end
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })

/** Live wins over unconfirmed, which wins over a plain upcoming slot. */
function roundStatus(i: Interview): string | null {
  if (isLiveNow(i)) return 'in_progress'
  if (i.status === 'scheduled' && !i.is_confirmed) return 'pending'
  if (i.status === 'scheduled') return 'confirmed'
  if (i.status === 'completed') return 'completed'
  return null
}

export default function InterviewerDashboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isUnlocked = useInterviewStore((s) => s.isComplete)

  const { data: interviews, isLoading } = useQuery({
    queryKey: ['my-interviews'],
    queryFn: () => interviewsApi.list().then((r) => r.data),
  })

  const all = interviews ?? []
  const todayScheduled = all.filter((i) => isToday(i.scheduled_at) && i.status === 'scheduled')
  const completedToday = all.filter((i) => isToday(i.scheduled_at) && i.status === 'completed')
  const scorecardsDue = all.filter((i) => i.status === 'completed' && !i.feedback)
  const thisMonth = all.filter((i) => isThisMonth(i.scheduled_at))
  const liveNow = all.filter(isLiveNow).length

  const todayItems = all
    .filter((i) => isToday(i.scheduled_at) && i.status !== 'cancelled')
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())

  const lead = isLoading
    ? 'Loading your schedule…'
    : `You have ${todayScheduled.length} interview${todayScheduled.length === 1 ? '' : 's'} today${
        liveNow > 0 ? ` — ${liveNow} live right now` : ''
      }.`

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow={new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })}
        /* Name in the brand gradient, like the site's hero phrase. */
        title={
          <>
            {greeting()}
            {user && (
              <>
                , <span className="hb-grad-text">{user.full_name.split(' ')[0]}</span>
              </>
            )}
          </>
        }
        description={lead}
        actions={
          <Button variant="ghost" to="/hiring/interviewer/interviews">
            Full calendar
          </Button>
        }
      />

      <div className="space-y-hb-6">
        {isLoading ? (
          <SkeletonStats />
        ) : (
          <StatGrid>
            <StatCard label="Interviews today" value={todayScheduled.length} icon={<CalendarDays />} />
            <StatCard label="Scorecards due" value={scorecardsDue.length} icon={<Clock />} />
            <StatCard label="Completed today" value={completedToday.length} icon={<CheckCircle2 />} />
            <StatCard label="This month" value={thisMonth.length} icon={<BarChart3 />} />
          </StatGrid>
        )}

        <Card padding="loose">
          <CardHeader
            title="Today's schedule"
            subtitle={new Date().toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
            action={liveNow > 0 ? <Badge tone="success" dot="pulse">{liveNow} live</Badge> : undefined}
          />

          {isLoading ? (
            <div className="space-y-hb-3">
              {[1, 2].map((n) => (
                <Skeleton key={n} className="h-28 w-full" rounded="md" />
              ))}
            </div>
          ) : todayItems.length === 0 ? (
            <EmptyState
              icon={<CalendarDays />}
              title="Nothing on today"
              description="Your schedule is clear. Interviews assigned to you will appear here."
            />
          ) : (
            <ul className="space-y-hb-4">
              {groupInterviewsByCandidate(todayItems).map((group) => (
                <li key={group.candidate_id}>
                  <Card padding="none" className="overflow-hidden">
                    <div className="flex items-center gap-3.5 border-b border-hb-border bg-hb-surface-2 px-5 py-4">
                      <Avatar name={group.candidate_name} size="lg" />
                      <div className="min-w-0">
                        <h3 className="truncate font-display text-hb-h3 text-hb-text">
                          {group.candidate_name}
                        </h3>
                        <p className="text-hb-xs text-hb-muted">
                          {group.interviews.length} round
                          {group.interviews.length === 1 ? '' : 's'} assigned to you
                        </p>
                      </div>
                    </div>

                    <ul>
                      {group.interviews.map((interview) => {
                        const live = isLiveNow(interview)
                        const done = interview.status === 'completed'
                        /* The prep kit gates the meeting link for interviewers
                           only — an admin or recruiter sitting in can always
                           join. */
                        const canJoin = isUnlocked(interview.id) || user?.role !== 'interviewer'

                        return (
                          <li
                            key={interview.id}
                            className="flex flex-col gap-hb-3 border-b border-hb-border p-5 last:border-0 md:flex-row md:items-center"
                          >
                            <div className="flex shrink-0 items-baseline gap-2 md:w-24 md:flex-col md:gap-0.5">
                              <p className="font-display text-hb-h3 text-hb-text">
                                {fmtTime(interview.scheduled_at)}
                              </p>
                              <p className="font-mono text-hb-micro uppercase text-hb-dim">
                                {interview.duration_minutes}m
                              </p>
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-hb-body font-semibold text-hb-text">
                                  {interview.title || 'General interview'}
                                </span>
                                {roundStatus(interview) && (
                                  <Badge
                                    tone={live ? 'success' : done ? 'brand' : 'info'}
                                    dot={live ? 'pulse' : undefined}
                                  >
                                    {live
                                      ? 'Live now'
                                      : done
                                        ? 'Completed'
                                        : interview.is_confirmed
                                          ? 'Confirmed'
                                          : 'Awaiting confirm'}
                                  </Badge>
                                )}
                              </div>
                              <p className="mt-1 inline-flex items-center gap-1.5 text-hb-xs capitalize text-hb-muted">
                                <Monitor size={12} aria-hidden />
                                {interview.interview_type || 'video'}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 md:justify-end">
                              {live &&
                                interview.meeting_link &&
                                (canJoin ? (
                                  <Button
                                    size="sm"
                                    icon={<Video size={14} />}
                                    href={interview.meeting_link}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Join
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    icon={<Lock size={13} />}
                                    disabled
                                    title="Complete the prep kit to unlock the meeting link"
                                  >
                                    Locked
                                  </Button>
                                ))}

                              <Button
                                size="sm"
                                variant={done ? 'ghost' : 'primary'}
                                onClick={() =>
                                  navigate(`/hiring/interviewer/scorecard/${interview.id}`)
                                }
                              >
                                {done ? 'View result' : 'Fill scorecard'}
                              </Button>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
