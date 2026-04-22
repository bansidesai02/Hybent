import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { talentPoolApi } from '@/api/talentPool'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { Modal } from '@/components/ui/Modal'
import { CandidateProfileView } from '@/components/recruiter/CandidateProfileView'
import { ArrowLeft, Search, Filter } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import type { Candidate } from '@/types'

export default function AllTalentListPage() {
  const { basePath } = useAuth()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [viewTarget, setViewTarget] = useState<Candidate | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['all-talent-full', page, search],
    queryFn: () =>
      talentPoolApi.list({
        page,
        limit: 4, // Set to 4 so you can see pagination with your 6 candidates
        search: search || undefined,
      }).then(r => r.data),
  })

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-[var(--violet)] transition-colors mb-4 group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Back to Talent DB
          </button>
          <h1 className="text-3xl font-black text-gray-900 dark:text-[var(--text)] tracking-tight">
            All Talent <span className="text-[var(--violet)] text-xl ml-2">({data?.total || 0})</span>
          </h1>
          <p className="text-sm text-gray-500 dark:text-[var(--text-mid)] mt-1 font-medium">
            Complete database of all assessed candidates.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Input
              placeholder="Search by name, skill, or role..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              leftIcon={<Search size={16} />}
            />
          </div>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="p-6 rounded-3xl bg-white dark:bg-[var(--card-bg)] border border-gray-100 dark:border-[var(--card-border)] space-y-4">
              <Skeleton className="w-12 h-12 rounded-full" />
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
      ) : !data?.items.length ? (
        <EmptyState title="No talent found matching your search" />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {data.items.map((candidate, i) => (
            <motion.div
              key={candidate.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Card hover className="p-6 rounded-3xl border-none shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all bg-white dark:bg-[var(--card-bg)] group flex flex-col h-full">
                <div className="flex justify-between items-center">
                  <Avatar name={candidate.full_name} src={candidate.avatar_url} size="lg" className="ring-2 ring-violet-50 dark:ring-[var(--violet)]/20" />
                  {candidate.match_score != null && (
                    <span className="text-[11px] font-black px-2 py-1 bg-emerald-500/10 text-emerald-600 rounded-lg">
                      {Math.round(candidate.match_score)}% Score
                    </span>
                  )}
                </div>
                <div className="mt-4">
                  <h3 className="text-lg font-bold text-[var(--violet)] group-hover:text-[var(--violet)]/80 transition-colors">
                    {candidate.full_name}
                  </h3>
                  <p className="text-sm font-medium text-gray-400 mt-0.5 truncate">
                    {candidate.current_title || "Candidate"}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      {candidate.experience_years || (candidate.years_experience != null ? `${candidate.years_experience} YRS EXP` : 'N/A')}
                    </span>
                    <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">AVAILABLE</span>
                  </div>
                </div>
                <div className="mt-4 flex-1">
                  <p className="text-[11px] font-bold text-gray-500 dark:text-[var(--text-mid)] uppercase tracking-wider line-clamp-2">
                    {candidate.skills?.length > 0 ? candidate.skills.join(' • ') : "NO SKILLS LISTED"}
                  </p>
                </div>
                
                <div className="mt-6 pt-4 border-t border-gray-50 dark:border-white/5">
                  <button
                    className="w-full bg-[var(--violet)] hover:bg-[var(--violet)]/90 text-white rounded-2xl text-xs font-bold py-3 shadow-lg shadow-violet-200 dark:shadow-none transition-all hover:-translate-y-0.5"
                    onClick={() => setViewTarget(candidate)}
                  >
                    View Full Profile
                  </button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="mt-12 p-6 bg-white dark:bg-[var(--card-bg)] rounded-3xl border border-gray-100 dark:border-[var(--card-border)] shadow-sm">
          <Pagination page={data.page} pages={data.pages} total={data.total} limit={data.limit} onPage={setPage} />
        </div>
      )}

      {/* Profile Modal */}
      {viewTarget && (
        <Modal open onClose={() => setViewTarget(null)} title="Candidate Profile" size="lg">
          <CandidateProfileView candidate={viewTarget} />
        </Modal>
      )}
    </div>
  )
}
