import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ClipboardList, Lock, Sparkles, Star } from 'lucide-react'

import { scorecardsApi } from '@/api/scorecards'
import { formatDate } from '@/utils/formatters'
import type { Candidate, Scorecard } from '@/types'
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  Meter,
  Skeleton,
  Tabs,
  statusDef,
  type BadgeTone,
} from '@/components/hb'

/**
 * Interview feedback, grouped by round.
 *
 * Extracted from `CandidateProfileView` in phase 6. The recommendation map here
 * is the only one left: `REC_CFG` previously assigned five hardcoded hexes, and
 * the round tabs were `<div onClick>` with no roles, so none of this was
 * reachable by keyboard.
 */

/** Stages at or past the technical round, where feedback can exist. */
const INTERVIEW_STAGES = new Set([
  'technical_round', 'technical_round_selected', 'technical_round_rejected', 'technical_round_back_out',
  'practical_round', 'practical_round_selected', 'practical_round_rejected', 'practical_round_back_out',
  'techno_functional_round', 'techno_functional_selected', 'techno_functional_rejected',
  'management_round', 'management_round_selected', 'management_round_rejected',
  'hr_round', 'hr_round_selected', 'hr_round_rejected',
  'interview', 'interviewed',
  'offered', 'offer', 'hired', 'hired_joined', 'rejected',
])

const RECOMMENDATION: Record<string, { label: string; tone: BadgeTone }> = {
  strong_yes: { label: 'Strong hire', tone: 'success' },
  yes: { label: 'Hire', tone: 'success' },
  maybe: { label: 'Maybe', tone: 'warning' },
  no: { label: 'No hire', tone: 'error' },
  strong_no: { label: 'Strong no', tone: 'error' },
}

const REC_ORDER = ['strong_yes', 'yes', 'maybe', 'no', 'strong_no']

/** 1–5 rating → the same three bands the match score uses. */
function ratingTone(outOfFive: number): BadgeTone {
  if (outOfFive >= 4) return 'success'
  if (outOfFive >= 3) return 'warning'
  return 'error'
}

function ratingLabel(avg: number) {
  if (avg < 2.5) return 'Below average'
  if (avg < 3.5) return 'Average'
  if (avg < 4.5) return 'Good'
  return 'Excellent'
}

function StarRow({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={13}
          aria-hidden
          className={s <= value ? 'fill-hb-warning text-hb-warning' : 'text-hb-dim opacity-40'}
        />
      ))}
    </span>
  )
}

function AiSummary({ interviewId }: { interviewId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['ai-summary', interviewId],
    queryFn: () => scorecardsApi.getAiSummary(interviewId).then((r: any) => r.data),
    staleTime: 5 * 60_000,
    enabled: !!interviewId && interviewId !== 'unknown',
  })

  const summary: string | null = data?.ai_summary ?? null

  return (
    <div className="rounded-hb-sm border border-hb-border-strong bg-hb-grad-soft p-4">
      <p className="mb-2.5 inline-flex items-center gap-1.5 font-mono text-hb-label uppercase text-hb-cyan">
        <Sparkles size={12} aria-hidden />
        AI summary
      </p>
      {isLoading ? (
        <Skeleton className="h-12 w-full" />
      ) : summary ? (
        <p className="text-hb-sm italic leading-relaxed text-hb-muted">“{summary}”</p>
      ) : (
        <p className="text-hb-xs italic text-hb-dim">
          No summary yet — it is generated once at least one scorecard is submitted.
        </p>
      )}
    </div>
  )
}

function ScorecardDetail({ sc }: { sc: any }) {
  const [open, setOpen] = useState(false)
  const rec = RECOMMENDATION[sc.recommendation]
  const criteria = sc.criteria_scores ?? []

  return (
    <div className="overflow-hidden rounded-hb-sm border border-hb-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center justify-between gap-3 bg-hb-surface-2 px-4 py-3 text-left transition-colors duration-hb hover:bg-hb-surface focus-visible:outline-none focus-visible:shadow-hb-ring"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <Avatar name={sc.submitted_by_name ?? 'Interviewer'} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-hb-sm font-semibold text-hb-text">
              {sc.submitted_by_name ?? 'Interviewer'}
            </span>
            <span className="block text-hb-xs text-hb-muted">{formatDate(sc.submitted_at)}</span>
          </span>
        </span>

        <span className="flex items-center gap-2.5">
          <StarRow value={sc.overall_rating} />
          <Badge tone={ratingTone(sc.overall_rating)}>{sc.overall_rating}/5</Badge>
          {rec && <Badge tone={rec.tone}>{rec.label}</Badge>}
          <ChevronDown
            size={14}
            aria-hidden
            className={`text-hb-dim transition-transform duration-hb ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {open && (
        <div className="space-y-hb-4 border-t border-hb-border p-4">
          {criteria.length > 0 && (
            <div>
              <p className="mb-2.5 font-mono text-hb-label uppercase text-hb-dim">
                Evaluation criteria
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {criteria.map((c: any) => (
                  <div key={c.criterion}>
                    <Meter
                      label={c.criterion}
                      value={c.score}
                      max={5}
                      size="xs"
                      valueLabel={`${c.score}/5`}
                    />
                    {c.notes && <p className="mt-1 text-hb-xs italic text-hb-dim">{c.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {sc.strengths && <Note label="Strengths" body={sc.strengths} />}
          {sc.weaknesses && <Note label="Areas to improve" body={sc.weaknesses} />}
          {sc.summary && <Note label="Summary" body={sc.summary} italic />}
        </div>
      )}
    </div>
  )
}

function Note({ label, body, italic }: { label: string; body: string; italic?: boolean }) {
  return (
    <div>
      <p className="mb-1 font-mono text-hb-label uppercase text-hb-dim">{label}</p>
      <p className={`text-hb-sm leading-relaxed text-hb-muted ${italic ? 'italic' : ''}`}>{body}</p>
    </div>
  )
}

/** One interview round: AI summary plus a panel per interviewer. */
function RoundGroup({ group }: { group: { interview_id: string; title: string; cards: any[] } }) {
  const hasAi = group.interview_id && !group.interview_id.startsWith('unknown_')
  const [active, setActive] = useState<string>(hasAi ? 'ai' : group.cards[0]?.id)

  if (!group.cards?.length) return null

  const avg = group.cards.reduce((s, c) => s + c.overall_rating, 0) / group.cards.length
  const items = [
    ...(hasAi ? [{ value: 'ai', label: 'AI summary' }] : []),
    ...group.cards.map((sc: any, i: number) => ({
      value: sc.id as string,
      label: sc.submitted_by_name?.split(' ')[0] ?? `Interviewer ${i + 1}`,
    })),
  ]

  const activeCard = group.cards.find((sc: any) => sc.id === active)

  return (
    <Card padding="none">
      <div className="flex flex-wrap items-center gap-3 border-b border-hb-border px-4 py-3">
        <h3 className="font-display text-hb-h3 text-hb-text">{group.title}</h3>
        <Badge tone={ratingTone(avg)}>Avg {avg.toFixed(1)}</Badge>
      </div>

      <Tabs
        items={items}
        value={active}
        onChange={setActive}
        aria-label={`Feedback for ${group.title}`}
        className="px-2"
      />

      <div className="p-4">
        {active === 'ai' && hasAi ? (
          <AiSummary interviewId={group.interview_id} />
        ) : activeCard ? (
          <ScorecardDetail sc={activeCard} />
        ) : null}
      </div>
    </Card>
  )
}

export function FeedbackTab({ candidate }: { candidate: Candidate }) {
  const stage = candidate.pipeline_stage || 'applied'
  const reachedInterview = INTERVIEW_STAGES.has(stage)

  const { data: scorecards = [], isLoading } = useQuery({
    queryKey: ['scorecards', 'candidate', candidate.id],
    queryFn: () => scorecardsApi.getForCandidate(candidate.id).then((r: any) => r.data as Scorecard[]),
    enabled: reachedInterview,
    staleTime: 30_000,
  })

  if (!reachedInterview) {
    return (
      <EmptyState
        icon={<Lock />}
        title="Feedback not available yet"
        description={`${candidate.full_name} is at "${statusDef(stage).label}". Interview feedback unlocks from the technical round onwards — move them forward from the row actions.`}
      />
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-hb-4">
        <Skeleton className="h-28 w-full" rounded="md" />
        <Skeleton className="h-28 w-full" rounded="md" />
      </div>
    )
  }

  if (!scorecards.length) {
    return (
      <EmptyState
        icon={<ClipboardList />}
        title="No feedback submitted yet"
        description="Interviewers submit feedback from the schedule page once an interview is complete."
      />
    )
  }

  const avg = scorecards.reduce((s, sc: any) => s + sc.overall_rating, 0) / scorecards.length

  /* One group per interview. Scorecards with no interview id get their own
     bucket rather than being merged into a misleading "round". */
  const groups: Record<string, { interview_id: string; title: string; cards: any[] }> = {}
  scorecards.forEach((sc: any, i: number) => {
    const key = sc.interview_id || `unknown_${i}`
    groups[key] ??= { interview_id: key, title: sc.interview_title || 'Overall feedback', cards: [] }
    groups[key].cards.push(sc)
  })

  return (
    <div className="space-y-hb-5">
      <div className="flex flex-wrap items-center gap-2">
        {REC_ORDER.map((r) => {
          const count = scorecards.filter((sc: any) => sc.recommendation === r).length
          if (!count) return null
          return (
            <Badge key={r} tone={RECOMMENDATION[r].tone}>
              {count} × {RECOMMENDATION[r].label}
            </Badge>
          )
        })}
        <div className="flex-1" />
        <Badge tone="info">{avg.toFixed(1)} / 5</Badge>
        <Badge tone={ratingTone(avg)} dot>
          {ratingLabel(avg)}
        </Badge>
      </div>

      {Object.values(groups).map((group) => (
        <RoundGroup key={group.interview_id} group={group} />
      ))}
    </div>
  )
}
