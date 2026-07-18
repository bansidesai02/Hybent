import { useAuth } from '@/hooks/useAuth'
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '@/api/analytics'
import { candidatesApi } from '@/api/candidates'
import { talentPoolApi } from '@/api/talentPool'
import { jobsApi } from '@/api/jobs'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatScore } from '@/utils/formatters'
import { motion } from 'framer-motion'
import { Select } from '@/components/ui/Select'
import { GlassIcon } from '@/components/common/GlassIcon'

// ─── Glass card wrapper ─────────────────────────────────────────────────────────
function GlassCard({ children, className = '', style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded-[24px] p-6 bg-white dark:bg-[var(--card-bg)] border border-gray-100 dark:border-[var(--card-border)] shadow-sm ${className}`}
      style={style}
    >
      {children}
    </div>
  )
}

export default function AnalyticsPage() {
  const { basePath } = useAuth()
  const navigate = useNavigate()
  const [funnelJobId, setFunnelJobId] = useState('')

  // ─── Data Fetching ────────────────────────────────────────────────────────────
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: () => analyticsApi.overview().then((r: any) => r.data),
  })

  const { data: funnel, isLoading: funnelLoading } = useQuery({
    queryKey: ['analytics', 'funnel', funnelJobId],
    queryFn: () => analyticsApi.funnel(funnelJobId || undefined).then((r: any) => r.data),
  })

  const { data: talentStats } = useQuery({
    queryKey: ['talent-pool', 'stats'],
    queryFn: () => talentPoolApi.getStats().then((r: any) => r.data),
  })

  const { data: fairnessData, isLoading: fairnessLoading } = useQuery({
    queryKey: ['analytics', 'fairness'],
    queryFn: () => analyticsApi.fairness().then((r: any) => r.data),
  })

  const { data: candidatesData } = useQuery({
    queryKey: ['candidates', 'top-skills'],
    queryFn: () => candidatesApi.list({ limit: 100 }).then((r: any) => r.data),
  })

  const { data: jobsData } = useQuery({
    queryKey: ['jobs', 'all'],
    queryFn: () => jobsApi.list({ limit: 100 }).then((r: any) => r.data),
  })

  // ─── Computed Data ───────────────────────────────────────────────────────────
  const jobOptions = [
    { value: '', label: 'Global Pipeline' },
    ...(jobsData?.items.map((j: any) => ({ value: j.id, label: j.title })) ?? []),
  ]

  const topSkills = useMemo(() => {
    if (!candidatesData?.items) return []
    const counts: Record<string, number> = {}
    candidatesData.items.forEach((c: any) => {
      // Primary: skills array; fallback: parsed_data.skills
      const skills: string[] = (c.skills?.length ? c.skills : (c as any).parsed_data?.skills) ?? []
      skills.forEach((s: string) => {
        if (s && s.trim()) {
          const cleanSkill = s.trim()
          counts[cleanSkill] = (counts[cleanSkill] || 0) + 1
        }
      })
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([skill]) => skill)
  }, [candidatesData])

  const skillColorMap = [
    'var(--violet)',
    'var(--pink, #ff6bc6)',
    'var(--teal, #00d4c8)',
    'var(--amber, #f59e0b)',
    'var(--indigo)',
    'var(--cyan)',
    'var(--rose)',
    'rgba(108,71,255,0.9)', // violet/90
    'rgba(255,107,198,0.9)', // pink/90
    'rgba(0,212,200,0.9)',  // teal/90
  ]

  const bannerContent = useMemo(() => {
    if (!overview) return null
    
    let title = "Pipeline Intelligence Active"
    if (overview.avg_match_score) {
      title = `${formatScore(overview.avg_match_score)} Avg Match Score`
    } else if (overview.total_applications > 0) {
      title = `${overview.total_applications} Applications Tracked`
    }

    const parts = []
    if (overview.avg_match_score) {
      parts.push(`${formatScore(overview.avg_match_score)} avg match score this month.`)
    }
    if (talentStats?.re_matched_count) {
      parts.push(`${talentStats.re_matched_count} past candidates re-matched to new roles.`)
    }
    
    return {
      title,
      subtitle: parts.length > 0 ? parts.join(' ') : "Real-time analytics are being collected as candidates apply."
    }
  }, [overview, talentStats])

  return (
    <div className="space-y-8 select-none pb-10">
      {/* Page Header */}
      <header className="page-header">
        <h1 className="page-title flex items-center gap-3">
          AI Insights

        </h1>
        <p className="page-subtitle">What Hireon AI has learned about your hiring pipeline.</p>
      </header>

      {/* ── AI Summary Banner ── */}
      {overview && !overviewLoading && bannerContent && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[28px] p-5 sm:p-8 text-white shadow-2xl shadow-violet-200 dark:shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
          style={{
            background: 'linear-gradient(135deg, var(--violet) 0%, var(--pink, #ff6bc6) 100%)'
          }}
        >
          <div className="relative z-10">
            <p className="text-[10px] font-black uppercase tracking-[3px] mb-3 opacity-80">AI SUMMARY</p>
            <h2 className="text-xl sm:text-3xl font-black mb-2 flex items-center gap-3" style={{ fontFamily: "'Fraunces', serif" }}>
              {bannerContent.title} <GlassIcon icon="Target" variant="violet" size={32} iconSize={18} ghost glow={false} />
            </h2>
            <p className="text-sm sm:text-lg font-medium opacity-90 max-w-2xl leading-relaxed">
              {bannerContent.subtitle}
            </p>
          </div>
          {/* Decorative elements */}
          <div className="absolute top-[-10%] right-[-5%] w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-[-20%] left-[10%] w-48 h-48 bg-violet-500/10 dark:bg-black/10 rounded-full blur-2xl" />
        </motion.div>
      )}

      {/* Main Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Hire Probability by Stage */}
        <GlassCard>
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-[15px] font-bold text-gray-800 dark:text-[var(--text)] uppercase tracking-wider">Hire Probability by Stage</h3>
            <div className="w-48">
              <Select 
                options={jobOptions} 
                value={funnelJobId} 
                onChange={(e: any) => setFunnelJobId(e.target.value)} 
                className="!bg-transparent !border-none !shadow-none font-bold text-[var(--violet)] focus:ring-0" 
              />
            </div>
          </div>
          
          <div className="space-y-6">
            {funnelLoading ? (
              Array.from({ length: 5 }).map((_: any, i: any) => <Skeleton key={i} className="h-2 w-full rounded-full" />)
            ) : funnel?.stages.reduce((acc: any, s: any) => {
              // Group stages into 5 funnel buckets
              let bucket = '';
              const stage = s.stage.toLowerCase();

              if (stage === 'applied') bucket = 'Applied';
              else if (['screening', 'pre_screening'].includes(stage)) bucket = 'Shortlisted';
              else if (['technical_round', 'practical_round', 'techno_functional_round'].includes(stage)) bucket = 'Screened';
              else if (['management_round', 'hr_round', 'interview'].includes(stage)) bucket = 'Interviewed';
              else if (['interviewed', 'offer', 'hired'].includes(stage)) bucket = 'Final Round';
              
              if (bucket) {
                const existing = acc.find((a: any) => a.name === bucket);
                if (existing) {
                  existing.count += s.count;
                } else {
                  acc.push({ name: bucket, count: s.count, percentage: 0 });
                }
              }
              return acc;
            }, [] as { name: string, count: number, percentage: number }[])
            .map((bucket: any, _: any, all: any) => {
              // Recalculate percentages based on consolidated counts
              const total = all.reduce((sum: any, b: any) => sum + b.count, 0);
              bucket.percentage = total > 0 ? (bucket.count / total) * 100 : 0;
              return bucket;
            })
            .sort((a: any, b: any) => {
              const order = ['Applied', 'Shortlisted', 'Screened', 'Interviewed', 'Final Round'];
              return order.indexOf(a.name) - order.indexOf(b.name);
            })
             .map((s: any, i: any) => (
              <div key={s.name} className="space-y-2">
                <div className="flex justify-between text-[13px] font-bold text-gray-600 dark:text-[var(--text-mid)]">
                  <span>{s.name}</span>
                  <span>{Math.round(s.percentage)}%</span>
                </div>
                <div className="h-1.5 w-full bg-gray-100 dark:bg-[#100e1e] rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${s.percentage}%` }}
                    transition={{ duration: 1, delay: i * 0.1 }}
                    className="h-full rounded-full"
                    style={{ 
                      background: i === 0 ? 'var(--violet)' : i === 1 ? 'var(--pink, #ff6bc6)' : i === 2 ? 'var(--teal, #00d4c8)' : i === 3 ? 'var(--amber, #f59e0b)' : 'var(--teal, #10b981)'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Top Skills in Pipeline */}
        <GlassCard>
          <h3 className="text-[15px] font-bold text-gray-800 dark:text-[var(--text)] uppercase tracking-wider mb-8">Top Skills in Pipeline</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {topSkills.length > 0 ? topSkills.map((skill: any, i: any) => (
              <motion.div
                key={skill}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-center p-3 rounded-xl text-[12px] font-bold shadow-sm text-center text-white"
                style={{ backgroundColor: skillColorMap[i % skillColorMap.length] }}
              >
                {skill}
              </motion.div>
            )) : (
              <p className="col-span-full pt-10 text-center text-sm text-gray-400 font-medium">Analyzing candidate database for skill trends...</p>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Intelligence Row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Talent DB Match */}
        <GlassCard className="relative overflow-hidden group">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-[14px] font-bold text-gray-800 dark:text-[var(--text)]">Talent DB Match</h3>
            <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-600 text-[10px] font-black uppercase tracking-tighter">
              {talentStats?.re_matched_count || 0} Found
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-[var(--text-mid)] leading-relaxed font-medium mb-4">
            {talentStats?.re_matched_count || 0} candidates from your pool match current active roles. Re-engaging could save weeks of sourcing.
          </p>
          <button 
            onClick={() => navigate(`${basePath}/talent-pool`)}
            className="flex items-center justify-center gap-1.5 h-10 px-5 bg-[var(--violet)] text-white rounded-xl text-xs font-bold hover:scale-[1.03] active:scale-95 transition-all shadow-lg shadow-violet-200 dark:shadow-[0_8px_20px_rgba(0,0,0,0.2)]"
          >
            <span>View Matches</span>
            <GlassIcon icon="ArrowRight" variant="violet" size={20} iconSize={11} ghost glow={false} />
          </button>
        </GlassCard>

        {/* Avg. Time-to-Hire */}
        <GlassCard className="relative overflow-hidden group">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-[14px] font-bold text-gray-800 dark:text-[var(--text)]">Avg. Time-to-Hire</h3>
          </div>
          <div className="text-sm text-gray-500 dark:text-[var(--text-mid)] leading-relaxed font-medium">
            <span className="text-[var(--text)] font-bold text-2xl mb-1 block">
              {overview?.time_to_hire_days ? `${Math.round(overview.time_to_hire_days)} days` : '—'}
            </span> 
            {overview?.time_to_hire_days ? 'Average from application to interview.' : 'Not enough data to calculate yet.'}
          </div>
          <div className="absolute bottom-4 right-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <GlassIcon icon="Timer" variant="pink" size={60} iconSize={32} glow={false} />
          </div>
        </GlassCard>
      </div>

      {/* Fairness & Bias Analytics Row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Pass Rates By Stage */}
        <GlassCard>
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-[15px] font-bold text-gray-800 dark:text-[var(--text)] uppercase tracking-wider">Pass Rates By Stage</h3>
            <span className="text-[10px] text-emerald-600 font-black bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-xl uppercase tracking-wider">Fairness</span>
          </div>
          <div className="space-y-6">
            {fairnessLoading ? (
              Array.from({ length: 4 }).map((_: any, i: any) => <Skeleton key={i} className="h-2 w-full rounded-full" />)
            ) : fairnessData?.pass_rates_by_stage?.map((s: any, i: any) => (
              <div key={s.stage} className="space-y-2">
                <div className="flex justify-between text-[13px] font-bold text-gray-600 dark:text-[var(--text-mid)]">
                  <span>{s.stage}</span>
                  <span>{Math.round(s.pass_rate)}%</span>
                </div>
                <div className="h-1.5 w-full bg-gray-100 dark:bg-[#100e1e] rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${s.pass_rate}%` }}
                    transition={{ duration: 1, delay: i * 0.1 }}
                    className="h-full rounded-full bg-emerald-500"
                  />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Pass Rates By Source */}
        <GlassCard>
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-[15px] font-bold text-gray-800 dark:text-[var(--text)] uppercase tracking-wider">Hires By Source</h3>
            <span className="text-[10px] text-emerald-600 font-black bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-xl uppercase tracking-wider">Fairness</span>
          </div>
          <div className="space-y-6">
            {fairnessLoading ? (
              Array.from({ length: 4 }).map((_: any, i: any) => <Skeleton key={i} className="h-2 w-full rounded-full" />)
            ) : fairnessData?.pass_rates_by_source?.length === 0 ? (
              <p className="text-sm text-gray-400 font-medium">No source data available.</p>
            ) : fairnessData?.pass_rates_by_source?.map((s: any, i: any) => (
              <div key={s.source} className="space-y-2">
                <div className="flex justify-between text-[13px] font-bold text-gray-600 dark:text-[var(--text-mid)]">
                  <span className="capitalize">{s.source.replace('_', ' ')}</span>
                  <span>{Math.round(s.pass_rate)}%</span>
                </div>
                <div className="h-1.5 w-full bg-gray-100 dark:bg-[#100e1e] rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${s.pass_rate}%` }}
                    transition={{ duration: 1, delay: i * 0.1 }}
                    className="h-full rounded-full bg-pink-500"
                  />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Interviewer Calibration */}
        <GlassCard>
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-[15px] font-bold text-gray-800 dark:text-[var(--text)] uppercase tracking-wider">Interviewer Bias</h3>
            <span className="text-[10px] text-violet-600 font-black bg-violet-50 dark:bg-violet-900/20 px-3 py-1.5 rounded-xl uppercase tracking-wider">Calibration</span>
          </div>
          <div className="space-y-4">
            {fairnessLoading ? (
              Array.from({ length: 3 }).map((_: any, i: any) => <Skeleton key={i} className="h-10 w-full rounded-xl" />)
            ) : fairnessData?.interviewer_calibration_variance?.length === 0 ? (
              <p className="text-sm text-gray-400 font-medium">Not enough interview data for calibration.</p>
            ) : fairnessData?.interviewer_calibration_variance?.map((c: any) => (
              <div key={c.interviewer_name} className="flex items-center justify-between p-3 rounded-xl bg-gray-50/50 dark:bg-[var(--color-bg-card)] border border-gray-100 dark:border-[var(--card-border)]">
                <div>
                  <p className="text-[13px] font-bold text-gray-800 dark:text-[var(--text)]">{c.interviewer_name}</p>
                  <p className="text-[11px] text-gray-500 font-medium">Avg Rating: {c.avg_rating_given}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Variance</p>
                  <span className={`text-[13px] font-black px-2 py-1 rounded-md ${
                    c.variance > 0.5 ? 'bg-rose-100 text-rose-600' :
                    c.variance < -0.5 ? 'bg-amber-100 text-amber-600' :
                    'bg-emerald-100 text-emerald-600'
                  }`}>
                    {c.variance > 0 ? '+' : ''}{c.variance}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

    </div>
  )
}

