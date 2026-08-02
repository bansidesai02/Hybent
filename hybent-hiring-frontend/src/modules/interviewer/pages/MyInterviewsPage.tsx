import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Brain,
  Check,
  ExternalLink,
  FileText,
  Link as LinkIcon,
  Lock,
  Sparkles,
  Video,
} from 'lucide-react'

import { interviewsApi } from '@/api/interviews'
import { candidatesApi } from '@/api/candidates'
import type { Candidate, Interview } from '@/types'
import { AddToCalendarDropdown } from '@/components/calendar/AddToCalendarDropdown'
import { groupInterviewsByCandidate } from '@/utils/grouping'
import { useInterviewStore } from '@/store/interviewStore'
import { useAuthStore } from '@/store/authStore'
import {
  Avatar,
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  PageHeader,
  Skeleton,
} from '@/components/hb'

/**
 * The interviewer's queue for today.
 *
 * Rebuilt on the design system in phase 8. Four navigation targets in this file
 * were missing the `/hiring` prefix — Enter Room, Prep Kit, Scorecard and the
 * header's Enter Live Room — so every primary action on the page resolved to
 * the catch-all and dropped the interviewer on the marketing homepage. The
 * routes they point at also had no `:interviewId` segment until phase 8; both
 * halves are fixed.
 *
 * The résumé viewer was a hand-rolled `createPortal` overlay with its own
 * Escape handler, scroll lock and `#fff`/`#111`/`#f5f5f5` palette. It is a
 * `Dialog` now, which brings focus trapping the original never had.
 */

const isSameDay = (a: Date, b: Date) =>
  a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()

const isToday = (iso: string) => isSameDay(new Date(iso), new Date())

/** Live from five minutes before the start until the scheduled end. */
function isLiveNow(i: Interview) {
  if (i.status !== 'scheduled') return false
  const start = new Date(i.scheduled_at).getTime()
  const end = start + (i.duration_minutes ?? 60) * 60_000
  const now = Date.now()
  return now >= start - 5 * 60_000 && now <= end
}

const TYPE_LABEL: Record<string, string> = {
  phone: 'Phone screen',
  video: 'Video interview',
  onsite: 'On-site round',
  technical: 'Technical round',
  hr: 'HR round',
  final: 'Final round',
}

const typeLabel = (t: string) =>
  TYPE_LABEL[t] ?? t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

/* ── Card ───────────────────────────────────────────────────────────────── */

function InterviewCard({
  interview,
  live,
  onEnterRoom,
  onViewResume,
  onPrepKit,
  onScorecard,
  onConfirm,
}: {
  interview: Interview
  live: boolean
  onEnterRoom: () => void
  onViewResume: () => void
  onPrepKit: () => void
  onScorecard: () => void
  onConfirm: () => void
}) {
  const { user } = useAuthStore()
  /* The prep kit gates the meeting link for interviewers only — an admin or
     recruiter sitting in can always join. */
  const unlocked =
    useInterviewStore((s) => s.isComplete(interview.id)) || user?.role !== 'interviewer'

  const done = interview.status === 'completed'
  const skills = interview.candidate_skills ?? []

  return (
    <Card padding="none" className="flex flex-col md:flex-row">
      <div className="flex shrink-0 items-baseline justify-between gap-2 border-b border-hb-border px-5 py-4 md:w-[112px] md:flex-col md:items-start md:justify-center md:border-b-0 md:border-r">
        <p className={`font-display text-hb-h2 ${live ? 'text-hb-success' : 'text-hb-text'}`}>
          {fmtTime(interview.scheduled_at)}
        </p>
        <p className="font-mono text-hb-micro uppercase text-hb-dim">
          {interview.duration_minutes} min
        </p>
      </div>

      <div className="min-w-0 flex-1 space-y-2.5 p-5">
        <div>
          <h3 className="font-display text-hb-h3 text-hb-text">
            {interview.title || 'General round'}
          </h3>
          <p className="mt-0.5 text-hb-xs text-hb-muted">{typeLabel(interview.interview_type)}</p>
        </div>

        {skills.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {skills.slice(0, 5).map((skill) => (
              <li key={skill}>
                <Badge>{skill}</Badge>
              </li>
            ))}
            {skills.length > 5 && (
              <li className="self-center text-hb-xs text-hb-dim">+{skills.length - 5} more</li>
            )}
          </ul>
        )}

        {interview.meeting_link &&
          !done &&
          (unlocked ? (
            <a
              href={interview.meeting_link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-hb-xs font-semibold text-hb-cyan transition-colors duration-hb hover:text-hb-text"
            >
              <LinkIcon size={13} aria-hidden />
              {interview.meeting_link.replace(/^https?:\/\//, '')}
            </a>
          ) : (
            <p className="inline-flex items-center gap-1.5 rounded-hb-sm bg-hb-surface-2 px-2.5 py-1 text-hb-xs text-hb-muted">
              <Lock size={12} aria-hidden />
              Link locked until the prep kit is done
            </p>
          ))}
      </div>

      <div className="flex shrink-0 flex-col justify-center gap-2.5 p-5 pt-0 md:items-end md:pt-5">
        {live ? (
          unlocked ? (
            <Button fullWidth icon={<Video size={15} />} onClick={onEnterRoom}>
              Enter room
            </Button>
          ) : (
            <Button fullWidth variant="ghost" icon={<Lock size={14} />} onClick={onPrepKit}>
              Prep required
            </Button>
          )
        ) : interview.status === 'scheduled' ? (
          interview.is_confirmed ? (
            <Badge tone="success" dot>
              Confirmed
            </Badge>
          ) : (
            <Button fullWidth icon={<Check size={15} />} onClick={onConfirm}>
              Confirm
            </Button>
          )
        ) : done ? (
          <Button fullWidth variant="ghost" onClick={onScorecard}>
            Scorecard
          </Button>
        ) : null}

        <div className="flex flex-wrap items-center justify-center gap-2 md:justify-end">
          {interview.status === 'scheduled' && <AddToCalendarDropdown interview={interview} />}
          <Button
            size="sm"
            variant="ghost"
            icon={<FileText size={13} />}
            onClick={onViewResume}
            title="Review the candidate's résumé"
          >
            Résumé
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={<Brain size={13} />}
            onClick={onPrepKit}
            title="Open the prep checklist"
          >
            Prep
          </Button>
        </div>
      </div>
    </Card>
  )
}

/* ── Section heading ────────────────────────────────────────────────────── */

function Section({
  label,
  tone,
  children,
}: {
  label: string
  tone: 'success' | 'info' | 'neutral'
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="mb-hb-4 flex items-center gap-3">
        <Badge tone={tone} dot={tone === 'success' ? 'pulse' : true}>
          {label}
        </Badge>
        <span aria-hidden className="h-px flex-1 bg-hb-border" />
      </div>
      <div className="space-y-hb-4">{children}</div>
    </section>
  )
}

/* ── Résumé dialog ──────────────────────────────────────────────────────── */

function ResumeDialog({
  interview,
  candidate,
  loading,
  onClose,
}: {
  interview: Interview | null
  candidate: Candidate | null
  loading: boolean
  onClose: () => void
}) {
  /* A stored résumé needs a freshly signed URL, so it opens in a new tab
     rather than an iframe. A legacy direct URL can be previewed inline. */
  const openResume = async () => {
    if (!candidate) return
    if (candidate.resume_storage_path) {
      try {
        const res = await candidatesApi.getResumeUrl(candidate.id ?? '')
        const data = (res.data as any)?.data ?? res.data
        if (data?.url) window.open(data.url, '_blank', 'noopener,noreferrer')
      } catch {
        window.alert('Could not load the résumé. Please try again.')
      }
      return
    }
    const base = import.meta.env.VITE_API_BASE_URL || window.location.origin
    const url = candidate.resume_url!.startsWith('http')
      ? candidate.resume_url!
      : `${base}${candidate.resume_url}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const hasResume = !!(candidate?.resume_storage_path || candidate?.resume_url)

  return (
    <Dialog
      open={!!interview}
      onClose={onClose}
      size="xl"
      title={`${interview?.candidate_name ?? 'Candidate'} — résumé`}
      description={
        candidate?.current_title
          ? `${candidate.current_title}${
              candidate.years_experience ? ` · ${candidate.years_experience} yrs` : ''
            }`
          : undefined
      }
      footer={
        hasResume ? (
          <Button size="sm" icon={<ExternalLink size={14} />} onClick={openResume}>
            Open in a new tab
          </Button>
        ) : undefined
      }
    >
      <div className="pb-2">
        {loading ? (
          <Skeleton className="h-[60vh] w-full" rounded="md" />
        ) : !hasResume ? (
          <EmptyState
            icon={<FileText />}
            title="No résumé uploaded"
            description="This candidate has not uploaded a résumé yet."
          />
        ) : candidate?.resume_url && !candidate.resume_storage_path ? (
          <iframe
            src={`${
              candidate.resume_url.startsWith('http')
                ? candidate.resume_url
                : `${import.meta.env.VITE_API_BASE_URL || window.location.origin}${candidate.resume_url}`
            }#toolbar=1&navpanes=0`}
            title={`Résumé for ${candidate.full_name}`}
            className="h-[64vh] w-full rounded-hb-sm border border-hb-border"
          />
        ) : (
          <p className="py-10 text-center text-hb-sm text-hb-muted">
            This résumé is stored securely. Open it in a new tab to view it.
          </p>
        )}
      </div>
    </Dialog>
  )
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function MyInterviewsPage() {
  const navigate = useNavigate()
  const [resumeInterview, setResumeInterview] = useState<Interview | null>(null)

  const { data: interviews, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-interviews'],
    queryFn: () => interviewsApi.list().then((r) => r.data),
  })

  const { data: resumeCandidate, isLoading: resumeLoading } = useQuery({
    queryKey: ['candidate', resumeInterview?.candidate_id],
    queryFn: () => candidatesApi.get(resumeInterview!.candidate_id).then((r) => r.data),
    enabled: !!resumeInterview,
  })

  const all = interviews ?? []
  const liveNow = all.filter(isLiveNow)
  const upcomingToday = all
    .filter((i) => isToday(i.scheduled_at) && i.status === 'scheduled' && !isLiveNow(i))
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
  const completedToday = all
    .filter((i) => isToday(i.scheduled_at) && (i.status === 'completed' || i.status === 'no_show'))
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())

  const firstLive = liveNow[0]
  const nothingToday = !liveNow.length && !upcomingToday.length && !completedToday.length

  const confirm = async (id: string) => {
    try {
      await interviewsApi.confirm(id)
      refetch()
    } catch (err) {
      console.error('Failed to confirm interview', err)
    }
  }

  const handlers = (i: Interview) => ({
    onEnterRoom: () => navigate(`/hiring/interviewer/live-room/${i.id}`),
    onViewResume: () => setResumeInterview(i),
    onPrepKit: () => navigate(`/hiring/interviewer/prep-kit/${i.id}`),
    onScorecard: () => navigate(`/hiring/interviewer/scorecard/${i.id}`),
    onConfirm: () => confirm(i.id),
  })

  /** Each section groups by candidate, so consecutive rounds read as one block. */
  const renderGroups = (list: Interview[], live: boolean) =>
    groupInterviewsByCandidate(list).map((group) => (
      <Card key={group.candidate_id} padding="default">
        <div className="mb-hb-3 flex items-center gap-2.5">
          <Avatar name={group.candidate_name} size="sm" />
          <span className="text-hb-sm font-semibold text-hb-text">{group.candidate_name}</span>
          <span className="text-hb-xs text-hb-muted">
            {group.interviews.length} round{group.interviews.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="space-y-hb-3">
          {group.interviews.map((i) => (
            <InterviewCard key={i.id} interview={i} live={live} {...handlers(i)} />
          ))}
        </div>
      </Card>
    ))

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Schedule"
        title="My interview queue"
        description="Your assigned interviews for today — confirm them, review the candidate, or jump into the live room."
        actions={
          firstLive ? (
            <Button
              icon={<Video size={16} />}
              to={`/hiring/interviewer/live-room/${firstLive.id}`}
            >
              Enter live room
            </Button>
          ) : (
            <Button variant="ghost" disabled title="Nothing is live right now">
              Enter live room
            </Button>
          )
        }
      />

      {isLoading ? (
        <div className="space-y-hb-4">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-32 w-full" rounded="md" />
          ))}
        </div>
      ) : isError ? (
        <div
          role="alert"
          className="rounded-hb-md border border-hb-error/25 bg-hb-error/8 p-4 text-hb-sm text-hb-error"
        >
          Could not load your interviews. Please refresh.
        </div>
      ) : nothingToday ? (
        <Card padding="none">
          <EmptyState
            icon={<Sparkles />}
            title="Nothing assigned today"
            description="Enjoy your day — you will be notified when a new interview is scheduled."
            size="page"
          />
        </Card>
      ) : (
        <div className="space-y-hb-8">
          {liveNow.length > 0 && (
            <Section label="Live now" tone="success">
              {renderGroups(liveNow, true)}
            </Section>
          )}
          {upcomingToday.length > 0 && (
            <Section label="Upcoming today" tone="info">
              {renderGroups(upcomingToday, false)}
            </Section>
          )}
          {completedToday.length > 0 && (
            <Section label="Completed" tone="neutral">
              {renderGroups(completedToday, false)}
            </Section>
          )}
        </div>
      )}

      <ResumeDialog
        interview={resumeInterview}
        candidate={resumeCandidate ?? null}
        loading={resumeLoading}
        onClose={() => setResumeInterview(null)}
      />
    </div>
  )
}
