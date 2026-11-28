import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Briefcase, Clock, Code2, Globe, History, MapPin, ShieldCheck, Trash2, UserCheck } from 'lucide-react'
import toast from 'react-hot-toast'

import { searchHistoryApi, type SavedCandidate, type SearchRunSummary } from '@/api/search'
import { Avatar, Badge, Button, Card, EmptyState, Skeleton, Tabs } from '@/components/hb'
import { timeAgo } from '@/utils/formatters'
import { HISTORY_KEY, SAVED_KEY } from './queryKeys'

/**
 * Global Search's memory, shown under the search bar:
 *  - Recent searches: every search the team ran, reopened from what it found
 *    (no outside-search credits spent again).
 *  - Saved candidates: everyone brought in from outside (saved or added from
 *    Global / GitHub results, or accepted from the Talent Network).
 */


type LibTab = 'recent' | 'saved'

function summary(r: SearchRunSummary) {
  const f = r.filters
  return r.query || [...f.job_titles.slice(0, 2), ...f.skills.slice(0, 2), f.city].filter(Boolean).join(', ')
}

function RunRow({ r, onOpen, onRemove, removing }: {
  r: SearchRunSummary
  onOpen: () => void
  onRemove: () => void
  removing: boolean
}) {
  const total = r.counts.outside + r.counts.github + r.counts.network
  return (
    <li className="group flex items-center gap-hb-3 rounded-hb-sm border border-hb-border bg-hb-surface px-4 py-3 transition-colors duration-hb hover:border-hb-violet">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-hb-3 text-left">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-hb-full bg-hb-surface-2 text-hb-violet">
          <History size={16} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-hb-sm font-semibold text-hb-text">{summary(r)}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-hb-3 gap-y-0.5 text-hb-micro text-hb-dim">
            <span>{total.toLocaleString()} outside · {r.counts.own} yours</span>
            {r.job_title && (
              <span className="inline-flex items-center gap-1">
                <Briefcase size={11} aria-hidden /> {r.job_title}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Clock size={11} aria-hidden /> {timeAgo(r.created_at)}
              {r.searched_by && !r.is_mine ? ` by ${r.searched_by}` : ''}
            </span>
          </span>
        </span>
      </button>
      <Button
        size="sm"
        variant="quiet"
        icon={<Trash2 size={13} />}
        loading={removing}
        onClick={onRemove}
        aria-label={`Remove "${summary(r)}" from history`}
      />
    </li>
  )
}

const ORIGIN: Record<SavedCandidate['origin'], { label: string; icon: JSX.Element; tone: 'brand' | 'neutral' | 'success' }> = {
  pdl: { label: 'Global', icon: <Globe size={10} aria-hidden />, tone: 'brand' },
  github: { label: 'GitHub', icon: <Code2 size={10} aria-hidden />, tone: 'neutral' },
  network: { label: 'Hybent Network', icon: <ShieldCheck size={10} aria-hidden />, tone: 'success' },
}

function SavedRow({ c, basePath }: { c: SavedCandidate; basePath: string }) {
  const o = ORIGIN[c.origin] ?? ORIGIN.pdl
  return (
    <li>
      <Link
        to={`${basePath}/candidates?openId=${c.id}`}
        className="flex items-start gap-hb-3 rounded-hb-sm border border-hb-border bg-hb-surface px-4 py-3 transition-colors duration-hb hover:border-hb-violet"
      >
        <Avatar name={c.full_name} size="md" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-hb-sm font-semibold text-hb-text">{c.full_name}</span>
            <Badge tone={o.tone}>
              {o.icon} {o.label}
            </Badge>
            {c.pipeline_stage && <Badge tone="info">{c.pipeline_stage.replace(/_/g, ' ')}</Badge>}
          </span>
          <span className="mt-0.5 flex flex-wrap gap-x-hb-3 gap-y-0.5 text-hb-micro text-hb-muted">
            {c.job_title && <span className="max-w-[22rem] truncate">{c.job_title}</span>}
            {c.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={11} aria-hidden /> {c.location}
              </span>
            )}
            {c.jobs.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Briefcase size={11} aria-hidden /> In {c.jobs.join(', ')}
              </span>
            )}
          </span>
        </span>
        <span className="shrink-0 text-right text-hb-micro text-hb-dim">
          <span className="block">{timeAgo(c.saved_at)}</span>
          {c.saved_by && <span className="block">by {c.saved_by}</span>}
          <span className={`mt-0.5 block ${c.has_email ? 'text-hb-success' : ''}`}>
            {c.has_email ? 'Email on file' : 'No email yet'}
          </span>
        </span>
      </Link>
    </li>
  )
}

export function SearchLibrary({ onOpenRun, basePath, emptyFallback }: {
  onOpenRun: (id: string) => void
  basePath: string
  /** Shown instead when there is no history and nothing saved yet. */
  emptyFallback: JSX.Element
}) {
  const qc = useQueryClient()
  const [tab, setTab] = useState<LibTab>('recent')
  const [page, setPage] = useState(1)

  const history = useQuery({ queryKey: HISTORY_KEY, queryFn: () => searchHistoryApi.list(30) })
  const saved = useQuery({ queryKey: [...SAVED_KEY, page], queryFn: () => searchHistoryApi.saved(page, 25) })

  const remove = useMutation({
    mutationFn: searchHistoryApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: HISTORY_KEY }),
    onError: () => toast.error('Could not remove it'),
  })

  const runs = history.data ?? []
  const savedTotal = saved.data?.total ?? 0

  if (history.isLoading || saved.isLoading) {
    return <Skeleton className="mt-hb-10 h-48 w-full" />
  }
  if (!runs.length && !savedTotal) return emptyFallback

  return (
    <Card padding="loose" className="mt-hb-10 text-left">
      <Tabs<LibTab>
        aria-label="Search history and saved candidates"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'recent', label: 'Recent searches', count: runs.length },
          { value: 'saved', label: 'Saved candidates', count: savedTotal },
        ]}
      />
      <div className="mt-hb-4">
        {tab === 'recent' ? (
          runs.length ? (
            <ul className="space-y-hb-2">
              {runs.map((r) => (
                <RunRow
                  key={r.id}
                  r={r}
                  onOpen={() => onOpenRun(r.id)}
                  onRemove={() => remove.mutate(r.id)}
                  removing={remove.isPending && remove.variables === r.id}
                />
              ))}
            </ul>
          ) : (
            <EmptyState title="No searches yet" description="Your team's searches will be kept here." />
          )
        ) : savedTotal ? (
          <>
            <p className="mb-hb-3 inline-flex items-center gap-1.5 text-hb-sm text-hb-muted">
              <UserCheck size={14} aria-hidden /> Everyone your team brought in from Global Search. Click to open
              their profile.
            </p>
            <ul className="space-y-hb-2">
              {saved.data!.items.map((c) => (
                <SavedRow key={c.id} c={c} basePath={basePath} />
              ))}
            </ul>
            {savedTotal > 25 && (
              <div className="mt-hb-4 flex items-center justify-between text-hb-sm text-hb-muted">
                <span>
                  Page {page} of {Math.ceil(savedTotal / 25)}
                </span>
                <span className="flex gap-2">
                  <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={page * 25 >= savedTotal}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </span>
              </div>
            )}
          </>
        ) : (
          <EmptyState
            title="No saved candidates yet"
            description="Use Save candidate or Add to pipeline on any search result."
          />
        )}
      </div>
    </Card>
  )
}
