import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { BriefcaseBusiness, Edit2, Eye, Link2, Plus, Trash2, XCircle, Zap } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { jobsApi } from '@/api/jobs'
import { aiApi } from '@/api/ai'
import { organizationsApi } from '@/api/organizations'
import { formatDate } from '@/utils/formatters'
import type { Job, JobStatus } from '@/types'
import { LinkedInShareModal } from '@/modules/recruiter/components/LinkedInShareModal'
import {
  Badge,
  Button,
  CellStack,
  ConfirmDialog,
  DataTable,
  Dialog,
  FilterChips,
  IconTile,
  PageHeader,
  Pagination,
  Select,
  StatusPill,
  Toolbar,
  ToolbarSearch,
  type Column,
} from '@/components/hb'

/** LinkedIn's mark. Lucide 1.x dropped brand glyphs, so this one stays local. */
function LinkedInGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

/**
 * Open positions.
 *
 * Rebuilt on the design system in phase 6. The list was a hand-built CSS grid
 * pretending to be a table â€” no `<table>`, no `aria-sort`, a duplicated mobile
 * block that repeated every cell a second time, and hover states applied by
 * mutating `style` in `onMouseEnter`. `DataTable` supplies the semantics and
 * collapses to cards below `md` from one column definition.
 *
 * Also gone: a private `STATUS_STYLE` map whose `active` entry read
 * `var(--teal, #059669)` while the same status elsewhere in the product was
 * emerald, amber or violet. Status now comes from `StatusPill`.
 */

const JOB_TYPE_LABEL: Record<string, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
  freelance: 'Freelance',
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'paused', label: 'Paused' },
  { value: 'closed', label: 'Closed' },
] as const

const EXPERIENCE_LABEL: Record<string, string> = {
  entry: 'Entry level',
  mid: 'Mid level',
  senior: 'Senior',
  lead: 'Lead / Principal',
  director: 'Director+',
}

function experienceDisplay(job: Job) {
  const parts: string[] = []
  if (job.min_experience_years != null && job.min_experience_years > 0) {
    parts.push(`${job.min_experience_years}+ years`)
  }
  if (job.experience_level) {
    const key = job.experience_level.toLowerCase().trim()
    parts.push(EXPERIENCE_LABEL[key] || job.experience_level)
  }
  return parts.join(' · ') || 'Not specified'
}

/* â”€â”€ Detail dialog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

/** Shape the AI export endpoint wants, built from a job. */
function jdPayload(job: Job) {
  return {
    title: job.title,
    location: job.location || 'Remote',
    experience: experienceDisplay(job),
    key_responsibilities: (job as any).responsibilities
      ? (job as any).responsibilities
          .split('\n')
          .map((s: string) => s.replace(/^[â€¢\s*-]+/, '').trim())
          .filter(Boolean)
      : [],
    required_qualifications_skills: job.skills_required,
    good_to_have: [],
    description: job.description,
  }
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-hb-sm border border-hb-border bg-hb-surface-2 p-3.5">
      <p className="font-mono text-hb-label uppercase text-hb-dim">{label}</p>
      <p className="mt-1.5 text-hb-body font-semibold text-hb-text">{value}</p>
    </div>
  )
}

function Prose({ title, body }: { title: string; body: string }) {
  return (
    <section>
      <h3 className="font-display text-hb-h3 text-hb-text">{title}</h3>
      <p className="mt-2 whitespace-pre-line text-hb-body text-hb-muted">{body}</p>
    </section>
  )
}

/** Copies the public, no-login "apply to this job" link — shareable on LinkedIn or anywhere else. */
async function copyApplyLink(orgSlug: string | undefined, job: Job) {
  if (!orgSlug) {
    toast.error('Apply link is still loading — try again in a moment.')
    return
  }
  const url = `${window.location.origin}/apply/${orgSlug}/${job.id}`
  try {
    await navigator.clipboard.writeText(url)
    toast.success('Apply link copied!')
  } catch {
    toast.error('Could not copy the apply link.')
  }
}

function JobDetailDialog({ job, orgSlug, onClose }: { job: Job; orgSlug: string | undefined; onClose: () => void }) {
  const [busy, setBusy] = useState(false)

  /* Opens the stored JD if there is one, otherwise generates a PDF. Both end at
     a blob URL, which is revoked on a timer â€” revoking immediately races the
     browser's own fetch of the new tab. */
  const openJd = async (download: boolean) => {
    setBusy(true)
    try {
      const blob = job.jd_url
        ? await fetch(job.jd_url).then((r) => {
            if (!r.ok) throw new Error('Failed to fetch JD')
            return r.blob()
          })
        : new Blob([(await aiApi.exportJDPDF(jdPayload(job))).data], { type: 'application/pdf' })

      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))

      if (download) {
        const link = document.createElement('a')
        link.href = url
        link.download = job.jd_filename || `JD_${job.title.replace(/\s+/g, '_')}.pdf`
        document.body.appendChild(link)
        link.click()
        link.remove()
        toast.success('JD downloaded')
      } else {
        window.open(url, '_blank')
      }

      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      console.error(err)
      toast.error(download ? 'Could not download the JD.' : 'Could not open the JD.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={job.title}
      description={
        <span className="inline-flex flex-wrap items-center gap-2">
          <StatusPill status={job.status} />
          <span>{job.is_remote ? 'Remote' : job.location || '—'}</span>
        </span>
      }
      footer={
        <>
          <Button
            variant="ghost"
            size="sm"
            icon={<Link2 size={14} />}
            onClick={() => copyApplyLink(orgSlug, job)}
          >
            Copy apply link
          </Button>
          <Button variant="quiet" size="sm" onClick={() => openJd(true)} loading={busy}>
            Download JD
          </Button>
          <Button size="sm" icon={<Eye size={14} />} onClick={() => openJd(false)} loading={busy}>
            View JD
          </Button>
        </>
      }
    >
      <div className="space-y-hb-6 pb-2">
        <div className="grid gap-hb-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Job type" value={JOB_TYPE_LABEL[job.job_type] || job.job_type} />
          <Fact label="Experience" value={experienceDisplay(job)} />
          <Fact label="Posted" value={formatDate(job.created_at)} />
          <Fact label="Applicants" value={job.application_count} />
        </div>

        {job.description && <Prose title="Description" body={job.description} />}
        {(job as any).responsibilities && (
          <Prose title="Key responsibilities" body={(job as any).responsibilities} />
        )}
        {job.requirements && <Prose title="Requirements" body={job.requirements} />}

        {job.skills_required?.length > 0 && (
          <section>
            <h3 className="font-display text-hb-h3 text-hb-text">Required skills</h3>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {job.skills_required.map((skill: string) => (
                <Badge key={skill}>{skill}</Badge>
              ))}
            </div>
          </section>
        )}
      </div>
    </Dialog>
  )
}

/* —— Page ——————————————————————————————————————————————————————————————————— */

export default function JobsListPage() {
  const { basePath, user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<JobStatus | null>(null)
  const [search, setSearch] = useState('')
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [linkedInJob, setLinkedInJob] = useState<Job | null>(null)
  const [closeTarget, setCloseTarget] = useState<Job | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Job | null>(null)

  const isAdmin = user?.role === 'admin'

  const { data: organization } = useQuery({
    queryKey: ['organization', 'me'],
    queryFn: () => organizationsApi.getMe().then((r: any) => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const { data, isLoading, isError } = useQuery({
    queryKey: ['jobs', page, statusFilter, search],
    queryFn: () =>
      jobsApi
        .list({
          page,
          limit: 10,
          status: statusFilter || undefined,
          search: search || undefined,
        })
        .then((r: any) => r.data),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: JobStatus }) =>
      jobsApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['recent-activities'] })
      toast.success('Status updated')
    },
    onError: () => toast.error('Failed to update status'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => jobsApi.delete(id),
    onSuccess: (_, deletedId) => {
      queryClient.setQueriesData({ queryKey: ['jobs'] }, (oldData: any) => {
        if (!oldData?.items) return oldData
        return {
          ...oldData,
          items: oldData.items.filter((job: any) => job.id !== deletedId),
          total: Math.max(0, oldData.total - 1),
        }
      })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['recent-activities'] })
      toast.success('Position deleted')
    },
    onError: () => toast.error('Failed to delete position'),
  })

  const columns: Array<Column<any>> = [
    {
      key: 'title',
      header: 'Position',
      cardTitle: true,
      width: 'minmax(0, 2fr)',
      cell: (job) => (
        <CellStack
          leading={
            <IconTile size="sm">
              <BriefcaseBusiness />
            </IconTile>
          }
          primary={job.title}
          secondary={JOB_TYPE_LABEL[job.job_type] || job.job_type}
        />
      ),
    },
    {
      key: 'location',
      header: 'Location',
      cell: (job) => (
        <span className="text-hb-muted">
          {job.is_remote ? 'Remote' : job.location || '—'}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Posted',
      cell: (job) => <span className="text-hb-muted">{formatDate(job.created_at)}</span>,
    },
    {
      key: 're_engage',
      header: 'Re-engage',
      align: 'center',
      cell: (job) =>
        job.re_engage_count > 0 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`${basePath}/talent-pool?search=${encodeURIComponent(job.title)}`)
            }}
            className="inline-flex items-center gap-1.5 rounded-hb-full border border-hb-blue/30 bg-hb-blue/10 px-2.5 py-1 font-mono text-hb-micro text-hb-blue transition-colors duration-hb hover:bg-hb-blue/20 focus-visible:outline-none focus-visible:shadow-hb-ring"
            aria-label={`${job.re_engage_count} candidates to re-engage for ${job.title}`}
          >
            <Zap size={11} aria-hidden />
            {job.re_engage_count}
          </button>
        ) : (
          <span className="text-hb-dim">0</span>
        ),
    },
    {
      key: 'application_count',
      header: 'Apps',
      align: 'center',
      cell: (job) => (
        <span className="font-mono tabular-nums text-hb-text">{job.application_count}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (job) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Select
            aria-label={`Status for ${job.title}`}
            value={job.status}
            options={STATUS_OPTIONS.map((s) => ({ ...s }))}
            onChange={(e) =>
              statusMutation.mutate({ id: job.id, status: e.target.value as JobStatus })
            }
            className="h-8 text-hb-sm"
          />
        </div>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      width: '170px',
      cell: (job) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <IconButton label="Share on LinkedIn" onClick={() => setLinkedInJob(job)}>
            <LinkedInGlyph />
          </IconButton>
          <IconButton label="Copy apply link" onClick={() => copyApplyLink(organization?.slug, job)}>
            <Link2 size={14} />
          </IconButton>

          {isAdmin && (
            <>
              <IconButton
                label={`Edit ${job.title}`}
                to={`${basePath}/jobs/${job.id}/edit`}
              >
                <Edit2 size={14} />
              </IconButton>
              {job.status === 'closed' ? (
                <IconButton label={`Delete ${job.title}`} danger onClick={() => setDeleteTarget(job)}>
                  <Trash2 size={14} />
                </IconButton>
              ) : (
                <IconButton label={`Close ${job.title}`} danger onClick={() => setCloseTarget(job)}>
                  <XCircle size={14} />
                </IconButton>
              )}
            </>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Jobs"
        title="Open positions"
        description={
          data
            ? `${data.total} position${data.total === 1 ? '' : 's'} across your organisation.`
            : "Manage your organisation's openings."
        }
        actions={
          <Button icon={<Plus size={17} />} to={`${basePath}/jobs/new`}>
            Post a position
          </Button>
        }
      />

      <Toolbar>
        <ToolbarSearch
          value={search}
          onChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          placeholder="Search by title or location..."
          aria-label="Search positions"
        />
        <FilterChips
          options={STATUS_OPTIONS.map((s) => ({ ...s }))}
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v)
            setPage(1)
          }}
        />
      </Toolbar>

      {isError ? (
        <div
          role="alert"
          className="rounded-hb-md border border-hb-error/25 bg-hb-error/8 p-4 text-hb-sm text-hb-error"
        >
          Could not load positions. Please refresh.
        </div>
      ) : (
        <>
          <DataTable
            caption="Open positions"
            columns={columns}
            rows={data?.items ?? []}
            rowKey={(job: any) => job.id}
            loading={isLoading}
            onRowClick={(job) => setSelectedJob(job)}
            empty={{
              tone: search || statusFilter ? 'no-results' : 'empty',
              icon: <BriefcaseBusiness />,
              title: search || statusFilter ? 'No positions match' : 'No positions yet',
              description:
                search || statusFilter
                  ? 'Try a different search term or clear the status filter.'
                  : 'Post your first opening and Hybent AI starts screening applicants straight away.',
              action:
                search || statusFilter
                  ? {
                      label: 'Clear filters',
                      onClick: () => {
                        setSearch('')
                        setStatusFilter(null)
                        setPage(1)
                      },
                    }
                  : { label: 'Post a position', onClick: () => navigate(`${basePath}/jobs/new`) },
            }}
          />

          {data && (
            <Pagination
              page={data.page}
              pages={data.pages}
              total={data.total}
              limit={data.limit}
              onPage={setPage}
              noun="positions"
            />
          )}
        </>
      )}

      <LinkedInShareModal job={linkedInJob} onClose={() => setLinkedInJob(null)} />

      {selectedJob && (
        <JobDetailDialog job={selectedJob} orgSlug={organization?.slug} onClose={() => setSelectedJob(null)} />
      )}

      <ConfirmDialog
        open={!!closeTarget}
        onClose={() => setCloseTarget(null)}
        onConfirm={() => {
          if (closeTarget) statusMutation.mutate({ id: closeTarget.id, status: 'closed' })
          setCloseTarget(null)
        }}
        title="Close this position?"
        description={`"${closeTarget?.title}" moves to the Closed tab. Candidates stay in your talent pool and can be re-engaged later.`}
        confirmLabel="Close position"
        destructive
        loading={statusMutation.isPending}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
          setDeleteTarget(null)
        }}
        title="Delete this position?"
        description={`"${deleteTarget?.title}" will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete position"
        destructive
        loading={deleteMutation.isPending}
      />
    </div>
  )
}

/**
 * Square icon action inside a table row.
 *
 * Local rather than exported: a row-level icon button is a table concern, and
 * promoting it invites it into toolbars, where a labelled `Button` belongs.
 * The accessible name is required â€” the old row had six unlabelled buttons.
 */
function IconButton({
  label,
  onClick,
  to,
  danger,
  children,
}: {
  label: string
  /** One of `onClick` or `to`. `to` renders a link, so Edit opens in a new tab. */
  onClick?: () => void
  to?: string
  danger?: boolean
  children: React.ReactNode
}) {
  const className =
    'grid h-8 w-8 place-items-center rounded-hb-sm border transition-colors duration-hb focus-visible:outline-none focus-visible:shadow-hb-ring ' +
    (danger
      ? 'border-hb-error/25 bg-hb-error/8 text-hb-error hover:bg-hb-error/15'
      : 'border-hb-border bg-hb-surface-2 text-hb-muted hover:text-hb-text hover:border-hb-border-strong')

  if (to) {
    return (
      <Link to={to} title={label} aria-label={label} className={className}>
        {children}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className={className}>
      {children}
    </button>
  )
}
