import { useAuth } from '@/hooks/useAuth'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { jobsApi } from '@/api/jobs'
import { aiApi } from '@/api/ai'
import { GlassIcon } from '@/components/common/GlassIcon'
import { 
  Plus, 
  Search, 
  MoreVertical, 
  MapPin, 
  Clock, 
  Calendar, 
  Briefcase, 
  Filter, 
  ChevronDown, 
  Zap,
  Edit2,
  XCircle,
  Eye,
  ExternalLink
} from 'lucide-react'
import type { Job, JobStatus } from '@/types'
import { Skeleton } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/ui/Pagination'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { formatDate } from '@/utils/formatters'
import toast from 'react-hot-toast'
import { LinkedInShareModal } from '@/components/recruiter/LinkedInShareModal'

// ─── Status badge ───────────────────────────────────────────────────────────────
const STATUS_STYLE: Record<string, { color: string; bg: string; border: string; dot: string }> = {
  active:  { color: 'var(--teal, #059669)', bg: 'var(--teal-10)', border: 'var(--teal-25)', dot: 'var(--teal, #10b981)' },
  draft:   { color: 'var(--text-light)', bg: 'var(--color-bg-sidebar)', border: 'var(--color-border)', dot: '#9ca3af' },
  paused:  { color: '#d97706', bg: 'var(--amber-10)', border: 'var(--amber-25)', dot: '#fbbf24' },
  closed:  { color: '#ef4444', bg: 'var(--danger-10)', border: 'var(--danger-25)', dot: '#ef4444' },
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

const getExperienceDisplay = (job: Job) => {
  const levelLabels: Record<string, string> = {
    entry: 'Entry Level',
    mid: 'Mid Level',
    senior: 'Senior',
    lead: 'Lead / Principal',
    director: 'Director+',
  }

  const parts: string[] = []
  if (job.min_experience_years != null && job.min_experience_years > 0) {
    parts.push(`${job.min_experience_years}+ years`)
  }

  if (job.experience_level) {
    const normalized = job.experience_level.toLowerCase().trim()
    const friendlyLevel = levelLabels[normalized] || job.experience_level
    parts.push(friendlyLevel)
  }

  return parts.join(' - ') || 'Not specified'
}

// ─── Job Detail Modal ──────────────────────────────────────────────────────────

function JobDetailModal({ job, onClose, onEdit }: { job: Job; onClose: () => void; onEdit: () => void }) {
  const [isExporting, setIsExporting] = useState(false)

  const handleDownloadPDF = async () => {
    if (job.jd_url) {
      window.open(job.jd_url, '_blank')
      return
    }

    try {
      setIsExporting(true)
      const jdData = {
        title: job.title,
        location: job.location || 'Remote',
        experience: getExperienceDisplay(job),
        key_responsibilities: job.requirements ? job.requirements.split('\n') : [],
        required_qualifications_skills: job.skills_required,
        good_to_have: [],
        description: job.description
      }
      const res = await aiApi.exportJDPDF(jdData)
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `JD_${job.title.replace(/\s+/g, '_')}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success('JD PDF generated successfully!')
    } catch (err) {
      console.error(err)
      toast.error('Failed to generate PDF.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Position Details"
      size="lg"
      headerActions={
        <button
          type="button"
          onClick={handleDownloadPDF}
          disabled={isExporting}
          className="btn-primary-gradient"
          style={{
            padding: '6px 14px',
            fontSize: 12,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 4px 12px rgba(167, 139, 250, 0.25)',
            opacity: isExporting ? 0.7 : 1
          }}
        >
          <Eye size={14} />
          {isExporting ? 'Generating...' : 'View JD'}
        </button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Header Section */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '1px solid var(--table-border)', paddingBottom: 20 }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{
              width: 54, height: 54, borderRadius: 14,
              background: 'linear-gradient(135deg, var(--violet-10), var(--violet-25))',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
            }}><GlassIcon icon="Briefcase" variant="violet" size={40} iconSize={18} /></div>
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
          <div style={{ padding: 14, borderRadius: 12, border: '1px solid #e5e7eb', background: 'var(--card-bg)' }}>
             <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: 4 }}>Job Type</p>
             <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{JOB_TYPE_LABEL[job.job_type] || job.job_type}</p>
          </div>
          <div style={{ padding: 14, borderRadius: 12, border: '1px solid #e5e7eb', background: 'var(--card-bg)' }}>
             <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: 4 }}>Experience</p>
             <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{getExperienceDisplay(job)}</p>
          </div>
          <div style={{ padding: 14, borderRadius: 12, border: '1px solid #e5e7eb', background: 'var(--card-bg)' }}>
             <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: 4 }}>Posted</p>
             <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{formatDate(job.created_at)}</p>
          </div>
          <div style={{ padding: 14, borderRadius: 12, border: '1px solid #e5e7eb', background: 'var(--card-bg)' }}>
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
            <div className="flex flex-wrap gap-1.5 mt-2">
              {job.skills_required.map((skill: any) => (
                <span key={skill} className="px-3 py-1 bg-white/50 dark:bg-[var(--color-bg-sidebar)] rounded-lg text-[10px] font-bold text-gray-500 uppercase tracking-wider border border-gray-100 dark:border-[var(--card-border)]">
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
  const { basePath, user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [closeTarget, setCloseTarget] = useState<Job | null>(null)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [linkedInJob, setLinkedInJob] = useState<Job | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['jobs', page, statusFilter, search],
    queryFn: () =>
      jobsApi.list({ page, limit: 10, status: statusFilter || undefined, search: search || undefined }).then((r: any) => r.data),
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
          style={{ padding: '10px 20px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 7 }}
        >
          <Plus size={18} /> Post a Position
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center w-full">
        {/* Search */}
        <div className="relative w-full sm:max-w-[400px] flex-1">
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>
            <Search size={14} />
          </span>
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
                  background: isActive ? 'var(--violet-10)' : 'transparent',
                  color: isActive ? 'var(--violet)' : 'var(--text-mid)', transition: 'all 0.2s',
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
          icon={<GlassIcon icon="Briefcase" variant="violet" size={60} iconSize={28} />}
          title="No positions found"
          description={search || statusFilter ? 'Try changing your filters' : 'Start by posting your first opening'}
        />
      ) : (
        <>
          {/* Column headers */}
          <div className="hidden lg:grid lg:grid-cols-[2fr_1fr_1fr_100px_90px_100px_140px] gap-3 px-5 text-[10px] font-bold text-[var(--text-light)] uppercase tracking-[0.8px]">
            <span>Position</span>
            <span>Location</span>
            <span>Posted Date</span>
            <span style={{ textAlign: 'center' }}>Re-engage</span>
            <span style={{ textAlign: 'center' }}>Apps</span>
            <span style={{ textAlign: 'center' }}>Status</span>
            {user?.role === 'admin' && <span style={{ textAlign: 'right' }}>Actions</span>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.items.map((job: any, i: number) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => setSelectedJob(job)}
                className="flex flex-col lg:grid lg:grid-cols-[2fr_1fr_1fr_100px_90px_100px_140px] gap-4 lg:gap-3 items-start lg:items-center p-4 lg:px-5 lg:py-[14px] rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-[var(--shadow)] cursor-pointer transition-all duration-150"
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement
                  el.style.borderColor = 'var(--violet)'
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
                  <div className="shrink-0 flex items-center justify-center">
                    <GlassIcon icon="Briefcase" variant="violet" size={36} iconSize={16} rounded="10px" />
                  </div>
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

                {/* Col 4 – Re-engage (desktop only) */}
                <div className="hidden lg:flex lg:justify-center" onClick={(e) => e.stopPropagation()}>
                  {job.re_engage_count > 0 ? (
                      <button
                        onClick={() => navigate(`${basePath}/talent-pool?search=${encodeURIComponent(job.title)}`)}
                        style={{
                          padding: '3px 10px',
                          borderRadius: 20,
                          background: 'var(--violet-10)',
                          color: 'var(--violet)',
                          fontSize: 11,
                          fontWeight: 700,
                          border: '1px solid var(--violet-25)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--violet)/20'
                          e.currentTarget.style.transform = 'scale(1.05)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'var(--violet)/10'
                          e.currentTarget.style.transform = 'scale(1)'
                        }}
                      >
                      <Zap size={11} fill="currentColor" />
                      {job.re_engage_count}
                    </button>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--text-light)', opacity: 0.5 }}>0</span>
                  )}
                </div>

                {/* Col 5 – Applicants (desktop only) */}
                <p className="hidden lg:block text-[14px] font-bold text-[var(--text)] text-center">
                  {job.application_count}
                </p>

                {/* Col 6 – Status dropdown (desktop only) */}
                <div className="hidden lg:flex lg:justify-center" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={job.status}
                    onChange={(e) => statusMutation.mutate({ id: job.id, status: e.target.value as JobStatus })}
                    style={{
                      appearance: 'none',
                      border: `1px solid ${STATUS_STYLE[job.status]?.border ?? 'rgba(107,114,128,0.20)'}`,
                      background: STATUS_STYLE[job.status]?.bg ?? 'rgba(107,114,128,0.10)',
                      color: STATUS_STYLE[job.status]?.color ?? 'var(--text-light)',
                      fontSize: 11, fontWeight: 700,
                      padding: '3px 10px', borderRadius: 20,
                      cursor: 'pointer',
                    }}
                  >
                    {['active', 'draft', 'paused', 'closed'].map((s: any) => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </div>

                {/* Col 7 – Actions (Admin can Edit/Delete, Admin+Recruiter can Share) */}
                <div
                  className="flex justify-end gap-2 w-full lg:w-auto mt-2 lg:mt-0 border-t border-[var(--card-border)] lg:border-none pt-3 lg:pt-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* LinkedIn Share — visible to admin + recruiter */}
                  <button
                    onClick={() => setLinkedInJob(job)}
                    title="Share on LinkedIn"
                    style={{
                      width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(0,119,181,0.30)',
                      background: 'rgba(0,119,181,0.09)', color: '#0077b5',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,119,181,0.20)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,119,181,0.09)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  </button>

                  {user?.role === 'admin' && (
                    <>
                      <button
                        onClick={() => navigate(`${basePath}/jobs/${job.id}/edit`)}
                        title="Edit Position"
                        style={{
                          width: 32, height: 32, borderRadius: 8, border: '1px solid var(--violet)/25',
                          background: 'var(--violet)/10', color: 'var(--violet)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--violet)/20' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--violet)/10' }}
                      >
                        <Edit2 size={14} />
                      </button>
                      {job.status !== 'closed' && (
                        <button
                          onClick={() => setCloseTarget(job)}
                          title="Close Position"
                          style={{
                            width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(239,68,68,0.25)',
                            background: 'rgba(239,68,68,0.07)', color: '#ef4444',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.16)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.07)' }}
                        >
                          <XCircle size={14} />
                        </button>
                      )}
                    </>
                  )}
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
                    <span className="text-[10px] font-bold text-[var(--text-light)] uppercase tracking-wider">Re-engage</span>
                    {job.re_engage_count > 0 ? (
                      <button
                        onClick={() => navigate(`${basePath}/talent-pool?search=${encodeURIComponent(job.title)}`)}
                        style={{
                          padding: '2px 8px',
                          borderRadius: 20,
                          background: 'var(--violet)/10',
                          color: 'var(--violet)',
                          fontSize: 10,
                          fontWeight: 700,
                          border: '1px solid var(--violet)/20',
                          width: 'fit-content',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <Zap size={10} fill="currentColor" /> {job.re_engage_count}
                      </button>
                    ) : (
                      <p className="text-[12px] text-[var(--text-light)] opacity-50">0</p>
                    )}
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
                        color: STATUS_STYLE[job.status]?.color ?? 'var(--text-light)',
                        fontSize: 11, fontWeight: 700,
                        padding: '3px 10px', borderRadius: 20,
                        cursor: 'pointer', width: 'fit-content',
                      }}
                    >
                      {['active', 'draft', 'paused', 'closed'].map((s: any) => (
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

      {/* LinkedIn Share Modal */}
      <LinkedInShareModal
        job={linkedInJob}
        onClose={() => setLinkedInJob(null)}
      />

      {/* Job Detail Modal */}
      {selectedJob && (
        <JobDetailModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onEdit={() => navigate(`${basePath}/jobs/${selectedJob.id}/edit`)}
        />
      )}

      {/* Close confirm */}
      <ConfirmModal
        open={!!closeTarget}
        onClose={() => setCloseTarget(null)}
        onConfirm={() => {
          if (closeTarget) {
            statusMutation.mutate({ id: closeTarget.id, status: 'closed' })
            setCloseTarget(null)
          }
        }}
        title="Close Position"
        message={`Are you sure you want to close "${closeTarget?.title}"? It will be moved to the Closed tab and candidates will remain in the Talent Pool.`}
        confirmText="Close Position"
        danger
        loading={statusMutation.isPending}
      />
    </div>
  )
}
