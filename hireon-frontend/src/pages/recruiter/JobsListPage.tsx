import { useAuth } from '@/hooks/useAuth'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { jobsApi } from '@/api/jobs'
import type { Job, JobStatus } from '@/types'
import { Skeleton } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/ui/Pagination'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { formatDate } from '@/utils/formatters'
import toast from 'react-hot-toast'

// ─── Status badge ───────────────────────────────────────────────────────────────
const STATUS_STYLE: Record<string, { color: string; bg: string; border: string; dot: string }> = {
  active:  { color: '#059669', bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.25)', dot: '#10b981' },
  draft:   { color: '#6b7280', bg: 'rgba(107,114,128,0.10)', border: 'rgba(107,114,128,0.20)', dot: '#9ca3af' },
  paused:  { color: '#d97706', bg: 'rgba(251,191,36,0.10)', border: 'rgba(251,191,36,0.25)', dot: '#fbbf24' },
  closed:  { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.20)', dot: '#ef4444' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.draft
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 700, padding: '3px 10px',
      borderRadius: 20, background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

const JOB_TYPE_LABEL: Record<string, string> = {
  full_time: 'Full-time', part_time: 'Part-time',
  contract: 'Contract', internship: 'Internship', freelance: 'Freelance',
}

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'paused', label: 'Paused' },
  { value: 'closed', label: 'Closed' },
]

// ─── Job Detail Modal ──────────────────────────────────────────────────────────

function JobDetailModal({ job, onClose, onEdit }: { job: Job; onClose: () => void; onEdit: () => void }) {
  return (
    <Modal
      open
      onClose={onClose}
      title="Position Details"
      size="lg"
      headerActions={
        job.jd_url && (
          <button
            onClick={() => window.open(job.jd_url!, '_blank')}
            className="btn-primary-gradient"
            style={{
              padding: '6px 14px',
              fontSize: 12,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 12px rgba(108,71,255,0.25)'
            }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            View JD
          </button>
        )
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Header Section */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '1px solid var(--table-border)', paddingBottom: 20 }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{
              width: 54, height: 54, borderRadius: 14,
              background: 'linear-gradient(135deg, rgba(108,71,255,0.14), rgba(139,107,255,0.06))',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
            }}>💼</div>
            <div>
              <h3 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', fontFamily: "'Fraunces', serif", marginBottom: 4 }}>{job.title}</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <StatusBadge status={job.status} />
                <span style={{ fontSize: 12, color: 'var(--text-mid)' }}>{job.location}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          <div className="glass" style={{ padding: 14, borderRadius: 12 }}>
             <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: 4 }}>Job Type</p>
             <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{JOB_TYPE_LABEL[job.job_type] || job.job_type}</p>
          </div>
          <div className="glass" style={{ padding: 14, borderRadius: 12 }}>
             <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: 4 }}>Experience</p>
             <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{job.experience_level}</p>
          </div>
          <div className="glass" style={{ padding: 14, borderRadius: 12 }}>
             <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: 4 }}>Posted</p>
             <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{formatDate(job.created_at)}</p>
          </div>
          <div className="glass" style={{ padding: 14, borderRadius: 12 }}>
             <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: 4 }}>Applicants</p>
             <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--violet)' }}>{job.application_count} Total</p>
          </div>
        </div>

        {/* Description */}
        <div>
          <h4 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>Description</h4>
          <div style={{ fontSize: 14, color: 'var(--text-mid)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
            {job.description}
          </div>
        </div>

        {/* Requirements */}
        {job.requirements && (
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>Requirements</h4>
            <div style={{ fontSize: 14, color: 'var(--text-mid)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
              {job.requirements}
            </div>
          </div>
        )}

        {/* Skills */}
        <div>
          <h4 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>Required Skills</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {job.skills_required.map(skill => (
              <span key={skill} style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20, background: 'rgba(108,71,255,0.08)', color: '#6c47ff', border: '1px solid rgba(108,71,255,0.15)' }}>
                {skill}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function JobsListPage() {
  const { basePath } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Job | null>(null)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['jobs', page, statusFilter, search],
    queryFn: () =>
      jobsApi.list({ page, limit: 10, status: statusFilter || undefined, search: search || undefined }).then((r) => r.data),
    refetchInterval: 30_000,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => jobsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      toast.success('Position deleted successfully')
      setDeleteTarget(null)
    },
    onError: () => toast.error('Failed to delete position'),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: JobStatus }) => jobsApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['recent-activities'] })
      toast.success('Status updated')
    },
    onError: () => toast.error('Failed to update status'),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1
            style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(24px,3vw,32px)', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: 4 }}
          >
            Open Positions
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-light)' }}>
            {data ? `${data.total} active position${data.total !== 1 ? 's' : ''}` : "Manage your organisation's openings"}
          </p>
        </div>
        <button
          onClick={() => navigate(`${basePath}/jobs/new`)}
          className="btn-primary-gradient"
          style={{ padding: '10px 20px', borderRadius: 12 }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Post a Position
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center w-full">
        {/* Search */}
        <div className="relative w-full sm:max-w-[400px] flex-1">
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.5, fontSize: 14 }}>🔍</span>
          <input
            placeholder="Search by title, location..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="input-base"
            style={{ paddingLeft: 36, height: 44, borderRadius: 12 }}
          />
        </div>

        {/* Status pills */}
        <div className="flex flex-wrap items-center gap-2 bg-[var(--kpi-bg)] p-1 rounded-xl border border-[var(--table-border)] text-sm">
          {STATUS_FILTERS.map(({ value, label }) => {
            const isActive = statusFilter === value
            return (
              <button
                key={label}
                onClick={() => { setStatusFilter(value); setPage(1) }}
                style={{
                  padding: '6px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  background: isActive ? 'rgba(108,71,255,0.08)' : 'transparent',
                  color: isActive ? '#6c47ff' : 'var(--text-mid)', transition: 'all 0.2s',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content Table */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: 5 }).map((_, i) => (
             <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 18, borderRadius: 14, background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
               <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
               <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                 <Skeleton className="h-4 w-44" />
                 <Skeleton className="h-3 w-32" />
               </div>
               <Skeleton className="h-6 w-20 rounded-full" />
               <Skeleton className="h-8 w-24 rounded-lg" />
             </div>
          ))}
        </div>
      ) : isError ? (
        <div style={{ borderRadius: 12, padding: 16, fontSize: 13, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.20)', color: '#ef4444' }}>
          Failed to load positions. Please refresh.
        </div>
      ) : !data?.items.length ? (
        <EmptyState
          icon={<span>💼</span>}
          title="No positions found"
          description={search || statusFilter ? 'Try changing your filters' : 'Start by posting your first opening'}
        />
      ) : (
        <>
          {/* Column headers */}
          <div className="hidden lg:grid lg:grid-cols-[2fr_1fr_1fr_80px_100px_140px] gap-3 px-5 text-[10px] font-bold text-[var(--text-light)] uppercase tracking-[0.8px]">
            <span>Position</span>
            <span>Location</span>
            <span>Posted Date</span>
            <span style={{ textAlign: 'center' }}>Apps</span>
            <span style={{ textAlign: 'center' }}>Status</span>
            <span style={{ textAlign: 'right' }}>Actions</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.items.map((job, i) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => setSelectedJob(job)}
                className="flex flex-col lg:grid lg:grid-cols-[2fr_1fr_1fr_80px_100px_140px] gap-4 lg:gap-3 items-start lg:items-center p-4 lg:px-5 lg:py-[14px] rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-[var(--shadow)] cursor-pointer transition-all duration-150"
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement
                  el.style.borderColor = 'rgba(108,71,255,0.30)'
                  el.style.boxShadow = 'var(--shadow-h)'
                  el.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement
                  el.style.borderColor = 'var(--table-border)'
                  el.style.boxShadow = 'var(--shadow)'
                  el.style.transform = 'none'
                }}
              >
                {/* Col 1 – Position (always visible) */}
                <div className="flex items-center gap-3 w-full lg:w-auto min-w-0">
                  <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 text-base" style={{ background: 'linear-gradient(135deg, rgba(108,71,255,0.1), rgba(139,107,255,0.05))' }}>💼</div>
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-[var(--violet)] mb-[2px] truncate">{job.title}</p>
                    <p className="text-[11px] text-[var(--text-light)]">{JOB_TYPE_LABEL[job.job_type] || job.job_type}</p>
                  </div>
                </div>

                {/* Col 2 – Location (desktop only) */}
                <p className="hidden lg:block text-[13px] text-[var(--text-mid)] truncate min-w-0">
                  {job.is_remote ? 'Remote' : (job.location || '—')}
                </p>

                {/* Col 3 – Posted Date (desktop only) */}
                <p className="hidden lg:block text-[12px] text-[var(--text-light)]">
                  {formatDate(job.created_at)}
                </p>

                {/* Col 4 – Applicants (desktop only) */}
                <p className="hidden lg:block text-[14px] font-bold text-[var(--text)] text-center">
                  {job.application_count}
                </p>

                {/* Col 5 – Status dropdown (desktop only) */}
                <div className="hidden lg:flex lg:justify-center" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={job.status}
                    onChange={(e) => statusMutation.mutate({ id: job.id, status: e.target.value as JobStatus })}
                    style={{
                      appearance: 'none',
                      border: `1px solid ${STATUS_STYLE[job.status]?.border ?? 'rgba(107,114,128,0.20)'}`,
                      background: STATUS_STYLE[job.status]?.bg ?? 'rgba(107,114,128,0.10)',
                      color: STATUS_STYLE[job.status]?.color ?? '#6b7280',
                      fontSize: 11, fontWeight: 700,
                      padding: '3px 10px', borderRadius: 20,
                      cursor: 'pointer',
                    }}
                  >
                    {['active', 'draft', 'paused', 'closed'].map(s => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </div>

                {/* Col 6 – Actions (always visible) */}
                <div
                  className="flex justify-end gap-2 w-full lg:w-auto mt-2 lg:mt-0 border-t border-[var(--card-border)] lg:border-none pt-3 lg:pt-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => navigate(`${basePath}/jobs/${job.id}/edit`)}
                    title="Edit Position"
                    style={{
                      width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(108,71,255,0.25)',
                      background: 'rgba(108,71,255,0.08)', color: '#6c47ff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(108,71,255,0.18)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(108,71,255,0.08)' }}
                  >
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setDeleteTarget(job)}
                    title="Delete Position"
                    style={{
                      width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(239,68,68,0.25)',
                      background: 'rgba(239,68,68,0.07)', color: '#ef4444',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.16)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.07)' }}
                  >
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                {/* Mobile-only extra info */}
                <div className="grid grid-cols-2 gap-3 w-full lg:hidden">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-[var(--text-light)] uppercase tracking-wider">Location</span>
                    <p className="text-[13px] text-[var(--text-mid)] truncate">{job.is_remote ? 'Remote' : (job.location || '—')}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-[var(--text-light)] uppercase tracking-wider">Posted Date</span>
                    <p className="text-[12px] text-[var(--text-light)]">{formatDate(job.created_at)}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-[var(--text-light)] uppercase tracking-wider">Applicants</span>
                    <p className="text-[14px] font-bold text-[var(--text)]">{job.application_count}</p>
                  </div>
                  <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[10px] font-bold text-[var(--text-light)] uppercase tracking-wider">Status</span>
                    <select
                      value={job.status}
                      onChange={(e) => statusMutation.mutate({ id: job.id, status: e.target.value as JobStatus })}
                      style={{
                        appearance: 'none',
                        border: `1px solid ${STATUS_STYLE[job.status]?.border ?? 'rgba(107,114,128,0.20)'}`,
                        background: STATUS_STYLE[job.status]?.bg ?? 'rgba(107,114,128,0.10)',
                        color: STATUS_STYLE[job.status]?.color ?? '#6b7280',
                        fontSize: 11, fontWeight: 700,
                        padding: '3px 10px', borderRadius: 20,
                        cursor: 'pointer', width: 'fit-content',
                      }}
                    >
                      {['active', 'draft', 'paused', 'closed'].map(s => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <Pagination
            page={data.page}
            pages={data.pages}
            total={data.total}
            limit={data.limit}
            onPage={setPage}
          />
        </>
      )}

      {/* Job Detail Modal */}
      {selectedJob && (
        <JobDetailModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onEdit={() => navigate(`${basePath}/jobs/${selectedJob.id}/edit`)}
        />
      )}

      {/* Delete confirm */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete Position"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmText="Delete Position"
        danger
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
