import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowRight, RefreshCw, Search, Users, Zap } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { talentPoolApi } from '@/api/talentPool'
import { candidatesApi } from '@/api/candidates'
import { jobsApi } from '@/api/jobs'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  FilterChips,
  Input,
  PageHeader,
  Skeleton,
  StatCard,
  StatGrid,
} from '@/components/hb'

/**
 * The talent database.
 *
 * Rebuilt on the design system in phase 6. Two behavioural fixes:
 *
 * - The page ran a paginated `talent-pool` query on every filter change and
 *   rendered none of it — the candidate list moved to `/all-talent` at some
 *   point and the query stayed. Fifty candidate records were fetched per
 *   keystroke-triggered refetch and thrown away. It is gone; "View all
 *   candidates" now carries the current search across instead, so typing a term
 *   here actually leads somewhere.
 * - `commentTarget` and `viewTarget` had modals but no code path that opened
 *   them. Removed rather than migrated.
 */

/** Shorthand recruiters actually type, expanded to what the matcher indexes. */
const SHORTCUTS: Record<string, string> = {
  bde: 'Business Development Executive',
  bdm: 'Business Development Manager',
  bda: 'Business Development Associate',
  sde: 'Software Development Engineer',
  swe: 'Software Engineer',
  fe: 'Frontend Engineer',
  be: 'Backend Engineer',
  fs: 'Full Stack',
  mern: 'MERN Stack',
  mean: 'MEAN Stack',
  pm: 'Product Manager',
  po: 'Product Owner',
  em: 'Engineering Manager',
  hr: 'Human Resources',
  ds: 'Data Scientist',
  da: 'Data Analyst',
  de: 'Data Engineer',
  ml: 'Machine Learning',
  ai: 'Artificial Intelligence',
  se: 'Sales Executive',
  sm: 'Sales Manager',
  mkt: 'Marketing',
  ux: 'UX Designer',
  ui: 'UI Designer',
  qa: 'Quality Assurance',
  qe: 'Quality Engineer',
  sre: 'Site Reliability Engineer',
  dvo: 'DevOps',
}

function expand(raw: string) {
  return SHORTCUTS[raw.trim().toLowerCase()] ?? raw
}

function suggestionsFor(input: string) {
  const q = input.trim().toLowerCase()
  if (!q) return []
  return Object.entries(SHORTCUTS)
    .filter(([key, value]) => key.startsWith(q) || value.toLowerCase().includes(q))
    .slice(0, 6)
    .map(([shortcut, expanded]) => ({ shortcut: shortcut.toUpperCase(), expanded }))
}

function MatchRow({
  candidate,
  jobTitle,
  highlight,
  onReengage,
  pending,
}: {
  candidate: any
  jobTitle: string
  highlight: string
  onReengage: () => void
  pending: boolean
}) {
  const term = highlight.trim().toLowerCase()

  return (
    <Card variant="interactive" padding="default">
      <div className="flex flex-col gap-hb-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Avatar name={candidate.full_name} src={candidate.avatar_url} size="md" />

          <div className="min-w-0">
            <p className="truncate text-hb-body font-semibold text-hb-text">
              {candidate.full_name}
              {candidate.current_title && (
                <span className="ml-2 font-normal text-hb-muted">{candidate.current_title}</span>
              )}
            </p>

            <p className="mt-0.5 text-hb-xs text-hb-muted">
              Match for {jobTitle}:{' '}
              <span className="font-mono font-semibold text-hb-success">
                {candidate.match_score}%
              </span>
              {candidate.created_by_name && <> · added by {candidate.created_by_name}</>}
            </p>

            {candidate.skills?.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {candidate.skills.map((s: string) => (
                  <li key={s}>
                    {/* Skills matching the search are toned up, so a recruiter
                        can see *why* this candidate came back. */}
                    <Badge tone={term && s.toLowerCase().includes(term) ? 'info' : 'neutral'}>
                      {s}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <Button size="sm" loading={pending} onClick={onReengage} className="shrink-0">
          Re-engage
        </Button>
      </div>
    </Card>
  )
}

export default function TalentPoolPage() {
  const { basePath } = useAuth()
  const navigate = useNavigate()

  /* The jobs list links here as `/talent-pool?search=<job title>` from its
     re-engage chip. Nothing read the parameter, so that link had been landing
     on an unfiltered page since it was added. */
  const [searchParams] = useSearchParams()
  const initialSearch = searchParams.get('search') ?? ''

  const [searchInput, setSearchInput] = useState(initialSearch)
  const [search, setSearch] = useState(initialSearch)
  const [selectedJobTitle, setSelectedJobTitle] = useState<string | null>(null)
  const [jobIndex, setJobIndex] = useState(0)

  const { data: jobsData } = useQuery({
    queryKey: ['active-jobs'],
    queryFn: () => jobsApi.list({ status: 'active', limit: 20 }).then((r) => r.data),
  })
  const activeJobs = jobsData?.items ?? []

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['talent-pool-stats'],
    queryFn: () => talentPoolApi.getStats().then((r) => r.data),
  })

  const { data: matches, isLoading: matchesLoading } = useQuery({
    queryKey: ['talent-pool-suggestions'],
    queryFn: () => talentPoolApi.getSuggestedMatches().then((r) => r.data),
  })

  /* When the recruiter searches or picks a job chip, jump the match panel to
     the closest matching role rather than leaving it on an unrelated one. */
  useEffect(() => {
    if (!matches?.length) return
    const query = (selectedJobTitle || search).toLowerCase().trim()
    if (!query) return
    const best = matches.findIndex((m) => {
      const title = m.job_title.toLowerCase()
      return title.includes(query) || query.includes(title)
    })
    if (best !== -1) setJobIndex(best)
  }, [search, selectedJobTitle, matches])

  const reengage = useMutation({
    mutationFn: ({ candidateId, jobId }: { candidateId: string; jobId: string }) =>
      candidatesApi.updateStage(candidateId, 'applied', false, jobId),
    onSuccess: () => {
      toast.success('Candidate re-engaged and moved into the pipeline')
      navigate(`${basePath}/candidates`)
    },
    onError: () => toast.error('Failed to re-engage the candidate'),
  })

  const hints = useMemo(() => suggestionsFor(searchInput), [searchInput])
  const current = matches?.[jobIndex]
  const hasMatches = !!matches?.length
  const hasFilters = !!search || !!selectedJobTitle

  const submitSearch = (value = searchInput) => {
    setSearch(expand(value))
    setSearchInput(value)
  }

  /* The search leads to the full list, which is where a candidate list lives. */
  const openAllTalent = () =>
    navigate(`${basePath}/all-talent${search ? `?search=${encodeURIComponent(search)}` : ''}`)

  return (
    <div className="mx-auto max-w-hb-page pb-hb-10">
      <PageHeader
        eyebrow="Talent"
        title="Talent database"
        description="Everyone your team has ever assessed — searchable and re-matchable for as long as you keep them."
        actions={
          <Button variant="ghost" trailingIcon={<ArrowRight size={16} />} onClick={openAllTalent}>
            View all candidates
          </Button>
        }
      />

      <div className="space-y-hb-6">
        <Card padding="loose">
          <div className="flex flex-col gap-hb-3 sm:flex-row sm:items-end">
            <Input
              label="Search the database"
              leadingIcon={<Search size={15} />}
              placeholder="Try BDE, SDE, MERN — or a skill or name"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitSearch()
              }}
              fieldClassName="flex-1"
              trailingSlot={
                search && search !== searchInput ? (
                  <Badge tone="info">
                    <Zap size={10} aria-hidden />
                    {search}
                  </Badge>
                ) : undefined
              }
            />
            <Button size="lg" onClick={() => submitSearch()}>
              Search
            </Button>
          </div>

          {hints.length > 0 && searchInput.trim() !== '' && (
            <div className="mt-hb-3">
              <p className="mb-1.5 font-mono text-hb-label uppercase text-hb-dim">Shortcuts</p>
              <div className="flex flex-wrap gap-1.5">
                {hints.map(({ shortcut, expanded }) => (
                  <button
                    key={shortcut}
                    type="button"
                    onClick={() => submitSearch(expanded)}
                    className="inline-flex h-8 items-center gap-2 rounded-hb-full border border-hb-border bg-hb-surface px-3 text-hb-sm text-hb-muted transition-colors duration-hb hover:border-hb-border-strong hover:text-hb-text focus-visible:outline-none focus-visible:shadow-hb-ring"
                  >
                    <span className="font-mono text-hb-micro text-hb-cyan">{shortcut}</span>
                    {expanded}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeJobs.length > 0 && (
            <div className="mt-hb-4">
              <p className="mb-1.5 font-mono text-hb-label uppercase text-hb-dim">
                Filter by active job
              </p>
              <FilterChips
                options={activeJobs.map((j: any) => ({ value: j.title, label: j.title }))}
                value={selectedJobTitle}
                onChange={setSelectedJobTitle}
                allLabel="Any job"
              />
            </div>
          )}
        </Card>

        <StatGrid className="xl:grid-cols-2">
          <StatCard
            label="Candidates stored"
            value={(stats?.total_candidates ?? 0).toLocaleString()}
            icon={<Users />}
            loading={statsLoading}
          />
          <StatCard
            label="Re-matched to new roles"
            value={stats?.re_matched_count ?? 0}
            icon={<RefreshCw />}
            loading={statsLoading}
          />
        </StatGrid>

        <Card padding="loose">
          <CardHeader
            title={
              current?.job_title ? `Recent matches — ${current.job_title}` : 'Recent matches'
            }
            subtitle={
              hasFilters
                ? 'Narrowed to the role closest to your search.'
                : 'Candidates in your pool that score against a currently open role.'
            }
            action={
              hasMatches && !matchesLoading ? (
                <Badge tone="info">{current?.candidates?.length ?? 0} found</Badge>
              ) : undefined
            }
          />

          {hasMatches && matches.length > 1 && (
            <div className="mb-hb-4">
              <FilterChips
                options={matches.map((m, i) => ({ value: String(i), label: m.job_title }))}
                value={String(jobIndex)}
                onChange={(v) => setJobIndex(v === null ? 0 : Number(v))}
                allLabel="First open role"
              />
            </div>
          )}

          <div className="space-y-hb-3">
            {matchesLoading ? (
              Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-24 w-full" rounded="md" />
              ))
            ) : !hasMatches ? (
              <p className="py-8 text-center text-hb-sm text-hb-muted">
                No active jobs, or nobody in the pool clears the match threshold yet. Post a job and
                upload résumés to see matches here.
              </p>
            ) : current?.candidates?.length ? (
              current.candidates.map((candidate: any) => (
                <MatchRow
                  key={candidate.id}
                  candidate={candidate}
                  jobTitle={current.job_title}
                  highlight={search || selectedJobTitle || ''}
                  pending={reengage.isPending && reengage.variables?.candidateId === candidate.id}
                  onReengage={() =>
                    reengage.mutate({ candidateId: candidate.id, jobId: current.job_id })
                  }
                />
              ))
            ) : (
              <p className="py-8 text-center text-hb-sm text-hb-muted">
                Nobody in the pool matches this role strongly enough yet.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
