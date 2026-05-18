import { useState, useCallback, useRef, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { talentPoolApi } from '@/api/talentPool'
import { candidatesApi } from '@/api/candidates'
import { jobsApi } from '@/api/jobs'
import { GlassIcon } from '@/components/common/GlassIcon'
import type { Candidate } from '@/types'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ScoreRing } from '@/components/ui/ScoreRing'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { Modal } from '@/components/ui/Modal'
import { formatDate } from '@/utils/formatters'
import { CandidateProfileView } from '@/components/recruiter/CandidateProfileView'
import { ArrowRight, Check, Zap, Pin } from 'lucide-react'

// ─── Abbreviation expansion map ──────────────────────────────────────────────
// Maps shorthand/acronym → expanded search terms
const SHORTCUTS: Record<string, string> = {
  // Business roles
  bde:  'Business Development Executive',
  bdm:  'Business Development Manager',
  bda:  'Business Development Associate',
  // Engineering
  sde:  'Software Development Engineer',
  swe:  'Software Engineer',
  fe:   'Frontend Engineer',
  be:   'Backend Engineer',
  fs:   'Full Stack',
  mern: 'MERN Stack',
  mean: 'MEAN Stack',
  // Management
  pm:   'Product Manager',
  po:   'Product Owner',
  em:   'Engineering Manager',
  hr:   'Human Resources',
  // Data
  ds:   'Data Scientist',
  da:   'Data Analyst',
  de:   'Data Engineer',
  ml:   'Machine Learning',
  ai:   'Artificial Intelligence',
  // Sales & Marketing
  se:   'Sales Executive',
  sm:   'Sales Manager',
  mkt:  'Marketing',
  // Design
  ux:   'UX Designer',
  ui:   'UI Designer',
  // QA
  qa:   'Quality Assurance',
  qe:   'Quality Engineer',
  // DevOps
  sre:  'Site Reliability Engineer',
  dvo:  'DevOps',
}

function expandShortcut(raw: string): string {
  const trimmed = raw.trim().toLowerCase()
  return SHORTCUTS[trimmed] ?? raw
}

// Suggest matching shortcuts for the current input
function getSuggestions(input: string): { shortcut: string; expanded: string }[] {
  if (!input || input.length < 1) return []
  const lower = input.toLowerCase()
  return Object.entries(SHORTCUTS)
    .filter(([key, val]) =>
      key.startsWith(lower) || val.toLowerCase().includes(lower)
    )
    .slice(0, 6)
    .map(([shortcut, expanded]) => ({ shortcut: shortcut.toUpperCase(), expanded }))
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatCard({ title, value, subtitle, icon, filterLabel, trend }: {
  title: string; value: string | number; subtitle: string; icon: React.ReactNode
  filterLabel: string
  trend?: { label: string; color: string }
}) {
  return (
    <Card className="relative overflow-hidden group border-none bg-white dark:bg-[var(--card-bg)] shadow-sm hover:shadow-md transition-all duration-300">
      <div className="flex justify-between items-start">
        <div className="p-3 bg-violet-100 dark:bg-[var(--color-bg-sidebar)] rounded-2xl text-[var(--violet)] group-hover:scale-110 transition-transform">
          {icon}
        </div>
        {trend && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${trend.color} bg-opacity-10 opacity-80`}>
            {trend.label}
          </span>
        )}
      </div>
      <div className="mt-4">
        <h3 className="text-3xl font-black text-gray-900 dark:text-[var(--text)] tracking-tight">{value}</h3>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1">{title}</p>
        <div className="mt-4 flex items-center justify-between">
          <p className="text-[10px] text-gray-500 dark:text-[var(--text-mid)] font-medium">{subtitle}</p>
          <span className="text-[10px] text-emerald-500 font-bold px-2 py-0.5 bg-emerald-500/10 rounded-full">{filterLabel}</span>
        </div>
      </div>
    </Card>
  )
}

function SuggestedMatchItem({ candidate, jobTitle, highlightTerm, onReengage }: { 
  candidate: any; 
  jobTitle: string;
  highlightTerm?: string;
  onReengage?: () => void;
}) {
  const highlight = highlightTerm?.toLowerCase() || ''
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
      className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 bg-white dark:bg-[var(--card-bg)] rounded-2xl border border-gray-100 dark:border-[var(--card-border)] group hover:border-[var(--violet)]/30 transition-all shadow-sm gap-4"
    >
      <div className="flex items-center gap-4 w-full">
        <Avatar name={candidate.full_name} src={candidate.avatar_url} size="md" className="ring-2 ring-violet-100 dark:ring-[var(--violet)] flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <h4 className="font-bold text-gray-900 dark:text-[var(--text)] group-hover:text-[var(--violet)] transition-colors truncate">
            {candidate.full_name} <ArrowRight size={12} className="inline mx-1 opacity-50" /> {candidate.current_title}
          </h4>
          <p className="text-[11px] text-gray-400 dark:text-[var(--text-mid)] mt-0.5">
            AI Score match for {jobTitle}: <span className="font-bold text-emerald-500">{candidate.match_score}%</span>
          </p>
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {candidate.skills?.map((s: string) => {
              const isMatch = highlight && s.toLowerCase().includes(highlight)
              return (
                <span key={s} className={`text-[9px] uppercase tracking-tighter px-2 py-0.5 rounded border font-bold transition-all ${
                  isMatch 
                  ? "bg-[var(--violet)] text-white border-[var(--violet)] shadow-sm" 
                  : "bg-gray-100 dark:bg-[var(--card-bg)] text-gray-500 dark:text-[var(--text-mid)] border-gray-100 dark:border-[var(--card-border)]"
                }`}>
                  {s}
                </span>
              )
            })}
          </div>
          <p className="text-[10px] text-gray-400 dark:text-[var(--text-mid)] mt-2 flex items-center gap-1.5 font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--violet)]"></span>
            Added By: <span className="text-[var(--violet)]">{candidate.created_by_name || 'Admin'}</span>
          </p>
        </div>
      </div>
      <Button 
        size="sm" 
        onClick={onReengage}
        className="w-full max-w-[150px] bg-[var(--violet)] hover:bg-[var(--violet)]/90 text-white rounded-xl text-xs font-black px-6 py-2.5 shadow-lg shadow-violet-200 dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-all hover:scale-105 active:scale-95"
      >
        Re-engage
      </Button>
    </motion.div>
  )
}

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
      className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
      {message}
    </motion.div>
  )
}

function AddCommentModal({ candidate, onClose, onSuccess }: { candidate: Candidate; onClose: () => void; onSuccess: () => void }) {
  const [comment, setComment] = useState(candidate.talent_pool_comment || '')
  const mutation = useMutation({
    mutationFn: () => candidatesApi.update(candidate.id, { talent_pool_comment: comment.trim() }),
    onSuccess,
  })
  return (
    <Modal open onClose={onClose} title={`${candidate.talent_pool_comment ? 'Edit Comment for' : 'Add a Comment to'} ${candidate.full_name}`} size="sm">
      <div className="space-y-4">
        <Input label="Comment" placeholder="e.g. Strong candidate for backend roles, needs follow-up"
          value={comment} onChange={(e) => setComment(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && comment.trim() && mutation.mutate()} />
        {mutation.isError && <p className="text-sm text-red-500">Failed to save comment.</p>}
        <div className="flex gap-3 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={!comment.trim()}>
            {candidate.talent_pool_comment ? 'Save Changes' : 'Add Comment'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function CandidateProfileModal({ candidate, onClose }: { candidate: Candidate; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title="Candidate Profile" size="lg">
      <CandidateProfileView candidate={candidate} />
    </Modal>
  )
}

// ─── Shortcut autocomplete dropdown ──────────────────────────────────────────
function ShortcutDropdown({ suggestions, onSelect }: {
  suggestions: { shortcut: string; expanded: string }[]
  onSelect: (expanded: string) => void
}) {
  if (!suggestions.length) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
      className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[var(--card-bg)] border border-violet-100 dark:border-[var(--card-border)] rounded-2xl shadow-2xl z-50 overflow-hidden"
    >
      <div className="p-2 border-b border-gray-100 dark:border-[var(--card-border)] px-4 py-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--violet)] flex items-center gap-1">
          <Zap size={10} fill="currentColor" /> Shortcuts
        </span>
      </div>
      {suggestions.map(({ shortcut, expanded }) => (
        <button
          key={shortcut}
          onClick={() => onSelect(expanded)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-violet-50 dark:hover:bg-[var(--violet)]/10 transition-colors group"
        >
          <span className="font-black text-[var(--violet)] text-xs bg-violet-100 dark:bg-[var(--violet-10)] px-2 py-0.5 rounded-lg min-w-[40px] text-center">
            {shortcut}
          </span>
          <span className="text-sm font-medium text-gray-700 dark:text-[var(--text-mid)] group-hover:text-[var(--violet)] dark:group-hover:text-[var(--violet)]">
            {expanded}
          </span>
        </button>
      ))}
    </motion.div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TalentPoolPage() {
  const { basePath } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [selectedJobTitle, setSelectedJobTitle] = useState<string | null>(null)
  const [skill, setSkill] = useState('')
  const [minExp, setMinExp] = useState('')
  const [page, setPage] = useState(1)
  const [commentTarget, setCommentTarget] = useState<Candidate | null>(null)
  const [viewTarget, setViewTarget] = useState<Candidate | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [selectedJobIndex, setSelectedJobIndex] = useState(0)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  // Active jobs for filter chips
  const { data: jobsData } = useQuery({
    queryKey: ['active-jobs'],
    queryFn: () => jobsApi.list({ status: 'active', limit: 20 }).then(r => r.data),
  })
  const activeJobs = jobsData?.items ?? []

  const suggestions = getSuggestions(searchInput)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSearchSubmit = () => {
    const expanded = expandShortcut(searchInput)
    setSearch(expanded)
    setPage(1)
    setDropdownOpen(false)
  }

  const handleShortcutSelect = (expanded: string) => {
    setSearchInput(expanded)
    setSearch(expanded)
    setPage(1)
    setDropdownOpen(false)
  }

  const handleJobChip = (jobTitle: string) => {
    if (selectedJobTitle === jobTitle) {
      setSelectedJobTitle(null)
    } else {
      setSelectedJobTitle(jobTitle)
    }
    setPage(1)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['talent-pool', page, search, skill, minExp, selectedJobTitle],
    queryFn: () =>
      talentPoolApi.list({
        page, limit: 12,
        search: search || undefined,
        skill: skill || undefined,
        min_experience: minExp ? parseInt(minExp) : undefined,
        job_title: selectedJobTitle || undefined,
      }).then(r => r.data),
  })

  const { data: stats } = useQuery({
    queryKey: ['talent-pool-stats'],
    queryFn: () => talentPoolApi.getStats().then((r) => r.data),
  })

  const { data: suggestionsData, isLoading: suggestionsLoading } = useQuery({
    queryKey: ['talent-pool-suggestions'],
    queryFn: () => talentPoolApi.getSuggestedMatches().then((r) => r.data),
  })

  // Auto-sync "Recent DB Matches" tab when search or job filter changes
  useEffect(() => {
    if (!suggestionsData || suggestionsData.length === 0) return
    const query = (selectedJobTitle || search || '').toLowerCase().trim()
    if (!query) return

    const bestIdx = suggestionsData.findIndex(s => {
      const title = s.job_title.toLowerCase()
      return title.includes(query) || query.includes(title)
    })

    if (bestIdx !== -1 && bestIdx !== selectedJobIndex) {
      setSelectedJobIndex(bestIdx)
    }
  }, [search, selectedJobTitle, suggestionsData, selectedJobIndex])

  const currentJobSuggestions = suggestionsData?.[selectedJobIndex]
  const hasRealSuggestions = suggestionsData && suggestionsData.length > 0

  const reengageMutation = useMutation({
    mutationFn: ({ candidateId, jobId }: { candidateId: string; jobId: string }) => 
      candidatesApi.updateStage(candidateId, 'applied', false, jobId),
    onSuccess: (_, variables) => {
      showToast('Candidate re-engaged and moved to pipeline!')
      // Navigate to main candidates page
      setTimeout(() => navigate(`${basePath}/candidates`), 1500)
    },
    onError: () => showToast('Failed to re-engage candidate.', 'error')
  })

  const hasActiveFilters = search || selectedJobTitle || skill

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20">
      {/* Header */}
      <div className="px-4 md:px-0 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-[var(--text)] tracking-tight" style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 800 }}>
            Talent Database
          </h1>
          <p className="text-sm md:text-base text-gray-500 dark:text-[var(--text-mid)] mt-2 font-medium">
            All candidates ever assessed — searchable and re-matchable forever.
          </p>
        </div>
        
        <button
          onClick={() => navigate(`${basePath}/all-talent`)}
          className="px-8 py-3 bg-white dark:bg-[var(--card-bg)] border-2 border-[var(--violet)] text-[var(--violet)] rounded-2xl text-sm font-black hover:bg-[var(--violet)] hover:text-white transition-all shadow-lg shadow-violet-100 dark:shadow-none flex items-center gap-3 group whitespace-nowrap"
        >
          View All Candidates
          <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* ── Smart Search ── */}
      <div className="bg-white dark:bg-[var(--card-bg)] p-6 rounded-3xl border border-gray-100 dark:border-[var(--card-border)] shadow-xl shadow-gray-200/50 dark:shadow-none space-y-5">
        {/* Search bar with autocomplete */}
        <div className="flex gap-4">
          <div className="flex-1 relative group" ref={searchRef}>
            {/* Search icon */}
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[var(--violet)] z-10">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <input
              value={searchInput}
              onChange={e => {
                setSearchInput(e.target.value)
                setDropdownOpen(true)
              }}
              onFocus={() => setDropdownOpen(true)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSearchSubmit()
                if (e.key === 'Escape') setDropdownOpen(false)
              }}
              placeholder="Try: BDE, SDE, MERN, or type a skill / name…"
              className="w-full pl-12 pr-4 bg-gray-50 dark:bg-[var(--color-bg-sidebar)] border border-gray-100 dark:border-[var(--card-border)] h-14 text-base rounded-2xl focus:outline-none focus:ring-2 focus:ring-[var(--violet)] focus:border-transparent transition-all text-gray-900 dark:text-[var(--text)]"
              style={{ fontSize: 15 }}
            />

            {/* Expanded shortcut indicator */}
            {search && search !== searchInput && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-[var(--violet)] bg-violet-50 dark:bg-[var(--violet-25)] px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Zap size={10} fill="currentColor" /> {search}
                </span>
              </div>
            )}

            {/* Autocomplete dropdown */}
            <AnimatePresence>
              {dropdownOpen && suggestions.length > 0 && (
                <ShortcutDropdown suggestions={suggestions} onSelect={handleShortcutSelect} />
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={handleSearchSubmit}
            className="h-14 px-8 bg-[var(--violet)] hover:bg-[var(--violet)]/90 text-white rounded-2xl font-bold shadow-lg shadow-violet-200 dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-all hover:scale-[1.02] text-sm"
          >
            Search Talent DB
          </button>
        </div>

        {/* Removed Shortcuts bar as requested */}

        {/* Active Jobs filter chips */}
        {activeJobs.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1">
              <Pin size={10} className="rotate-45" /> Filter by Active Job
            </p>
            <div className="flex flex-wrap gap-2">
              {hasActiveFilters && (
                <button
                  onClick={() => { setSearch(''); setSearchInput(''); setSelectedJobTitle(null); setSkill(''); setPage(1) }}
                  className="px-4 py-1.5 rounded-full text-[11px] font-bold border border-red-200 text-red-500 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 transition-colors"
                >
                  ✕ Clear
                </button>
              )}
              {activeJobs.map((job: any) => (
                <button
                  key={job.id}
                  onClick={() => handleJobChip(job.title)}
                  className={`px-4 py-1.5 rounded-full text-[11px] font-bold transition-all border ${
                    selectedJobTitle === job.title
                      ? 'bg-[var(--violet)] text-white border-[var(--violet)] shadow-md shadow-violet-200'
                      : 'bg-gray-100 dark:bg-[var(--card-bg)] text-gray-500 dark:text-[var(--text-mid)] border-gray-200 dark:border-[var(--card-border)] hover:bg-violet-50 hover:text-[var(--violet)] hover:border-violet-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <GlassIcon icon="Briefcase" variant="violet" size={18} iconSize={10} glow={false} />
                    <span>{job.title}</span>
                  </div>
                  {selectedJobTitle === job.title && (
                    <span className="ml-1 bg-white/30 px-1 rounded flex items-center justify-center">
                      <Check size={10} strokeWidth={3} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatCard
          title="Candidates Stored"
          value={stats?.total_candidates?.toLocaleString() || (isLoading ? "..." : "0")}
          subtitle="Candidates Stored"
          filterLabel={selectedJobTitle ? `Filtered: ${selectedJobTitle}` : (search ? `Search: ${search}` : "All time")}
          icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
        />
        <StatCard
          title="Re-matched to New Roles"
          value={stats?.re_matched_count || (isLoading ? "..." : "0")}
          subtitle="Candidates identified for new opportunities"
          filterLabel={selectedJobTitle ? `Filtered: ${selectedJobTitle}` : (search ? `Search: ${search}` : "All time")}
          icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
          trend={{ label: "This quarter", color: "text-emerald-500" }}
        />
      </div>

      {/* Suggested Matches */}
      <div className="bg-white dark:bg-[var(--card-bg)] rounded-3xl border border-gray-100 dark:border-[var(--card-border)] shadow-xl overflow-hidden p-8 space-y-6">
        <div className="flex justify-between items-center sm:items-end flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-[var(--text)] flex items-center gap-2">
              Recent DB Matches
              {currentJobSuggestions?.job_title && (
                <> — <span className="text-[var(--violet)]">{currentJobSuggestions.job_title}</span></>
              )}
            </h2>
            {hasRealSuggestions && (
              <div className="flex gap-2 mt-3">
                {suggestionsData.map((s, idx) => (
                  <button
                    key={s.job_id}
                    onClick={() => setSelectedJobIndex(idx)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                      selectedJobIndex === idx
                      ? "bg-[var(--violet)] text-white border-[var(--violet)] shadow-sm"
                      : "bg-white dark:bg-[var(--card-bg)] text-gray-400 dark:text-[var(--text-mid)] border-gray-100 dark:border-[var(--card-border)] hover:border-violet-200"
                    }`}
                  >
                    {s.job_title}
                  </button>
                ))}
              </div>
            )}
          </div>
          {!suggestionsLoading && hasRealSuggestions && (
            <span className="text-xs font-bold text-[var(--violet)] bg-[var(--violet)]/10 px-3 py-1 rounded-full">
              {currentJobSuggestions?.candidates?.length ?? 0} found
            </span>
          )}
        </div>

        <div className="space-y-4">
          {suggestionsLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)
          ) : !hasRealSuggestions ? (
            <div className="py-10 text-center text-gray-400 italic font-medium">
              No active jobs or no candidates match the threshold yet. Post a job and upload resumes to see AI-matched candidates here.
            </div>
          ) : (currentJobSuggestions?.candidates || []).map((candidate: any) => (
            <SuggestedMatchItem
              key={candidate.id}
              candidate={candidate}
              jobTitle={currentJobSuggestions?.job_title || ''}
              highlightTerm={search || selectedJobTitle || ''}
              onReengage={() => reengageMutation.mutate({ 
                candidateId: candidate.id, 
                jobId: currentJobSuggestions?.job_id || '' 
              })}
            />
          ))}
          {hasRealSuggestions && currentJobSuggestions?.candidates?.length === 0 && (
            <div className="py-10 text-center text-gray-400 italic font-medium">
              No strong candidates found in the pool for this specific role yet.
            </div>
          )}
        </div>
      </div>

      {/* Candidate list removed from here as it is now on its own page */}

      {commentTarget && (
        <AddCommentModal candidate={commentTarget} onClose={() => setCommentTarget(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['talent-pool'] })
            setCommentTarget(null)
            showToast('Comment added!')
          }}
        />
      )}
      {viewTarget && <CandidateProfileModal candidate={viewTarget} onClose={() => setViewTarget(null)} />}
      <AnimatePresence>{toast && <Toast {...toast} />}</AnimatePresence>
    </div>
  )
}
