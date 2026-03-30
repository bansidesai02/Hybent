import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '@/api/reports'
import { adminApi } from '@/api/admin'
import { useAuth } from '@/hooks/useAuth'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { motion } from 'framer-motion'
import { toast } from 'react-hot-toast'
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
      className={`rounded-[24px] p-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm ${className}`}
      style={style}
    >
      {children}
    </div>
  )
}

const COLORS = ['#6c47ff', '#10b981', '#f59e0b', '#ff6bc6', '#3b82f6', '#8b5cf6', '#f97316', '#ef4444']

export default function ReportsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [days, setDays] = useState<string>('30')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [recruiterId, setRecruiterId] = useState<string>('all')
  const [recruiters, setRecruiters] = useState<{ id: string; name: string }[]>([])

  const { data: summary, isLoading } = useQuery<ReportSummary>({
    queryKey: ['reports', 'summary', recruiterId],
    queryFn: () => reportsApi.getSummary(isAdmin && recruiterId !== 'all' ? recruiterId : undefined).then((r) => r.data),
  })

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
    try {
      const params: any = {}
      if (days === 'custom') {
        if (startDate) params.start_date = startDate
        if (endDate) params.end_date = endDate
      } else if (days !== 'all') {
        params.days = parseInt(days)
      }
      
      if (isAdmin && recruiterId !== 'all') params.recruiter_id = recruiterId

      const res = await reportsApi.export(params);
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
    { name: 'Applied', value: summary?.applied ?? 0, color: '#6c47ff' },
    { name: 'Hired', value: summary?.hired ?? 0, color: '#10b981' },
    { name: 'Backout', value: summary?.backout ?? 0, color: '#f59e0b' },
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
    { label: 'Total Applied', value: summary?.applied ?? 0, color: '#6c47ff', icon: '📝' },
    { label: 'Total Hired', value: summary?.hired ?? 0, color: '#10b981', icon: '✅' },
    { label: 'Total Backout', value: summary?.backout ?? 0, color: '#f59e0b', icon: '⚠️' },
    { label: 'Total Rejected', value: summary?.rejected ?? 0, color: '#ff6bc6', icon: '❌' },
  ]

  return (
    <div className="space-y-8 select-none max-w-[1400px] mx-auto pb-10">
      {/* Page Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight" style={{ fontFamily: "'Fraunces', serif" }}>
            Reports & Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">Detailed recruitment metrics and data export.</p>
        </div>
        <button
          onClick={handleDownload}
          className="text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:scale-105 transition-transform shadow-xl shadow-violet-200"
          style={{ background: 'linear-gradient(135deg, #6c47ff 0%, #ff6bc6 100%)' }}
        >
          <span>📊</span> Download Excel Report
        </button>
      </div>

      {/* Filters for Admin */}
      <GlassCard className="bg-gray-50/30">
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
            Filtering aggregates for export
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
                <div 
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner"
                  style={{ backgroundColor: `${stat.color}15`, color: stat.color }}
                >
                  {stat.icon}
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[2px] text-gray-400">{stat.label}</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-16 mt-1" />
                  ) : (
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white">
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
        style={{ background: 'linear-gradient(135deg, #6c47ff 0%, #ff6bc6 100%)' }}
      >
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1">
            <h2 className="text-2xl font-black mb-3" style={{ fontFamily: "'Fraunces', serif" }}>
              Data Transparency & Insights 💡
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
          <GlassCard className="p-0 h-full overflow-hidden border-gray-100 flex flex-col">
            <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
               <div>
                 <h3 className="font-bold text-gray-800">Recruitment Funnel Breakdown</h3>
                 <p className="text-xs text-gray-400 font-medium">Visualizing candidate progression across major milestones</p>
               </div>
               <span className="text-[10px] text-violet-600 font-black bg-violet-100 px-3 py-1.5 rounded-xl uppercase tracking-wider">Live Insights</span>
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
                        cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-white p-4 rounded-2xl shadow-2xl border border-gray-100 min-w-[140px]">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{payload[0].payload.name}</p>
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
        <GlassCard className="p-0 overflow-hidden border-gray-100 h-full flex flex-col">
          <div className="p-6 border-b border-gray-50 bg-gray-50/50">
            <h3 className="font-bold text-gray-800">Stages Distribution</h3>
            <p className="text-xs text-gray-400 font-medium">Candidate spread across all active stages</p>
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
                              <div className="bg-white p-3 rounded-xl shadow-xl border border-gray-100">
                                <p className="text-[11px] font-bold text-gray-800">{payload[0].name}</p>
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
                        <span className="text-[10px] font-bold text-gray-500 whitespace-nowrap">{entry.name} ({entry.value})</span>
                      </div>
                    ))}
                 </div>
               </div>
             )}
          </div>
        </GlassCard>
      </div>

      {/* ── Lower Row: Roles Analysis ── */}
      <GlassCard className="p-0 overflow-hidden border-gray-100">
        <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
           <div>
             <h3 className="font-bold text-gray-800">Candidates by Open Position</h3>
             <p className="text-xs text-gray-400 font-medium">Application volume across currently active roles</p>
           </div>
           <span className="text-[10px] text-emerald-600 font-black bg-emerald-50 px-3 py-1.5 rounded-xl uppercase tracking-wider">High Accuracy</span>
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
                    tick={{ fontSize: 11, fontWeight: 700, fill: '#1e293b' }}
                 />
                 <Tooltip
                    cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white p-3 rounded-xl shadow-xl border border-gray-100">
                             <p className="text-[11px] font-bold text-gray-800 mb-1">{payload[0].payload.name}</p>
                             <p className="text-base font-black text-emerald-500">{payload[0].value} Applications</p>
                          </div>
                        )
                      }
                      return null
                    }}
                 />
                 <Bar dataKey="value" fill="#6c47ff" radius={[0, 10, 10, 0]} barSize={32}>
                   {rolesData.map((_entry, index) => (
                     <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#6c47ff' : '#8b5cf6'} />
                   ))}
                   <LabelList dataKey="value" position="right" style={{ fontSize: 12, fontWeight: 800, fill: '#64748b' }} offset={14} />
                 </Bar>
               </BarChart>
             </ResponsiveContainer>
           )}
        </div>
      </GlassCard>
    </div>
  )
}
