import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '@/api/reports'
import { adminApi } from '@/api/admin'
import { superAdminApi } from '@/api/superAdmin'
import { useAuth } from '@/hooks/useAuth'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { motion } from 'framer-motion'
import { toast } from 'react-hot-toast'
import { 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Download, 
  Lightbulb,
  Lock
} from 'lucide-react'
import { GlassIcon } from '@/components/common/GlassIcon'
import type { ReportSummary, User } from '@/types'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  LabelList,
  PieChart,
  Pie,
} from 'recharts'

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

const COLORS = ['var(--violet)', 'var(--teal, #10b981)', 'var(--amber, #f59e0b)', 'var(--pink, #ff6bc6)', '#3b82f6', '#8b5cf6', '#f97316', '#ef4444']

export default function ReportsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [days, setDays] = useState<string>('30')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [recruiterId, setRecruiterId] = useState<string>('all')
  const [recruiters, setRecruiters] = useState<{ id: string; name: string }[]>([])

  // Single source of truth for all active filters — used by both the summary query and export
  const filterParams = useMemo(() => {
    const p: { days?: number; start_date?: string; end_date?: string; recruiter_id?: string } = {}
    if (days === 'custom') {
      if (startDate) p.start_date = startDate
      if (endDate) p.end_date = endDate
    } else if (days !== 'all') {
      p.days = parseInt(days)
    }
    if (isAdmin && recruiterId !== 'all') p.recruiter_id = recruiterId
    return p
  }, [days, startDate, endDate, recruiterId, isAdmin])

  const { data: summary, isLoading } = useQuery<ReportSummary>({
    // Include full filterParams in the key so React Query refetches on any filter change
    queryKey: ['reports', 'summary', filterParams],
    queryFn: () => reportsApi.getSummary(filterParams).then((r) => r.data),
  })

  const { data: globalFlags } = useQuery({ queryKey: ['super-admin', 'global-flags'], queryFn: () => superAdminApi.getGlobalFlags() })

  useEffect(() => {
    if (isAdmin) {
      adminApi.listUsers().then(res => {
        // Filter out candidates from the recruiter list
        const users = res.data
          .filter((u: any) => u.role !== 'candidate')
          .map((u: any) => ({ id: u.id, name: u.full_name }))
        setRecruiters(users)
      }).catch(err => console.error("Failed to fetch recruiters", err))
    }
  }, [isAdmin])

  const handleDownload = async () => {
    if (!globalFlags?.analytics) {
      toast.error('Feature Locked: Advanced Export Metrics is disabled for your organization. Please contact your administrator.');
      return;
    }
    try {
      // Reuse the same filterParams object — export and on-screen data are always in sync
      const res = await reportsApi.export(filterParams);
      const filename = `recruitment_report_${new Date().toISOString().split('T')[0]}.xlsx`;

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Excel report downloaded successfully');
    } catch (error) {
      console.error('Download failed', error);
      toast.error('Failed to download report');
    }
  }

  const funnelData = [
    { name: 'Applied', value: summary?.applied ?? 0, color: 'var(--violet)' },
    { name: 'Hired', value: summary?.hired ?? 0, color: 'var(--teal, #10b981)' },
    { name: 'Backout', value: summary?.backout ?? 0, color: 'var(--amber, #f59e0b)' },
    { name: 'Rejected', value: summary?.rejected ?? 0, color: '#ff6bc6' },
  ]

  const stagesData = summary?.stages_distribution 
    ? Object.entries(summary.stages_distribution).map(([key, val]) => ({ 
        name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), 
        value: val 
      }))
    : []

  const rolesData = summary?.candidates_by_role
    ? Object.entries(summary.candidates_by_role).map(([key, val]) => ({ 
        name: key, 
        value: val 
      }))
    : []

  const stats = [
    { label: 'Total Applied', value: summary?.applied ?? 0, icon: <GlassIcon icon="FileText" variant="violet" size={48} iconSize={20} glow={false} />, color: 'var(--violet)' },
    { label: 'Total Hired', value: summary?.hired ?? 0, icon: <GlassIcon icon="CheckCircle" variant="emerald" size={48} iconSize={20} glow={false} />, color: '#10b981' },
    { label: 'Total Backout', value: summary?.backout ?? 0, icon: <GlassIcon icon="AlertTriangle" variant="amber" size={48} iconSize={20} glow={false} />, color: '#f59e0b' },
    { label: 'Total Rejected', value: summary?.rejected ?? 0, icon: <GlassIcon icon="XCircle" variant="rose" size={48} iconSize={20} glow={false} />, color: '#ff6bc6' },
  ]

  return (
    <div className="space-y-8 select-none max-w-[1400px] mx-auto pb-10">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-2">
        <header className="page-header !mb-0">
          <h1 className="page-title">
            Advanced Analytics
          </h1>
          <p className="page-subtitle">
            Detailed recruitment metrics and data export.
          </p>
        </header>
        <button
          onClick={handleDownload}
          className={`text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-xl shadow-violet-200 dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] ${!globalFlags?.analytics ? 'opacity-60 cursor-not-allowed grayscale' : 'hover:scale-105 transition-transform'}`}
          style={{ background: 'linear-gradient(135deg, var(--violet) 0%, var(--pink, #ff6bc6) 100%)' }}
          title={!globalFlags?.analytics ? "Feature Locked" : "Download Excel Report"}
        >
          {!globalFlags?.analytics ? <Lock size={18} /> : <Download size={18} />} Download Excel Report
        </button>
      </div>

      {/* Filters for Admin */}
      <GlassCard className="bg-gray-50/30 dark:bg-[var(--color-bg-sidebar)]">
        <div className="flex flex-col lg:flex-row gap-6 items-end w-full">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
            <Select
              label="Date Range"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              options={[
                { value: '7', label: 'Last 7 Days' },
                { value: '30', label: 'Last 30 Days' },
                { value: '90', label: 'Last 90 Days' },
                { value: 'custom', label: 'Custom Range' },
                { value: 'all', label: 'All Time' },
              ]}
            />

            {days === 'custom' && (
              <>
                <Input
                  type="date"
                  label="Start Date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <Input
                  type="date"
                  label="End Date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </>
            )}

            {isAdmin && (
              <Select
                label="Recruiter Filter"
                value={recruiterId}
                onChange={(e) => setRecruiterId(e.target.value)}
                options={[
                  { value: 'all', label: 'All Recruiters' },
                  ...recruiters.map(r => ({ value: r.id, label: r.name }))
                ]}
              />
            )}
          </div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pb-3 shrink-0">
            Filters apply to cards, charts &amp; export
          </div>
        </div>
      </GlassCard>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <GlassCard className="relative overflow-hidden group hover:border-violet-200 transition-colors">
              <div className="flex items-center gap-4">
                  {stat.icon}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[2px] text-gray-400">{stat.label}</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-16 mt-1" />
                  ) : (
                    <h2 className="text-3xl font-black text-gray-900 dark:text-[var(--text)]">
                      {stat.value}
                    </h2>
                  )}
                </div>
              </div>
              <div 
                className="absolute -bottom-4 -right-4 w-24 h-24 blur-3xl opacity-10 group-hover:opacity-20 transition-opacity"
                style={{ backgroundColor: stat.color }}
              />
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {/* ── Information Banner ── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-[28px] p-8 text-white shadow-2xl shadow-violet-200 dark:shadow-none"
        style={{ background: 'linear-gradient(135deg, var(--violet) 0%, var(--pink, #ff6bc6) 100%)' }}
      >
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1">
            <h2 className="text-2xl font-black mb-3 flex items-center gap-2" style={{ fontFamily: "'Fraunces', serif" }}>
              Data Transparency & Insights <GlassIcon icon="Lightbulb" variant="amber" size={32} iconSize={18} glow={false} />
            </h2>
            <p className="text-white/80 font-medium leading-relaxed">
              Our reporting engine aggregates data from every touchpoint in your hiring funnel. 
              Admins have a birds-eye view of organization-wide performance, while HR partners see metrics 
              specifically tailored to their managed positions.
            </p>
          </div>
          <div className="flex gap-4">
             <div className="px-6 py-4 rounded-3xl bg-white/10 border border-white/20 backdrop-blur-md text-center">
                <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1">Accuracy</p>
                <p className="text-xl font-bold">Real-time</p>
             </div>
             <div className="px-6 py-4 rounded-3xl bg-white/10 border border-white/20 backdrop-blur-md text-center">
                <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1">Format</p>
                <p className="text-xl font-bold">CSV / XLSX</p>
             </div>
          </div>
        </div>
        
        {/* Decorative ambient light */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-violet-500/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/20 blur-[100px] rounded-full" />
      </motion.div>

      {/* ── Main Funnel & Stats ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Funnel Chart */}
        <div className="xl:col-span-2">
          <GlassCard className="p-0 h-full overflow-hidden border-gray-100 dark:border-[var(--card-border)] flex flex-col">
            <div className="p-6 border-b border-gray-50 dark:border-[var(--card-border)] flex items-center justify-between bg-gray-50/50 dark:bg-[var(--color-bg-card)]">
               <div>
                 <h3 className="font-bold text-gray-800 dark:text-[var(--text)]">Recruitment Funnel Breakdown</h3>
                 <p className="text-xs text-gray-400 dark:text-[var(--text-mid)] font-medium">Visualizing candidate progression across major milestones</p>
               </div>
               <span className="text-[10px] text-[var(--violet)] dark:text-white font-black bg-violet-100 dark:bg-[var(--violet)] px-3 py-1.5 rounded-xl uppercase tracking-wider">Live Insights</span>
            </div>
            <div className="p-8 flex-1 min-h-[400px]">
               {isLoading ? (
                 <Skeleton className="w-full h-full rounded-2xl" />
               ) : (
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={funnelData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }} barSize={60}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.03)" />
                     <XAxis 
                       dataKey="name" 
                       axisLine={false} 
                       tickLine={false} 
                       tick={{ fontSize: 12, fontWeight: 700, fill: '#94a3b8' }}
                       dy={10}
                     />
                     <YAxis hide />
                     <Tooltip
                        cursor={false}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-white dark:bg-[var(--card-bg)] p-4 rounded-2xl shadow-2xl border border-gray-100 dark:border-[var(--card-border)] min-w-[140px]">
                                <p className="text-[10px] font-black text-gray-400 dark:text-[var(--text-mid)] uppercase tracking-widest mb-1">{payload[0].payload.name}</p>
                                <p className="text-2xl font-black" style={{ color: payload[0].payload.color }}>
                                  {payload[0].value}
                                </p>
                              </div>
                            )
                          }
                          return null
                        }}
                     />
                     <Bar dataKey="value" radius={[12, 12, 12, 12]} animationDuration={1000}>
                       {funnelData.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={entry.color} />
                       ))}
                       <LabelList dataKey="value" position="top" style={{ fontSize: 14, fontWeight: 900, fill: '#1e293b' }} offset={15} />
                     </Bar>
                   </BarChart>
                 </ResponsiveContainer>
               )}
            </div>
          </GlassCard>
        </div>

        {/* Stages Distribution Pie Chart */}
        <GlassCard className="p-0 overflow-hidden border-gray-100 dark:border-[var(--card-border)] h-full flex flex-col">
          <div className="p-6 border-b border-gray-50 dark:border-[var(--card-border)] bg-gray-50/50 dark:bg-[var(--color-bg-card)]">
            <h3 className="font-bold text-gray-800 dark:text-[var(--text)]">Stages Distribution</h3>
            <p className="text-xs text-gray-400 dark:text-[var(--text-mid)] font-medium">Candidate spread across all active stages</p>
          </div>
          <div className="p-4 flex-1 flex flex-col items-center justify-center min-h-[300px]">
             {isLoading ? <Skeleton className="w-48 h-48 rounded-full" /> : (
               <div className="w-full h-full relative">
                 <ResponsiveContainer width="100%" height={300}>
                   <PieChart>
                     <Pie
                       data={stagesData}
                       cx="50%"
                       cy="50%"
                       innerRadius={60}
                       outerRadius={80}
                       paddingAngle={5}
                       dataKey="value"
                       animationDuration={1500}
                     >
                       {stagesData.map((_entry, index) => (
                         <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                       ))}
                     </Pie>
                     <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-white dark:bg-[var(--card-bg)] p-3 rounded-xl shadow-xl border border-gray-100 dark:border-[var(--card-border)]">
                                <p className="text-[11px] font-bold text-gray-800 dark:text-[var(--text)]">{payload[0].name}</p>
                                <p className="text-lg font-black" style={{ color: payload[0].payload.fill }}>{payload[0].value} Candidates</p>
                              </div>
                            )
                          }
                          return null
                        }}
                     />
                   </PieChart>
                 </ResponsiveContainer>
                 {/* Legend */}
                 <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 justify-center px-4 overflow-y-auto max-h-[100px]">
                    {stagesData.map((entry, index) => (
                      <div key={entry.name} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="text-[10px] font-bold text-gray-500 dark:text-[var(--text-mid)] whitespace-nowrap">{entry.name} ({entry.value})</span>
                      </div>
                    ))}
                 </div>
               </div>
             )}
          </div>
        </GlassCard>
      </div>

      {/* ── Lower Row: Roles Analysis ── */}
      <GlassCard className="p-0 overflow-hidden border-gray-100 dark:border-[var(--card-border)]">
        <div className="p-6 border-b border-gray-50 dark:border-[var(--card-border)] bg-gray-50/50 dark:bg-[var(--color-bg-card)] flex items-center justify-between">
           <div>
             <h3 className="font-bold text-gray-800 dark:text-[var(--text)]">Candidates by Open Position</h3>
             <p className="text-xs text-gray-400 dark:text-[var(--text-mid)] font-medium">Application volume across currently active roles</p>
           </div>
           <span className="text-[10px] text-emerald-600 font-black bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-xl uppercase tracking-wider">High Accuracy</span>
        </div>
        <div className="p-8 h-[350px]">
           {isLoading ? (
             <Skeleton className="w-full h-full rounded-2xl" />
           ) : (
             <ResponsiveContainer width="100%" height="100%">
               <BarChart
                 layout="vertical"
                 data={rolesData}
                 margin={{ top: 5, right: 60, left: 100, bottom: 5 }}
               >
                 <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(0,0,0,0.03)" />
                 <XAxis type="number" hide />
                 <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false}
                    width={90}
                    tick={{ fontSize: 11, fontWeight: 700, fill: 'var(--text-mid)' }}
                 />
                 <Tooltip
                    cursor={{ fill: 'rgba(139, 92, 246, 0.05)' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white dark:bg-[var(--card-bg)] p-3 rounded-xl shadow-xl border border-gray-100 dark:border-[var(--card-border)]">
                             <p className="text-[11px] font-bold text-gray-800 dark:text-[var(--text)] mb-1">{payload[0].payload.name}</p>
                             <p className="text-base font-black text-emerald-500">{payload[0].value} Applications</p>
                          </div>
                        )
                      }
                      return null
                    }}
                 />
                 <Bar dataKey="value" fill="var(--violet)" radius={[0, 10, 10, 0]} barSize={32}>
                   {rolesData.map((_entry, index) => (
                     <Cell key={`cell-${index}`} fill={index % 2 === 0 ? 'var(--violet)' : 'var(--brand2, #8b5cf6)'} />
                   ))}
                   <LabelList dataKey="value" position="right" style={{ fontSize: 12, fontWeight: 800, fill: 'var(--text-mid)' }} offset={14} />
                 </Bar>
               </BarChart>
             </ResponsiveContainer>
           )}
        </div>
      </GlassCard>
    </div>
  )
}
