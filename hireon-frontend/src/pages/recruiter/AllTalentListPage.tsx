import React, { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { GlassIcon } from '@/components/common/GlassIcon'
import { CandidateProfileView } from '@/components/recruiter/CandidateProfileView'
import { ArrowLeft, Search, Calendar, Plus, Play, Pause, Trash2, CheckCircle, Bookmark, X, Upload, ChevronDown, Clock3 } from 'lucide-react'
import { talentPoolApi } from '@/api/talentPool'
import { candidatesApi } from '@/api/candidates'
import { jobsApi } from '@/api/jobs'
import { adminApi } from '@/api/admin'
import { useNotificationStore } from '@/store/notificationStore'
import { Select } from '@/components/ui/Select'
import { DatePicker } from '@/components/ui/DatePicker'
import { BulkImportModal } from '@/components/recruiter/BulkImportModal'
import { BulkImportHistoryModal } from '@/components/recruiter/BulkImportHistoryModal'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDate, formatCandidateDate } from '@/utils/formatters'
import type { Candidate } from '@/types'
import type { ImportResultData } from '@/api/bulkImport'

// ── Stage config ───────────────────────────────────────────────────────────────
const STAGE_CFG: Record<string, { color: string; bg: string; label: string }> = {
  applied:                      { color: 'var(--violet)', bg: 'var(--violet)/10', label: 'Applied' },
  pre_screening:                { color: '#3b82f6', bg: 'rgba(59,130,246,0.10)', label: 'Pre-screening' },
  pre_screening_selected:       { color: '#10b981', bg: 'rgba(16,185,129,0.10)', label: 'Pre-screening Selected' },
  pre_screening_rejected:       { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'Pre-screening Rejected' },
  technical_round:              { color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)', label: 'Technical Round' },
  technical_round_selected:     { color: '#10b981', bg: 'rgba(16,185,129,0.10)', label: 'Technical Round Selected' },
  technical_round_rejected:     { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'Technical Round Rejected' },
  technical_round_back_out:     { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', label: 'Technical Round Back Out' },
  practical_round:              { color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)', label: 'Practical Round' },
  practical_round_selected:     { color: '#10b981', bg: 'rgba(16,185,129,0.10)', label: 'Practical Round Selected' },
  practical_round_rejected:     { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'Practical Round Rejected' },
  hr_round:                     { color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)', label: 'HR Round' },
  hr_round_selected:            { color: '#10b981', bg: 'rgba(16,185,129,0.10)', label: 'HR Round Selected' },
  hr_round_rejected:            { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'HR Round Rejected' },
  offered:                      { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', label: 'Offered' },
  hired_joined:                 { color: '#10b981', bg: 'rgba(16,185,129,0.10)', label: 'Hired / Joined' },
  rejected:                     { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'Rejected' },
  inactive:                     { color: '#94a3b8', bg: 'rgba(148,163,184,0.10)', label: 'Inactive' },
}

const STATUS_CFG: Record<string, { color: string; bg: string; dot: string; label: string }> = {
  shortlisted: { color: 'var(--teal, #059669)', bg: 'rgba(16,185,129,0.12)', dot: 'var(--teal, #10b981)', label: 'Shortlisted' },
  in_review:   { color: 'var(--violet)', bg: 'var(--violet)/10', dot: 'var(--violet)', label: 'In Review' },
  scheduled:   { color: '#3b82f6', bg: 'rgba(59,130,246,0.10)', dot: '#3b82f6', label: 'Scheduled' },
  rejected:    { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', dot: '#ef4444', label: 'Rejected' },
  inactive:    { color: '#94a3b8', bg: 'rgba(148,163,184,0.10)', dot: '#94a3b8', label: 'Inactive' },
}

const REJECTION_STAGES = ['rejected','pre_screening_rejected','technical_round_rejected','technical_round_back_out','practical_round_rejected','hr_round_rejected']

const STAGE_GROUPS = [
  {
    label: 'Pre-Screening',
    icon: <GlassIcon icon="Search" variant="blue" size={22} iconSize={12} ghost />,
    stages: [
      { key: 'pre_screening', label: 'In Pre-screening', icon: <GlassIcon icon="Clock" variant="amber" size={18} iconSize={9} ghost /> },
      { key: 'pre_screening_selected', label: 'Pre-screening Selected', icon: <GlassIcon icon="CheckCircle" variant="emerald" size={18} iconSize={9} ghost /> },
      { key: 'pre_screening_rejected', label: 'Pre-screening Rejected', icon: <GlassIcon icon="XCircle" variant="rose" size={18} iconSize={9} ghost /> },
    ],
  },
  {
    label: 'Technical Round',
    icon: <GlassIcon icon="Code" variant="violet" size={22} iconSize={12} ghost />,
    stages: [
      { key: 'technical_round', label: 'In Technical Round', icon: <GlassIcon icon="Clock" variant="amber" size={18} iconSize={9} ghost /> },
      { key: 'technical_round_selected', label: 'Technical Round Selected', icon: <GlassIcon icon="CheckCircle" variant="emerald" size={18} iconSize={9} ghost /> },
      { key: 'technical_round_rejected', label: 'Technical Round Rejected', icon: <GlassIcon icon="XCircle" variant="rose" size={18} iconSize={9} ghost /> },
      { key: 'technical_round_back_out', label: 'Technical Round Back Out', icon: <GlassIcon icon="RotateCcw" variant="amber" size={18} iconSize={9} ghost /> },
    ],
  },
  {
    label: 'Practical Round',
    icon: <GlassIcon icon="FileText" variant="violet" size={22} iconSize={12} ghost />,
    stages: [
      { key: 'practical_round', label: 'In Practical Round', icon: <GlassIcon icon="Clock" variant="amber" size={18} iconSize={9} ghost /> },
      { key: 'practical_round_selected', label: 'Practical Round Selected', icon: <GlassIcon icon="CheckCircle" variant="emerald" size={18} iconSize={9} ghost /> },
      { key: 'practical_round_rejected', label: 'Practical Round Rejected', icon: <GlassIcon icon="XCircle" variant="rose" size={18} iconSize={9} ghost /> },
    ],
  },
  {
    label: 'HR Round',
    icon: <GlassIcon icon="Users" variant="violet" size={22} iconSize={12} ghost />,
    stages: [
      { key: 'hr_round', label: 'In HR Round', icon: <GlassIcon icon="Clock" variant="amber" size={18} iconSize={9} ghost /> },
      { key: 'hr_round_selected', label: 'HR Round Selected', icon: <GlassIcon icon="CheckCircle" variant="emerald" size={18} iconSize={9} ghost /> },
      { key: 'hr_round_rejected', label: 'HR Round Rejected', icon: <GlassIcon icon="XCircle" variant="rose" size={18} iconSize={9} ghost /> },
    ],
  },
  {
    label: 'Offer & Joining',
    icon: <GlassIcon icon="Trophy" variant="emerald" size={22} iconSize={12} ghost />,
    stages: [
      { key: 'offered', label: 'Offered', icon: <GlassIcon icon="Tag" variant="amber" size={18} iconSize={9} ghost /> },
      { key: 'hired_joined', label: 'Hired / Joined', icon: <GlassIcon icon="Trophy" variant="emerald" size={18} iconSize={9} ghost /> },
    ],
  },
]

// ── Mini stage dropdown ────────────────────────────────────────────────────────
function StageDropdown({ candidateId, currentStage, onSelect, onClose, onDelete, user, onAddToPipeline, onViewProfile, hasActiveJobs, isInPipeline, triggerEl }: {
  candidateId: string; currentStage: string
  onSelect: (s: string) => void; onClose: () => void
  onDelete: (id: string) => void; user: any
  onAddToPipeline: () => void
  onViewProfile: () => void
  hasActiveJobs: boolean
  isInPipeline: boolean
  triggerEl: HTMLButtonElement | null
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [openUp, setOpenUp] = useState(false)
  const [maxHeight, setMaxHeight] = useState(420)
  const [menuTop, setMenuTop] = useState(0)
  const [menuLeft, setMenuLeft] = useState(0)
  const MENU_WIDTH = 268

  const computePlacement = () => {
    if (!ref.current || !triggerEl) return
    const viewportPadding = 12
    const horizontalPadding = 0
    const gap = 8
    const viewportHeight = window.innerHeight
    const viewportWidth = window.innerWidth
    const triggerRect = triggerEl.getBoundingClientRect()

    const naturalHeight = Math.min(ref.current.scrollHeight, Math.floor(viewportHeight * 0.78))
    const spaceBelow = viewportHeight - triggerRect.bottom - viewportPadding
    const spaceAbove = triggerRect.top - viewportPadding

    const shouldOpenUp = spaceBelow < Math.min(280, naturalHeight) && spaceAbove > spaceBelow
    const available = shouldOpenUp ? spaceAbove : spaceBelow
    const safeMaxHeight = Math.max(200, Math.floor(available - gap))

    // Right-align to trigger by default, then clamp within viewport.
    const desiredLeft = triggerRect.right - MENU_WIDTH
    const clampedLeft = Math.max(
      horizontalPadding,
      Math.min(desiredLeft, viewportWidth - MENU_WIDTH - horizontalPadding),
    )

    const computedTop = shouldOpenUp
      ? triggerRect.top - Math.min(naturalHeight, safeMaxHeight) - gap
      : triggerRect.bottom + gap

    setOpenUp(shouldOpenUp)
    setMaxHeight(safeMaxHeight)
    setMenuLeft(clampedLeft)
    setMenuTop(Math.max(viewportPadding, computedTop))
  }

  useLayoutEffect(() => {
    computePlacement()
  }, [triggerEl])

  useEffect(() => {
    const onReflow = () => computePlacement()
    window.addEventListener('resize', onReflow)
    window.addEventListener('scroll', onReflow, true)
    return () => {
      window.removeEventListener('resize', onReflow)
      window.removeEventListener('scroll', onReflow, true)
    }
  }, [triggerEl])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, scale: 0.95, y: openUp ? -6 : 6 }} animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: openUp ? -6 : 6 }} transition={{ duration: 0.14 }}
      style={{ position: 'fixed', top: menuTop, left: menuLeft, zIndex: 9999, width: MENU_WIDTH,
        background: '#ffffff', borderRadius: 14,
        boxShadow: '0 10px 28px rgba(15,23,42,0.12)', border: '1px solid rgba(148,163,184,0.22)',
        padding: '8px', transformOrigin: openUp ? 'bottom right' : 'top right', maxHeight, overflowY: 'auto' }}
      onClick={e => e.stopPropagation()}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onViewProfile(); onClose() }}
        style={{
          width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 9,
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 12.5, fontWeight: 700, color: 'var(--violet)',
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(108,71,255,0.08)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
      >
        <Search size={13} />
        <span style={{ flex: 1 }}>View Full Profile</span>
      </button>
      <div style={{ height: 1, background: 'var(--table-border)', margin: '4px 6px' }} />

      {(hasActiveJobs || isInPipeline) && (
        <>
          {isInPipeline ? (
            <div
              style={{
                width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 9,
                background: 'rgba(148, 163, 184, 0.1)', border: '1.5px solid rgba(148, 163, 184, 0.2)',
                cursor: 'not-allowed', fontSize: 12.5, fontWeight: 700, color: '#94a3b8',
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
              }}
            >
              <CheckCircle size={13} />
              <span style={{ flex: 1 }}>Already in Pipeline</span>
            </div>
          ) : (
            <button onClick={e => { e.stopPropagation(); onAddToPipeline(); onClose() }}
              style={{ width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 9,
                background: 'rgba(16,185,129,0.10)', border: '1.5px solid rgba(16,185,129,0.20)',
                cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: '#059669',
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.18)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.10)' }}
            >
              <Plus size={13} /><span style={{ flex: 1 }}>Add in Pipeline</span>
            </button>
          )}
          <div style={{ height: 1, background: 'var(--table-border)', margin: '2px 6px 6px' }} />
        </>
      )}
      {STAGE_GROUPS.map((group, gi) => (
        <div key={group.label}>
          {gi > 0 && <div style={{ height: 1, background: 'var(--table-border)', margin: '4px 6px' }} />}
          <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase',
            letterSpacing: '0.9px', padding: '6px 10px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
            {group.icon}
            {group.label}
          </p>
          {group.stages.map(item => {
            const cfg = STAGE_CFG[item.key] ?? STAGE_CFG.applied
            const isActive = currentStage === item.key
            return (
              <button key={item.key} onClick={e => { e.stopPropagation(); onSelect(item.key) }}
                style={{ width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: 9,
                  background: isActive ? cfg.bg : 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12.5, fontWeight: isActive ? 700 : 500, color: isActive ? cfg.color : 'var(--text)',
                  display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.12s' }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = cfg.bg }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'none' }}
              >
                {item.icon}
                <span style={{ flex: 1 }}>{item.label}</span>
                {isActive && <span style={{ fontSize: 9, background: cfg.bg, color: cfg.color, borderRadius: 10, padding: '1px 7px', fontWeight: 700 }}>Active</span>}
              </button>
            )
          })}
        </div>
      ))}
      <div style={{ height: 1, background: 'var(--table-border)', margin: '4px 6px' }} />
      {user?.role === 'admin' && (
        <button onClick={e => { e.stopPropagation(); onDelete(candidateId); onClose() }}
          style={{ width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: 9,
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 500, color: '#ef4444',
            display: 'flex', alignItems: 'center', gap: 8 }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
        >
          <Trash2 size={12} /> Delete Candidate
        </button>
      )}
    </motion.div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AllTalentListPage() {
  const { basePath, user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [viewTarget, setViewTarget] = useState<Candidate | null>(null)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [recruiterId, setRecruiterId] = useState<string>('all')
  const [selectedJobId, setSelectedJobId] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [customDateRange, setCustomDateRange] = useState<[string, string]>(['', ''])
  const [recruiters, setRecruiters] = useState<{ id: string; name: string }[]>([])
  const [showAddJobModal, setShowAddJobModal] = useState(false)
  const [showBulkImportModal, setShowBulkImportModal] = useState(false)
  const [showBulkImportHistoryModal, setShowBulkImportHistoryModal] = useState(false)
  const [showImportActions, setShowImportActions] = useState(false)
  const [newJobTitle, setNewJobTitle] = useState('')
  const [isCreatingJob, setIsCreatingJob] = useState(false)
  const newJobInputRef = useRef<HTMLInputElement>(null)
  const actionTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const importActionsRef = useRef<HTMLDivElement>(null)

  // Right-click context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; job: any } | null>(null)
  const [renameModal, setRenameModal] = useState<{ job: any; title: string } | null>(null)
  const [isRenamingJob, setIsRenamingJob] = useState(false)
  const [isDeletingJob, setIsDeletingJob] = useState(false)
  const [candidateToDelete, setCandidateToDelete] = useState<{ id: string; name: string } | null>(null)
  const [jobToDelete, setJobToDelete] = useState<any | null>(null)

  // Saved Views & Alerts State
  const [savedViews, setSavedViews] = useState<any[]>(() => {
    return JSON.parse(localStorage.getItem('hireon_talent_saved_views') || '[]')
  })
  const [newViewName, setNewViewName] = useState('')
  const [activeViewId, setActiveViewId] = useState<string | null>(null)

  const [alertMatchThreshold, setAlertMatchThreshold] = useState<number>(() => {
    return parseInt(localStorage.getItem('hireon_alert_match_threshold') || '85')
  })
  const [alertOnOffer, setAlertOnOffer] = useState<boolean>(() => {
    return localStorage.getItem('hireon_alert_on_offer') !== 'false'
  })

  const saveCurrentView = () => {
    if (!newViewName.trim()) {
      toast.error('Please enter a name for the view')
      return
    }
    const newView = {
      id: crypto.randomUUID(),
      name: newViewName.trim(),
      search,
      statusFilter,
      recruiterId,
      selectedJobId,
      dateFilter,
      customDateRange,
    }
    const updated = [...savedViews, newView]
    setSavedViews(updated)
    localStorage.setItem('hireon_talent_saved_views', JSON.stringify(updated))
    setActiveViewId(newView.id)
    setNewViewName('')
    toast.success(`View "${newView.name}" saved successfully!`)
  }

  const loadSavedView = (view: any) => {
    setSearch(view.search || '')
    setStatusFilter(view.statusFilter)
    setRecruiterId(view.recruiterId || 'all')
    setSelectedJobId(view.selectedJobId || 'all')
    setDateFilter(view.dateFilter || 'all')
    setCustomDateRange(view.customDateRange || ['', ''])
    setActiveViewId(view.id)
    toast.success(`Loaded view "${view.name}"`)
  }

  const deleteActiveView = () => {
    if (!activeViewId) return
    const updated = savedViews.filter(v => v.id !== activeViewId)
    setSavedViews(updated)
    localStorage.setItem('hireon_talent_saved_views', JSON.stringify(updated))
    setActiveViewId(null)
    toast.success('Saved view deleted')
  }

  useEffect(() => {
    adminApi.listUsers().then((res: any) => {
      const users = res.data
        .filter((u: any) => u.role !== 'candidate')
        .map((u: any) => ({ id: u.id, name: u.full_name }))
      setRecruiters(users)
    }).catch((err: any) => console.error("Failed to fetch recruiters", err))
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: ['all-talent-full', page, search, statusFilter, recruiterId, selectedJobId, dateFilter, customDateRange],
    queryFn: () => {
      let date_from: string | undefined
      let date_to: string | undefined
      const now = new Date()
      if (dateFilter === 'today') {
        now.setHours(0,0,0,0)
        date_from = now.toISOString()
      } else if (dateFilter === 'week') {
        const d = new Date(now)
        d.setDate(d.getDate() - 7)
        date_from = d.toISOString()
      } else if (dateFilter === 'month') {
        const d = new Date(now)
        d.setMonth(d.getMonth() - 1)
        date_from = d.toISOString()
      } else if (dateFilter === 'custom' && customDateRange[0]) {
        date_from = new Date(customDateRange[0]).toISOString()
        if (customDateRange[1]) {
          const end = new Date(customDateRange[1])
          end.setHours(23, 59, 59, 999)
          date_to = end.toISOString()
        } else {
          date_to = date_from
        }
      }

      return talentPoolApi.list({ 
        page, 
        limit: 50, 
        search: search || undefined,
        status: statusFilter,
        created_by_id: recruiterId !== 'all' ? recruiterId : undefined,
        job_id: selectedJobId !== 'all' ? selectedJobId : undefined,
        date_from,
        date_to
      }).then(r => r.data)
    },
  })

  // Real-time Candidate Alert Monitor
  useEffect(() => {
    const items = data?.items || []
    if (items.length === 0) return

    // Get notified candidate IDs
    const notifiedIds = new Set<string>(
      JSON.parse(localStorage.getItem('hireon_notified_candidate_ids') || '[]')
    )

    let updatedNotified = false

    items.forEach((candidate: any) => {
      if (notifiedIds.has(candidate.id)) return

      // Alert Condition 1: High Match Score
      const matchScore = candidate.match_score ?? candidate.parsed_data?.match_score ?? 0
      const matchesScore = matchScore >= alertMatchThreshold

      // Alert Condition 2: Candidate stage is "Offer" (offered)
      const stage = candidate.pipeline_stage || ''
      const isOffer = stage.toLowerCase() === 'offered' || stage.toLowerCase() === 'offer' || stage.toLowerCase() === 'hired_joined'
      const matchesOffer = alertOnOffer && isOffer

      if (matchesScore || matchesOffer) {
        // Add to notified
        notifiedIds.add(candidate.id)
        updatedNotified = true

        const title = matchesOffer ? 'Stage Reached: Offer' : 'High Match Score Alert'
        const message = matchesOffer
          ? `Candidate ${candidate.full_name} has entered the "Offer" stage!`
          : `Candidate ${candidate.full_name} matches with a score of ${matchScore}%!`

        // Trigger in-app notification in store
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

        // Show premium toast
        toast.custom((t) => (
          <div
            className={`${
              t.visible ? 'animate-enter' : 'animate-leave'
            } max-w-md w-full bg-white dark:bg-[#1a1730] shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-black ring-opacity-5 border border-violet-100 dark:border-[#2a2550]`}
          >
            <div className="flex-1 w-0 p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 pt-0.5">
                  <div className="h-10 w-10 rounded-full bg-violet-50 dark:bg-[#201c3b] flex items-center justify-center text-violet-600 dark:text-violet-400 font-bold text-lg">
                    ✨
                  </div>
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {title}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {message}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex border-l border-gray-100 dark:border-[#201c3b]">
              <button
                onClick={() => toast.dismiss(t.id)}
                className="w-full border border-transparent rounded-none rounded-r-2xl p-4 flex items-center justify-center text-xs font-bold text-violet-600 hover:text-violet-500 dark:text-violet-400 focus:outline-none"
              >
                Close
              </button>
            </div>
          </div>
        ), { duration: 5000 })
      }
    })

    if (updatedNotified) {
      localStorage.setItem('hireon_notified_candidate_ids', JSON.stringify(Array.from(notifiedIds)))
    }
  }, [data?.items, alertMatchThreshold, alertOnOffer])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (importActionsRef.current && !importActionsRef.current.contains(event.target as Node)) {
        setShowImportActions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const { data: allJobs } = useQuery({
    queryKey: ['jobs', 'all-for-filters'],
    queryFn: () => jobsApi.list({ limit: 100, include_pool: true }).then((r: any) => r.data.items),
  })

  const activeJobs = allJobs?.filter((j: any) => j.status === 'active') || []

  const stageMutation = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) =>
      candidatesApi.updateStage(id, stage, REJECTION_STAGES.includes(stage)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-talent-full'] })
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      toast.success('Stage updated')
      setOpenDropdownId(null)
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to update stage'),
  })

  const inviteMutation = useMutation({
    mutationFn: (data: { email: string; full_name: string }) => candidatesApi.invite(data),
    onSuccess: (_, v) => { toast.success(`Invitation sent to ${v.full_name}`); queryClient.invalidateQueries({ queryKey: ['all-talent-full'] }) },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to send invite'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => candidatesApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['all-talent-full'] }); toast.success('Candidate deleted') },
    onError: () => toast.error('Failed to delete candidate'),
  })

  const resolveJobForCandidate = (candidate: any): string | null => {
    if (!activeJobs || activeJobs.length === 0) return null

    const normalize = (v?: string | null) =>
      (v || '')
        .toLowerCase()
        .replace(/[^a-z0-9+#.\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

    const roles = [
      candidate?.applied_job_title,
      candidate?.current_title,
      candidate?.parsed_data?.current_title,
      candidate?.parsed_data?.role,
    ]
      .map((r: any) => normalize(typeof r === 'string' ? r : ''))
      .filter(Boolean)

    const exact = activeJobs.find((j: any) => roles.includes(normalize(j.title)))
    if (exact?.id) return exact.id

    const partial = activeJobs.find((j: any) => {
      const jt = normalize(j.title)
      return roles.some((r: string) => r.includes(jt) || jt.includes(r))
    })
    if (partial?.id) return partial.id

    return null
  }

  const handleAddToPipeline = async (candidateId: string, jobId: string) => {
    try {
      await candidatesApi.updateStage(candidateId, 'applied', false, jobId)
      toast.success('Added to pipeline successfully')
      queryClient.invalidateQueries({ queryKey: ['all-talent-full'] })
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
    } catch {
      toast.error('Failed to add to pipeline')
    }
  }


  const handleCreateJob = async () => {
    const title = newJobTitle.trim()
    if (!title) return
    setIsCreatingJob(true)
    try {
      const res = await jobsApi.create({ title, status: 'pool', openings: 0, description: title, job_type: 'full_time' })
      toast.success(`Designation "${title}" added!`)
      setNewJobTitle('')
      setShowAddJobModal(false)
      queryClient.invalidateQueries({ queryKey: ['jobs', 'all-for-filters'] })
      // Auto-select the new job tab
      const newJob = (res as any).data
      if (newJob?.id) setSelectedJobId(newJob.id)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to create designation')
    } finally {
      setIsCreatingJob(false)
    }
  }

  const handleRenameJob = async () => {
    if (!renameModal) return
    const title = renameModal.title.trim()
    if (!title) return
    setIsRenamingJob(true)
    try {
      await jobsApi.update(renameModal.job.id, { title })
      toast.success(`Renamed to "${title}"`)
      queryClient.invalidateQueries({ queryKey: ['jobs', 'all-for-filters'] })
      queryClient.invalidateQueries({ queryKey: ['all-talent-full'] })
      setRenameModal(null)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to rename')
    } finally {
      setIsRenamingJob(false)
    }
  }

  const handleDeleteJob = async (job: any) => {
    setJobToDelete(job)
  }

  const confirmDeleteJob = async () => {
    if (!jobToDelete) return
    setIsDeletingJob(true)
    try {
      await jobsApi.delete(jobToDelete.id)
      toast.success(`"${jobToDelete.title}" deleted`)
      if (selectedJobId === jobToDelete.id) setSelectedJobId('all')
      queryClient.invalidateQueries({ queryKey: ['jobs', 'all-for-filters'] })
      queryClient.invalidateQueries({ queryKey: ['all-talent-full'] })
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to delete')
    } finally {
      setIsDeletingJob(false)
      setContextMenu(null)
      setJobToDelete(null)
    }
  }

  const normalizeRole = (v?: string | null) =>
    (v || '')
      .toLowerCase()
      .replace(/[^a-z0-9+#.\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

  const selectedJobTitle =
    selectedJobId === 'all'
      ? ''
      : ((allJobs || []).find((j: any) => j.id === selectedJobId)?.title || '')

  const filteredItems = data?.items || []
  const handleBulkImportSuccess = (result: ImportResultData) => {
    queryClient.invalidateQueries({ queryKey: ['all-talent-full'] })
    queryClient.invalidateQueries({ queryKey: ['candidates'] })
    queryClient.invalidateQueries({ queryKey: ['jobs', 'all-for-filters'] })
    setShowBulkImportModal(false)
    toast.success(`Imported ${result.created_count} candidates into Talent DB`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <header className="page-header">
          <button onClick={() => navigate(-1)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--text-light)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 8, padding: 0 }}>
            <ArrowLeft size={15} /> Back to Dashboard
          </button>
          <h1 className="page-title" style={{ margin: 0 }}>
            All Talent <span style={{ color: 'var(--violet)', fontSize: 18 }}>({data?.total ?? 0})</span>
          </h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0' }}>
            Complete database of all assessed candidates.
          </p>
        </header>
        <div className="relative flex items-center" ref={importActionsRef}>
          <button
            onClick={() => setShowBulkImportModal(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setShowBulkImportModal(true)
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-l-xl text-sm font-semibold text-white shadow-sm transition-all hover:opacity-95"
            style={{
              background: 'linear-gradient(135deg,#6c47ff,#8b6bff)',
              minHeight: 40,
            }}
          >
            <Upload size={16} />
            Import Candidates
          </button>
          <button
            onClick={() => setShowImportActions((prev) => !prev)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setShowImportActions(false)
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setShowImportActions((prev) => !prev)
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setShowImportActions(true)
              }
            }}
            aria-haspopup="menu"
            aria-expanded={showImportActions}
            className="inline-flex items-center justify-center px-3 py-2 rounded-r-xl text-white shadow-sm transition-all hover:opacity-95 border-l border-white/20"
            style={{
              background: 'linear-gradient(135deg,#6c47ff,#8b6bff)',
              minHeight: 40,
            }}
          >
            <ChevronDown size={14} className={`transition-transform duration-200 ${showImportActions ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {showImportActions && (
              <motion.div
                role="menu"
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full right-0 mt-2 w-56 rounded-xl border border-gray-200 dark:border-[var(--card-border)] bg-white dark:bg-[var(--color-bg-sidebar)] shadow-xl z-[1200] p-2"
              >
                <button
                  role="menuitem"
                  onClick={() => {
                    setShowImportActions(false)
                    setShowBulkImportHistoryModal(true)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-left text-gray-800 dark:text-gray-100 hover:bg-violet-50 dark:hover:bg-[#201c3b] transition-colors"
                >
                  <Clock3 size={15} />
                  Import History
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 bg-white dark:bg-[var(--color-bg-sidebar)] p-4 rounded-2xl border border-gray-100 dark:border-[var(--card-border)]">
        <div className="flex flex-wrap items-center gap-3 flex-1 w-full">
          {/* Search Input */}
          <div className="w-full sm:max-w-[280px]">
            <Input
              placeholder="Search by name, skill, or role..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              leftIcon={<Search size={15} />}
            />
          </div>

          <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block mx-1" />

          {/* Core Selects Group */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-[140px]">
              <Select
                value={recruiterId}
                onChange={(e) => { setRecruiterId(e.target.value); setPage(1) }}
                options={[
                  { value: 'all', label: 'All Recruiters' },
                  ...recruiters.map(r => ({ value: r.id, label: r.name }))
                ]}
              />
            </div>

            <div className="w-[140px]">
              <Select
                value={statusFilter || 'all'}
                onChange={(e) => { 
                  setStatusFilter(e.target.value === 'all' ? undefined : e.target.value); 
                  setPage(1); 
                }}
                options={[
                  { value: 'all', label: 'All Statuses' },
                  { value: 'in_review', label: 'In Review' },
                  { value: 'shortlisted', label: 'Shortlisted' },
                  { value: 'scheduled', label: 'Scheduled' },
                  { value: 'rejected', label: 'Rejected' },
                ]}
              />
            </div>

            {/* Date Group */}
            <div className="flex items-center gap-2">
              <div className="w-[130px]">
                <Select
                  value={dateFilter}
                  onChange={(e) => { setDateFilter(e.target.value); setPage(1) }}
                  options={[
                    { value: 'all', label: 'Any Date' },
                    { value: 'today', label: 'Today' },
                    { value: 'week', label: 'Last 7 Days' },
                    { value: 'month', label: 'Last 30 Days' },
                    { value: 'custom', label: 'Custom Date…' },
                  ]}
                />
              </div>

              {dateFilter === 'custom' && (
                <div className="w-[180px] flex-shrink-0 animate-in fade-in slide-in-from-left-2 duration-300">
                  <DatePicker
                    value={customDateRange}
                    onChange={(range) => { setCustomDateRange(range); setPage(1) }}
                    className="relative z-50"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Saved Views & Alerts Bar commented out
      <div 
        className="flex flex-wrap items-center justify-end gap-4 p-4 rounded-xl border border-gray-100 dark:border-[#2a2550] bg-white/60 dark:bg-[#161233]/60 backdrop-blur-md"
        style={{
          boxShadow: 'var(--shadow)',
          marginTop: -8,
          marginBottom: 8,
        }}
      >
        <div className="flex flex-wrap items-center gap-4">

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-300">
              <GlassIcon icon="Zap" variant="amber" size={24} iconSize={12} ghost glow={false} />
              <span>Score Alert:</span>
            </div>
            <select
              value={alertMatchThreshold}
              onChange={(e) => {
                const val = parseInt(e.target.value)
                setAlertMatchThreshold(val)
                localStorage.setItem('hireon_alert_match_threshold', String(val))
                toast.success(`Match score alert set to ${val}%`)
              }}
              className="px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-[#2a2550] bg-white dark:bg-[#1a1730] text-gray-800 dark:text-white focus:outline-none"
            >
              <option value="70">≥ 70%</option>
              <option value="75">≥ 75%</option>
              <option value="80">≥ 80%</option>
              <option value="85">≥ 85%</option>
              <option value="90">≥ 90%</option>
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={alertOnOffer}
              onChange={(e) => {
                const val = e.target.checked
                setAlertOnOffer(val)
                localStorage.setItem('hireon_alert_on_offer', String(val))
                toast.success(val ? 'Offer stage alert enabled' : 'Offer stage alert disabled')
              }}
              className="rounded border-gray-300 dark:border-[#2a2550] text-violet-600 focus:ring-violet-500"
            />
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Alert on "Offer" Stage</span>
          </label>
        </div>
      </div>
      */}

      {/* Context Menu for right-click on job tab */}
      {contextMenu && (
        <>
          {/* Backdrop to close menu */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu(null) }}
          />
          <div
            style={{
              position: 'fixed',
              top: contextMenu.y,
              left: contextMenu.x,
              zIndex: 9999,
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: 10,
              boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
              minWidth: 160,
              overflow: 'hidden',
              padding: '4px 0',
            }}
          >
            <button
              onClick={() => { setRenameModal({ job: contextMenu.job, title: contextMenu.job.title }); setContextMenu(null) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '10px 16px',
                border: 'none', background: 'transparent',
                fontSize: 13, fontWeight: 600, color: 'var(--text)',
                cursor: 'pointer', textAlign: 'left',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--sb-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              ✏️ Rename
            </button>
            <div style={{ height: 1, background: 'var(--card-border)', margin: '2px 0' }} />
            <button
              onClick={() => handleDeleteJob(contextMenu.job)}
              disabled={isDeletingJob}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '10px 16px',
                border: 'none', background: 'transparent',
                fontSize: 13, fontWeight: 600, color: '#ef4444',
                cursor: isDeletingJob ? 'not-allowed' : 'pointer', textAlign: 'left',
              }}
              onMouseEnter={e => !isDeletingJob && (e.currentTarget.style.background = 'rgba(239,68,68,0.07)')}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              🗑️ {isDeletingJob ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </>
      )}

      {/* Rename Modal */}
      {renameModal && (
        <Modal open onClose={() => setRenameModal(null)} title="Rename Designation">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--text-mid)' }}>Enter a new name for <strong>{renameModal.job.title}</strong></p>
            <input
              className="input-base"
              value={renameModal.title}
              autoFocus
              onChange={e => setRenameModal(p => p ? { ...p, title: e.target.value } : null)}
              onKeyDown={e => { if (e.key === 'Enter') handleRenameJob() }}
              placeholder="New designation name"
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setRenameModal(null)} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-mid)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={handleRenameJob}
                disabled={isRenamingJob || !renameModal.title.trim()}
                style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: 'var(--violet)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: isRenamingJob ? 'not-allowed' : 'pointer', opacity: isRenamingJob ? 0.7 : 1 }}
              >
                {isRenamingJob ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Jobs Tabs Row */}
      <div className="flex items-center gap-3 px-1 mb-2 overflow-x-auto w-full" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <style dangerouslySetInnerHTML={{__html: `::-webkit-scrollbar { display: none; }`}} />
        <div className="flex items-center gap-2 flex-nowrap">
          <button
            onClick={() => { setSelectedJobId('all'); setPage(1); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 10,
              border: selectedJobId === 'all' ? `1.5px solid var(--violet)` : '1.5px solid var(--table-border)',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: selectedJobId === 'all' ? 'var(--sb-active)' : 'var(--kpi-bg)',
              color: selectedJobId === 'all' ? 'var(--violet)' : 'var(--text-mid)',
              transition: 'all 0.18s',
              whiteSpace: 'nowrap', flexShrink: 0
            }}
          >
            All
          </button>
          {(allJobs || []).map((job: any) => {
            const isActive = selectedJobId === job.id;
            return (
              <button
                key={job.id}
                onClick={() => { setSelectedJobId(job.id); setPage(1); }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ x: e.clientX, y: e.clientY, job });
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 10,
                  border: isActive ? `1.5px solid var(--violet)` : '1.5px solid var(--table-border)',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  background: isActive ? 'var(--sb-active)' : 'var(--kpi-bg)',
                  color: isActive ? 'var(--violet)' : 'var(--text-mid)',
                  transition: 'all 0.18s',
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                {job.title}
              </button>
            )
          })}
          {/* + Add Designation button */}
          <button
            onClick={() => { setShowAddJobModal(true); setTimeout(() => newJobInputRef.current?.focus(), 80) }}
            title="Add new designation"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              border: '1.5px dashed var(--violet)',
              background: 'var(--sb-active)',
              color: 'var(--violet)',
              cursor: 'pointer', fontSize: 18, fontWeight: 700,
              transition: 'all 0.18s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(108,71,255,0.18)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--sb-active)' }}
          >
            +
          </button>
        </div>
      </div>

      {/* Column headers */}
      <div className="hidden lg:grid" style={{
        gridTemplateColumns: '2fr 96px 1.5fr 60px 120px 100px 210px',
        gap: 14, padding: '0 24px',
        fontSize: 10, fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.8px',
      }}>
        <span>Candidate</span>
        <span style={{ textAlign: 'center' }}>Date</span>
        <span>Role</span>
        <span style={{ textAlign: 'center' }}>Exp</span>
        <span style={{ textAlign: 'center' }}>Stage</span>
        <span style={{ textAlign: 'center' }}>Added By</span>
        <span style={{ textAlign: 'center' }}>Actions</span>
      </div>

      {/* Rows */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 18, borderRadius: 14, background: 'var(--kpi-bg)', border: '1px solid var(--table-border)' }}>
              <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                <Skeleton className="h-4 w-44" /><Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" /><Skeleton className="h-8 w-24 rounded-lg" />
            </div>
          ))}
        </div>
      ) : !filteredItems.length ? (
        <EmptyState title="No talent found" description={search ? 'Try adjusting your search.' : 'No candidates in the talent pool yet.'} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredItems.map((candidate: any) => {
            const stage = candidate.pipeline_stage
            const stageCfg = stage ? STAGE_CFG[stage] : null
            const hasInvitation = candidate.invitations?.length > 0

            return (
              <div key={candidate.id}
                className="flex flex-col lg:grid gap-4 lg:gap-[14px] p-5 lg:px-6 lg:py-3.5"
                style={{
                  gridTemplateColumns: '2fr 96px 1.5fr 60px 120px 100px 210px',
                  alignItems: 'center', borderRadius: 14,
                  background: 'var(--kpi-bg)', border: '1px solid var(--table-border)',
                  boxShadow: 'var(--shadow)', transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--violet)'; el.style.boxShadow = 'var(--shadow-h)' }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--table-border)'; el.style.boxShadow = 'var(--shadow)' }}
              >
                {/* Candidate */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <Avatar name={candidate.full_name} src={candidate.avatar_url} size="md" />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--violet)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{candidate.full_name}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{candidate.email}</p>
                  </div>
                </div>

                {/* Date */}
                <p className="text-[12px] text-[var(--text-mid)] lg:text-center">{formatCandidateDate(candidate, 'dd MMM yyyy')}</p>

                {/* Role */}
                <p className="text-[13px] text-[var(--text-mid)] truncate">{candidate.applied_job_title || candidate.current_title || '—'}</p>

                {/* Exp */}
                <p className="lg:text-center text-[12px] font-semibold text-[var(--text-mid)]">
                  {candidate.experience_years || (candidate.years_experience != null ? `${candidate.years_experience}y` : (candidate.relevant_experience || '—'))}
                </p>

                {/* Stage */}
                <div className="lg:flex lg:justify-center">
                  {stageCfg ? (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: stageCfg.bg, color: stageCfg.color, whiteSpace: 'nowrap' }}>{stageCfg.label}</span>
                  ) : (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(108,71,255,0.05)', color: 'var(--text-light)', border: '1px dashed var(--table-border)' }}>
                      {candidate.match_score != null ? 'New' : 'Unprocessed'}
                    </span>
                  )}
                </div>

                {/* Added By */}
                <p className="text-[11px] font-semibold text-[var(--text-mid)] lg:text-center">{candidate.created_by_name || 'Admin'}</p>

                {/* Actions */}
                <div className="flex items-center lg:justify-end gap-2" style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                  <button onClick={e => { e.stopPropagation(); setViewTarget(candidate) }}
                    className="text-[11px] flex items-center justify-center gap-1.5 font-bold px-4 py-2 rounded-lg bg-[#6c47ff] text-white shadow-sm hover:bg-[#5a3ae6] transition-all">
                    View Full Profile
                  </button>

                  <div style={{ position: 'relative' }}>
                    <button
                      ref={(el) => { actionTriggerRefs.current[candidate.id] = el }}
                      onClick={e => { e.stopPropagation(); setOpenDropdownId(openDropdownId === candidate.id ? null : candidate.id) }}
                      className="w-8 h-8 rounded-lg border border-gray-200 dark:border-[var(--card-border)] flex items-center justify-center hover:bg-gray-50 dark:hover:bg-[var(--color-bg-sidebar)] transition-colors text-[var(--text)]">
                      ⋯
                    </button>
                    <AnimatePresence>
                      {openDropdownId === candidate.id && (
                        <StageDropdown
                          candidateId={candidate.id}
                          currentStage={stage || 'applied'}
                          onSelect={s => stageMutation.mutate({ id: candidate.id, stage: s })}
                          onDelete={id => setCandidateToDelete({ id, name: candidate.full_name })}
                          onClose={() => setOpenDropdownId(null)}
                          user={user}
                          onViewProfile={() => {
                            setViewTarget(candidate)
                            candidatesApi.recordView(candidate.id)
                          }}
                          hasActiveJobs={!!(activeJobs && activeJobs.length > 0)}
                          isInPipeline={Boolean(stageCfg)}
                          triggerEl={actionTriggerRefs.current[candidate.id] || null}
                          onAddToPipeline={() => {
                            const resolvedJobId = resolveJobForCandidate(candidate)
                            if (!resolvedJobId) {
                              toast.error('No matching designation found from resume/profile for active jobs.')
                              return
                            }
                            handleAddToPipeline(candidate.id, resolvedJobId)
                          }}

                        />
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {data && data.pages > 1 && (
        <Pagination page={data.page} pages={data.pages} total={data.total} limit={data.limit} onPage={setPage} />
      )}

      {/* Profile Modal */}
      {viewTarget && (
        <Modal open onClose={() => setViewTarget(null)} title="Candidate Profile" size="xl">
          <CandidateProfileView 
            candidate={viewTarget} 
            onInvite={() => inviteMutation.mutate({ email: viewTarget.email, full_name: viewTarget.full_name })}
            onSchedule={() => navigate(`${basePath}/interviews?candidateId=${viewTarget.id}`)}
            hasInvitation={Boolean(viewTarget.invitations && viewTarget.invitations.length > 0)}
          />
        </Modal>
      )}

      {/* Quick Add Designation Modal */}
      {showAddJobModal && (
        <Modal open onClose={() => { setShowAddJobModal(false); setNewJobTitle('') }} title="Add New Designation" size="sm">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.6 }}>
              Create a new job designation. It will appear in the Jobs tabs immediately — even before any candidates are added.
            </p>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-mid)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>
                Designation / Job Title
              </label>
              <input
                ref={newJobInputRef}
                className="input-base"
                placeholder="e.g. Senior React Developer"
                value={newJobTitle}
                onChange={e => setNewJobTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateJob(); if (e.key === 'Escape') { setShowAddJobModal(false); setNewJobTitle('') } }}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleCreateJob}
                disabled={isCreatingJob || !newJobTitle.trim()}
                style={{
                  flex: 1, padding: '10px', borderRadius: 10,
                  background: 'linear-gradient(135deg,#6c47ff,#8b6bff)',
                  color: '#fff', border: 'none', fontWeight: 700, fontSize: 13,
                  cursor: isCreatingJob || !newJobTitle.trim() ? 'not-allowed' : 'pointer',
                  opacity: isCreatingJob || !newJobTitle.trim() ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {isCreatingJob ? 'Creating...' : '+ Add Designation'}
              </button>
              <button
                onClick={() => { setShowAddJobModal(false); setNewJobTitle('') }}
                style={{ padding: '10px 16px', borderRadius: 10, border: '1.5px solid var(--table-border)', background: 'var(--kpi-bg)', color: 'var(--text-mid)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      <BulkImportModal
        open={showBulkImportModal}
        onClose={() => setShowBulkImportModal(false)}
        onSuccess={handleBulkImportSuccess}
      />
      <BulkImportHistoryModal
        open={showBulkImportHistoryModal}
        onClose={() => setShowBulkImportHistoryModal(false)}
        onRollbackSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['all-talent-full'] })
          queryClient.invalidateQueries({ queryKey: ['candidates'] })
        }}
      />

      {candidateToDelete && (
        <Modal
          open={!!candidateToDelete}
          onClose={() => setCandidateToDelete(null)}
          title="Delete Candidate"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              Are you sure you want to delete <strong>{candidateToDelete.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  deleteMutation.mutate(candidateToDelete.id)
                  setCandidateToDelete(null)
                }}
                className="flex-1 text-[12px] font-bold px-4 py-2.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Delete Candidate
              </button>
              <button
                onClick={() => setCandidateToDelete(null)}
                className="flex-1 text-[12px] font-bold px-4 py-2.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {jobToDelete && (
        <Modal
          open={!!jobToDelete}
          onClose={() => setJobToDelete(null)}
          title="Delete Designation"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              Are you sure you want to delete <strong>{jobToDelete.title}</strong>? This action cannot be undone.
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={isDeletingJob}
                onClick={confirmDeleteJob}
                className="flex-1 text-[12px] font-bold px-4 py-2.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {isDeletingJob ? 'Deleting...' : 'Delete Designation'}
              </button>
              <button
                onClick={() => setJobToDelete(null)}
                className="flex-1 text-[12px] font-bold px-4 py-2.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
