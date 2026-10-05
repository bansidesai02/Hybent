import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  Check,
  Clock3,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { superAdminApi } from '@/api/superAdmin'
import { talentPoolApi } from '@/api/talentPool'
import { candidatesApi } from '@/api/candidates'
import { jobsApi } from '@/api/jobs'
import { adminApi } from '@/api/admin'
import { designationsApi, type DesignationItem } from '@/api/designations'
import { useNotificationStore } from '@/store/notificationStore'
import { formatCandidateDate, formatExperience } from '@/utils/formatters'
import type { Candidate } from '@/types'
import type { ImportResultData } from '@/api/bulkImport'

import { CandidateProfileView } from '@/modules/recruiter/components/CandidateProfileView'
import { CandidateActionsPanel } from '@/modules/recruiter/components/CandidateActionsPanel'
import { BulkImportModal } from '@/modules/recruiter/components/BulkImportModal'
import { BulkImportHistoryModal } from '@/modules/recruiter/components/BulkImportHistoryModal'
import { STATUS_TABS, isRejectionStage, statusFromStage } from '@/modules/recruiter/pipeline'
import {
  Avatar,
  Button,
  Card,
  ConfirmDialog,
  ContextMenu,
  Dialog,
  Drawer,
  EmptyState,
  Input,
  PageHeader,
  Pagination,
  Select,
  Skeleton,
  StatusPill,
  Toolbar,
  ToolbarSearch,
  ToolbarFilters,
} from '@/components/hb'

/**
 * The full talent database.
 *
 * Rebuilt on the design system in phase 6. What changed beyond appearance:
 *
 * - The row-actions dropdown is a `Drawer`. Its predecessor carried sixty lines
 *   of viewport arithmetic — measure, flip up or down, flip left or right,
 *   recompute on scroll and resize through a `ResizeObserver` — purely to avoid
 *   being clipped by the card grid. A portal needs none of that.
 * - "Already in the pipeline" was decided by `Boolean(STAGE_CFG[stage])`, which
 *   is true for *any* known stage — including `rejected` and `inactive`. A
 *   rejected candidate therefore showed as already in the pipeline and could
 *   never be re-added. It now uses `isCandidateInActivePipeline`.
 * - `?search=` is read from the URL, so the talent-pool page can hand a search
 *   term across.
 *
 * A 50-line commented-out "Saved views & alerts" bar was deleted along with its
 * three handlers. Its localStorage-backed alert thresholds are still read by
 * the alert monitor below — see the note there.
 */

const DATE_OPTIONS = [
  { value: 'all', label: 'Any date' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom range…' },
]

function dateParams(filter: string, custom: [string, string]) {
  const now = new Date()
  if (filter === 'today') return { date_from: new Date(now.setHours(0, 0, 0, 0)).toISOString() }
  if (filter === 'week') {
    const d = new Date(now)
    d.setDate(d.getDate() - 7)
    return { date_from: d.toISOString() }
  }
  if (filter === 'month') {
    const d = new Date(now)
    d.setMonth(d.getMonth() - 1)
    return { date_from: d.toISOString() }
  }
  if (filter === 'custom' && custom[0]) {
    const from = new Date(custom[0]).toISOString()
    if (!custom[1]) return { date_from: from, date_to: from }
    const end = new Date(custom[1])
    end.setHours(23, 59, 59, 999)
    return { date_from: from, date_to: end.toISOString() }
  }
  return {}
}

/** One labelled row inside a candidate card. */
function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-hb-xs text-hb-muted">{label}</span>
      <span className="min-w-0 truncate text-right text-hb-sm font-medium text-hb-text">
        {value}
      </span>
    </div>
  )
}

export default function AllTalentListPage() {
  const { basePath, user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()

  /* ── Filters ── */
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [recruiterId, setRecruiterId] = useState('all')
  const [selectedJobId, setSelectedJobId] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [customDateRange, setCustomDateRange] = useState<[string, string]>(['', ''])
  const [recruiters, setRecruiters] = useState<Array<{ id: string; name: string }>>([])

  /* ── Overlays ── */
  const [actionsTarget, setActionsTarget] = useState<any | null>(null)
  const [viewTarget, setViewTarget] = useState<Candidate | null>(null)
  const [designationTarget, setDesignationTarget] = useState<Candidate | null>(null)
  const [designationSearch, setDesignationSearch] = useState('')
  const [pendingDesignation, setPendingDesignation] = useState<DesignationItem | null>(null)
  const [candidateToDelete, setCandidateToDelete] = useState<{ id: string; name: string } | null>(null)

  const [showAddDesignation, setShowAddDesignation] = useState(false)
  const [newJobTitle, setNewJobTitle] = useState('')
  const [isCreatingJob, setIsCreatingJob] = useState(false)

  const [renameTarget, setRenameTarget] = useState<{ job: any; title: string } | null>(null)
  const [isRenamingJob, setIsRenamingJob] = useState(false)
  const [jobToDelete, setJobToDelete] = useState<any | null>(null)
  const [isDeletingJob, setIsDeletingJob] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; job: any } | null>(null)

  const [showBulkImport, setShowBulkImport] = useState(false)
  const [showImportHistory, setShowImportHistory] = useState(false)

  const isAdmin = user?.role === 'admin'
  const newJobInputRef = useRef<HTMLInputElement>(null)

  /* ── Data ── */
  const { data: globalFlags } = useQuery({
    queryKey: ['super-admin', 'global-flags'],
    queryFn: () => superAdminApi.getGlobalFlags(),
  })
  const bulkEnabled = !!globalFlags?.bulk

  useEffect(() => {
    adminApi
      .listUsers()
      .then((res: any) =>
        setRecruiters(
          res.data
            .filter((u: any) => u.role !== 'candidate')
            .map((u: any) => ({ id: u.id, name: u.full_name }))
        )
      )
      .catch((err: any) => console.error('Failed to fetch recruiters', err))
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: [
      'all-talent-full',
      page,
      search,
      statusFilter,
      recruiterId,
      selectedJobId,
      dateFilter,
      customDateRange,
    ],
    queryFn: () =>
      talentPoolApi
        .list({
          page,
          limit: 50,
          search: search || undefined,
          status: statusFilter,
          created_by_id: recruiterId !== 'all' ? recruiterId : undefined,
          job_id: selectedJobId !== 'all' ? selectedJobId : undefined,
          ...dateParams(dateFilter, customDateRange),
        })
        .then((r) => r.data),
  })

  const { data: talentStats } = useQuery({
    queryKey: ['talent-pool-stats'],
    queryFn: () => talentPoolApi.getStats().then((r) => r.data),
  })

  const { data: designationData } = useQuery({
    queryKey: ['designations'],
    queryFn: () => designationsApi.list().then((r: any) => r.data),
  })

  const { data: userPrefData } = useQuery({
    queryKey: ['user-preference-order', user?.id],
    queryFn: () =>
      user?.id ? adminApi.getDesignationOrder(user.id).then((r: any) => r.data) : { order: [] },
    enabled: !!user?.id,
  })

  const { data: allJobs } = useQuery({
    queryKey: ['jobs', 'all-for-filters'],
    queryFn: () => jobsApi.list({ limit: 100, include_pool: true }).then((r: any) => r.data.items),
  })
  const activeJobs = allJobs?.filter((j: any) => j.status === 'active') ?? []

  /* Backend order wins; a locally-dragged order covers the gap before it syncs. */
  const designations = useMemo(() => {
    const items = (designationData?.items ?? []) as DesignationItem[]
    let saved: string[] = userPrefData?.order ?? []
    if (saved.length === 0 && user?.id) {
      try {
        saved = JSON.parse(localStorage.getItem(`designation_order_${user.id}`) || '[]')
      } catch {
        saved = []
      }
    }
    if (saved.length === 0) {
      return [...items].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    }
    const rank = new Map(saved.map((id, i) => [id, i]))
    return [...items].sort((a, b) => {
      const ra = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER
      const rb = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER
      return ra !== rb ? ra - rb : (a.display_order ?? 0) - (b.display_order ?? 0)
    })
  }, [designationData?.items, userPrefData?.order, user?.id])

  const designationCounts = (designationData?.designation_counts ?? {}) as Record<string, number>
  const items = data?.items ?? []
  const totalCandidates = talentStats?.total_candidates ?? data?.total_candidates ?? 0

  /* ── Alert monitor ──
     Raises an in-app notification the first time a candidate crosses the match
     threshold or reaches an offer stage. The thresholds live in localStorage
     and are read here; the UI that set them was commented out before this
     rewrite, so they sit at their defaults until that control comes back. */
  useEffect(() => {
    if (!items.length) return

    const threshold = parseInt(localStorage.getItem('hybent_hiring_alert_match_threshold') || '85', 10)
    const alertOnOffer = localStorage.getItem('hybent_hiring_alert_on_offer') !== 'false'

    let notified: Set<string>
    try {
      notified = new Set<string>(
        JSON.parse(localStorage.getItem('hybent_hiring_notified_candidate_ids') || '[]')
      )
    } catch {
      notified = new Set()
    }

    let changed = false

    items.forEach((candidate: any) => {
      if (notified.has(candidate.id)) return

      const score = candidate.match_score ?? candidate.parsed_data?.match_score ?? 0
      const stage = (candidate.pipeline_stage || '').toLowerCase()
      const isOffer = ['offered', 'offer', 'hired_joined'].includes(stage)

      const byScore = score >= threshold
      const byOffer = alertOnOffer && isOffer
      if (!byScore && !byOffer) return

      notified.add(candidate.id)
      changed = true

      const title = byOffer ? 'Offer stage reached' : 'High match score'
      const message = byOffer
        ? `${candidate.full_name} has entered the offer stage.`
        : `${candidate.full_name} matches at ${score}%.`

      useNotificationStore.getState().addNotification({
        id: crypto.randomUUID(),
        organization_id: '',
        user_id: '',
        type: 'system',
        title,
        message,
        data: null,
        is_read: false,
        read_at: null,
        created_at: new Date().toISOString(),
      })

      /* The shared toast, not a bespoke card — this page used to render its own
         ring-1 white panel with an emoji, which matched nothing else. */
      toast.success(`${title} — ${message}`, { duration: 5000 })
    })

    if (changed) {
      localStorage.setItem(
        'hybent_hiring_notified_candidate_ids',
        JSON.stringify(Array.from(notified))
      )
    }
  }, [items])

  /* ── Mutations ── */
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['all-talent-full'] })
    queryClient.invalidateQueries({ queryKey: ['candidates'] })
    queryClient.invalidateQueries({ queryKey: ['designations'] })
    queryClient.invalidateQueries({ queryKey: ['talent-pool-stats'] })
  }

  const stageMutation = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) =>
      candidatesApi.updateStage(id, stage, isRejectionStage(stage)),
    onSuccess: () => {
      invalidateAll()
      toast.success('Stage updated')
      setActionsTarget(null)
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to update stage'),
  })

  const inviteMutation = useMutation({
    mutationFn: (payload: { email: string; full_name: string }) => candidatesApi.invite(payload),
    onSuccess: (_, v) => {
      toast.success(`Invitation sent to ${v.full_name}`)
      invalidateAll()
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to send invite'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => candidatesApi.delete(id),
    onSuccess: () => {
      invalidateAll()
      toast.success('Candidate deleted')
    },
    onError: () => toast.error('Failed to delete candidate'),
  })

  const transferMutation = useMutation({
    mutationFn: ({ candidateId, designationId }: { candidateId: string; designationId: string }) =>
      candidatesApi.updateDesignation(candidateId, designationId),
    onMutate: async ({ candidateId, designationId }) => {
      await queryClient.cancelQueries({ queryKey: ['all-talent-full'] })
      await queryClient.cancelQueries({ queryKey: ['designations'] })

      const previousCandidates = queryClient.getQueryData(['all-talent-full'])
      const previousDesignations = queryClient.getQueryData(['designations'])
      const next = designations.find((d) => d.id === designationId)

      if (next) {
        queryClient.setQueryData(['all-talent-full'], (old: any) => {
          if (!old?.items) return old
          return {
            ...old,
            items: old.items.map((c: any) =>
              c.id === candidateId
                ? { ...c, designation_id: designationId, applied_job_title: next.title }
                : c
            ),
          }
        })
      }
      return { previousCandidates, previousDesignations }
    },
    onSuccess: (res: any) => {
      if (res?.data) {
        queryClient.setQueryData(['designations'], {
          items: res.data.designations ?? [],
          designation_counts: res.data.designation_counts ?? {},
          total_candidates: res.data.total_candidates ?? totalCandidates,
        })
      }
      invalidateAll()
      setDesignationTarget(null)
      setPendingDesignation(null)
      setDesignationSearch('')
      toast.success('Designation updated')
    },
    onError: (err: any, _v, context: any) => {
      if (context) {
        queryClient.setQueryData(['all-talent-full'], context.previousCandidates)
        queryClient.setQueryData(['designations'], context.previousDesignations)
      }
      toast.error(err.response?.data?.message || 'Failed to move candidate')
    },
  })

  /* ── Designation CRUD ── */
  const createDesignation = async () => {
    const title = newJobTitle.trim()
    if (!title) return
    setIsCreatingJob(true)
    try {
      const res = await jobsApi.create({
        title,
        status: 'pool',
        openings: 0,
        description: title,
        job_type: 'full_time',
      })
      toast.success(`Designation "${title}" added`)
      setNewJobTitle('')
      setShowAddDesignation(false)
      queryClient.invalidateQueries({ queryKey: ['jobs', 'all-for-filters'] })
      invalidateAll()
      const created = (res as any).data
      if (created?.id) setSelectedJobId(created.id)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create the designation')
    } finally {
      setIsCreatingJob(false)
    }
  }

  const renameDesignation = async () => {
    if (!renameTarget?.title.trim()) return
    setIsRenamingJob(true)
    try {
      await jobsApi.update(renameTarget.job.id, { title: renameTarget.title.trim() })
      toast.success(`Renamed to "${renameTarget.title.trim()}"`)
      queryClient.invalidateQueries({ queryKey: ['jobs', 'all-for-filters'] })
      invalidateAll()
      setRenameTarget(null)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to rename')
    } finally {
      setIsRenamingJob(false)
    }
  }

  const deleteDesignation = async () => {
    if (!jobToDelete) return
    setIsDeletingJob(true)
    try {
      await designationsApi.delete(jobToDelete.id)
      toast.success(`"${jobToDelete.title}" deleted`)
      if (selectedJobId === jobToDelete.id) setSelectedJobId('all')
      queryClient.invalidateQueries({ queryKey: ['jobs', 'all-for-filters'] })
      invalidateAll()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete')
    } finally {
      setIsDeletingJob(false)
      setContextMenu(null)
      setJobToDelete(null)
    }
  }

  const reorderDesignations = async (result: DropResult) => {
    if (!result.destination || result.source.index === result.destination.index) return

    const reordered = Array.from(designations)
    const [moved] = reordered.splice(result.source.index, 1)
    if (!moved) return
    reordered.splice(result.destination.index, 0, moved)
    const order = reordered.map((d) => d.id)

    if (user?.id) localStorage.setItem(`designation_order_${user.id}`, JSON.stringify(order))
    queryClient.setQueryData(['user-preference-order', user?.id], { order })

    const previous = queryClient.getQueryData<any>(['designations'])
    queryClient.setQueryData(['designations'], {
      ...(previous ?? {}),
      items: reordered.map((d, i) => ({ ...d, display_order: i })),
    })

    try {
      if (user?.id) await adminApi.updateDesignationOrder(user.id, order)
      const res = await designationsApi.reorder(order)
      queryClient.setQueryData(['designations'], res.data)
      toast.success('Designation order saved')
    } catch (err: any) {
      queryClient.setQueryData(['designations'], previous)
      toast.error(err.response?.data?.message || 'Failed to reorder designations')
    }
  }

  /* ── Pipeline entry ── */
  const normalize = (v?: string | null) =>
    (v || '').toLowerCase().replace(/[^a-z0-9+#.\s]/g, ' ').replace(/\s+/g, ' ').trim()

  const resolveJobForCandidate = (candidate: any): string | null => {
    if (!activeJobs.length) return null
    const roles = [
      candidate?.applied_job_title,
      candidate?.current_title,
      candidate?.parsed_data?.current_title,
      candidate?.parsed_data?.role,
    ]
      .map((r) => normalize(typeof r === 'string' ? r : ''))
      .filter(Boolean)

    const exact = activeJobs.find((j: any) => roles.includes(normalize(j.title)))
    if (exact?.id) return exact.id

    const partial = activeJobs.find((j: any) => {
      const jt = normalize(j.title)
      return roles.some((r) => r.includes(jt) || jt.includes(r))
    })
    return partial?.id ?? null
  }

  const addToPipelineMutation = useMutation({
    mutationFn: ({ candidate, jobId }: { candidate: any; jobId: string }) =>
      candidatesApi.updateStage(candidate.id, 'applied', false, jobId),
    onSuccess: () => {
      toast.success('Added to pipeline')
      invalidateAll()
    },
    onError: () => toast.error('Failed to add to pipeline'),
  })

  const addToPipeline = (candidate: any) => {
    if (addToPipelineMutation.isPending) return
    const jobId = resolveJobForCandidate(candidate)
    if (!jobId) {
      toast.error('No active job matches this candidate’s role. Pick a designation first.')
      return
    }
    addToPipelineMutation.mutate({ candidate, jobId })
  }

  const currentDesignationTitle =
    designationTarget?.applied_job_title || designationTarget?.current_title || ''
  const filteredDesignations = designations.filter((d) =>
    d.title.toLowerCase().includes(designationSearch.trim().toLowerCase())
  )

  const hasFilters =
    !!search || !!statusFilter || recruiterId !== 'all' || selectedJobId !== 'all' || dateFilter !== 'all'

  const resetFilters = () => {
    setSearch('')
    setStatusFilter(undefined)
    setRecruiterId('all')
    setSelectedJobId('all')
    setDateFilter('all')
    setPage(1)
  }

  const guardBulk = (run: () => void) => () => {
    if (!bulkEnabled) {
      toast.error('Bulk import is disabled for your organisation. Contact your administrator.')
      return
    }
    run()
  }

  return (
    <div className="pb-hb-10">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-3 inline-flex items-center gap-1.5 text-hb-sm text-hb-muted transition-colors duration-hb hover:text-hb-text focus-visible:outline-none focus-visible:shadow-hb-ring"
      >
        <ArrowLeft size={15} aria-hidden />
        Back
      </button>

      <PageHeader
        eyebrow="Talent"
        title="All talent"
        description={`${totalCandidates.toLocaleString()} candidate${totalCandidates === 1 ? '' : 's'} assessed across every designation.`}
        actions={
          <>
            <Button
              icon={bulkEnabled ? <Upload size={16} /> : <Lock size={16} />}
              disabled={!bulkEnabled}
              title={bulkEnabled ? 'Import candidates' : 'Bulk import is disabled for your organisation'}
              onClick={guardBulk(() => setShowBulkImport(true))}
            >
              Import candidates
            </Button>
            <Button
              variant="ghost"
              icon={<Clock3 size={15} />}
              disabled={!bulkEnabled}
              onClick={guardBulk(() => setShowImportHistory(true))}
            >
              Import history
            </Button>
          </>
        }
      />

      <Toolbar className="items-end">
        <ToolbarSearch
          value={search}
          onChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          placeholder="Search by name, skill or role…"
          aria-label="Search all talent"
        />
        <ToolbarFilters activeCount={[recruiterId !== 'all', statusFilter != null && statusFilter !== 'all', dateFilter !== 'all'].filter(Boolean).length} onReset={() => { setRecruiterId('all'); setStatusFilter(undefined); setDateFilter('all') }}>

        <Select
          label="Added by"
          aria-label="Filter by recruiter"
          value={recruiterId}
          onChange={(e) => {
            setRecruiterId(e.target.value)
            setPage(1)
          }}
          options={[
            { value: 'all', label: 'All recruiters' },
            ...recruiters.map((r) => ({ value: r.id, label: r.name })),
          ]}
          fieldClassName="w-[168px]"
        />

        <Select
          label="Status"
          aria-label="Filter by status"
          value={statusFilter ?? 'all'}
          onChange={(e) => {
            setStatusFilter(e.target.value === 'all' ? undefined : e.target.value)
            setPage(1)
          }}
          options={[{ value: 'all', label: 'All statuses' }, ...STATUS_TABS]}
          fieldClassName="w-[150px]"
        />

        <Select
          label="Applied"
          aria-label="Filter by date"
          value={dateFilter}
          onChange={(e) => {
            setDateFilter(e.target.value)
            setPage(1)
          }}
          options={DATE_OPTIONS}
          fieldClassName="w-[150px]"
        />

        {dateFilter === 'custom' && (
          <>
            <Input
              label="From"
              type="date"
              aria-label="From date"
              value={customDateRange[0]}
              onChange={(e) => {
                setCustomDateRange([e.target.value, customDateRange[1]])
                setPage(1)
              }}
              fieldClassName="w-[152px]"
            />
            <Input
              label="To"
              type="date"
              aria-label="To date"
              value={customDateRange[1]}
              min={customDateRange[0] || undefined}
              onChange={(e) => {
                setCustomDateRange([customDateRange[0], e.target.value])
                setPage(1)
              }}
              fieldClassName="w-[152px]"
            />
          </>
        )}
        </ToolbarFilters>
      </Toolbar>

      {/* ── Designation tabs ──
          Draggable to reorder; right-click for rename and delete. */}
      <div className="mb-hb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setShowAddDesignation(true)
            setTimeout(() => newJobInputRef.current?.focus(), 60)
          }}
          aria-label="Add a designation"
          title="Add a designation"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-hb-full border border-dashed border-hb-border-strong text-hb-dim transition-colors duration-hb hover:border-hb-blue/40 hover:text-hb-blue focus-visible:outline-none focus-visible:shadow-hb-ring"
        >
          <Plus size={15} aria-hidden />
        </button>

        <button
          type="button"
          onClick={() => {
            setSelectedJobId('all')
            setPage(1)
          }}
          aria-pressed={selectedJobId === 'all'}
          className={
            'inline-flex h-8 shrink-0 items-center rounded-hb-full border px-3.5 text-hb-sm font-semibold transition-all duration-hb ' +
            (selectedJobId === 'all'
              ? 'border-hb-blue/40 bg-hb-blue/10 text-hb-blue'
              : 'border-hb-border bg-hb-surface text-hb-muted hover:border-hb-border-strong hover:text-hb-text')
          }
        >
          All
        </button>

        <DragDropContext onDragEnd={reorderDesignations}>
          <Droppable droppableId="designations" direction="horizontal">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {designations.map((job: any, index: number) => {
                  const active = selectedJobId === job.id
                  const count = job.candidate_count ?? designationCounts[job.title] ?? 0
                  return (
                    <Draggable key={job.id} draggableId={job.id} index={index}>
                      {(drag, snapshot) => (
                        <div
                          ref={drag.innerRef}
                          {...drag.draggableProps}
                          style={drag.draggableProps.style}
                          className={
                            'group/chip inline-flex h-8 shrink-0 items-center rounded-hb-full border text-hb-sm font-semibold transition-colors duration-hb ' +
                            (active
                              ? 'border-hb-blue/40 bg-hb-blue/10 text-hb-blue'
                              : 'border-hb-border bg-hb-surface text-hb-muted hover:border-hb-border-strong hover:text-hb-text') +
                            (snapshot.isDragging ? ' shadow-hb-2' : '')
                          }
                        >
                          <button
                            {...drag.dragHandleProps}
                            type="button"
                            aria-pressed={active}
                            onClick={() => {
                              setSelectedJobId(job.id)
                              setPage(1)
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault()
                              setContextMenu({ x: e.clientX, y: e.clientY, job })
                            }}
                            className={
                              'inline-flex h-full items-center gap-1.5 rounded-hb-full pl-3.5 focus-visible:outline-none focus-visible:shadow-hb-ring ' +
                              (active ? 'pr-1' : 'pr-3.5')
                            }
                          >
                            {job.title}
                            <span className="font-mono text-hb-micro opacity-70">{count}</span>
                          </button>
                          {/* Delete sits on the selected chip (and on hover), so it's
                              findable without right-click and works on touch. */}
                          <button
                            type="button"
                            onClick={() => setJobToDelete(job)}
                            aria-label={`Delete ${job.title}`}
                            title={`Delete ${job.title}`}
                            className={
                              'mr-1 grid h-6 w-6 place-items-center rounded-hb-full text-hb-dim transition-colors duration-hb hover:bg-hb-error/10 hover:text-hb-error focus-visible:outline-none focus-visible:shadow-hb-ring ' +
                              (active ? '' : 'hidden group-hover/chip:grid group-focus-within/chip:grid')
                            }
                          >
                            <X size={13} aria-hidden />
                          </button>
                        </div>
                      )}
                    </Draggable>
                  )
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      {/* ── Cards ── */}
      {isLoading ? (
        <div className="grid gap-hb-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 min-[1380px]:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="h-[300px] w-full" rounded="md" />
          ))}
        </div>
      ) : !items.length ? (
        <Card padding="none">
          <EmptyState
            tone={hasFilters ? 'no-results' : 'empty'}
            icon={<Users />}
            title={hasFilters ? 'No talent matches' : 'No talent yet'}
            description={
              hasFilters
                ? 'Try a broader search, or clear the filters to see everyone.'
                : 'Import candidates or upload resumes to start building your database.'
            }
            action={
              hasFilters
                ? { label: 'Clear filters', onClick: resetFilters }
                : bulkEnabled
                  ? { label: 'Import candidates', onClick: () => setShowBulkImport(true) }
                  : undefined
            }
            size="page"
          />
        </Card>
      ) : (
        <ul className="grid gap-hb-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 min-[1380px]:grid-cols-5">
          {items.map((candidate: any) => (
            <li key={candidate.id}>
              <Card
                variant="interactive"
                as="article"
                className="group relative flex h-full flex-col overflow-hidden border border-hb-border/80 bg-hb-surface transition-all duration-300 hover:border-hb-blue/40 hover:shadow-md hover:shadow-hb-blue/5 hover:-translate-y-0.5"
              >
                {/* Top accent bar */}
                <div className="h-1 w-full bg-gradient-to-r from-hb-blue via-indigo-500 to-violet-500 opacity-80 group-hover:opacity-100 transition-opacity" />

                <div className="p-4 flex h-full flex-col justify-between space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar
                        name={candidate.full_name}
                        src={candidate.avatar_url}
                        size="md"
                        className="ring-2 ring-hb-blue/15 shadow-sm shrink-0"
                      />
                      <div className="min-w-0">
                        <p
                          className="truncate text-hb-body font-bold text-hb-text group-hover:text-hb-blue transition-colors"
                          title={candidate.full_name}
                        >
                          {candidate.full_name}
                        </p>
                        <p className="truncate text-hb-xs text-hb-muted" title={candidate.email}>
                          {candidate.email}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActionsTarget(candidate)}
                      aria-label={`More actions for ${candidate.full_name}`}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-hb-full border border-hb-border bg-hb-surface-2/80 text-hb-muted transition-all duration-hb hover:border-hb-blue/40 hover:bg-hb-blue/10 hover:text-hb-blue focus-visible:outline-none focus-visible:shadow-hb-ring"
                    >
                      <MoreHorizontal size={15} aria-hidden />
                    </button>
                  </div>

                  <div className="space-y-2.5 rounded-hb bg-hb-surface-2/40 p-3 border border-hb-border/40">
                    <Fact label="Role" value={candidate.applied_job_title || candidate.current_title || '—'} />
                    <Fact label="Experience" value={formatExperience(candidate)} />
                    <Fact label="Applied" value={formatCandidateDate(candidate, 'dd MMM yyyy')} />
                    <Fact
                      label="Stage"
                      value={
                        candidate.pipeline_stage ? (
                          <StatusPill status={candidate.pipeline_stage} />
                        ) : (
                          <span className="inline-flex items-center rounded-hb-full border border-dashed border-hb-border-strong px-2.5 py-0.5 font-mono text-hb-micro uppercase text-hb-dim">
                            {candidate.match_score != null ? 'New' : 'Unprocessed'}
                          </span>
                        )
                      }
                    />
                    <Fact
                      label="Status"
                      value={<StatusPill status={statusFromStage(candidate.pipeline_stage)} />}
                    />
                    <Fact label="Added by" value={candidate.created_by_name || 'Admin'} />
                    {candidate.hr_name && <Fact label="Recruiter" value={candidate.hr_name} />}
                  </div>

                  <Button
                    fullWidth
                    size="sm"
                    variant="primary"
                    onClick={() => setViewTarget(candidate)}
                    className="shadow-sm shadow-hb-blue/20"
                  >
                    View full profile
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {data && (
        <Pagination
          page={data.page}
          pages={data.pages}
          total={data.total}
          limit={data.limit}
          onPage={setPage}
          noun="candidates"
        />
      )}

      {/* ── Designation context menu ── */}
      <ContextMenu
        at={contextMenu}
        onClose={() => setContextMenu(null)}
        aria-label={contextMenu ? `Actions for ${contextMenu.job.title}` : undefined}
        items={[
          {
            label: 'Rename',
            icon: <Pencil size={14} aria-hidden />,
            onSelect: () =>
              contextMenu && setRenameTarget({ job: contextMenu.job, title: contextMenu.job.title }),
          },
          {
            label: 'Delete',
            icon: <Trash2 size={14} aria-hidden />,
            destructive: true,
            onSelect: () => contextMenu && setJobToDelete(contextMenu.job),
          },
        ]}
      />

      {/* ── Row actions ── */}
      <Drawer
        open={!!actionsTarget}
        onClose={() => setActionsTarget(null)}
        title={actionsTarget?.full_name ?? ''}
        description="Move this candidate through the pipeline, or manage their record."
      >
        {actionsTarget && (
          <CandidateActionsPanel
            candidate={actionsTarget}
            canDelete={isAdmin || user?.role === 'recruiter'}
            hasActiveJobs={activeJobs.length > 0}
            busy={
              stageMutation.isPending
                ? stageMutation.variables?.stage ?? 'stage'
                : addToPipelineMutation.isPending
                  ? 'addToPipeline'
                  : null
            }
            onStage={(stage) => {
              if (!stageMutation.isPending) stageMutation.mutate({ id: actionsTarget.id, stage })
            }}
            onAddToPipeline={() => {
              addToPipeline(actionsTarget)
              setActionsTarget(null)
            }}
            onChangeDesignation={() => {
              setDesignationTarget(actionsTarget)
              setDesignationSearch('')
              setPendingDesignation(null)
              setActionsTarget(null)
            }}
            onDelete={() => {
              setCandidateToDelete({ id: actionsTarget.id, name: actionsTarget.full_name })
              setActionsTarget(null)
            }}
          />
        )}
      </Drawer>

      {/* ── Profile ── */}
      <Dialog
        open={!!viewTarget}
        onClose={() => setViewTarget(null)}
        title="Candidate profile"
        size="xl"
      >
        {viewTarget && (
          <CandidateProfileView
            candidate={viewTarget}
            onInvite={() => {
              if (!inviteMutation.isPending) inviteMutation.mutate({ email: viewTarget.email, full_name: viewTarget.full_name })
            }}
            isInviting={inviteMutation.isPending}
            onSchedule={() => navigate(`${basePath}/interviews?candidateId=${viewTarget.id}`)}
            hasInvitation={Boolean(viewTarget.invitations?.length)}
          />
        )}
      </Dialog>

      {/* ── Designation transfer ── */}
      <Dialog
        open={!!designationTarget && !pendingDesignation}
        onClose={() => {
          setDesignationTarget(null)
          setDesignationSearch('')
        }}
        title="Change designation"
        description={
          designationTarget
            ? `${designationTarget.full_name} — currently ${currentDesignationTitle || 'unassigned'}`
            : undefined
        }
        size="md"
      >
        <div className="space-y-hb-4 pb-2">
          <Input
            placeholder="Search designations…"
            aria-label="Search designations"
            leadingIcon={<Search size={15} />}
            value={designationSearch}
            onChange={(e) => setDesignationSearch(e.target.value)}
          />

          {filteredDesignations.length === 0 ? (
            <p className="py-6 text-center text-hb-sm text-hb-muted">
              No designations match your search.
            </p>
          ) : (
            <ul className="grid max-h-[340px] gap-2 overflow-y-auto">
              {filteredDesignations.map((d) => {
                const isCurrent = d.title === currentDesignationTitle
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      disabled={isCurrent}
                      onClick={() => setPendingDesignation(d)}
                      className={
                        'flex w-full items-center justify-between gap-3 rounded-hb-sm border px-3.5 py-3 text-left transition-colors duration-hb ' +
                        (isCurrent
                          ? 'cursor-default border-hb-success/35 bg-hb-success/8'
                          : 'border-hb-border bg-hb-surface hover:border-hb-border-strong hover:bg-hb-surface-2')
                      }
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-hb-sm font-semibold text-hb-text">
                          {d.title}
                        </span>
                        <span className="block text-hb-xs text-hb-muted">
                          {d.candidate_count ?? designationCounts[d.title] ?? 0} candidates
                        </span>
                      </span>
                      {isCurrent && (
                        <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-hb-micro uppercase text-hb-success">
                          <Check size={12} aria-hidden />
                          Current
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!designationTarget && !!pendingDesignation}
        onClose={() => setPendingDesignation(null)}
        onConfirm={() => {
          if (designationTarget && pendingDesignation) {
            transferMutation.mutate({
              candidateId: designationTarget.id,
              designationId: pendingDesignation.id,
            })
          }
        }}
        title="Move this candidate?"
        description={`${designationTarget?.full_name} moves from ${currentDesignationTitle || 'Unassigned'} to ${pendingDesignation?.title}.`}
        confirmLabel="Move candidate"
        loading={transferMutation.isPending}
      />

      {/* ── Designation CRUD ── */}
      <Dialog
        open={showAddDesignation}
        onClose={() => {
          setShowAddDesignation(false)
          setNewJobTitle('')
        }}
        size="sm"
        title="Add a designation"
        description="It appears in the tab row straight away, before any candidates are assigned to it."
        footer={
          <>
            <Button
              variant="quiet"
              size="sm"
              onClick={() => {
                setShowAddDesignation(false)
                setNewJobTitle('')
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              loading={isCreatingJob}
              disabled={!newJobTitle.trim()}
              onClick={createDesignation}
            >
              Add designation
            </Button>
          </>
        }
      >
        <div className="pb-2">
          <Input
            ref={newJobInputRef}
            label="Designation / job title"
            placeholder="e.g. Senior React Developer"
            value={newJobTitle}
            onChange={(e) => setNewJobTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') createDesignation()
            }}
          />
        </div>
      </Dialog>

      <Dialog
        open={!!renameTarget}
        onClose={() => setRenameTarget(null)}
        size="sm"
        title="Rename designation"
        footer={
          <>
            <Button variant="quiet" size="sm" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              loading={isRenamingJob}
              disabled={!renameTarget?.title.trim()}
              onClick={renameDesignation}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="pb-2">
          <Input
            label="New name"
            autoFocus
            value={renameTarget?.title ?? ''}
            onChange={(e) =>
              setRenameTarget((prev) => (prev ? { ...prev, title: e.target.value } : null))
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') renameDesignation()
            }}
          />
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!jobToDelete}
        onClose={() => setJobToDelete(null)}
        onConfirm={deleteDesignation}
        title="Delete this role?"
        description={`"${jobToDelete?.title}" will be removed from the Talent DB. Its candidates stay in the database, unassigned. Open positions are not affected. This cannot be undone.`}
        confirmLabel="Delete role"
        destructive
        loading={isDeletingJob}
      />

      <ConfirmDialog
        open={!!candidateToDelete}
        onClose={() => setCandidateToDelete(null)}
        onConfirm={() => {
          if (candidateToDelete) deleteMutation.mutate(candidateToDelete.id)
          setCandidateToDelete(null)
        }}
        title="Delete this candidate?"
        description={`${candidateToDelete?.name} and their entire history will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete candidate"
        destructive
        loading={deleteMutation.isPending}
      />

      <BulkImportModal
        open={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        onSuccess={(result: ImportResultData) => {
          invalidateAll()
          queryClient.invalidateQueries({ queryKey: ['jobs', 'all-for-filters'] })
          setShowBulkImport(false)
          toast.success(`Imported ${result.created_count} candidates`)
        }}
      />

      <BulkImportHistoryModal
        open={showImportHistory}
        onClose={() => setShowImportHistory(false)}
        onRollbackSuccess={invalidateAll}
      />
    </div>
  )
}
