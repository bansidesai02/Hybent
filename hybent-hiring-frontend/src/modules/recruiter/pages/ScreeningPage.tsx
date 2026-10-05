import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { AlertTriangle, Check, ExternalLink, RefreshCw, X } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { jobsApi } from '@/api/jobs'
import type { Job } from '@/types'
import {
  SCREENING_QUEUE_KEY,
  screeningApi,
  type DecidePayload,
  type DecideResult,
  type ScreeningAction,
  type ScreeningItem,
  type ScreeningRecommendationKind,
} from '@/api/screening'
import {
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  EmptyState,
  FilterChips,
  PageHeader,
  Select,
  Skeleton,
  Tabs,
  type BadgeTone,
} from '@/components/hb'
import { CopilotSparkle } from '@/modules/recruiter/components/Copilot/CopilotSparkle'

/**
 * "To review": what the Candidate Screening Agent suggests for each new
 * candidate (backend: app/services/agents/screening, routers/screening.py).
 *
 * The agent only recommends. Approve runs the same code as the matching
 * button elsewhere in the product (Add to Pipeline, Send pre-screening
 * invite, Talent pool tag, Reject); Change picks a different action;
 * Dismiss leaves the candidate as they are.
 */

const KIND: Record<ScreeningRecommendationKind, { label: string; tone: BadgeTone; approve: string }> = {
  pre_screen: { label: 'Send pre-screening', tone: 'brand', approve: 'Send pre-screening' },
  shortlist: { label: 'Shortlist', tone: 'info', approve: 'Add to pipeline' },
  talent_pool: { label: 'Talent pool', tone: 'neutral', approve: 'Keep in talent pool' },
  reject: { label: 'Reject', tone: 'error', approve: 'Reject' },
  duplicate: { label: 'Possible duplicate', tone: 'warning', approve: 'Mark reviewed' },
}

const ACTION_OPTIONS: Array<{ value: ScreeningAction; label: string }> = [
  { value: 'pre_screen', label: 'Send pre-screening invite' },
  { value: 'shortlist', label: 'Add to pipeline' },
  { value: 'talent_pool', label: 'Keep in talent pool' },
  { value: 'reject', label: 'Reject (no email)' },
]

const DONE_LABEL: Record<string, string> = {
  pre_screen: 'Pre-screening sent',
  shortlist: 'Added to pipeline',
  talent_pool: 'Kept in talent pool',
  reject: 'Rejected',
  none: 'No action',
}

/* Most actionable first: who to invite or look at now, then the rest. */
const ORDER: Record<ScreeningRecommendationKind, number> = {
  pre_screen: 0,
  shortlist: 1,
  reject: 2,
  talent_pool: 3,
  duplicate: 4,
}

function needsJob(action: ScreeningAction) {
  return action === 'pre_screen' || action === 'shortlist'
}

function timeAgo(iso: string | null) {
  if (!iso) return ''
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function summarise(results: DecideResult[]) {
  const failed = results.filter((r) => r.status === 'failed' || r.status === 'missing')
  const done = results.length - failed.length
  if (failed.length === 0) toast.success(done === 1 ? 'Done' : `${done} candidates done`)
  else if (done === 0) toast.error(failed[0].error || "That didn't go through")
  else toast.error(`${done} done, ${failed.length} didn't go through`)
}

/* ── Change dialog ─────────────────────────────────────────────────────────── */

function ChangeDialog({
  item,
  onClose,
  onSubmit,
  pending,
}: {
  item: ScreeningItem
  onClose: () => void
  onSubmit: (action: ScreeningAction, jobId?: string) => void
  pending: boolean
}) {
  const initial: ScreeningAction = item.recommendation === 'duplicate' ? 'talent_pool' : item.recommendation
  const [action, setAction] = useState<ScreeningAction>(initial)
  // Jobs it was scored against, best first. A duplicate stopped before
  // matching, so fall back to the org's open jobs (no score) for those.
  const scored = item.matches.length > 0
  const { data: openJobs, isLoading: jobsLoading } = useQuery({
    queryKey: ['jobs', 'active-for-screening'],
    queryFn: () => jobsApi.list({ status: 'active', limit: 100 }).then((r: any) => r.data.items as Job[]),
    enabled: !scored && needsJob(action),
    staleTime: 60_000,
  })
  const jobs: Array<{ job_id: string; title: string; score: number | null }> = scored
    ? item.matches
    : (openJobs ?? []).map((j) => ({ job_id: j.id, title: j.title, score: null }))
  const [picked, setJobId] = useState(item.job?.id ?? '')
  const jobId = picked || jobs[0]?.job_id || ''
  const missingJob = needsJob(action) && !jobId

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Change for ${item.candidate.full_name}`}
      description="Choose what to do instead. Nothing happens until you confirm."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={pending}
            disabled={missingJob}
            onClick={() => onSubmit(action, needsJob(action) ? jobId : undefined)}
          >
            Confirm
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-hb-4">
        <Select
          label="Action"
          options={ACTION_OPTIONS}
          value={action}
          onChange={(e) => setAction(e.target.value as ScreeningAction)}
        />
        {needsJob(action) &&
          (jobs.length ? (
            <Select
              label="Job"
              options={jobs.map((j) => ({
                value: j.job_id,
                label: j.score != null ? `${j.title} · ${Math.round(j.score)}% match` : j.title,
              }))}
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
            />
          ) : jobsLoading ? (
            <Skeleton className="h-11 w-full" rounded="md" />
          ) : (
            <p className="text-hb-sm text-hb-error">There's no open job to add this candidate to.</p>
          ))}
      </div>
    </Dialog>
  )
}

/* ── One card ──────────────────────────────────────────────────────────────── */

function ReviewCard({
  item,
  selected,
  onSelect,
  onDecide,
  onChange,
  onOpenProfile,
  busy,
}: {
  item: ScreeningItem
  selected: boolean
  onSelect: (on: boolean) => void
  onDecide: (payload: Omit<DecidePayload, 'ids'>) => void
  onChange: () => void
  onOpenProfile: (candidateId: string) => void
  busy: boolean
}) {
  const kind = KIND[item.recommendation]
  const positive = item.recommendation === 'pre_screen' || item.recommendation === 'shortlist'
  const c = item.candidate
  const pending = item.status === 'pending'
  const facts = [
    c.current_title && (c.current_company ? `${c.current_title} at ${c.current_company}` : c.current_title),
    c.years_experience != null && `${c.years_experience} yrs`,
    c.location,
  ].filter(Boolean)

  return (
    <Card padding="default" className={selected ? 'ring-2 ring-hb-blue/40' : undefined}>
      <div className="flex gap-3">
        {pending && (
          <div className="pt-1">
            <Checkbox
              label={<span className="sr-only">Select {c.full_name}</span>}
              checked={selected}
              onChange={(e) => onSelect(e.target.checked)}
            />
          </div>
        )}

        <div className="min-w-0 flex-1">
          {/* Who */}
          <div className="flex items-start gap-3">
            <Avatar name={c.full_name} size="md" />
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onOpenProfile(c.id)}
                className="group inline-flex max-w-full items-center gap-1.5 text-left text-hb-body font-semibold text-hb-text hover:text-hb-blue"
              >
                <span className="truncate">{c.full_name}</span>
                <ExternalLink size={13} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
              </button>
              {facts.length > 0 && <p className="mt-0.5 text-hb-sm text-hb-muted">{facts.join(' · ')}</p>}
              <p className="mt-0.5 text-hb-xs text-hb-dim">
                {c.source ? `From ${c.source.replace(/_/g, ' ')} · ` : ''}
                {timeAgo(item.created_at)}
              </p>
            </div>
          </div>

          {/* Recommendation */}
          <div className="mt-hb-4 rounded-hb-md border border-hb-border bg-hb-surface-2/60 p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-hb-xs font-semibold uppercase tracking-wide text-hb-dim">
                <CopilotSparkle size={13} gradient /> Suggests
              </span>
              <Badge tone={kind.tone}>{kind.label}</Badge>
              {item.job && (
                <span className="text-hb-sm text-hb-text">
                  for <span className="font-semibold">{item.job.title}</span>
                </span>
              )}
              {item.score != null && item.recommendation !== 'duplicate' && (
                <span className="font-mono text-hb-xs text-hb-muted">{Math.round(item.score)}% match</span>
              )}
            </div>

            {item.duplicate_of && (
              <p className="mt-2 text-hb-sm text-hb-text">
                Same email or phone as{' '}
                <button
                  type="button"
                  onClick={() => onOpenProfile(item.duplicate_of!.id)}
                  className="font-semibold text-hb-blue hover:underline"
                >
                  {item.duplicate_of.full_name}
                </button>
                , already in your candidates.
              </p>
            )}

            {item.reasons.length > 0 && !item.duplicate_of && (
              <ul className="mt-2 flex flex-col gap-1">
                {item.reasons.map((r, i) => (
                  <li key={i} className="flex gap-2 text-hb-sm text-hb-text">
                    {/* A tick only where the reason argues *for* the candidate. */}
                    {positive ? (
                      <Check size={14} className="mt-[3px] shrink-0 text-hb-success" aria-hidden />
                    ) : (
                      <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-hb-dim" aria-hidden />
                    )}
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            )}
            {item.risks.length > 0 && (
              <ul className="mt-1.5 flex flex-col gap-1">
                {item.risks.map((r, i) => (
                  <li key={i} className="flex gap-2 text-hb-sm text-hb-muted">
                    <AlertTriangle size={14} className="mt-[3px] shrink-0 text-hb-warning" aria-hidden />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {item.error && pending && (
            <p className="mt-2 flex items-start gap-1.5 text-hb-sm text-hb-error">
              <X size={14} className="mt-[3px] shrink-0" aria-hidden />
              Last try didn't go through: {item.error}
            </p>
          )}

          {/* Actions */}
          {pending ? (
            <div className="mt-hb-4 flex flex-wrap items-center gap-2">
              <Button size="sm" loading={busy} onClick={() => onDecide({ action: 'approve' })}>
                {kind.approve}
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={onChange}>
                Change
              </Button>
              <Button size="sm" variant="quiet" disabled={busy} onClick={() => onDecide({ action: 'dismiss' })}>
                Dismiss
              </Button>
            </div>
          ) : (
            <p className="mt-3 text-hb-sm text-hb-muted">
              <span className="font-semibold text-hb-text">
                {item.status === 'dismissed' ? 'Dismissed' : DONE_LABEL[item.action_taken ?? 'none']}
              </span>
              {item.status === 'overridden' && ' (changed from the suggestion)'}
              {item.decided_at && ` · ${timeAgo(item.decided_at)}`}
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

export default function ScreeningPage() {
  const { basePath } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'pending' | 'decided'>('pending')
  const [filter, setFilter] = useState<ScreeningRecommendationKind | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [changing, setChanging] = useState<ScreeningItem | null>(null)
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: [...SCREENING_QUEUE_KEY, tab],
    queryFn: () => screeningApi.getQueue(tab).then((r) => r.data),
    refetchInterval: tab === 'pending' ? 60_000 : false,
  })

  const items = useMemo(() => {
    const list = (data?.items ?? []).filter((i) => !filter || i.recommendation === filter)
    // Waiting: most actionable first. Decided: most recent first (server order).
    return tab === 'pending'
      ? [...list].sort((a, b) => ORDER[a.recommendation] - ORDER[b.recommendation])
      : list
  }, [data, filter, tab])
  const counts = data?.counts ?? {}

  const decide = useMutation({
    mutationFn: (payload: DecidePayload) => screeningApi.decide(payload).then((r) => r.data.results),
    onMutate: (payload) => setBusyIds((s) => new Set([...s, ...payload.ids])),
    onSuccess: (results) => {
      summarise(results)
      setSelected((s) => {
        const next = new Set(s)
        results.forEach((r) => r.status !== 'failed' && next.delete(r.id))
        return next
      })
      setChanging(null)
    },
    onError: () => toast.error("That didn't go through. Please try again."),
    onSettled: (_r, _e, payload) => {
      setBusyIds((s) => new Set([...s].filter((id) => !payload.ids.includes(id))))
      queryClient.invalidateQueries({ queryKey: SCREENING_QUEUE_KEY })
    },
  })

  const openProfile = (candidateId: string) =>
    navigate(`${basePath}/candidates?openId=${encodeURIComponent(candidateId)}`)

  const selectedIds = items.filter((i) => selected.has(i.id)).map((i) => i.id)
  const allSelected = items.length > 0 && selectedIds.length === items.length

  const filterOptions = (Object.keys(KIND) as ScreeningRecommendationKind[])
    .filter((k) => counts[k])
    .map((k) => ({ value: k, label: KIND[k].label, count: counts[k] }))

  return (
    <div className="flex flex-col gap-hb-5">
      <PageHeader
        eyebrow="Candidates"
        title="To review"
        description="Hybent AI screens each new candidate against your open jobs and suggests a next step. Nothing happens until you approve."
        actions={
          <Button variant="ghost" size="sm" icon={<RefreshCw size={14} className={isFetching ? 'animate-spin' : undefined} />} onClick={() => refetch()}>
            Refresh
          </Button>
        }
      />

      <Tabs
        aria-label="Review status"
        value={tab}
        onChange={(t) => {
          setTab(t)
          setSelected(new Set())
          setFilter(null)
        }}
        items={[
          { value: 'pending', label: 'Waiting', count: data && tab === 'pending' ? data.pending_total : undefined },
          { value: 'decided', label: 'Decided' },
        ]}
      />

      {tab === 'pending' && filterOptions.length > 1 && (
        <FilterChips options={filterOptions} value={filter} onChange={setFilter} />
      )}

      {tab === 'pending' && items.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <Checkbox
            label={allSelected ? 'Clear selection' : 'Select all'}
            checked={allSelected}
            onChange={(e) => setSelected(e.target.checked ? new Set(items.map((i) => i.id)) : new Set())}
          />
          {selectedIds.length > 0 && (
            <>
              <Button
                size="sm"
                loading={decide.isPending && selectedIds.some((id) => busyIds.has(id))}
                onClick={() => decide.mutate({ ids: selectedIds, action: 'approve' })}
              >
                Approve {selectedIds.length} as suggested
              </Button>
              <Button
                size="sm"
                variant="quiet"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ ids: selectedIds, action: 'dismiss' })}
              >
                Dismiss {selectedIds.length}
              </Button>
            </>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-hb-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44 w-full" rounded="md" />
          ))}
        </div>
      ) : data && !data.enabled && (data.items ?? []).length === 0 ? (
        <Card padding="default">
          <EmptyState
            title="AI screening is off for your workspace"
            description="When it's switched on, every new candidate from email, uploads and your careers page is screened here automatically."
          />
        </Card>
      ) : items.length === 0 ? (
        <Card padding="default">
          <EmptyState
            title={tab === 'pending' ? "You're all caught up" : 'Nothing decided yet'}
            description={
              tab === 'pending'
                ? 'New candidates show up here once they have been screened.'
                : 'Candidates you approve, change or dismiss are listed here.'
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-hb-4">
          {items.map((item) => (
            <ReviewCard
              key={item.id}
              item={item}
              selected={selected.has(item.id)}
              onSelect={(on) =>
                setSelected((s) => {
                  const next = new Set(s)
                  if (on) next.add(item.id)
                  else next.delete(item.id)
                  return next
                })
              }
              onDecide={(payload) => decide.mutate({ ids: [item.id], ...payload })}
              onChange={() => setChanging(item)}
              onOpenProfile={openProfile}
              busy={busyIds.has(item.id)}
            />
          ))}
        </div>
      )}

      {changing && (
        <ChangeDialog
          item={changing}
          onClose={() => setChanging(null)}
          pending={decide.isPending}
          onSubmit={(action, jobId) =>
            decide.mutate({ ids: [changing.id], action: 'override', override_to: action, job_id: jobId })
          }
        />
      )}
    </div>
  )
}
