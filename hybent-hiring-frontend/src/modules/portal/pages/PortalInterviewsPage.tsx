import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Check, Clock, MapPin, Target, User, Video } from 'lucide-react'

import { portalApi } from '@/api/portal'
import type { Interview } from '@/types'
import { AddToCalendarDropdown } from '@/components/calendar/AddToCalendarDropdown'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Skeleton,
} from '@/components/hb'

/**
 * The candidate's interview schedule: today, upcoming, completed.
 *
 * Rebuilt on the design system in phase 7 — off `.int-card`/`.chip` from
 * portal.css and the fourth inline font family in as many portal pages. The
 * structure is unchanged: three chronological groups, with the big time
 * numeral as each card's anchor.
 */

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  return d.setHours(0, 0, 0, 0) === now.setHours(0, 0, 0, 0)
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  let hours = d.getHours()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  const mins = d.getMinutes().toString().padStart(2, '0')
  return { hr: String(hours), min: mins, ampm, dt: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
}

function InterviewCard({ interview }: { interview: Interview }) {
  const navigate = useNavigate()
  const scheduled = interview.status === 'scheduled'
  const today = scheduled && isToday(interview.scheduled_at)
  const t = formatTime(interview.scheduled_at)

  const isPassed = interview.status === 'completed' || (interview.status as string) === 'passed'
  const isFailed = interview.status === 'cancelled' || (interview.status as string) === 'failed'

  const panelists =
    interview.panelists?.map((p) => p.user_name || p.user_email).join(', ') || 'TBD'

  return (
    <Card
      variant={scheduled ? 'interactive' : 'flat'}
      padding="default"
      className={`flex flex-col gap-hb-4 md:flex-row md:items-start ${
        today ? 'border-hb-cyan/40' : ''
      } ${!scheduled ? 'opacity-75' : ''}`}
    >
      <div className="flex shrink-0 items-baseline gap-1.5 md:w-24 md:flex-col md:gap-0">
        <p className={`font-display text-hb-h1 ${scheduled ? 'text-hb-text' : 'text-hb-dim'}`}>
          {t.hr}
        </p>
        <p className="font-mono text-hb-xs uppercase text-hb-muted">
          :{t.min} {t.ampm}
        </p>
        <p className={`font-mono text-hb-micro uppercase ${today ? 'text-hb-cyan' : 'text-hb-dim'}`}>
          {today ? 'Today' : t.dt}
        </p>
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <h3 className="text-hb-body font-semibold text-hb-text">{interview.title}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-hb-xs capitalize text-hb-muted">
            {interview.interview_type.replace(/_/g, ' ')} · {interview.duration_minutes} min
            {!scheduled && isPassed && (
              <Badge tone="success" dot>Completed</Badge>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-hb-xs text-hb-muted">
          <span className="inline-flex items-center gap-1.5">
            <User size={12} aria-hidden className="text-hb-cyan" />
            Panel: {panelists}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock size={12} aria-hidden className="text-hb-cyan" />
            {interview.duration_minutes} minutes
          </span>
        </div>

        {scheduled && interview.meeting_link ? (
          <a
            href={interview.meeting_link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-hb-sm font-semibold text-hb-cyan transition-colors duration-hb hover:text-hb-text"
          >
            <Video size={14} aria-hidden />
            Join meeting
          </a>
        ) : scheduled && interview.location ? (
          <p className="inline-flex items-center gap-1.5 text-hb-sm text-hb-muted">
            <MapPin size={14} aria-hidden className="text-hb-cyan" />
            {interview.location}
          </p>
        ) : null}

        {interview.notes && (
          <p className="text-hb-xs italic text-hb-dim">{interview.notes}</p>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">
        {scheduled ? (
          <>
            <AddToCalendarDropdown interview={interview} />
            {interview.meeting_link && (
              <Button size="sm" href={interview.meeting_link} target="_blank" rel="noreferrer">
                Join meet
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              icon={<Target size={13} />}
              onClick={() => navigate('/hiring/portal/prep')}
            >
              Prep kit
            </Button>
          </>
        ) : isPassed ? (
          <Badge tone="success">
            Passed <Check size={11} aria-hidden />
          </Badge>
        ) : isFailed ? (
          <Badge>{interview.status}</Badge>
        ) : null}
      </div>
    </Card>
  )
}

function GroupLabel({ children, live }: { children: React.ReactNode; live?: boolean }) {
  return (
    <p className="flex items-center gap-2 font-mono text-hb-label uppercase text-hb-muted">
      {live && (
        <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-hb-cyan" />
      )}
      {children}
    </p>
  )
}

export default function PortalInterviewsPage() {
  const { data: interviews, isLoading, isError } = useQuery({
    queryKey: ['portal', 'interviews'],
    queryFn: () => portalApi.myInterviews().then((r: any) => r.data),
  })

  const todayInterviews =
    interviews?.filter((i: any) => i.status === 'scheduled' && isToday(i.scheduled_at)) ?? []
  const upcoming =
    interviews
      ?.filter((i: any) => i.status === 'scheduled' && !isToday(i.scheduled_at))
      .sort((a: any, b: any) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()) ?? []
  const past =
    interviews
      ?.filter((i: any) => i.status !== 'scheduled')
      .sort((a: any, b: any) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()) ?? []

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Candidate portal"
        title="My interview schedule"
        description="All your upcoming and past interviews in one place."
        actions={
          todayInterviews.length > 0 ? (
            <Badge tone="info" dot="pulse">
              {todayInterviews.length} today
            </Badge>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="space-y-hb-3">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-36 w-full" rounded="md" />
          ))}
        </div>
      ) : isError ? (
        <div
          role="alert"
          className="rounded-hb-md border border-hb-error/25 bg-hb-error/8 p-4 text-hb-sm text-hb-error"
        >
          Failed to load interviews.
        </div>
      ) : !interviews?.length ? (
        <Card padding="none">
          <EmptyState
            icon={<CalendarDays />}
            title="No interviews scheduled"
            description="When an interviewer schedules you, it will appear here."
            size="page"
          />
        </Card>
      ) : (
        <div className="space-y-hb-3">
          {todayInterviews.length > 0 && (
            <>
              <GroupLabel live>Today</GroupLabel>
              {todayInterviews.map((iv: any) => (
                <InterviewCard key={iv.id} interview={iv} />
              ))}
            </>
          )}

          {upcoming.length > 0 && (
            <>
              <GroupLabel>Upcoming</GroupLabel>
              {upcoming.map((iv: any) => (
                <InterviewCard key={iv.id} interview={iv} />
              ))}
            </>
          )}

          {past.length > 0 && (
            <>
              <GroupLabel>Completed</GroupLabel>
              {past.map((iv: any) => (
                <InterviewCard key={iv.id} interview={iv} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
