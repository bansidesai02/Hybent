import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { talentPoolApi } from '@/api/talentPool'
import { candidatesApi } from '@/api/candidates'
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

// --- Components ---

function StatCard({ title, value, subtitle, icon, trend }: { 
  title: string; 
  value: string | number; 
  subtitle: string; 
  icon: React.ReactNode;
  trend?: { label: string; color: string }
}) {
  return (
    <Card className="relative overflow-hidden group border-none bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl shadow-sm hover:shadow-md transition-all duration-300">
      <div className="flex justify-between items-start">
        <div className="p-3 bg-violet-100 dark:bg-violet-900/30 rounded-2xl text-violet-600 dark:text-violet-400 group-hover:scale-110 transition-transform">
          {icon}
        </div>
        {trend && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${trend.color} bg-opacity-10 opacity-80`}>
            {trend.label}
          </span>
        )}
      </div>
      <div className="mt-4">
        <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{value}</h3>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1">{title}</p>
        <div className="mt-4 flex items-center justify-between">
           <p className="text-[10px] text-gray-500 font-medium">{subtitle}</p>
           <span className="text-[10px] text-emerald-500 font-bold px-2 py-0.5 bg-emerald-500/10 rounded-full">All time</span>
        </div>
      </div>
    </Card>
  )
}

function SuggestedMatchItem({ candidate, jobTitle, jobMatchScore }: { 
  candidate: any; 
  jobTitle: string;
  jobMatchScore: number;
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 bg-white/80 dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-700/50 group hover:border-violet-200 dark:hover:border-violet-800/50 transition-all shadow-sm gap-4"
    >
      <div className="flex items-center gap-4 w-full">
        <Avatar name={candidate.full_name} src={candidate.avatar_url} size="md" className="ring-2 ring-violet-100 dark:ring-violet-900/30 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <h4 className="font-bold text-gray-900 dark:text-white group-hover:text-violet-600 transition-colors truncate">
            {candidate.full_name} — {candidate.current_title}
          </h4>
          <p className="text-[11px] text-gray-400 mt-0.5">
            AI Score match for {jobTitle}: <span className="font-bold text-emerald-500">{candidate.match_score || jobMatchScore}%</span>
          </p>
          <div className="flex gap-1 mt-1.5 flex-wrap">
             {candidate.skills?.slice(0, 3).map((s: string) => (
               <span key={s} className="text-[9px] uppercase tracking-tighter px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded border border-gray-100 dark:border-gray-600 font-bold">{s}</span>
             ))}
          </div>
        </div>
      </div>
      <Button size="sm" className="w-full sm:w-auto bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-black px-6 py-2.5 shadow-lg shadow-violet-200 dark:shadow-none transition-all hover:scale-105 active:scale-95">
        Re-engage
      </Button>
    </motion.div>
  )
}

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${
        type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
      }`}
    >
      {message}
    </motion.div>
  )
}

function AddCommentModal({
  candidate,
  onClose,
  onSuccess,
}: {
  candidate: Candidate
  onClose: () => void
  onSuccess: () => void
}) {
  const [comment, setComment] = useState(candidate.summary || '')

  const mutation = useMutation({
    mutationFn: () => candidatesApi.update(candidate.id, { summary: comment.trim() }),
    onSuccess,
  })

  return (
    <Modal open onClose={onClose} title={`Add a Comment to ${candidate.full_name}`} size="sm">
      <div className="space-y-4">
        <Input
          label="Comment"
          placeholder="e.g. Strong candidate for backend roles, needs follow-up"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && comment.trim() && mutation.mutate()}
        />
        {mutation.isError && <p className="text-sm text-red-500">Failed to add comment.</p>}
        <div className="flex gap-3 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!comment.trim()}
          >
            Add Comment
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function CandidateProfileModal({ candidate, onClose }: { candidate: Candidate; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title="Candidate Profile" size="lg">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-start gap-6 pb-6 border-b border-gray-100 dark:border-gray-800">
          <Avatar name={candidate.full_name} src={candidate.avatar_url} size="xl" />
          <div className="flex-1 min-w-0">
            <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight mb-1">
              {candidate.full_name}
            </h3>
            {candidate.current_title && (
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                {candidate.current_title}{candidate.current_company ? ` · ${candidate.current_company}` : ''}
              </p>
            )}
            <p className="text-xs text-gray-400">{candidate.email}</p>
            
            <div className="flex gap-2 mt-4">
               {candidate.match_score != null && (
                <span className="text-[10px] font-bold px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-full border border-emerald-500/20">
                  Match {Math.round(candidate.match_score)}%
                </span>
              )}
              <span className="text-[10px] font-bold px-3 py-1 bg-violet-500/10 text-violet-600 rounded-full border border-violet-500/20 capitalize">
                {candidate.pipeline_stage || 'Talent Pool'}
              </span>
            </div>
          </div>
          
          <div className="flex flex-col gap-2 items-end">
            {candidate.resume_url && (
              <a href={candidate.resume_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-violet-600 hover:text-violet-700 flex items-center gap-1.5 bg-violet-50 dark:bg-violet-900/20 px-3 py-1.5 rounded-xl border border-violet-100 dark:border-violet-800/50 transition-all">
                📄 View Resume
              </a>
            )}
            <div className="flex gap-3 mt-1">
              {candidate.linkedin_url && (
                <a href={candidate.linkedin_url} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-blue-600 transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.238 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                </a>
              )}
              {candidate.github_url && (
                <a href={candidate.github_url} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Experience</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">{candidate.years_experience} Years</p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Location</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">{candidate.location || 'Remote'}</p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Added On</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">{formatDate(candidate.created_at)}</p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Source</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white capitalize">{candidate.source || 'Sourced'}</p>
          </div>
        </div>

        {/* AI Summary */}
        {!!candidate.summary ? (
          <div className="p-6 bg-violet-600 dark:bg-violet-600 text-white rounded-[32px] shadow-xl shadow-violet-200 dark:shadow-none relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-[10px] font-black text-violet-200 uppercase tracking-widest mb-3 flex items-center gap-2">
                 <span className="w-5 h-px bg-violet-200" /> AI Insights & Remarks
              </p>
              <p className="text-lg font-medium leading-relaxed italic">
                "{candidate.summary}"
              </p>
            </div>
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          </div>
        ) : null}

        {/* Skills */}
        <div className="space-y-4">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-3">
             Skills & Expertise <span className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
          </p>
          <div className="flex flex-wrap gap-2">
            {candidate.skills.map(skill => (
              <span key={skill} className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 shadow-sm">
                {skill}
              </span>
            ))}
          </div>
        </div>

        {/* Work History (if parsed_data exists) */}
        {!!candidate.parsed_data?.experience && Array.isArray(candidate.parsed_data.experience) ? (
          <div className="space-y-4">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-3">
               Professional History <span className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
            </p>
            <div className="space-y-6">
              {(candidate.parsed_data.experience as any[]).map((exp, i) => (
                <div key={i} className="relative pl-6 before:absolute before:left-0 before:top-2 before:bottom-0 before:w-0.5 before:bg-violet-100 dark:before:bg-violet-900/40">
                  <div className="absolute left-[-4px] top-1.5 w-2 h-2 rounded-full bg-violet-600 ring-4 ring-white dark:ring-gray-950" />
                  <h4 className="font-bold text-gray-900 dark:text-white text-base">{exp.title}</h4>
                  <p className="text-sm font-bold text-violet-600 mt-0.5">{exp.company}</p>
                  <p className="text-xs text-gray-400 mt-1 font-medium">{exp.duration}</p>
                  {exp.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 leading-relaxed">
                      {exp.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

// --- Main Page ---

export default function TalentPoolPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [skill, setSkill] = useState('')
  const [minExp, setMinExp] = useState('')
  const [page, setPage] = useState(1)
  const [commentTarget, setCommentTarget] = useState<Candidate | null>(null)
  const [viewTarget, setViewTarget] = useState<Candidate | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  
  // Track which job's matches we are viewing
  const [selectedJobIndex, setSelectedJobIndex] = useState(0)

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: ['talent-pool', page, search, skill, minExp],
    queryFn: () =>
      talentPoolApi
        .list({
          page,
          limit: 12,
          search: search || undefined,
          skill: skill || undefined,
          min_experience: minExp ? parseInt(minExp) : undefined,
        })
        .then((r) => r.data),
  })

  const { data: stats } = useQuery({
    queryKey: ['talent-pool-stats'],
    queryFn: () => talentPoolApi.getStats().then(r => r.data)
  })

  const { data: suggestions, isLoading: suggestionsLoading } = useQuery({
    queryKey: ['talent-pool-suggestions'],
    queryFn: () => talentPoolApi.getSuggestedMatches().then(r => r.data)
  })

  const filterChips = ["All Time", "Q1 2026", "Q4 2025", "Q3 2025", "React", "Node.js", "Senior"]

  const currentJobSuggestions = suggestions?.[selectedJobIndex]
  const hasRealSuggestions = suggestions && suggestions.length > 0

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20">
      {/* Header */}
      <div className="px-4 md:px-0">
        <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white tracking-tight" style={{ fontFamily: "'Fraunces', serif" }}>
          Talent Database
        </h1>
        <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 mt-2 font-medium"> All candidates ever assessed — searchable and re-matchable forever.</p>
      </div>

      {/* Global Search & Filters */}
      <div className="bg-white/40 dark:bg-gray-900/40 backdrop-blur-2xl p-6 rounded-3xl border border-white dark:border-gray-800 shadow-xl shadow-gray-200/50 dark:shadow-none space-y-6">
        <div className="flex gap-4">
          <div className="flex-1 relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-violet-500">
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <Input
              placeholder="Search by skill, role, experience, name..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-12 bg-white/50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700 h-14 text-lg rounded-2xl focus:ring-violet-500"
            />
          </div>
          <Button className="h-14 px-8 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl font-bold shadow-lg shadow-violet-200 dark:shadow-none transition-all hover:scale-[1.02]">
            Search Talent DB
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {filterChips.map(chip => (
            <button 
              key={chip}
              className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${
                chip === "All Time" 
                ? "bg-violet-600 text-white shadow-md shadow-violet-200" 
                : "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Candidates Stored"
          value={stats?.total_candidates?.toLocaleString() || (isLoading ? "..." : "0")}
          subtitle="Candidates Stored"
          icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
        />
        <StatCard 
          title="Re-matched to New Roles"
          value={stats?.re_matched_count || (isLoading ? "..." : "0")}
          subtitle="Candidates identified for new opportunities"
          icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
          trend={{ label: "This quarter", color: "text-emerald-500" }}
        />
        <StatCard 
          title="Avg. Hire from DB"
          value={stats?.avg_hire_time || "2.1d"}
          subtitle="Speed of filling roles via DB vs fresh sourcing"
          icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
          trend={{ label: "vs 3 weeks", color: "text-violet-500" }}
        />
      </div>

      {/* Suggested Matches Section */}
      <div className="bg-white/40 dark:bg-gray-900/40 backdrop-blur-2xl rounded-3xl border border-white dark:border-gray-800 shadow-xl overflow-hidden p-8 space-y-6">
        <div className="flex justify-between items-center sm:items-end flex-wrap gap-4">
           <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                Recent DB Matches
                {currentJobSuggestions?.job_title && (
                  <> — <span className="text-violet-600">{currentJobSuggestions.job_title}</span></>
                )}
              </h2>
              {hasRealSuggestions && (
                <div className="flex gap-2 mt-3">
                  {suggestions.map((s, idx) => (
                    <button
                      key={s.job_id}
                      onClick={() => setSelectedJobIndex(idx)}
                      className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                        selectedJobIndex === idx
                        ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                        : "bg-white dark:bg-gray-800 text-gray-400 border-gray-100 dark:border-gray-700 hover:border-violet-200"
                      }`}
                    >
                      {s.job_title}
                    </button>
                  ))}
                </div>
              )}
           </div>
           {!suggestionsLoading && hasRealSuggestions && (
             <span className="text-xs font-bold text-violet-500 bg-violet-500/10 px-3 py-1 rounded-full">
               {currentJobSuggestions?.candidates?.length ?? 0} found
             </span>
           )}
        </div>

        <div className="space-y-4">
          {suggestionsLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))
          ) : !hasRealSuggestions ? (
            <div className="py-10 text-center text-gray-400 italic font-medium">
              No active jobs or no candidates match the threshold yet. Post a job and upload resumes to see AI-matched candidates here.
            </div>
          ) : (currentJobSuggestions?.candidates || []).map((candidate: any) => (
            <SuggestedMatchItem
              key={candidate.id}
              candidate={candidate}
              jobTitle={currentJobSuggestions?.job_title || ''}
              jobMatchScore={candidate.match_score}
            />
          ))}

          {hasRealSuggestions && currentJobSuggestions?.candidates?.length === 0 && (
            <div className="py-10 text-center text-gray-400 italic font-medium">
              No strong candidates found in the pool for this specific role yet.
            </div>
          )}
        </div>
      </div>

      {/* Main Candidate Table/List */}
      <div className="space-y-6">
        <div className="flex justify-between items-end">
           <div>
              <h2 className="text-2xl font-black text-gray-900 dark:text-white">All Talent</h2>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1">{data?.total || (isLoading ? "..." : 0)} Total Results</p>
           </div>
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="p-6 rounded-3xl bg-white/20 dark:bg-gray-800/20 border border-gray-100 dark:border-gray-800 space-y-4">
                <Skeleton className="w-12 h-12 rounded-full" />
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : !data?.items.length ? (
          <EmptyState title="No candidates match your search" />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.items.map((candidate, i) => (
              <motion.div
                key={candidate.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card hover className="p-6 rounded-3xl border-none shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all bg-white dark:bg-gray-900 group">
                  <div className="flex justify-between items-start">
                    <Avatar name={candidate.full_name} src={candidate.avatar_url} size="xl" className="ring-4 ring-violet-50 dark:ring-violet-900/20" />
                    <ScoreRing score={candidate.match_score} size={56} strokeWidth={4} />
                  </div>
                  <div className="mt-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-violet-600 transition-colors">{candidate.full_name}</h3>
                    <p className="text-sm font-medium text-gray-400 mt-1">{candidate.current_title || "Full Stack Developer"}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{candidate.years_experience} Yrs Exp</span>
                      <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                      <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Available</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-1.5 mt-6">
                    {candidate.skills.slice(0, 4).map(s => (
                      <span key={s} className="px-3 py-1 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] font-bold rounded-lg border border-gray-100 dark:border-gray-700 uppercase tracking-tight">
                        {s}
                      </span>
                    ))}
                  </div>

                  <div className="flex gap-2 mt-8">
                      <Button 
                        variant="outline" 
                        className="flex-1 rounded-xl text-xs font-bold border-gray-100 hover:bg-violet-50 hover:text-violet-600"
                        onClick={() => setCommentTarget(candidate)}
                      >
                        Add a Comment
                      </Button>
                      <Button 
                        className="flex-1 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl text-xs font-bold hover:bg-violet-600 hover:text-white dark:hover:bg-violet-600"
                        onClick={() => setViewTarget(candidate)}
                      >
                        View Profile
                      </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {data && data.pages > 1 && (
          <div className="flex justify-center mt-12">
             <Pagination page={data.page} pages={data.pages} total={data.total} limit={data.limit} onPage={setPage} />
          </div>
        )}
      </div>

      {/* Add Comment Modal */}
      {commentTarget && (
        <AddCommentModal
          candidate={commentTarget}
          onClose={() => setCommentTarget(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['talent-pool'] })
            setCommentTarget(null)
            showToast('Comment added!')
          }}
        />
      )}

      {/* Candidate Profile Modal */}
      {viewTarget && (
        <CandidateProfileModal
          candidate={viewTarget}
          onClose={() => setViewTarget(null)}
        />
      )}

      <AnimatePresence>
        {toast && <Toast {...toast} />}
      </AnimatePresence>
    </div>
  )
}
