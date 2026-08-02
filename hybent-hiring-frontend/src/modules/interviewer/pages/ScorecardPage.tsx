import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CircleHelp,
  MessageSquare,
  Puzzle,
  Settings,
  Sparkles,
  Star,
  Users,
  X,
} from 'lucide-react'

import { interviewsApi } from '@/api/interviews'
import { scorecardsApi } from '@/api/scorecards'
import { aiApi } from '@/api/ai'
import { formatDate, formatDateTime } from '@/utils/formatters'
import type { Scorecard } from '@/types'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  IconTile,
  Meter,
  PageHeader,
  Skeleton,
  Textarea,
  type BadgeTone,
} from '@/components/hb'

/**
 * The interviewer's scorecard.
 *
 * Rebuilt on the design system in phase 8. The page was unreachable until this
 * phase: it reads `useParams<{ interviewId }>()`, but the route was registered
 * as a bare `scorecard` with no segment, so `interviewId` was always undefined
 * and every query stayed disabled.
 *
 * Also replaced: a local `Toast` component duplicating `react-hot-toast`, and a
 * `REC_OPTIONS` table carrying four hardcoded colour fields per option.
 */

type Recommendation = 'hire' | 'maybe' | 'no_hire'
type CriterionKey = 'technical' | 'communication' | 'culture_fit' | 'problem_solving'

const CRITERIA: Array<{
  key: CriterionKey
  label: string
  icon: React.ReactNode
  description: string
}> = [
  {
    key: 'technical',
    label: 'Technical skills',
    icon: <Settings />,
    description: 'Depth of technical knowledge and the ability to apply it',
  },
  {
    key: 'communication',
    label: 'Communication',
    icon: <MessageSquare />,
    description: 'Clarity, listening and articulation',
  },
  {
    key: 'culture_fit',
    label: 'Culture fit',
    icon: <Users />,
    description: 'Alignment with team values and working style',
  },
  {
    key: 'problem_solving',
    label: 'Problem solving',
    icon: <Puzzle />,
    description: 'Approach to ambiguous problems and critical thinking',
  },
]

/** `mapTo` is the API's enum; the label is what the interviewer reads. */
const RECOMMENDATIONS: Array<{
  value: Recommendation
  label: string
  icon: React.ReactNode
  mapTo: string
  tone: 'success' | 'warning' | 'error'
}> = [
  { value: 'hire', label: 'Hire', icon: <Check size={15} strokeWidth={3} />, mapTo: 'yes', tone: 'success' },
  { value: 'maybe', label: 'Maybe', icon: <CircleHelp size={15} />, mapTo: 'maybe', tone: 'warning' },
  { value: 'no_hire', label: 'No hire', icon: <X size={15} strokeWidth={3} />, mapTo: 'no', tone: 'error' },
]

const REC_SELECTED = {
  success: 'border-hb-success bg-hb-success/10 text-hb-success',
  warning: 'border-hb-warning bg-hb-warning/10 text-hb-warning',
  error: 'border-hb-error bg-hb-error/10 text-hb-error',
} as const

/** The API's recommendation enum, as something readable. */
const REC_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  strong_yes: { label: 'Strong hire', tone: 'success' },
  yes: { label: 'Hire', tone: 'success' },
  maybe: { label: 'Maybe', tone: 'warning' },
  no: { label: 'No hire', tone: 'error' },
  strong_no: { label: 'Strong no', tone: 'error' },
}

/** Minimum words each field needs before the scorecard can be submitted. */
const MIN_WORDS = { notes: 100, strengths: 30, weaknesses: 30 }

const wordCount = (t: string) => {
  const trimmed = t.trim()
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length
}

/* ── Star rating ────────────────────────────────────────────────────────── */

function StarRating({
  value,
  onChange,
  label,
  size = 26,
}: {
  value: number
  onChange?: (v: number) => void
  label: string
  size?: number
}) {
  const readOnly = !onChange

  if (readOnly) {
    return (
      <span className="inline-flex items-center gap-1" aria-label={`${label}: ${value} out of 5`}>
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            size={size}
            aria-hidden
            className={s <= value ? 'fill-hb-warning text-hb-warning' : 'text-hb-dim opacity-35'}
          />
        ))}
      </span>
    )
  }

  return (
    <div role="radiogroup" aria-label={`${label} rating`} className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          aria-label={`${s} out of 5`}
          onClick={() => onChange(s)}
          className="transition-transform duration-hb hover:scale-115 focus-visible:outline-none focus-visible:shadow-hb-ring"
        >
          <Star
            size={size}
            aria-hidden
            className={s <= value ? 'fill-hb-warning text-hb-warning' : 'text-hb-dim opacity-35'}
          />
        </button>
      ))}
      {value > 0 && (
        <span className="ml-1.5 font-mono text-hb-xs tabular-nums text-hb-muted">{value}/5</span>
      )}
    </div>
  )
}

/* ── A submitted scorecard, read-only ───────────────────────────────────── */

function SubmittedCard({ card, own }: { card: Scorecard; own?: boolean }) {
  const rec = REC_BADGE[card.recommendation]
  const criteria = Array.isArray(card.criteria_scores)
    ? card.criteria_scores
    : ((card.criteria_scores as any)?.criteria ?? [])

  return (
    <Card padding="default" className={own ? 'border-hb-blue/40' : undefined}>
      <div className="mb-hb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={card.submitted_by_name ?? 'Reviewer'} size="sm" />
          <div>
            <p className="text-hb-sm font-semibold text-hb-text">
              {own ? 'Your scorecard' : (card.submitted_by_name ?? 'Anonymous')}
            </p>
            <p className="font-mono text-hb-micro text-hb-dim">{formatDate(card.submitted_at)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <StarRating value={card.overall_rating} label="Overall" size={16} />
          {rec && <Badge tone={rec.tone}>{rec.label}</Badge>}
        </div>
      </div>

      <div className="grid gap-hb-5 md:grid-cols-2">
        {criteria.length > 0 && (
          <div className="space-y-hb-3">
            <h3 className="font-mono text-hb-label uppercase text-hb-dim">Competencies</h3>
            {criteria.map((c: any) => (
              <Meter
                key={c.criterion}
                label={c.criterion}
                value={c.score}
                max={5}
                size="xs"
                valueLabel={`${c.score}/5`}
              />
            ))}
          </div>
        )}

        <div className="space-y-hb-4">
          <div>
            <h3 className="mb-1.5 font-mono text-hb-label uppercase text-hb-dim">Summary</h3>
            <p className="text-hb-sm leading-relaxed text-hb-muted">
              {card.summary || 'No summary provided.'}
            </p>
          </div>
          <div className="grid gap-hb-3 sm:grid-cols-2">
            <div>
              <h3 className="mb-1 font-mono text-hb-label uppercase text-hb-success">Strengths</h3>
              <p className="text-hb-xs leading-relaxed text-hb-muted">
                {card.strengths || 'None listed'}
              </p>
            </div>
            <div>
              <h3 className="mb-1 font-mono text-hb-label uppercase text-hb-error">Concerns</h3>
              <p className="text-hb-xs leading-relaxed text-hb-muted">
                {card.weaknesses || 'None listed'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function ScorecardPage() {
  const { interviewId } = useParams<{ interviewId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [criteria, setCriteria] = useState<Record<CriterionKey, number>>({
    technical: 0,
    communication: 0,
    culture_fit: 0,
    problem_solving: 0,
  })
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null)
  const [notes, setNotes] = useState('')
  const [strengths, setStrengths] = useState('')
  const [weaknesses, setWeaknesses] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  /* The live room writes raw notes to localStorage. On first mount they are run
     through the AI summariser once — the ref guards against StrictMode's double
     invoke firing a second paid call. */
  const summarised = useRef(false)
  useEffect(() => {
    const raw = localStorage.getItem(`hybent_hiring_notes_${interviewId}`)
    if (!raw || summarised.current) return

    summarised.current = true
    setNotes('Summarising your live notes…')
    setAiLoading(true)

    aiApi
      .evaluateNotes(raw)
      .then((res) => {
        const summary = res.data?.professional_description
        if (summary) {
          setNotes(summary)
          toast.success('Your live notes were summarised')
        } else {
          setNotes(raw)
          toast.error('Could not summarise — using your raw notes')
        }
      })
      .catch(() => {
        setNotes(raw)
        toast.error('Could not summarise — using your raw notes')
      })
      .finally(() => setAiLoading(false))
  }, [interviewId])

  const counts = {
    notes: wordCount(notes),
    strengths: wordCount(strengths),
    weaknesses: wordCount(weaknesses),
  }

  const scores = Object.values(criteria)
  const allRated = scores.every((v) => v > 0)
  const average = scores.reduce((a, b) => a + b, 0) / scores.length
  const overallRating = allRated ? Math.round(average) : 0

  const { data: interview, isLoading: intLoading } = useQuery({
    queryKey: ['interview', interviewId],
    queryFn: () => interviewsApi.get(interviewId!).then((r) => r.data),
    enabled: !!interviewId,
  })

  const { data: myScorecard, isLoading: myLoading } = useQuery({
    queryKey: ['my_scorecard', interviewId],
    queryFn: () => scorecardsApi.getMyScorecardForInterview(interviewId!).then((r) => r.data),
    enabled: !!interviewId,
  })

  const { data: scorecards, isLoading: othersLoading } = useQuery({
    queryKey: ['scorecards', 'application', interview?.application_id],
    queryFn: () => scorecardsApi.getForApplication(interview!.application_id || '').then((r) => r.data),
    enabled: !!interview?.application_id,
  })

  const mutation = useMutation({
    mutationFn: () => {
      const rec = RECOMMENDATIONS.find((r) => r.value === recommendation)!
      return scorecardsApi.submit({
        interview_id: interviewId!,
        application_id: interview!.application_id || undefined,
        overall_rating: overallRating,
        recommendation: rec.mapTo,
        criteria_scores: CRITERIA.map((c) => ({ criterion: c.label, score: criteria[c.key] })),
        strengths: strengths || undefined,
        weaknesses: weaknesses || undefined,
        summary: notes || undefined,
      })
    },
    onSuccess: async () => {
      try {
        /* Submitting a scorecard is what marks the interview done — there is no
           separate "complete" action anywhere in the product. */
        await interviewsApi.update(interviewId!, { status: 'completed', feedback: 'submitted' })
        queryClient.invalidateQueries({ queryKey: ['my-interviews'] })
        queryClient.invalidateQueries({ queryKey: ['interview', interviewId] })
        queryClient.invalidateQueries({
          queryKey: ['scorecards', 'application', interview?.application_id],
        })
        queryClient.invalidateQueries({ queryKey: ['my_scorecard', interviewId] })
        queryClient.invalidateQueries({ queryKey: ['candidates_pipeline'] })
        queryClient.invalidateQueries({ queryKey: ['candidates'] })
        toast.success('Scorecard submitted — interview marked complete')
      } catch (err) {
        console.error('Failed to mark the interview completed', err)
        toast.error('Scorecard saved, but the interview status did not update')
      }

      setCriteria({ technical: 0, communication: 0, culture_fit: 0, problem_solving: 0 })
      setRecommendation(null)
      setNotes('')
      setStrengths('')
      setWeaknesses('')
      localStorage.removeItem(`hybent_hiring_notes_${interviewId}`)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg ?? 'Failed to submit the scorecard')
    },
  })

  const canSubmit =
    allRated &&
    recommendation !== null &&
    counts.notes >= MIN_WORDS.notes &&
    counts.strengths >= MIN_WORDS.strengths &&
    counts.weaknesses >= MIN_WORDS.weaknesses &&
    !mutation.isPending

  if (intLoading || myLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-hb-5">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-28 w-full" rounded="md" />
        <Skeleton className="h-96 w-full" rounded="md" />
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
          action={{
            label: 'Back to my interviews',
            onClick: () => navigate('/hiring/interviewer/interviews'),
          }}
          size="page"
        />
      </Card>
    )
  }

  const submitted = mutation.isSuccess || !!myScorecard
  const mine = myScorecard || mutation.data?.data
  const others = (scorecards ?? []).filter((sc) => sc.id !== mine?.id)

  /** Word-count hint that turns success once the minimum is met. */
  const counter = (n: number, min: number) => (
    <span className={n >= min ? 'text-hb-success' : 'text-hb-dim'}>
      {n} / {min} words
    </span>
  )

  return (
    <div className="mx-auto max-w-4xl pb-hb-10">
      <Button
        variant="quiet"
        size="sm"
        icon={<ArrowLeft size={15} />}
        to="/hiring/interviewer/interviews"
        className="mb-3"
      >
        My interviews
      </Button>

      <PageHeader
        eyebrow="Scorecard"
        title="Rate this interview"
        description={`${interview.title} — score the candidate across the four competencies and record your recommendation.`}
      />

      <div className="space-y-hb-5">
        <Card padding="default" className="flex items-center gap-3.5">
          <IconTile>
            <CalendarDays />
          </IconTile>
          <div className="min-w-0">
            <p className="text-hb-body font-semibold text-hb-text">{interview.title}</p>
            <p className="mt-0.5 text-hb-xs capitalize text-hb-muted">
              {formatDateTime(interview.scheduled_at)} · {interview.duration_minutes} min ·{' '}
              {interview.interview_type.replace(/_/g, ' ')}
            </p>
          </div>
        </Card>

        {mine ? (
          <SubmittedCard card={mine} own />
        ) : (
          <div className="grid gap-hb-5 md:grid-cols-2">
            {/* ── Ratings and recommendation ── */}
            <div className="space-y-hb-4">
              <Card padding="default">
                <CardHeader
                  title="Competency ratings"
                  action={allRated ? <Badge tone="info">Avg {average.toFixed(1)}</Badge> : undefined}
                />
                <ul>
                  {CRITERIA.map((c) => (
                    <li
                      key={c.key}
                      className="flex flex-wrap items-center gap-hb-3 border-b border-hb-border py-3.5 last:border-0"
                    >
                      <IconTile size="sm">{c.icon}</IconTile>
                      <div className="min-w-0 flex-1">
                        <p className="text-hb-sm font-semibold text-hb-text">{c.label}</p>
                        <p className="text-hb-xs text-hb-muted">{c.description}</p>
                      </div>
                      <StarRating
                        label={c.label}
                        value={criteria[c.key]}
                        onChange={(v) => setCriteria((prev) => ({ ...prev, [c.key]: v }))}
                      />
                    </li>
                  ))}
                </ul>
              </Card>

              <Card padding="default">
                <CardHeader title="Your recommendation" />
                <div role="radiogroup" aria-label="Recommendation" className="flex gap-2">
                  {RECOMMENDATIONS.map((opt) => {
                    const on = recommendation === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setRecommendation(opt.value)}
                        className={
                          'flex flex-1 items-center justify-center gap-2 rounded-hb-sm border-2 py-2.5 text-hb-sm font-semibold transition-colors duration-hb focus-visible:outline-none focus-visible:shadow-hb-ring ' +
                          (on
                            ? REC_SELECTED[opt.tone]
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

            {/* ── Written feedback ── */}
            <Card padding="default">
              <CardHeader
                title="Written feedback"
                subtitle="All three are required, with a minimum length — a one-line scorecard helps nobody decide."
              />

              <div className="space-y-hb-4">
                <Textarea
                  label="Overall summary"
                  required
                  rows={5}
                  value={notes}
                  disabled={aiLoading}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Your overall observations and impressions…"
                  description={
                    aiLoading ? 'Summarising your live notes…' : counter(counts.notes, MIN_WORDS.notes)
                  }
                />

                <Textarea
                  label="Strengths"
                  required
                  rows={3}
                  value={strengths}
                  onChange={(e) => setStrengths(e.target.value)}
                  placeholder="What did the candidate do well? Key positive signals…"
                  description={counter(counts.strengths, MIN_WORDS.strengths)}
                />

                <Textarea
                  label="Areas of concern"
                  required
                  rows={3}
                  value={weaknesses}
                  onChange={(e) => setWeaknesses(e.target.value)}
                  placeholder="What gaps or red flags did you notice?…"
                  description={counter(counts.weaknesses, MIN_WORDS.weaknesses)}
                />
              </div>

              <div className="mt-hb-5 flex gap-2">
                <Button
                  fullWidth
                  icon={<Sparkles size={15} />}
                  disabled={!canSubmit}
                  loading={mutation.isPending}
                  onClick={() => mutation.mutate()}
                >
                  Submit scorecard
                </Button>
                <Button variant="ghost" to="/hiring/interviewer/interviews">
                  Cancel
                </Button>
              </div>

              {!canSubmit && !submitted && !mutation.isPending && (
                <p className="mt-hb-3 text-center text-hb-xs text-hb-muted">
                  Rate all four competencies, pick a recommendation, and meet the word minimums
                  above.
                </p>
              )}
            </Card>
          </div>
        )}

        {!othersLoading && others.length > 0 && (
          <section>
            <h2 className="mb-hb-3 font-display text-hb-h3 text-hb-text">
              Other scorecards ({others.length})
            </h2>
            <div className="space-y-hb-3">
              {others.map((sc) => (
                <SubmittedCard key={sc.id} card={sc} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
