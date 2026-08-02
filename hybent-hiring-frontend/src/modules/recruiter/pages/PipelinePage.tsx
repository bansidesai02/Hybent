import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Mail, Mic, Star, Users } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { candidatesApi } from '@/api/candidates'
import { scorecardsApi } from '@/api/scorecards'
import { preScreeningApi } from '@/api/preScreening'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'
import { formatDate, timeAgo } from '@/utils/formatters'
import type { KanbanCard, Scorecard } from '@/types'
import {
  Avatar,
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  PageHeader,
  ScoreRing,
  Skeleton,
  Toolbar,
  ToolbarSearch,
  type BadgeTone,
} from '@/components/hb'

/**
 * The pipeline board.
 *
 * Rebuilt on the design system in phase 6. The "Pre-Screen" button used to
 * navigate to `/recruiter/pre-screening/…`, which is not a route — the real one
 * is under `/hiring` — so the invite was created and then the recruiter was
 * bounced to the marketing homepage with no way back to it.
 *
 * A 56-line commented-out "Saved views" block and its three handlers were
 * deleted rather than migrated. They had been dead in the file for long enough
 * that `savedViews` was still being read out of localStorage on every render to
 * populate a list nothing rendered.
 */

function recommendationTone(rec: string): BadgeTone {
  if (rec.includes('yes')) return 'success'
  if (rec === 'maybe') return 'warning'
  return 'error'
}

function StarRow({ value, size = 12 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5`}>
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

function ScorecardItem({ scorecard }: { scorecard: Scorecard }) {
  const criteria = scorecard.criteria_scores

  return (
    <Card padding="compact" className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={scorecard.submitted_by_name ?? 'Reviewer'} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-hb-sm font-semibold text-hb-text">
              {scorecard.submitted_by_name ?? 'Anonymous'}
            </p>
            <p className="font-mono text-hb-micro text-hb-dim">
              {formatDate(scorecard.submitted_at)}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <StarRow value={scorecard.overall_rating} size={13} />
          <Badge tone={recommendationTone(scorecard.recommendation)}>
            {scorecard.recommendation.replace(/_/g, ' ')}
          </Badge>
        </div>
      </div>

      {scorecard.summary && (
        <p className="border-l-2 border-hb-border-strong pl-3 text-hb-sm italic leading-relaxed text-hb-muted">
          “{scorecard.summary}”
        </p>
      )}

      {Array.isArray(criteria) && criteria.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {criteria.map((s, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-2 rounded-hb-sm border border-hb-border bg-hb-surface-2 px-2.5 py-1.5"
            >
              <span className="truncate font-mono text-hb-micro uppercase text-hb-dim">
                {s.criterion}
              </span>
              <StarRow value={s.score} size={10} />
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function CardDetailDialog({ card, onClose }: { card: KanbanCard; onClose: () => void }) {
  const { basePath } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  const { data: scorecards, isLoading } = useQuery({
    queryKey: ['scorecards', 'candidate', card.id],
    queryFn: () =>
      scorecardsApi
        .getForApplication(card.id)
        .then((r) => r.data)
        .catch(() => []),
  })

  const requestPreScreening = async () => {
    setBusy(true)
    try {
      const res = await preScreeningApi.createSession({ candidate_id: card.id })
      toast.success(`Pre-screening invite sent to ${card.candidate_email}`)
      onClose()
      navigate(`${basePath}/pre-screening/${res.data.id}`)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to create pre-screening session')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onClose={onClose} size="lg" title="Candidate details">
      <div className="space-y-hb-5 pb-2">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <Avatar name={card.candidate_name} src={card.avatar_url} size="xl" />
            <div className="min-w-0">
              <h3 className="font-display text-hb-h2 text-hb-text">{card.candidate_name}</h3>
              {card.current_title && (
                <p className="mt-0.5 text-hb-sm text-hb-muted">{card.current_title}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-hb-xs text-hb-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Mail size={13} aria-hidden />
                  {card.candidate_email}
                </span>
                <span aria-hidden className="text-hb-dim">
                  ·
                </span>
                <span>Applied {formatDate(card.applied_at)}</span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-center gap-2.5">
            <ScoreRing score={card.match_score} size={64} strokeWidth={5} />
            <span className="font-mono text-hb-label uppercase text-hb-dim">AI match</span>
            <Button
              variant="ghost"
              size="sm"
              icon={<Mic size={13} />}
              loading={busy}
              onClick={requestPreScreening}
            >
              Pre-screen
            </Button>
          </div>
        </div>

        <div className="grid gap-hb-3 sm:grid-cols-2">
          <div className="rounded-hb-sm border border-hb-border bg-hb-surface-2 px-3.5 py-3">
            <p className="font-mono text-hb-label uppercase text-hb-dim">Status</p>
            <p className="mt-1.5 text-hb-sm font-semibold text-hb-text">Active</p>
          </div>
          <div className="rounded-hb-sm border border-hb-border bg-hb-surface-2 px-3.5 py-3">
            <p className="font-mono text-hb-label uppercase text-hb-dim">Last activity</p>
            <p className="mt-1.5 text-hb-sm font-semibold text-hb-text">
              {timeAgo(card.stage_changed_at || card.applied_at)}
            </p>
          </div>
        </div>

        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h4 className="font-display text-hb-h3 text-hb-text">Interview evaluations</h4>
            <Badge tone="info">{scorecards?.length ?? 0} submitted</Badge>
          </div>

          <div className="max-h-[400px] space-y-hb-3 overflow-y-auto pr-1">
            {isLoading ? (
              [1, 2].map((i) => <Skeleton key={i} className="h-36 w-full" rounded="md" />)
            ) : !scorecards?.length ? (
              <p className="rounded-hb-md border border-dashed border-hb-border-strong py-8 text-center text-hb-sm text-hb-muted">
                No evaluations submitted yet.
              </p>
            ) : (
              scorecards.map((sc: Scorecard) => <ScorecardItem key={sc.id} scorecard={sc} />)
            )}
          </div>
        </section>

        {card.recruiter_notes && (
          <section className="rounded-hb-sm border border-hb-border-strong bg-hb-grad-soft p-4">
            <p className="mb-1.5 font-mono text-hb-label uppercase text-hb-cyan">AI summary</p>
            <p className="text-hb-sm leading-relaxed text-hb-muted">{card.recruiter_notes}</p>
          </section>
        )}
      </div>
    </Dialog>
  )
}

function BoardSkeleton() {
  return (
    <div className="flex gap-hb-4 overflow-x-auto pb-4">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="w-72 shrink-0 space-y-2.5">
          <Skeleton className="h-6 w-24" rounded="full" />
          {Array.from({ length: 3 }, (_, j) => (
            <div key={j} className="space-y-2 rounded-hb-md border border-hb-border bg-hb-surface p-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8" rounded="full" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-2.5 w-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default function PipelinePage() {
  const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null)
  const [search, setSearch] = useState('')

  const { data: pipelineStages, isLoading } = useQuery({
    queryKey: ['candidates_pipeline'],
    queryFn: () => candidatesApi.getPipeline().then((r) => r.data),
  })

  const toCard = useCallback(
    (c: any): KanbanCard => ({
      id: c.id,
      application_id: c.application_id || c.id,
      candidate_name: c.full_name,
      candidate_email: c.email,
      avatar_url: c.avatar_url,
      match_score: c.match_score,
      applied_at: c.created_at,
      stage_changed_at: c.updated_at,
      recruiter_notes: c.summary,
      skills: c.skills || [],
      current_title: c.current_title,
      created_by_name: c.created_by_name,
    }),
    []
  )

  const matches = useCallback(
    (list: KanbanCard[]) => {
      const q = search.trim().toLowerCase()
      if (!q) return list
      return list.filter(
        (c) =>
          c.candidate_name.toLowerCase().includes(q) ||
          c.candidate_email?.toLowerCase().includes(q) ||
          c.current_title?.toLowerCase().includes(q) ||
          c.skills?.some((s: string) => s.toLowerCase().includes(q))
      )
    },
    [search]
  )

  const column = (key: string) => matches((pipelineStages?.[key] ?? []).map(toCard))

  const pipelineData = pipelineStages
    ? {
        stages: {
          applied: column('applied'),
          screening: column('screening'),
          interview: column('interview'),
          interviewed: column('interviewed'),
          offer: column('offer'),
          rejected: column('rejected'),
          inactive: column('inactive'),
        },
      }
    : null

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        eyebrow="Pipeline"
        title="Pipeline"
        description="Drag candidates across stages — Hybent AI updates match probabilities automatically."
      />

      <Toolbar>
        <ToolbarSearch
          value={search}
          onChange={setSearch}
          placeholder="Search name, email, role or skill…"
          aria-label="Search the pipeline"
        />
      </Toolbar>

      <div className="min-h-0 flex-1">
        {isLoading ? (
          <BoardSkeleton />
        ) : pipelineData ? (
          <KanbanBoard data={pipelineData} onCardClick={setSelectedCard} />
        ) : (
          <EmptyState
            icon={<Users />}
            title="Nothing in the pipeline"
            description="Candidates appear here as they move through your recruitment stages."
            size="page"
          />
        )}
      </div>

      {selectedCard && (
        <CardDetailDialog card={selectedCard} onClose={() => setSelectedCard(null)} />
      )}
    </div>
  )
}
