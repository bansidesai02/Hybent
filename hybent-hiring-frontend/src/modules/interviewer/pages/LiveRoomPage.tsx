import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  BarChart2,
  Check,
  ChevronLeft,
  CircleHelp,
  ClipboardList,
  FileText,
  Lock,
  MessageSquare,
  Pause,
  Play,
  Puzzle,
  Settings,
  Square,
  Target,
  Users,
  Video,
  X,
} from 'lucide-react'

import { interviewsApi } from '@/api/interviews'
import { applicationsApi } from '@/api/applications'
import { formatDateTime } from '@/utils/formatters'
import { useInterviewStore } from '@/store/interviewStore'
import { useAuthStore } from '@/store/authStore'
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  IconTile,
  Meter,
  Skeleton,
  Textarea,
} from '@/components/hb'

/**
 * The live interview room.
 *
 * Rebuilt on the design system in phase 8. Three navigation targets here were
 * missing the `/hiring` prefix — End interview, Full scorecard, and the
 * prep-required fallback on the meeting link — so the two ways out of this page
 * both dropped the interviewer on the marketing homepage mid-interview.
 *
 * The page also shipped its own `Toast`: a `position:fixed` violet card with a
 * 2.8s timer, alongside `react-hot-toast` everywhere else in the product.
 *
 * Note on state: ratings and the verdict live in component state and are never
 * submitted — this page is a scratchpad, and the scorecard is where an
 * evaluation is actually recorded. Only the summary survives a refresh, via the
 * localStorage key the original used.
 */

type Verdict = 'hire' | 'maybe' | 'no_hire' | null

const CRITERIA = [
  { key: 'technical', label: 'Technical', icon: <Settings /> },
  { key: 'communication', label: 'Communication', icon: <MessageSquare /> },
  { key: 'culture_fit', label: 'Culture fit', icon: <Users /> },
  { key: 'problem_solving', label: 'Problem solving', icon: <Puzzle /> },
] as const

type CriterionKey = (typeof CRITERIA)[number]['key']

const VERDICTS = [
  { value: 'hire' as const, label: 'Hire', icon: <Check size={14} strokeWidth={3} />, tone: 'success' as const },
  { value: 'maybe' as const, label: 'Maybe', icon: <CircleHelp size={14} />, tone: 'warning' as const },
  { value: 'no_hire' as const, label: 'No hire', icon: <X size={14} strokeWidth={3} />, tone: 'error' as const },
]

const VERDICT_CLASS = {
  success: 'border-hb-success bg-hb-success/10 text-hb-success',
  warning: 'border-hb-warning bg-hb-warning/10 text-hb-warning',
  error: 'border-hb-error bg-hb-error/10 text-hb-error',
} as const

/** Interactive 1–5 rating. A radio group, so arrow keys work and it is announced. */
function StarRating({
  value,
  onChange,
  label,
}: {
  value: number
  onChange: (v: number) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={`${label} rating`} className="flex justify-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} out of 5`}
          onClick={() => onChange(star)}
          className={
            'text-hb-h3 leading-none transition-transform duration-hb hover:scale-125 focus-visible:outline-none focus-visible:shadow-hb-ring ' +
            (star <= value ? 'text-hb-warning' : 'text-hb-dim opacity-40')
          }
        >
          ★
        </button>
      ))}
    </div>
  )
}

const fmtClock = (secs: number) =>
  `${Math.floor(secs / 60)
    .toString()
    .padStart(2, '0')}:${(secs % 60).toString().padStart(2, '0')}`

/** Questions are seeded from the candidate's own skills where we have them. */
function buildQuestions(skills: string[]) {
  if (skills.length === 0) {
    return [
      'Walk me through the most technically complex project you have delivered.',
      'How do you approach debugging a hard-to-reproduce production issue?',
      'Describe a system you designed from scratch — what were the key decisions?',
      'Tell me about a technical disagreement with a teammate and how you resolved it.',
      'How do you mentor junior engineers or contribute to team growth?',
      'What does "good engineering culture" mean to you, practically?',
    ]
  }
  return [
    `How did you first get into ${skills[0]}, and what is the most complex thing you have built with it?`,
    'Walk me through a system you designed from scratch — what were the key architectural tradeoffs?',
    'How do you approach debugging a hard-to-reproduce production issue under pressure?',
    `Describe your experience with ${skills[1] ?? 'your secondary stack'} in a team setting.`,
    'Tell me about a time you had a technical disagreement with a teammate. How did it resolve?',
    'How do you balance technical debt against shipping on a tight deadline?',
  ]
}

export default function LiveRoomPage() {
  const { interviewId } = useParams<{ interviewId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const unlocked =
    useInterviewStore((s) => s.isComplete(interviewId!)) || user?.role !== 'interviewer'

  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [ratings, setRatings] = useState<Record<CriterionKey, number>>({
    technical: 0,
    communication: 0,
    culture_fit: 0,
    problem_solving: 0,
  })
  const [summary, setSummary] = useState(
    () => localStorage.getItem(`hybent_hiring_notes_${interviewId}`) || ''
  )
  const [verdict, setVerdict] = useState<Verdict>(null)
  const [asked, setAsked] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (summary) localStorage.setItem(`hybent_hiring_notes_${interviewId}`, summary)
  }, [summary, interviewId])

  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    } else if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [running])

  const { data: interview, isLoading } = useQuery({
    queryKey: ['interview', interviewId],
    queryFn: () => interviewsApi.get(interviewId!).then((r) => r.data),
    enabled: !!interviewId,
  })

  const { data: application } = useQuery({
    queryKey: ['application', interview?.application_id],
    queryFn: () => applicationsApi.get(interview!.application_id!).then((r) => r.data),
    enabled: !!interview?.application_id,
  })

  const candidate = application?.candidate
  const skills = candidate?.skills ?? []
  const questions = buildQuestions(skills)

  const endInterview = useCallback(() => {
    setRunning(false)
    toast.success('Interview ended — opening the scorecard')
    setTimeout(() => navigate(`/hiring/interviewer/scorecard/${interviewId}`), 1200)
  }, [navigate, interviewId])

  const rated = Object.values(ratings).filter(Boolean).length

  if (isLoading) {
    return (
      <div className="space-y-hb-4">
        <Skeleton className="h-20 w-full" rounded="md" />
        <div className="grid gap-hb-4 md:grid-cols-3">
          <Skeleton className="h-[420px] w-full md:col-span-2" rounded="md" />
          <Skeleton className="h-[420px] w-full" rounded="md" />
        </div>
      </div>
    )
  }

  if (!interview) {
    return (
      <Card padding="none">
        <EmptyState
          tone="error"
          title="Interview not found"
          description="This interview may have been cancelled or reassigned."
          action={{ label: 'Back to my interviews', onClick: () => navigate('/hiring/interviewer/interviews') }}
          size="page"
        />
      </Card>
    )
  }

  return (
    <div className="space-y-hb-5 pb-hb-10">
      {/* ── Control bar ── */}
      <Card padding="default" className="flex flex-wrap items-center gap-hb-4">
        <Button
          variant="ghost"
          size="sm"
          to="/hiring/interviewer/interviews"
          aria-label="Back to my interviews"
          className="!px-2.5"
        >
          <ChevronLeft size={18} aria-hidden />
        </Button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={running ? 'error' : 'success'} dot={running ? 'pulse' : true}>
              {running ? 'Recording' : 'Ready'}
            </Badge>
            <h1 className="font-display text-hb-h3 text-hb-text">{interview.title}</h1>
            <span className="text-hb-xs capitalize text-hb-muted">
              {interview.interview_type.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="mt-1 text-hb-xs text-hb-muted">
            {formatDateTime(interview.scheduled_at)} · {interview.duration_minutes} min
            {interview.panelists?.length > 0 &&
              ` · ${interview.panelists.map((p) => p.user_name).filter(Boolean).join(', ')}`}
          </p>
        </div>

        {interview.meeting_link ? (
          unlocked ? (
            <Button
              size="sm"
              variant="ghost"
              icon={<Video size={14} />}
              href={interview.meeting_link}
              target="_blank"
              rel="noreferrer"
              className="max-w-[220px]"
            >
              <span className="truncate">{interview.meeting_link.replace(/^https?:\/\//, '')}</span>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              icon={<Lock size={14} />}
              to={`/hiring/interviewer/prep-kit/${interviewId}`}
            >
              Prep required
            </Button>
          )
        ) : (
          <span className="text-hb-xs text-hb-dim">No meeting link</span>
        )}

        <div className="flex items-center gap-2">
          <span
            role="timer"
            aria-label="Elapsed interview time"
            className={`min-w-[68px] text-center font-mono text-hb-h3 tabular-nums ${
              running ? 'text-hb-text' : 'text-hb-muted'
            }`}
          >
            {fmtClock(elapsed)}
          </span>
          <Button
            size="sm"
            variant="ghost"
            icon={running ? <Pause size={13} /> : <Play size={13} />}
            onClick={() => {
              if (!running && elapsed === 0) toast.success('Interview started')
              setRunning(!running)
            }}
          >
            {running ? 'Pause' : 'Start'}
          </Button>
          <Button size="sm" variant="danger" icon={<Square size={13} />} onClick={endInterview}>
            End
          </Button>
        </div>
      </Card>

      <div className="grid gap-hb-5 md:grid-cols-3">
        {/* ── Left: ratings, notes, verdict ── */}
        <div className="space-y-hb-4 md:col-span-2">
          <div className="grid grid-cols-2 gap-hb-3 sm:grid-cols-4">
            {CRITERIA.map((c) => (
              <Card
                key={c.key}
                padding="compact"
                className={
                  'flex flex-col items-center gap-2 text-center ' +
                  (ratings[c.key] > 0 ? 'border-hb-blue/35 bg-hb-blue/5' : '')
                }
              >
                <IconTile size="sm">{c.icon}</IconTile>
                <p className="text-hb-xs font-semibold text-hb-muted">{c.label}</p>
                <StarRating
                  label={c.label}
                  value={ratings[c.key]}
                  onChange={(v) => setRatings((prev) => ({ ...prev, [c.key]: v }))}
                />
              </Card>
            ))}
          </div>

          <Card padding="default">
            <div className="mb-hb-3 flex items-center justify-between gap-3">
              <h2 className="inline-flex items-center gap-2 font-display text-hb-h3 text-hb-text">
                <FileText size={16} aria-hidden className="text-hb-dim" />
                Running notes
              </h2>
              {running && (
                <Badge tone="error" dot="pulse">
                  Recording
                </Badge>
              )}
            </div>
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={8}
              placeholder="Capture key answers and observations as the interview progresses…"
              description="Saved to this browser as you type. The scorecard is where the evaluation is recorded."
            />
          </Card>

          <Card padding="default">
            <h2 className="mb-hb-3 inline-flex items-center gap-2 font-display text-hb-h3 text-hb-text">
              <Target size={16} aria-hidden className="text-hb-dim" />
              Quick verdict
            </h2>
            <div role="radiogroup" aria-label="Quick verdict" className="flex gap-2">
              {VERDICTS.map((opt) => {
                const on = verdict === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setVerdict(on ? null : opt.value)}
                    className={
                      'flex flex-1 items-center justify-center gap-2 rounded-hb-sm border-2 py-2.5 text-hb-sm font-semibold transition-colors duration-hb focus-visible:outline-none focus-visible:shadow-hb-ring ' +
                      (on
                        ? VERDICT_CLASS[opt.tone]
                        : 'border-hb-border text-hb-muted hover:border-hb-border-strong hover:text-hb-text')
                    }
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </Card>
        </div>

        {/* ── Right: candidate and question checklist ── */}
        <div className="space-y-hb-4">
          <Card padding="default">
            <div className="flex items-center gap-3">
              <Avatar
                name={interview.candidate_name ?? candidate?.full_name ?? 'Candidate'}
                src={candidate?.avatar_url}
                size="md"
              />
              <div className="min-w-0">
                <p className="truncate text-hb-sm font-semibold text-hb-text">
                  {interview.candidate_name ?? candidate?.full_name ?? 'Candidate'}
                </p>
                <p className="truncate text-hb-xs capitalize text-hb-muted">
                  {candidate?.current_title ?? interview.interview_type.replace(/_/g, ' ')}
                </p>
              </div>
            </div>
            {skills.length > 0 && (
              <ul className="mt-hb-3 flex flex-wrap gap-1.5">
                {skills.slice(0, 7).map((skill) => (
                  <li key={skill}>
                    <Badge>{skill}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card padding="default">
            <h2 className="mb-2 inline-flex items-center gap-2 font-mono text-hb-label uppercase text-hb-dim">
              <ClipboardList size={13} aria-hidden />
              Questions
            </h2>
            <Meter
              value={asked.size}
              max={questions.length}
              size="xs"
              valueLabel={`${asked.size}/${questions.length}`}
              label="Asked"
              className="mb-hb-3"
            />
            <ul>
              {questions.map((q, idx) => {
                const done = asked.has(idx)
                return (
                  <li key={q} className="border-b border-hb-border py-2.5 last:border-0">
                    <label className="flex cursor-pointer items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={done}
                        onChange={() =>
                          setAsked((prev) => {
                            const next = new Set(prev)
                            if (next.has(idx)) next.delete(idx)
                            else next.add(idx)
                            return next
                          })
                        }
                        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded-hb-xs border border-hb-border-strong accent-hb-blue focus-visible:outline-none focus-visible:shadow-hb-ring"
                      />
                      <span
                        className={`text-hb-xs leading-relaxed ${
                          done ? 'text-hb-dim line-through' : 'text-hb-muted'
                        }`}
                      >
                        {q}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </Card>

          <Button
            fullWidth
            icon={<BarChart2 size={16} />}
            to={`/hiring/interviewer/scorecard/${interviewId}`}
          >
            Full scorecard
            {rated > 0 && ` (${rated}/4 rated)`}
          </Button>
        </div>
      </div>
    </div>
  )
}
