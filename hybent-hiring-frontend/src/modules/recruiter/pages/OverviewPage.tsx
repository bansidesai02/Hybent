import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format, isToday } from 'date-fns'
import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  FileText,
  Trophy,
  UserPlus,
  Video,
} from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/store/authStore'
import { analyticsApi } from '@/api/analytics'
import { interviewsApi } from '@/api/interviews'
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
  SkeletonStats,
  StatCard,
  StatGrid,
  StatusPill,
  type Trend,
} from '@/components/hb'

/**
 * The recruiter's front door.
 *
 * Rebuilt on the design system in phase 6. What it used to be: four locally
 * defined card components (KPI, activity row, interview, quick link), each with
 * its own radius, its own shadow and its own hardcoded palette, plus a private
 * `STATUS_MAP` that disagreed with the five other status maps in this module â€”
 * one entry of which, `'var(--violet)/10'`, was not valid CSS at all and had
 * been silently rendering transparent.
 *
 * Everything here now comes from `@/components/hb`. The page names no colour.
 */

/* â”€â”€ Funnel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   The width is the encoding, so every bar wears the brand gradient rather than
   a per-stage colour. The old version assigned violet / blue / pink / teal to
   the four stages, which read as four unrelated metrics instead of one
   narrowing flow. */
function FunnelRow({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((count / total) * 100)) : 0

  return (
    <div className="flex items-center gap-hb-4">
      <span className="w-24 shrink-0 text-right text-hb-sm text-hb-muted">{label}</span>

      <Meter value={pct} size="md" className="flex-1" />

      <span className="w-20 shrink-0 text-right font-mono text-hb-xs tabular-nums text-hb-text">
        {count.toLocaleString()}
        <span className="ml-1.5 text-hb-dim">{pct}%</span>
      </span>
    </div>
  )
}

/* â”€â”€ Today's interviews â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   `StatusPill` owns the label and the tone; this only decides the layout. */
function InterviewCard({
  time,
  name,
  type,
  status,
  meetingLink,
}: {
  time: string
  name: string
  type: string
  status: string
  meetingLink?: string | null
}) {
  return (
    <Card padding="compact" className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-hb-label uppercase text-hb-cyan">{time}</span>
        <StatusPill status={status} />
      </div>

      <div className="min-w-0">
        <p className="truncate font-display text-hb-h3 text-hb-text">{name}</p>
        <p className="mt-0.5 truncate text-hb-xs capitalize text-hb-muted">
          {type?.replace(/[_-]+/g, ' ')}
        </p>
      </div>

      {status === 'scheduled' && meetingLink && (
        <a
          href={meetingLink}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto inline-flex h-8 items-center justify-center gap-1.5 rounded-hb-full bg-hb-grad px-4 text-hb-sm font-bold text-hb-on-brand transition-transform duration-hb ease-hb hover:-translate-y-px"
        >
          <Video size={14} aria-hidden />
          Join now
        </a>
      )}
    </Card>
  )
}

/* â”€â”€ Quick actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   One tile appearance, per the design system. These were four different tinted
   backgrounds; what tells them apart is the glyph and the label. */
const QUICK_ACTIONS = [
  { label: 'Post a new job', to: '/jobs/new', icon: <BriefcaseBusiness /> },
  { label: 'Add a candidate', to: '/upload', icon: <UserPlus /> },
  { label: 'Schedule a call', to: '/interviews', icon: <CalendarDays /> },
  { label: 'AI insights', to: '/analytics', icon: <Bot /> },
] as const

export default function OverviewPage() {
  const { basePath } = useAuth()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: () => analyticsApi.overview().then((r: any) => r.data),
  })

  const { data: interviews, isLoading: interviewsLoading } = useQuery({
    queryKey: ['interviews', 'today'],
    queryFn: () => interviewsApi.list().then((r: any) => r.data),
  })

  const todayInterviews = useMemo(
    () => (interviews ?? []).filter((i: any) => isToday(new Date(i.scheduled_at))),
    [interviews]
  )

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const kpis = [
    {
      label: 'Resumes processed',
      value: analytics?.resumes_processed ?? 0,
      icon: <FileText />,
      trend: toTrend(analytics?.resumes_processed_delta),
    },
    {
      label: 'Auto-shortlisted',
      value: analytics?.auto_shortlisted ?? 0,
      icon: <CheckCircle2 />,
      trend: toTrend(analytics?.auto_shortlisted_delta),
    },
    {
      label: 'Interviews booked',
      value: analytics?.interviews_scheduled ?? 0,
      icon: <CalendarDays />,
      trend: toTrend(analytics?.interviews_scheduled_delta),
    },
    {
      label: 'Hires made',
      value: analytics?.offers_accepted ?? 0,
      icon: <Trophy />,
      trend: toTrend(analytics?.offers_accepted_delta),
    },
  ]

  const funnelTotal = Math.max(
    analytics?.total_candidates ?? 0,
    analytics?.total_applications ?? 0,
    1
  )

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Overview"
        /* The name carries the brand gradient, the way the site's hero puts
           "how you hire." in it. One gradient phrase per page is the whole
           reason that headline reads as Hybent and not as a generic H1 — the
           workspace had the gradient defined and never used it above the fold. */
        title={
          <>
            {greeting},{' '}
            <span className="hb-grad-text">
              {user?.full_name?.split(' ')[0] || 'there'}
            </span>
          </>
        }
        description="Your hiring pipeline at a glance. Hybent AI keeps screening while you're away."
        actions={
          <Button
            variant="ghost"
            size="sm"
            trailingIcon={<ArrowRight size={15} />}
            to={`${basePath}/analytics`}
          >
            Full analytics
          </Button>
        }
      />

      <div className="space-y-hb-6">
        {/* Quick actions */}
        {/* Each tile is a real link with a stretched hit area, rather than a
            `role="button"` div that reimplements Enter and Space. The `<a>` is
            the only focusable thing in the card, so the whole tile is one tab
            stop and middle-click opens it in a new tab. */}
        {/* Phones: a 2×2 grid of app-style tiles (icon over label) rather than
            four full-width rows that filled the whole first screen. */}
        <ul className="grid grid-cols-2 gap-3 md:gap-hb-4 xl:grid-cols-4">
          {QUICK_ACTIONS.map((a) => (
            <Card
              key={a.label}
              as="li"
              variant="interactive"
              padding="compact"
              className="group flex flex-col items-start gap-2.5 max-md:active:bg-hb-surface-2 md:flex-row md:items-center md:gap-3"
            >
              <IconTile>{a.icon}</IconTile>
              <Link
                to={`${basePath}${a.to}`}
                className="text-hb-sm font-semibold leading-snug text-hb-text md:text-hb-body after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:shadow-hb-ring"
              >
                {a.label}
              </Link>
              <ArrowRight
                size={15}
                aria-hidden
                className="ml-auto hidden shrink-0 text-hb-dim transition-transform duration-hb ease-hb group-hover:translate-x-1 md:block"
              />
            </Card>
          ))}
        </ul>

        {/* KPIs */}
        {analyticsLoading ? (
          <SkeletonStats />
        ) : (
          <StatGrid>
            {kpis.map((k) => (
              <StatCard key={k.label} {...k} />
            ))}
          </StatGrid>
        )}

        <div className="grid grid-cols-1 gap-hb-6 lg:grid-cols-2">
          {/* Hiring funnel */}
          <Card padding="loose">
            <CardHeader
              title="Hiring funnel"
              action={<Badge>This month</Badge>}
            />
            <div className="space-y-hb-4">
              {analyticsLoading ? (
                Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-2.5 w-full" />)
              ) : (
                <>
                  <FunnelRow label="Applied" count={analytics?.total_applications ?? 0} total={funnelTotal} />
                  <FunnelRow label="Shortlisted" count={analytics?.auto_shortlisted ?? 0} total={funnelTotal} />
                  <FunnelRow label="Interviewed" count={analytics?.interviews_scheduled ?? 0} total={funnelTotal} />
                  <FunnelRow label="Hired" count={analytics?.offers_accepted ?? 0} total={funnelTotal} />
                </>
              )}
            </div>
          </Card>

          {/* Recent activity */}
          <Card padding="loose">
            <CardHeader
              title="Recent activity"
              action={
                <Badge tone="success" dot="pulse">
                  Live
                </Badge>
              }
            />
            <RecentActivityFeed limit={4} />
          </Card>
        </div>

        {/* Today's interviews */}
        <Card padding="loose">
          <CardHeader
            title="Today's interviews"
            subtitle={format(new Date(), 'EEEE, MMMM d')}
            action={
              <Button
                variant="quiet"
                size="sm"
                trailingIcon={<ArrowRight size={14} />}
                to={`${basePath}/interviews`}
              >
                View schedule
              </Button>
            }
          />

          {interviewsLoading ? (
            <div className="grid grid-cols-1 gap-hb-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-[132px]" rounded="md" />
              ))}
            </div>
          ) : todayInterviews.length > 0 ? (
            <div className="grid grid-cols-1 gap-hb-4 md:grid-cols-2 xl:grid-cols-4">
              {todayInterviews.map((int: any) => (
                <InterviewCard
                  key={int.id}
                  time={format(new Date(int.scheduled_at), 'hh:mm a')}
                  name={int.candidate_name || 'Anonymous candidate'}
                  type={int.interview_type}
                  status={int.status}
                  meetingLink={int.meeting_link}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<CalendarDays />}
              title="Nothing on today"
              description="No interviews are scheduled for today. Your next one will appear here."
              action={{
                label: 'Open the schedule',
                onClick: () => navigate(`${basePath}/interviews`),
              }}
            />
          )}
        </Card>
      </div>
    </div>
  )
}

/**
 * Backend delta â†’ `StatCard` trend.
 *
 * The field is absent on some deployments and pre-formatted ("â†‘ 18%") on
 * others, so anything non-numeric returns undefined and the badge is simply
 * not rendered â€” better than a confident "0%".
 */
function toTrend(raw: unknown): Trend | undefined {
  if (raw === undefined || raw === null) return undefined
  const num = typeof raw === 'number' ? raw : parseFloat(String(raw))
  if (Number.isNaN(num)) return undefined
  return {
    value: `${Math.abs(num)}%`,
    direction: num === 0 ? 'flat' : num > 0 ? 'up' : 'down',
  }
}
