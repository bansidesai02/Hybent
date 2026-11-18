import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { AlertTriangle, FilterX, Loader2, Search } from 'lucide-react'

import { publicApi } from '@/api/public'
import { CompanyFooter, useNoIndex } from '@/modules/apply/components/CompanyFooter'

/**
 * A company's own careers page: hybent.com/apply/<org-slug>. It lists only
 * that company's open jobs and is reached from its apply links ("View all
 * job openings"); hybent.com doesn't link to it and search engines skip it.
 */

const JOB_TYPE_LABEL: Record<string, string> = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  contract: 'Contract',
  internship: 'Internship',
  freelance: 'Freelance',
}

interface CompanyJob {
  id: string
  title: string
  location: string | null
  is_remote: boolean
  job_type: string
  experience_level: string | null
  min_experience_years: number | null
  created_at: string
}

interface CompanyJobs {
  organization: { name: string; slug: string; logo_url: string | null; website: string | null }
  jobs: CompanyJob[]
}

const place = (j: CompanyJob) => (j.is_remote ? 'Remote' : j.location || 'Not specified')

function FilterSelect({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-hb-sm font-semibold text-hb-text">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-hb-sm border border-hb-border bg-hb-surface px-3 text-hb-sm text-hb-text focus:border-hb-blue/60 focus:outline-none"
      >
        <option value="">All</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  )
}

export default function CompanyJobsPage() {
  useNoIndex()
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const [data, setData] = useState<CompanyJobs | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [location, setLocation] = useState('')
  const [jobType, setJobType] = useState('')

  useEffect(() => {
    if (!orgSlug) return
    publicApi.listJobs(orgSlug)
      .then((res: any) => setData(res.data))
      .catch((err: any) => setError(err?.response?.status === 404
        ? 'This careers page does not exist.'
        : 'Could not load the jobs right now. Please try again shortly.'))
  }, [orgSlug])

  useEffect(() => {
    if (data) document.title = `Careers at ${data.organization.name}`
  }, [data])

  const locations = useMemo(() => [...new Set((data?.jobs ?? []).map(place))].sort(), [data])
  const types = useMemo(() => [...new Set((data?.jobs ?? []).map((j) => JOB_TYPE_LABEL[j.job_type] || j.job_type))], [data])
  const jobs = useMemo(() => (data?.jobs ?? []).filter((j) =>
    (!search.trim() || j.title.toLowerCase().includes(search.trim().toLowerCase()))
    && (!location || place(j) === location)
    && (!jobType || (JOB_TYPE_LABEL[j.job_type] || j.job_type) === jobType),
  ), [data, search, location, jobType])
  const filtered = !!(search || location || jobType)

  if (error) {
    return (
      <div className="hb-app grid min-h-screen place-items-center p-4">
        <p className="flex items-center gap-2 text-hb-body text-hb-muted">
          <AlertTriangle size={18} className="text-hb-warning" aria-hidden /> {error}
        </p>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="hb-app grid min-h-screen place-items-center p-4">
        <p role="status" className="flex items-center gap-2 text-hb-body text-hb-muted">
          <Loader2 size={20} className="animate-spin text-hb-cyan" aria-hidden /> Loading jobs…
        </p>
      </div>
    )
  }

  const org = data.organization
  return (
    <div className="hb-app min-h-screen">
      <header className="sticky top-0 z-30 border-b border-hb-border bg-hb-surface/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {org.logo_url && <img src={org.logo_url} alt="" className="h-9 w-auto max-w-[180px] object-contain" />}
            <span className="truncate font-display text-hb-h3 font-bold text-hb-text">{org.name}</span>
          </div>
          {org.website && (
            <a href={/^https?:\/\//i.test(org.website) ? org.website : `https://${org.website}`} target="_blank" rel="noopener noreferrer" className="shrink-0 text-hb-sm font-semibold text-hb-blue hover:underline">
              Home
            </a>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-hb-8">
        <h1 className="mb-hb-6 font-display text-hb-h1 text-hb-text">Open positions</h1>
        <div className="grid gap-hb-6 lg:grid-cols-[280px_1fr]">
          <aside className="h-fit space-y-hb-4 rounded-hb-md border border-hb-border bg-hb-surface p-hb-4">
            <div className="flex items-center gap-2">
              <label className="relative flex-1">
                <span className="sr-only">Search jobs</span>
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-hb-dim" aria-hidden />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search"
                  className="h-10 w-full rounded-hb-sm border border-hb-border bg-hb-surface pl-9 pr-3 text-hb-sm text-hb-text focus:border-hb-blue/60 focus:outline-none"
                />
              </label>
              <button
                type="button"
                onClick={() => { setSearch(''); setLocation(''); setJobType('') }}
                disabled={!filtered}
                aria-label="Clear filters"
                title="Clear filters"
                className="grid h-10 w-10 place-items-center rounded-hb-sm text-hb-muted hover:text-hb-text disabled:opacity-40"
              >
                <FilterX size={17} aria-hidden />
              </button>
            </div>
            <FilterSelect label="Location" value={location} options={locations} onChange={setLocation} />
            <FilterSelect label="Job Type" value={jobType} options={types} onChange={setJobType} />
          </aside>

          <section>
            <div className="mb-hb-3 flex items-center gap-2">
              <h2 className="font-display text-hb-h2 text-hb-text">All jobs</h2>
              <span className="rounded-full bg-hb-surface-2 px-2.5 py-0.5 text-hb-xs font-semibold text-hb-muted">
                {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'}
              </span>
            </div>
            {jobs.length === 0 ? (
              <p className="rounded-hb-md border border-hb-border bg-hb-surface p-hb-5 text-hb-sm text-hb-muted">
                {filtered ? 'No jobs match these filters.' : `${org.name} has no open positions right now.`}
              </p>
            ) : (
              <ul className="space-y-hb-3">
                {jobs.map((j) => (
                  <li key={j.id}>
                    <Link
                      to={`/apply/${org.slug}/${j.id}?source=careers_page`}
                      className="block rounded-hb-md border border-hb-border bg-hb-surface p-hb-4 transition-colors hover:border-hb-blue/40"
                    >
                      <p className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-hb-body font-semibold text-hb-text">{j.title}</span>
                        <span className="text-hb-xs text-hb-dim">
                          {formatDistanceToNow(new Date(j.created_at), { addSuffix: true })}
                        </span>
                      </p>
                      <p className="mt-1 text-hb-sm text-hb-muted">
                        {[place(j), j.min_experience_years ? `${j.min_experience_years}+` : null, JOB_TYPE_LABEL[j.job_type] || j.job_type]
                          .filter(Boolean).join(' • ')}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <CompanyFooter company={org.name} />
      </main>
    </div>
  )
}
