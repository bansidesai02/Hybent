import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { candidatesApi } from '@/api/candidates'
import { scorecardsApi } from '@/api/scorecards'
import { preScreeningApi } from '@/api/preScreening'
import type { KanbanCard, Scorecard } from '@/types'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'
import { Skeleton } from '@/components/ui/Skeleton'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import { ScoreRing } from '@/components/ui/ScoreRing'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Star, Mail, Search, Bookmark, X, Mic, Loader2 } from 'lucide-react'
import { GlassIcon } from '@/components/common/GlassIcon'
import { formatDate, timeAgo } from '@/utils/formatters'

function ScorecardItem({ scorecard }: { scorecard: Scorecard }) {
  return (
    <div className="bg-white dark:bg-[var(--card-bg)] border border-gray-100 dark:border-[var(--card-border)] rounded-xl p-4 space-y-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar name={scorecard.submitted_by_name ?? 'Reviewer'} size="sm" />
          <div>
            <span className="text-sm font-bold text-gray-900 dark:text-[var(--text)] block leading-tight">
              {scorecard.submitted_by_name ?? 'Anonymous'}
            </span>
            <span className="text-[10px] text-gray-400 uppercase tracking-widest">{formatDate(scorecard.submitted_at)}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex text-amber-400">
            {Array.from({ length: 5 }).map((_, i) => (
              <svg
                key={i}
                className={`w-3.5 h-3.5 ${i < scorecard.overall_rating ? 'fill-current' : 'fill-gray-200 dark:fill-gray-800'}`}
                viewBox="0 0 24 24"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            ))}
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border border-current bg-opacity-10 uppercase ${scorecard.recommendation.includes('yes') ? 'text-emerald-600 bg-emerald-50' :
            scorecard.recommendation === 'maybe' ? 'text-amber-600 bg-amber-50' : 'text-red-500 bg-red-50'
            }`}>
            {scorecard.recommendation.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {scorecard.summary && (
        <p className="text-sm text-gray-600 dark:text-[var(--text-light)] leading-relaxed italic border-l-2 border-violet-100 dark:border-[var(--violet)]/40 pl-3">
          "{scorecard.summary}"
        </p>
      )}

      {scorecard.criteria_scores && Array.isArray(scorecard.criteria_scores) && scorecard.criteria_scores.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 py-1">
          {scorecard.criteria_scores.map((s, i) => (
            <div key={i} className="flex items-center justify-between bg-gray-50 dark:bg-[var(--sb-hover)] px-2 py-1.5 rounded-xl border border-gray-100 dark:border-[var(--border)]/50">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tight truncate mr-2">{s.criterion}</span>
              <div className="flex text-amber-400 flex-shrink-0">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star 
                    key={star} 
                    size={10} 
                    fill={star <= s.score ? 'currentColor' : 'transparent'} 
                    className={star <= s.score ? 'opacity-100' : 'opacity-20 text-gray-300 dark:text-gray-700'} 
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CardDetailModal({ card, onClose }: { card: KanbanCard; onClose: () => void }) {
  const navigate = useNavigate()
  const [preScreenLoading, setPreScreenLoading] = useState(false)

  const { data: scorecards, isLoading: scLoading } = useQuery({
    queryKey: ['scorecards', 'candidate', card.id],
    queryFn: () => scorecardsApi.getForApplication(card.id).then((r) => r.data).catch(() => []),
  })

  const handleRequestPreScreening = async () => {
    setPreScreenLoading(true)
    try {
      const res = await preScreeningApi.createSession({ candidate_id: card.id })
      toast.success(`Pre-screening invite sent to ${card.candidate_email}`)
      onClose()
      navigate(`/recruiter/pre-screening/${res.data.id}`)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to create pre-screening session')
    } finally {
      setPreScreenLoading(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Candidate Details" size="lg">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 p-1">
          <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-5 min-w-0 font-sans">
            <Avatar name={card.candidate_name} src={card.avatar_url} size="xl" className="ring-4 ring-violet-50 shadow-sm" />
            <div className="min-w-0 space-y-0.5">
              <h3 className="text-xl font-black text-gray-900 dark:text-[var(--text)]" style={{ fontFamily: "'Fraunces', serif" }}>{card.candidate_name}</h3>
              <p className="text-gray-500 dark:text-[var(--text-mid)] text-sm font-bold uppercase tracking-wide">{card.current_title || 'Software Engineer'}</p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-1.5 text-[11px] text-gray-400 font-bold uppercase tracking-wider">
                <span className="flex items-center gap-1 shadow-sm">
                  <Mail size={14} className="text-violet-500" />
                  {card.candidate_email}
                </span>
                <span className="opacity-30">•</span>
                <span>Applied {formatDate(card.applied_at)}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center gap-3 self-center">
            <div className="flex-shrink-0 flex flex-col items-center gap-1.5 p-3 bg-violet-50 dark:bg-[var(--violet)]/10 rounded-2xl border border-violet-100/50 dark:border-[var(--violet)]/20 w-32 sm:w-auto">
              <ScoreRing score={card.match_score} size={60} strokeWidth={5} />
              <span className="text-[9px] font-black text-violet-600 dark:text-[var(--violet)] uppercase tracking-widest">AI Match</span>
            </div>
            <button
              onClick={handleRequestPreScreening}
              disabled={preScreenLoading}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-bold transition-all"
              style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.15)' }}
            >
              {preScreenLoading ? <Loader2 size={13} className="animate-spin" /> : <Mic size={13} />}
              Pre-Screen
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-gray-50 dark:bg-[var(--sb-hover)] rounded-2xl p-4 border border-gray-100 dark:border-[var(--border)]">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Status</p>
            <p className="text-sm font-bold text-violet-600 dark:text-[var(--violet)]">Active</p>
          </div>
          <div className="bg-gray-50 dark:bg-[var(--sb-hover)] rounded-2xl p-4 border border-gray-100 dark:border-[var(--border)]">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Last Activity</p>
            <p className="text-sm font-bold text-gray-900 dark:text-[var(--text)]">{timeAgo(card.stage_changed_at || card.applied_at)}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-gray-900 dark:text-[var(--text)] uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-violet-500 shadow-sm shadow-violet-200"></span>
              Interview Evaluations
            </h4>
            <span className="text-[10px] bg-violet-100 dark:bg-[var(--violet)]/30 text-violet-600 dark:text-[var(--violet)] px-2 py-0.5 rounded-full font-bold">
              {scorecards?.length || 0} Submitted
            </span>
          </div>

          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
            {scLoading ? (
              [1, 2].map((i: number) => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)
            ) : !scorecards || scorecards.length === 0 ? (
              <div className="text-center py-10 bg-gray-50 dark:bg-[var(--sb-hover)] rounded-2xl border border-dashed border-gray-200 dark:border-[var(--border)]">
                <p className="text-sm text-gray-400 italic">No evaluations submitted yet.</p>
              </div>
            ) : (
              scorecards.map((sc: Scorecard) => <ScorecardItem key={sc.id} scorecard={sc} />)
            )}
          </div>
        </div>

        {card.recruiter_notes && (
          <div className="bg-violet-50 dark:bg-[var(--violet)]/10 rounded-2xl p-5 border border-violet-100 dark:border-[var(--violet)]/30">
            <h4 className="text-[10px] font-bold text-violet-700 dark:text-[var(--violet)] uppercase tracking-widest mb-2">AI Summary</h4>
            <p className="text-sm text-violet-900 dark:text-[var(--text-mid)] leading-relaxed font-medium">
              {card.recruiter_notes}
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}

function BoardSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="w-72 flex-shrink-0 space-y-3">
          <Skeleton className="h-6 w-24 rounded-lg" />
          {Array.from({ length: 3 }).map((_, j) => (
            <div key={j} className="p-4 rounded-xl border border-gray-100 dark:border-[var(--border)] space-y-2 bg-white dark:bg-[var(--card-bg)]/50">
              <div className="flex items-center gap-2">
                <Skeleton className="w-8 h-8 rounded-full" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default function PipelinePage() {
  const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null)
  const [search, setSearch] = useState('')

  // Saved Views State
  const [savedViews, setSavedViews] = useState<any[]>(() => {
    return JSON.parse(localStorage.getItem('hireon_pipeline_saved_views') || '[]')
  })
  const [newViewName, setNewViewName] = useState('')
  const [activeViewId, setActiveViewId] = useState<string | null>(null)

  const saveCurrentView = () => {
    if (!newViewName.trim()) {
      toast.error('Please enter a name for the view')
      return
    }
    const newView = {
      id: crypto.randomUUID(),
      name: newViewName.trim(),
      search,
    }
    const updated = [...savedViews, newView]
    setSavedViews(updated)
    localStorage.setItem('hireon_pipeline_saved_views', JSON.stringify(updated))
    setActiveViewId(newView.id)
    setNewViewName('')
    toast.success(`Pipeline view "${newView.name}" saved successfully!`)
  }

  const loadSavedView = (view: any) => {
    setSearch(view.search || '')
    setActiveViewId(view.id)
    toast.success(`Loaded pipeline view "${view.name}"`)
  }

  const deleteActiveView = () => {
    if (!activeViewId) return
    const updated = savedViews.filter(v => v.id !== activeViewId)
    setSavedViews(updated)
    localStorage.setItem('hireon_pipeline_saved_views', JSON.stringify(updated))
    setActiveViewId(null)
    toast.success('Saved view deleted')
  }

  const { data: pipelineStages, isLoading } = useQuery({
    queryKey: ['candidates_pipeline'],
    queryFn: () => candidatesApi.getPipeline().then((r) => r.data),
  })

  const mapCandidateToCard = useCallback((c: any): KanbanCard => {
    return {
      id: c.id,
      application_id: c.application_id || c.id, // Ensure application_id is present
      candidate_name: c.full_name,
      candidate_email: c.email,
      avatar_url: c.avatar_url,
      match_score: c.match_score,
      applied_at: c.created_at,
      stage_changed_at: c.updated_at,
      recruiter_notes: c.summary,
      skills: c.skills || [],
      current_title: c.current_title,
      created_by_name: c.created_by_name,
    }
  }, [])

  const filterCandidates = useCallback((list: any[]) => {
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter((c: any) => 
      c.candidate_name.toLowerCase().includes(q) ||
      (c.candidate_email && c.candidate_email.toLowerCase().includes(q)) ||
      (c.current_title && c.current_title.toLowerCase().includes(q)) ||
      (c.skills && c.skills.some((s: string) => s.toLowerCase().includes(q)))
    )
  }, [search])

  const pipelineData = pipelineStages ? {
    stages: {
      applied: filterCandidates((pipelineStages.applied || []).map(mapCandidateToCard)),
      screening: filterCandidates((pipelineStages.screening || []).map(mapCandidateToCard)),
      interview: filterCandidates((pipelineStages.interview || []).map(mapCandidateToCard)),
      interviewed: filterCandidates((pipelineStages.interviewed || []).map(mapCandidateToCard)),
      offer: filterCandidates((pipelineStages.offer || []).map(mapCandidateToCard)),
      rejected: filterCandidates((pipelineStages.rejected || []).map(mapCandidateToCard)),
      inactive: filterCandidates((pipelineStages.inactive || []).map(mapCandidateToCard)),
    }
  } : null

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-[var(--text)]" style={{ fontFamily: "'Fraunces', serif" }}>Pipeline</h1>
        <p className="text-sm text-gray-500 dark:text-[var(--text-mid)] mt-1">Drag candidates across stages — Hybent Hiring AI updates probabilities automatically.</p>
      </div>

      {/* Controls: Search & Saved Views */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-gray-100 dark:border-[#2a2550] bg-white/60 dark:bg-[#161233]/60 backdrop-blur-md shadow-sm">
        {/* Search */}
        <div className="w-full md:w-[320px]">
          <Input
            placeholder="Search candidate name, email, role, skill..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search size={15} />}
          />
        </div>

        {/* Saved Views commented out
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-300">
            <GlassIcon icon="Bookmark" variant="violet" size={24} iconSize={12} ghost glow={false} />
            <span>Pipeline Views:</span>
          </div>

          {savedViews.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {savedViews.map((view) => (
                <div key={view.id} className="flex items-center gap-1">
                  <button
                    onClick={() => loadSavedView(view)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      activeViewId === view.id
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'bg-gray-100 hover:bg-gray-200 dark:bg-[#201c3b] dark:hover:bg-[#2a2550] text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {view.name}
                  </button>
                  {activeViewId === view.id && (
                    <button
                      onClick={deleteActiveView}
                      className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
                      title="Delete saved view"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <span className="text-xs text-gray-400">No saved views yet</span>
          )}

          <div className="hidden md:block h-4 w-px bg-gray-200 dark:bg-[#201c3b]" />

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Save as view..."
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              className="px-3 py-1 text-xs rounded-lg border border-gray-200 dark:border-[#2a2550] bg-white dark:bg-[#1a1730] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:border-violet-500"
              style={{ width: '130px' }}
            />
            <button
              onClick={saveCurrentView}
              className="px-3 py-1 rounded-lg bg-violet-50 hover:bg-violet-100 dark:bg-[#201c3b] dark:hover:bg-[#2a2550] text-violet-600 dark:text-[#ede9ff] text-xs font-bold transition-colors"
            >
              Save View
            </button>
          </div>
        </div>
        */}
      </div>

      <div className="flex-1 min-h-0 pt-4 border-t border-gray-200 dark:border-[var(--border)]">
        {isLoading ? (
          <BoardSkeleton />
        ) : pipelineData ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="h-full"
          >
            <KanbanBoard
              data={pipelineData}
              onCardClick={(card) => {
                setSelectedCard(card)
              }}
            />
          </motion.div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              title="No candidates in pipeline"
              description="Candidates will appear here as they move through the recruitment stages."
            />
          </div>
        )}
      </div>

      {selectedCard && (
        <CardDetailModal card={selectedCard} onClose={() => setSelectedCard(null)} />
      )}
    </div>
  )
}
