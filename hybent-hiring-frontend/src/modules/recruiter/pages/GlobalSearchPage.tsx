import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Briefcase, Building2, Check, Code2, Globe, Lock, Send, ShieldCheck, Link2, Mail, MapPin, Plus, Search, Sparkles, X } from 'lucide-react'

import {
  candidateGlobalSearch,
  importOutsideCandidate,
  requestNetworkContact,
  type NetworkHit,
  type GlobalSearchFilters,
  type GlobalSearchResponse,
  type OutsideCandidateHit,
  type OwnCandidateHit,
} from '@/api/search'
import { jobsApi } from '@/api/jobs'
import { Avatar, Badge, Button, Card, EmptyState, IconTile, ScoreRing, Select, Skeleton, Tabs } from '@/components/hb'

const STEPS = [
  { icon: <Sparkles />, title: 'Describe the role', body: 'Type it the way you would say it: role, skills, city, years.' },
  { icon: <Search />, title: 'AI finds and ranks', body: 'Your own candidates and millions of outside profiles, each with a match score and reason.' },
  { icon: <Plus />, title: 'Add in one click', body: 'Pick a job and drop the best people straight into its pipeline.' },
]

function Reason({ text }: { text: string }) {
  return <p className="mt-hb-2 text-hb-sm text-hb-muted">{text}</p>
}

/**
 * Global Search.
 *
 * The recruiter types what they want in plain English; the backend turns it
 * into filters (shown as removable chips) and searches both the org's own
 * candidates and outside profiles (People Data Labs). Editing a chip re-runs
 * the search with those exact filters, skipping the AI step.
 */

type Tab = 'outside' | 'network' | 'github' | 'own'

const EXAMPLES = [
  'React developer in Ahmedabad, 3–5 years',
  'Python Django developer Bangalore with AWS',
  'HR executive in Pune',
]

type ChipKey = 'job_titles' | 'skills' | 'city' | 'country' | 'years'

function chipsFor(f: GlobalSearchFilters) {
  const chips: Array<{ key: ChipKey; value?: string; label: string }> = []
  f.job_titles.forEach((t) => chips.push({ key: 'job_titles', value: t, label: t }))
  f.skills.forEach((s) => chips.push({ key: 'skills', value: s, label: s }))
  if (f.city) chips.push({ key: 'city', label: f.city })
  if (f.country) chips.push({ key: 'country', label: f.country })
  if (f.min_years != null || f.max_years != null) {
    const label =
      f.min_years != null && f.max_years != null
        ? `${f.min_years}–${f.max_years} yrs`
        : f.min_years != null
          ? `${f.min_years}+ yrs`
          : `up to ${f.max_years} yrs`
    chips.push({ key: 'years', label })
  }
  return chips
}

function withoutChip(f: GlobalSearchFilters, key: ChipKey, value?: string): GlobalSearchFilters {
  switch (key) {
    case 'job_titles':
      return { ...f, job_titles: f.job_titles.filter((t) => t !== value) }
    case 'skills':
      return { ...f, skills: f.skills.filter((s) => s !== value) }
    case 'city':
      return { ...f, city: null }
    case 'country':
      return { ...f, country: null }
    case 'years':
      return { ...f, min_years: null, max_years: null }
  }
}

const CHIP_TONE: Record<ChipKey, string> = {
  job_titles: 'text-hb-violet',
  skills: 'text-hb-cyan',
  city: 'text-hb-muted',
  country: 'text-hb-muted',
  years: 'text-hb-muted',
}

function SkillList({ skills, matched }: { skills: string[]; matched: string[] }) {
  if (!skills.length) return null
  const m = new Set(matched.map((s) => s.toLowerCase()))
  const ordered = [...skills].sort((a, b) => Number(m.has(b.toLowerCase())) - Number(m.has(a.toLowerCase())))
  return (
    <div className="mt-hb-3 flex flex-wrap gap-1.5">
      {ordered.slice(0, 8).map((s) => (
        <Badge key={s} tone={m.has(s.toLowerCase()) ? 'success' : 'neutral'}>
          {s}
        </Badge>
      ))}
    </div>
  )
}

function Meta({ title, company, location, years }: { title: string | null; company: string | null; location: string | null; years: number | null }) {
  return (
    <div className="mt-1 flex flex-wrap gap-x-hb-4 gap-y-1 text-hb-sm text-hb-muted">
      {title && (
        <span className="inline-flex items-center gap-1.5">
          <Briefcase size={13} aria-hidden /> {title}
        </span>
      )}
      {company && (
        <span className="inline-flex items-center gap-1.5">
          <Building2 size={13} aria-hidden /> {company}
        </span>
      )}
      {location && (
        <span className="inline-flex items-center gap-1.5">
          <MapPin size={13} aria-hidden /> {location}
        </span>
      )}
      {years != null && <span>{years} yrs exp</span>}
    </div>
  )
}

function OutsideCard({
  p,
  jobSelected,
  added,
  adding,
  onAdd,
}: {
  p: OutsideCandidateHit
  jobSelected: boolean
  added: boolean
  adding: boolean
  onAdd: () => void
}) {
  return (
    <Card padding="default" as="li" className="transition-shadow duration-hb hover:shadow-hb-2">
      <div className="flex items-start gap-hb-4">
        <ScoreRing score={p.match_score} size={56} suffix="%" label={`${p.match_score}% match`} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Avatar name={p.full_name} size="sm" />
            <h3 className="text-hb-base font-semibold text-hb-text">{p.full_name}</h3>
            <Badge tone={p.source === 'github' ? 'neutral' : 'brand'}>
              {p.source === 'github' ? (
                <>
                  <Code2 size={10} aria-hidden /> GitHub
                </>
              ) : (
                <>
                  <Globe size={10} aria-hidden /> Outside Hybent
                </>
              )}
            </Badge>
          </div>
          <Meta title={p.job_title} company={p.company} location={p.location} years={p.years_experience} />
          <Reason text={p.match_reason} />
          <SkillList skills={p.skills} matched={p.matched_skills} />
          <div className="mt-hb-3 flex flex-wrap items-center gap-hb-3 text-hb-sm text-hb-dim">
            {p.source === 'github' ? (
              <>
                {p.github_url && (
                  <a
                    href={p.github_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-hb-violet hover:underline"
                  >
                    <Code2 size={13} aria-hidden /> @{p.github_login}
                  </a>
                )}
                <span>{(p.followers ?? 0).toLocaleString()} followers</span>
                <span>{p.public_repos ?? 0} repos</span>
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5" title={p.has_email ? 'Email available' : 'No email on record'}>
                <Mail size={13} aria-hidden className={p.has_email ? 'text-hb-success' : ''} />
                {p.has_email ? 'Email available' : 'No email'}
              </span>
            )}
            {p.has_linkedin && (
              <span className="inline-flex items-center gap-1.5">
                <Link2 size={13} aria-hidden className="text-hb-success" />
                LinkedIn on record
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0">
          {added ? (
            <Badge tone="success">
              <Check size={12} aria-hidden /> Added
            </Badge>
          ) : (
            <Button size="sm" variant={jobSelected ? 'primary' : 'ghost'} loading={adding} icon={<Plus size={14} />} onClick={onAdd}>
              {jobSelected ? 'Add to pipeline' : 'Save candidate'}
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}

function NetworkCard({
  p,
  status,
  busy,
  onRequest,
}: {
  p: NetworkHit
  status: NetworkHit['request_status']
  busy: boolean
  onRequest: () => void
}) {
  return (
    <Card padding="default" as="li" className="transition-shadow duration-hb hover:shadow-hb-2">
      <div className="flex items-start gap-hb-4">
        <ScoreRing score={p.match_score} size={56} suffix="%" label={`${p.match_score}% match`} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Avatar name={p.full_name} size="sm" />
            <h3 className="text-hb-base font-semibold text-hb-text">{p.full_name}</h3>
            <Badge tone="success">
              <ShieldCheck size={10} aria-hidden /> Open to offers
            </Badge>
          </div>
          <Meta title={p.job_title} company={p.company} location={p.location} years={p.years_experience} />
          {p.looking_for && <p className="mt-hb-2 text-hb-sm text-hb-muted">Wants: {p.looking_for}</p>}
          <Reason text={p.match_reason} />
          <SkillList skills={p.skills} matched={p.matched_skills} />
          <p className="mt-hb-3 inline-flex items-center gap-1.5 text-hb-sm text-hb-dim">
            <Lock size={13} aria-hidden /> Contact details shared only if they accept your request
          </p>
        </div>
        <div className="shrink-0">
          {status === 'accepted' ? (
            <Badge tone="success">
              <Check size={12} aria-hidden /> Accepted
            </Badge>
          ) : status === 'pending' ? (
            <Badge tone="warning">Request sent</Badge>
          ) : status === 'declined' ? (
            <Badge>Declined</Badge>
          ) : (
            <Button size="sm" loading={busy} icon={<Send size={14} />} onClick={onRequest}>
              Request contact
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}

function OwnCard({ c }: { c: OwnCandidateHit }) {
  return (
    <Card padding="default" as="li" className="transition-shadow duration-hb hover:shadow-hb-2">
      <div className="flex items-start gap-hb-4">
        <ScoreRing score={c.match_score} size={56} suffix="%" label={`${c.match_score}% match`} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Avatar name={c.full_name} size="sm" />
            <h3 className="text-hb-base font-semibold text-hb-text">{c.full_name}</h3>
            {c.pipeline_stage && <Badge tone="info">{c.pipeline_stage.replace(/_/g, ' ')}</Badge>}
          </div>
          <Meta title={c.job_title} company={c.company} location={c.location} years={c.years_experience} />
          <Reason text={c.match_reason} />
          <SkillList skills={c.skills} matched={c.matched_skills} />
          <p className="mt-hb-3 inline-flex items-center gap-1.5 text-hb-sm text-hb-dim">
            <Mail size={13} aria-hidden /> {c.email.endsWith('.invalid') ? 'No email yet' : c.email}
          </p>
        </div>
      </div>
    </Card>
  )
}

function ResultSkeleton() {
  return (
    <ul className="space-y-hb-3">
      {[0, 1, 2].map((i) => (
        <li key={i}>
          <Skeleton className="h-28 w-full" />
        </li>
      ))}
    </ul>
  )
}

export default function GlobalSearchPage() {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<Tab>('outside')
  const [result, setResult] = useState<GlobalSearchResponse | null>(null)

  const [jobId, setJobId] = useState('')
  const [added, setAdded] = useState<Record<string, boolean>>({})

  const { data: jobsData } = useQuery({
    queryKey: ['jobs', 'active', 'global-search'],
    queryFn: () => jobsApi.list({ status: 'active', limit: 50 }).then((r) => r.data),
  })
  const jobs: Array<{ id: string; title: string }> = (jobsData as any)?.items ?? []

  const search = useMutation({
    mutationFn: candidateGlobalSearch,
    onSuccess: (data) => setResult(data),
  })

  const [requested, setRequested] = useState<Record<string, boolean>>({})
  const request = useMutation({
    mutationFn: requestNetworkContact,
    onSuccess: (_d, vars) => {
      setRequested((r) => ({ ...r, [vars.profile_id]: true }))
      toast.success('Request sent. We will email you when they answer.')
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Could not send the request'),
  })

  const add = useMutation({
    mutationFn: importOutsideCandidate,
    onSuccess: (data, vars) => {
      setAdded((a) => ({ ...a, [vars.person.external_id]: true }))
      const job = jobs.find((j) => j.id === vars.job_id)
      if (!data.created && !job) toast.success('Already in your candidates')
      else toast.success(job ? `Added to ${job.title} pipeline` : 'Saved to your candidates')
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Could not add this candidate'),
  })

  const run = (q = query, job = jobId) => {
    if (!q.trim()) return
    setQuery(q)
    search.mutate({ query: q, scope: 'both', job_id: job || undefined })
  }

  const removeChip = (key: ChipKey, value?: string) => {
    if (!result) return
    const next = withoutChip(result.filters, key, value)
    if (!next.job_titles.length && !next.skills.length) return
    search.mutate({ filters: next, scope: 'both', job_id: jobId || undefined })
  }

  const changeJob = (id: string) => {
    setJobId(id)
    setAdded({}) // "Added" was for the previous job
    // Re-rank against the new job. Filters are reused, so no AI call, and the
    // outside results come from cache, so no extra credits.
    if (result) search.mutate({ filters: result.filters, scope: 'both', job_id: id || undefined })
  }

  const errorMsg =
    (search.error as any)?.response?.data?.detail ?? (search.error ? 'Search failed. Please try again.' : null)
  const outside = result?.outside
  const own = result?.own ?? []

  return (
    <div>
      <div className="space-y-hb-6">
        {/* ── Hero search ─────────────────────────────────────────────── */}
        <section className={result ? 'pt-hb-2' : 'mx-auto max-w-4xl pt-hb-8 text-center'}>
          {!result && (
            <>
              <Badge tone="brand">
                <Sparkles size={10} aria-hidden /> AI talent search
              </Badge>
              <h1 className="mt-hb-4 font-display text-[clamp(26px,3.2vw,38px)] leading-[1.15] tracking-tight text-hb-text">
                Find the right candidate, <span className="hb-grad-text">from anywhere</span>
              </h1>
              <p className="mx-auto mt-hb-3 max-w-2xl text-hb-base text-hb-muted">
                Describe who you need in plain English. We search your own candidates and millions of profiles
                outside Hybent, and rank them for you.
              </p>
            </>
          )}

          <form
            className={result ? '' : 'mt-hb-6'}
            onSubmit={(e) => {
              e.preventDefault()
              run()
            }}
          >
            <div className="rounded-[22px] bg-hb-grad p-[1.5px] shadow-[0_18px_50px_-24px_rgb(76_111_255_/_0.55)]">
              <div className="flex flex-col gap-2 rounded-[21px] bg-hb-surface p-2 sm:flex-row sm:items-center">
                <label className="flex min-w-0 flex-1 items-center gap-3 px-3">
                  <Sparkles size={18} aria-hidden className="shrink-0 text-hb-violet" />
                  <input
                    aria-label="Who are you looking for?"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g. React developer in Ahmedabad, 3–5 years"
                    className="h-12 w-full min-w-0 bg-transparent text-hb-base text-hb-text placeholder:text-hb-dim focus:outline-none"
                  />
                </label>
                {jobs.length > 0 && (
                  <div className="sm:w-60 sm:border-l sm:border-hb-border sm:pl-2">
                    <Select
                      aria-label="Score against a job"
                      value={jobId}
                      onChange={(e) => changeJob(e.target.value)}
                      options={[{ value: '', label: 'Any job' }, ...jobs.map((j) => ({ value: j.id, label: j.title }))]}
                    />
                  </div>
                )}
                <Button size="lg" type="submit" loading={search.isPending} icon={<Search size={16} />}>
                  Search
                </Button>
              </div>
            </div>
          </form>

          {!result && (
            <div className="mt-hb-4 flex flex-wrap items-center justify-center gap-1.5">
              <span className="mr-1 font-mono text-hb-label uppercase text-hb-dim">Try</span>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => run(ex)}
                  className="inline-flex h-8 items-center rounded-hb-full border border-hb-border bg-hb-surface px-3 text-hb-sm text-hb-muted transition-colors duration-hb hover:border-hb-violet hover:text-hb-text focus-visible:outline-none focus-visible:shadow-hb-ring"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}

          {!result && !search.isPending && (
            <ol className="mt-hb-10 grid gap-hb-4 text-left sm:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <Card padding="default" className="h-full">
                    <div className="flex items-center gap-3">
                      <IconTile>{s.icon}</IconTile>
                      <span className="font-mono text-hb-label uppercase text-hb-dim">Step {i + 1}</span>
                    </div>
                    <h3 className="mt-hb-3 text-hb-base font-semibold text-hb-text">{s.title}</h3>
                    <p className="mt-1 text-hb-sm text-hb-muted">{s.body}</p>
                  </Card>
                </li>
              ))}
            </ol>
          )}

          {result && (
            <div className="mt-hb-4">
              <p className="mb-1.5 font-mono text-hb-label uppercase text-hb-dim">AI understood</p>
              <div className="flex flex-wrap gap-1.5">
                {chipsFor(result.filters).map((c) => (
                  <span
                    key={`${c.key}:${c.label}`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-hb-full border border-hb-border bg-hb-surface pl-3 pr-1.5 text-hb-sm"
                  >
                    <span className={CHIP_TONE[c.key]}>{c.label}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${c.label}`}
                      onClick={() => removeChip(c.key, c.value)}
                      className="grid h-5 w-5 place-items-center rounded-hb-full text-hb-dim hover:bg-hb-border hover:text-hb-text"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {errorMsg && <EmptyState tone="error" title="Search failed" description={String(errorMsg)} />}

        {(result || search.isPending) && (
          <>
            <Tabs<Tab>
              aria-label="Search results"
              value={tab}
              onChange={setTab}
              items={[
                { value: 'outside', label: 'Global', count: outside?.total },
                ...(result?.github || result?.github_error
                  ? [{ value: 'github' as Tab, label: 'GitHub', count: result.github?.total }]
                  : []),
                { value: 'network', label: 'Hybent Network', count: result?.network?.length },
                { value: 'own', label: 'Your candidates', count: result ? own.length : undefined },
              ]}
            />

            {search.isPending ? (
              <ResultSkeleton />
            ) : tab === 'network' ? (
              result?.network?.length ? (
                <>
                  <p className="text-hb-sm text-hb-muted">
                    People who joined the Hybent Talent Network to be found. Free to contact: they get an email and
                    choose whether to share their details with you.
                  </p>
                  <ul className="space-y-hb-3">
                    {result.network.map((p) => (
                      <NetworkCard
                        key={p.profile_id}
                        p={p}
                        status={requested[p.profile_id] ? 'pending' : p.request_status}
                        busy={request.isPending && request.variables?.profile_id === p.profile_id}
                        onRequest={() => request.mutate({ profile_id: p.profile_id, job_id: jobId || undefined })}
                      />
                    ))}
                  </ul>
                </>
              ) : (
                <EmptyState
                  tone="no-results"
                  title="No network members match yet"
                  description="The Hybent Talent Network grows every day as candidates join at hybent.com/talent."
                />
              )
            ) : tab === 'github' ? (
              result?.github_error ? (
                <EmptyState tone="error" icon={<Code2 />} title="GitHub search unavailable" description={result.github_error} />
              ) : result?.github && result.github.results.length ? (
                <>
                  <p className="text-hb-sm text-hb-muted">
                    Top {result.github.results.length} of {result.github.total.toLocaleString()} developers on GitHub,
                    ranked by followers. Free, public profiles.
                  </p>
                  <ul className="space-y-hb-3">
                    {result.github.results.map((p) => (
                      <OutsideCard
                        key={p.external_id}
                        p={p}
                        jobSelected={!!jobId}
                        added={!!added[p.external_id]}
                        adding={add.isPending && add.variables?.person.external_id === p.external_id}
                        onAdd={() => add.mutate({ person: p, job_id: jobId || undefined })}
                      />
                    ))}
                  </ul>
                </>
              ) : (
                <EmptyState
                  tone="no-results"
                  title="No GitHub developers match"
                  description="GitHub search needs a programming language or framework in your search, like React or Python."
                />
              )
            ) : tab === 'outside' ? (
              result?.outside_error ? (
                <EmptyState tone="error" icon={<Globe />} title="Outside search unavailable" description={result.outside_error} />
              ) : outside && outside.results.length ? (
                <>
                  <p className="text-hb-sm text-hb-muted">
                    Showing top {outside.results.length} of {outside.total.toLocaleString()} matching profiles
                  </p>
                  <ul className="space-y-hb-3">
                    {outside.results.map((p) => (
                      <OutsideCard
                        key={p.external_id}
                        p={p}
                        jobSelected={!!jobId}
                        added={!!added[p.external_id]}
                        adding={add.isPending && add.variables?.person.external_id === p.external_id}
                        onAdd={() => add.mutate({ person: p, job_id: jobId || undefined })}
                      />
                    ))}
                  </ul>
                </>
              ) : (
                <EmptyState
                  tone="no-results"
                  title="No outside profiles match"
                  description="Remove a filter above, such as the city or years, to widen the search."
                />
              )
            ) : own.length ? (
              <ul className="space-y-hb-3">
                {own.map((c) => (
                  <OwnCard key={c.id} c={c} />
                ))}
              </ul>
            ) : (
              <EmptyState
                tone="no-results"
                title="None of your candidates match yet"
                description="Check the Global tab for people outside Hybent."
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
