import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Ban,
  CalendarPlus,
  Check,
  FileSignature,
  Mail,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { candidatesApi } from '@/api/candidates'
import { jobsApi } from '@/api/jobs'
import { adminApi } from '@/api/admin'
import { designationsApi, type DesignationItem } from '@/api/designations'
import { formatCandidateDate, formatExperience } from '@/utils/formatters'
import type { Candidate } from '@/types'
import { CandidateProfileView } from '@/modules/recruiter/components/CandidateProfileView'
import { CandidateActionsPanel } from '@/modules/recruiter/components/CandidateActionsPanel'
import { GenerateOfferModal } from '@/modules/recruiter/components/GenerateOfferModal'
import {
  STATUS_TABS,
  isCandidateInActivePipeline,
  isRejectionStage,
  statusFromStage,
  type CandidateStatus,
} from '@/modules/recruiter/pipeline'
import {
  Avatar,
  Button,
  CellStack,
  ConfirmDialog,
  DataTable,
  Dialog,
  Drawer,
  FilterChips,
  Input,
  Meter,
  Pagination,
  PageHeader,
  Select,
  StatusPill,
  Toolbar,
  ToolbarSearch,
  statusDef,
  type Column,
} from '@/components/hb'

/**
 * Candidates.
 *
 * Rebuilt on the design system in phase 6. What changed structurally:
 *
 * - The row-actions menu is a `Drawer`, not an `absolute` dropdown. It was
 *   positioned inside the row, so inside `overflow-x-auto` it was clipped, and
 *   with 25 stage entries plus five actions it was a 420px scroller pretending
 *   to be a menu. In a drawer it is portalled, keyboard-trapped and readable.
 * - Stage labels and colours come from `StatusPill`. The page carried two
 *   private maps â€” `STAGE_CFG` (34 entries) and `STATUS_CFG` (5) â€” whose
 *   `applied` background read `'var(--violet)/10'`, which is not valid CSS and
 *   had been rendering transparent.
 * - The stage vocabulary moved to `@/modules/recruiter/pipeline`.
 *
 * Three unreachable features were removed rather than migrated: an "add to
 * pipeline" job picker, a "quick add designation" modal and a `stageFilter`
 * query param. All three had state and UI but no code path that ever set them.
 */

const DATE_OPTIONS = [
  { value: 'all', label: 'Any date' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom range...' },
]

/** Translates the date filter into the API's `date_from` / `date_to`. */
function dateParams(filter: string, custom: [string, string]) {
  if (filter === 'all') return {}
  const now = new Date()
  if (filter === 'today') return { date_from: new Date(now.setHours(0, 0, 0, 0)).toISOString() }
  if (filter === 'week') return { date_from: new Date(now.setDate(now.getDate() - 7)).toISOString() }
  if (filter === 'month') return { date_from: new Date(now.setDate(now.getDate() - 30)).toISOString() }
  if (filter === 'custom' && custom[0]) {
    const from = new Date(custom[0]).toISOString()
    if (!custom[1]) return { date_from: from, date_to: from }
    const end = new Date(custom[1])
    end.setHours(23, 59, 59, 999)
    return { date_from: from, date_to: end.toISOString() }
  }
  return {}
}

/**
 * Match score.
 *
 * Three tones, so the number is not the only signal â€” but the number is always
 * present, which is what makes this readable in greyscale.
 */
function MatchScore({ score }: { score: number }) {
  const tone = score >= 80 ? 'text-hb-success' : score >= 60 ? 'text-hb-warning' : 'text-hb-error'

  return (
    <div className="inline-flex flex-col gap-1">
      <span className={`font-mono text-hb-xs font-semibold tabular-nums ${tone}`}>
        {Math.round(score)}%
      </span>
      <Meter value={score} tone="auto" size="xs" className="w-10" />
    </div>
  )
}

export default function CandidatesPage() {
  const { basePath, user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  /* â”€â”€ Filters â”€â”€ */
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<CandidateStatus | null>(null)
  const [recruiterId, setRecruiterId] = useState('all')
  const [selectedJobId, setSelectedJobId] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [customDateRange, setCustomDateRange] = useState<[string, string]>(['', ''])

  /* â”€â”€ Overlays â”€â”€ */
  const [actionsTarget, setActionsTarget] = useState<Candidate | null>(null)
  const [viewTarget, setViewTarget] = useState<Candidate | null>(null)
  const [viewTargetInitialTab, setViewTargetInitialTab] = useState<
    'details' | 'feedback' | 'timeline' | 'prescreen' | undefined
  >(undefined)
  const [offerCandidate, setOfferCandidate] = useState<Candidate | null>(null)
  const [candidateToDelete, setCandidateToDelete] = useState<{ id: string; name: string } | null>(null)
  const [inactivePipelineBlock, setInactivePipelineBlock] = useState<{ id: string; name: string } | null>(null)
  const [designationTarget, setDesignationTarget] = useState<Candidate | null>(null)
  const [designationSearch, setDesignationSearch] = useState('')
  const [pendingDesignation, setPendingDesignation] = useState<DesignationItem | null>(null)

  const [recruiters, setRecruiters] = useState<Array<{ id: string; name: string }>>([])

  /* â”€â”€ Deep link: ?openId=<id>&tab=<key>, used by the pre-screening review's
        back button so it can land on a specific tab of the profile. â”€â”€ */
  const deepLinkOpenId = searchParams.get('openId')
  const deepLinkTab = searchParams.get('tab') as typeof viewTargetInitialTab
  useEffect(() => {
    if (!deepLinkOpenId) return
    candidatesApi
      .get(deepLinkOpenId)
      .then((res: any) => {
        setViewTarget(res.data)
        setViewTargetInitialTab(deepLinkTab ?? undefined)
        /* Cleared once handled, so a refresh does not reopen it. */
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            next.delete('openId')
            next.delete('tab')
            return next
          },
          { replace: true }
        )
      })
      .catch(() => {
        /* candidate not found — nothing to open */
      })
    /* `deepLinkTab` and `setSearchParams` are honest dependencies and safe to
       declare: the effect clears both params on success, so the next run sees
       no `openId` and returns immediately. No disable comment needed. */
  }, [deepLinkOpenId, deepLinkTab, setSearchParams])

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

  /* â”€â”€ Data â”€â”€ */
  const queryParams = useMemo(
    () => ({
      page,
      limit: 50,
      ...(search ? { search } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(recruiterId !== 'all' ? { created_by_id: recruiterId } : {}),
      ...(selectedJobId !== 'all' ? { job_id: selectedJobId } : {}),
      ...dateParams(dateFilter, customDateRange),
    }),
    [page, search, statusFilter, recruiterId, selectedJobId, dateFilter, customDateRange]
  )

  const { data, isLoading, isError } = useQuery({
    queryKey: ['candidates', queryParams],
    queryFn: () => candidatesApi.list(queryParams).then((r: any) => r.data),
  })

  const { data: activeJobs } = useQuery({
    queryKey: ['jobs', 'active'],
    queryFn: () => jobsApi.list({ status: 'active', limit: 100 }).then((r: any) => r.data.items),
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

  /* Backend order wins; a locally-dragged order is the fallback for users whose
     preference has not synced yet. */
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
  const rows = data?.items ?? []

  /* â”€â”€ Mutations â”€â”€ */
  const inviteMutation = useMutation({
    mutationFn: (payload: { email: string; full_name: string }) => candidatesApi.invite(payload),
    onSuccess: (_, variables) => {
      toast.success(`Invitation sent to ${variables.full_name}`)
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['recent-activities'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to send invite'),
  })

  const stageMutation = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) =>
      candidatesApi.updateStage(id, stage, isRejectionStage(stage)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['candidates_pipeline'] })
      queryClient.invalidateQueries({ queryKey: ['recent-activities'] })
      toast.success('Stage updated')
      setActionsTarget(null)
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to update stage'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => candidatesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['candidates_pipeline'] })
      queryClient.invalidateQueries({ queryKey: ['recent-activities'] })
      toast.success('Candidate deleted')
      setActionsTarget(null)
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to delete candidate'),
  })

  const transferMutation = useMutation({
    mutationFn: ({ candidateId, designationId }: { candidateId: string; designationId: string }) =>
      candidatesApi.updateDesignation(candidateId, designationId),
    onMutate: async ({ candidateId, designationId }) => {
      await queryClient.cancelQueries({ queryKey: ['candidates'] })
      await queryClient.cancelQueries({ queryKey: ['designations'] })

      const previousCandidates = queryClient.getQueryData(['candidates', queryParams])
      const previousDesignations = queryClient.getQueryData(['designations'])
      const next = designations.find((d) => d.id === designationId)

      if (next) {
        queryClient.setQueryData(['candidates', queryParams], (old: any) => {
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
          total_candidates: res.data.total_candidates ?? data?.total ?? 0,
        })
      }
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['designations'] })
      setDesignationTarget(null)
      setPendingDesignation(null)
      setDesignationSearch('')
      toast.success('Designation updated')
    },
    onError: (err: any, _variables, context: any) => {
      if (context) {
        queryClient.setQueryData(['candidates', queryParams], context.previousCandidates)
        queryClient.setQueryData(['designations'], context.previousDesignations)
      }
      toast.error(err.response?.data?.message || 'Failed to move candidate')
    },
  })

  /* â”€â”€ Pipeline entry â”€â”€
     The candidate's applied title rarely matches a job id, so the best
     available job is resolved by title, then by prefix, then by falling back to
     the first active job rather than blocking the recruiter. */
  const resolveJobForCandidate = (candidate: any): string | null => {
    if (!activeJobs?.length) return null
    const norm = (v?: string | null) => (v || '').trim().toLowerCase()
    const applied = norm(candidate?.applied_job_title)
    const current = norm(candidate?.current_title)

    const exact =
      activeJobs.find((j: any) => norm(j.title) === applied) ||
      activeJobs.find((j: any) => norm(j.title) === current)
    if (exact?.id) return exact.id

    const partial =
      activeJobs.find((j: any) => applied && norm(j.title).includes(applied)) ||
      activeJobs.find((j: any) => current && norm(j.title).includes(current))
    return partial?.id ?? activeJobs[0]?.id ?? null
  }

  const addToPipelineMutation = useMutation({
    mutationFn: ({ candidate, jobId }: { candidate: any; jobId: string }) =>
      candidatesApi.updateStage(candidate.id, 'applied', false, jobId),
    onSuccess: () => {
      toast.success('Added to pipeline')
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['candidates_pipeline'] })
    },
    onError: () => toast.error('Failed to add to pipeline'),
  })

  const addToPipeline = (candidate: any) => {
    if (addToPipelineMutation.isPending) return
    if (candidate.pipeline_stage === 'inactive') {
      setInactivePipelineBlock({ id: candidate.id, name: candidate.full_name })
      return
    }
    const jobId = resolveJobForCandidate(candidate)
    if (!jobId) {
      toast.error('No active jobs found. Create a job first.')
      return
    }
    addToPipelineMutation.mutate({ candidate, jobId })
  }

  const openProfile = (candidate: Candidate) => {
    setViewTarget(candidate)
    candidatesApi.recordView(candidate.id)
  }

  const resetFilters = () => {
    setSearch('')
    setStatusFilter(null)
    setRecruiterId('all')
    setSelectedJobId('all')
    setDateFilter('all')
    setPage(1)
  }

  const hasFilters =
    !!search || !!statusFilter || recruiterId !== 'all' || selectedJobId !== 'all' || dateFilter !== 'all'

  /* â”€â”€ Columns â”€â”€ */
  const columns: Array<Column<any>> = [
    {
      key: 'candidate',
      header: 'Candidate',
      cardTitle: true,
      width: 'minmax(0, 2fr)',
      cell: (c) => (
        <CellStack
          leading={<Avatar name={c.full_name} src={c.avatar_url} size="md" />}
          primary={c.full_name}
          secondary={`${c.email} • Added by ${c.created_by_name || 'Admin'}`}
        />
      ),
    },
    {
      key: 'role',
      header: 'Role',
      width: 'minmax(0, 1.2fr)',
      cell: (c) => (
        <span
          className="block w-full truncate text-hb-muted"
          title={c.applied_job_title || c.current_title || ''}
        >
          {c.applied_job_title || c.current_title || '—'}
        </span>
      ),
    },
    {
      key: 'experience',
      header: 'Exp',
      width: '56px',
      align: 'center',
      cell: (c) => (
        <span className="whitespace-nowrap text-hb-muted">{formatExperience(c)}</span>
      ),
    },
    {
      key: 'match_score',
      header: 'Match',
      width: '72px',
      align: 'center',
      cell: (c) =>
        c.match_score != null ? <MatchScore score={c.match_score} /> : <span className="text-hb-dim">—</span>,
    },
    {
      key: 'stage',
      header: 'Stage',
      cell: (c) => {
        const stage = c.pipeline_stage
        const inPipeline = isCandidateInActivePipeline(stage)
        const hasAccount = c.invitations?.length > 0 && c.invitations[0].is_used
        /* The triage actions only make sense for a recruiter-uploaded candidate
           who has been scored but not yet routed anywhere — and who hasn't
           already been rejected. `isCandidateInActivePipeline` treats a
           rejection stage the same as "never triaged" (both are !inPipeline),
           so without this check a rejected candidate looked untriaged and
           still showed an active Reject button. */
        const needsTriage =
          !inPipeline && !isRejectionStage(stage) && !!activeJobs?.length && !hasAccount && c.match_score != null

        return (
          <div className="flex flex-col items-start gap-1.5" onClick={(e) => e.stopPropagation()}>
            {needsTriage &&
              (c.match_score >= 70 ? (
                <Button
                  size="sm"
                  icon={<Plus size={13} />}
                  loading={addToPipelineMutation.isPending && addToPipelineMutation.variables?.candidate?.id === c.id}
                  disabled={addToPipelineMutation.isPending}
                  onClick={() => addToPipeline(c)}
                >
                  Add to pipeline
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="danger"
                  loading={stageMutation.isPending && stageMutation.variables?.id === c.id}
                  disabled={stageMutation.isPending}
                  onClick={() => {
                    if (!stageMutation.isPending) stageMutation.mutate({ id: c.id, stage: 'rejected' })
                  }}
                >
                  Reject
                </Button>
              ))}

            {stage ? (
              <StatusPill status={stage} />
            ) : (
              <span className="inline-flex items-center rounded-hb-full border border-dashed border-hb-border-strong px-2.5 py-1 font-mono text-hb-micro uppercase text-hb-dim">
                {c.match_score != null ? 'Needs action' : 'Unprocessed'}
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      width: '120px',
      cell: (c) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="ghost"
            icon={<Mail size={13} />}
            loading={inviteMutation.isPending && inviteMutation.variables?.email === c.email}
            disabled={inviteMutation.isPending}
            onClick={() => {
              if (!inviteMutation.isPending) inviteMutation.mutate({ email: c.email, full_name: c.full_name })
            }}
            aria-label={`Invite ${c.full_name}`}
          />
          <Button
            size="sm"
            icon={<CalendarPlus size={13} />}
            to={`${basePath}/interviews?candidateId=${c.id}`}
            aria-label={`Schedule interview for ${c.full_name}`}
          />
          <button
            type="button"
            onClick={() => setActionsTarget(c)}
            aria-label={`More actions for ${c.full_name}`}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-hb-sm border border-hb-border bg-hb-surface-2 text-hb-muted transition-colors duration-hb hover:border-hb-border-strong hover:text-hb-text focus-visible:outline-none focus-visible:shadow-hb-ring"
          >
            <MoreHorizontal size={15} aria-hidden />
          </button>
        </div>
      ),
    },
  ]

  const currentDesignationTitle =
    designationTarget?.applied_job_title || designationTarget?.current_title || ''
  const filteredDesignations = designations.filter((d) =>
    d.title.toLowerCase().includes(designationSearch.trim().toLowerCase())
  )

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Talent"
        title="Candidates"
        description={
          data
            ? `${data.total.toLocaleString()} candidate${data.total === 1 ? '' : 's'} in your organisation.`
            : 'Everyone who has applied or been uploaded.'
        }
        actions={
          <Button icon={<UserPlus size={17} />} to={`${basePath}/upload`}>
            Add candidate
          </Button>
        }
      />

      <Toolbar className="items-end">
        <ToolbarSearch
          value={search}
          onChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          placeholder="Search candidates..."
          aria-label="Search candidates"
        />

        <Select
          label="Role"
          aria-label="Filter by role"
          value={selectedJobId}
          onChange={(e) => {
            setSelectedJobId(e.target.value)
            setPage(1)
          }}
          options={[
            { value: 'all', label: 'All roles' },
            ...(activeJobs ?? []).map((j: any) => ({ value: j.id, label: j.title })),
          ]}
          fieldClassName="w-[168px]"
        />

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
      </Toolbar>

      <div className="mb-hb-4">
        <FilterChips
          options={STATUS_TABS}
          value={statusFilter as any}
          onChange={(v) => {
            setStatusFilter(v as CandidateStatus | null)
            setPage(1)
          }}
        />
      </div>

      {isError ? (
        <div
          role="alert"
          className="rounded-hb-md border border-hb-error/25 bg-hb-error/8 p-4 text-hb-sm text-hb-error"
        >
          Could not load candidates. Please refresh.
        </div>
      ) : (
        <>
          <DataTable
            caption="Candidates"
            columns={columns}
            rows={rows}
            rowKey={(c: any) => c.id}
            loading={isLoading}
            onRowClick={openProfile}
            empty={{
              tone: hasFilters ? 'no-results' : 'empty',
              icon: <Users />,
              title: hasFilters ? 'No candidates match' : 'No candidates yet',
              description: hasFilters
                ? 'Try a broader search, or clear the filters to see everyone.'
                : 'Upload resumes or invite candidates and Hybent AI scores them automatically.',
              action: hasFilters
                ? { label: 'Clear filters', onClick: resetFilters }
                : { label: 'Add a candidate', onClick: () => navigate(`${basePath}/upload`) },
            }}
          />

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
        </>
      )}

      {/* â”€â”€ Row actions â”€â”€ */}
      <Drawer
        open={!!actionsTarget}
        onClose={() => setActionsTarget(null)}
        title={actionsTarget?.full_name ?? ''}
        description="Move this candidate through the pipeline, or manage their record."
      >
        {actionsTarget && (
          <CandidateActionsPanel
            candidate={actionsTarget}
            canDelete={user?.role === 'admin' || user?.role === 'recruiter'}
            hasActiveJobs={!!activeJobs?.length}
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
            onGenerateOffer={() => {
              setOfferCandidate(actionsTarget)
              setActionsTarget(null)
            }}
            onDelete={() => {
              setCandidateToDelete({ id: actionsTarget.id, name: actionsTarget.full_name })
              setActionsTarget(null)
            }}
          />
        )}
      </Drawer>

      {/* â”€â”€ Profile â”€â”€ */}
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
            hideInvite
            hideSchedule
            initialTab={viewTargetInitialTab}
          />
        )}
      </Dialog>

      {offerCandidate && (
        <GenerateOfferModal
          candidate={offerCandidate}
          onClose={() => setOfferCandidate(null)}
          application={{ job: { title: offerCandidate.applied_job_title } } as any}
        />
      )}

      {/* â”€â”€ Designation transfer â”€â”€ */}
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
            placeholder="Search designations..."
            aria-label="Search designations"
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

      <ConfirmDialog
        open={!!inactivePipelineBlock}
        onClose={() => setInactivePipelineBlock(null)}
        onConfirm={() => {
          if (inactivePipelineBlock) {
            stageMutation.mutate({ id: inactivePipelineBlock.id, stage: 'applied' })
          }
          setInactivePipelineBlock(null)
        }}
        title="This candidate is inactive"
        description={`${inactivePipelineBlock?.name} has to be activated before joining a pipeline. Activate them now?`}
        confirmLabel="Activate candidate"
      />
    </div>
  )
}
