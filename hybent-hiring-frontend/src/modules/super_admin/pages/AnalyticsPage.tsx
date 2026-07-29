import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { superAdminApi } from '@/api/superAdmin'
import { GlassIcon } from '@/components/common/GlassIcon'
import { Skeleton } from '@/components/ui/Skeleton'
import { TrendingUp, Users, UserCheck, LineChart, BadgeCent } from 'lucide-react'

export default function AnalyticsPage() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['super-admin', 'analytics'],
    queryFn: () => superAdminApi.getAnalytics(),
  })

  // SVG Line Chart builder helper
  const renderLineChart = (data: Array<{ date: string; count?: number; amount?: number }>, valueKey: 'count' | 'amount', color: string) => {
    if (!data || data.length === 0) return null

    const values = data.map(d => Number(d[valueKey] || 0))
    const max = Math.max(...values, 1)
    const min = Math.min(...values, 0)
    const range = max - min

    const height = 150
    const width = 500
    const padding = 20

    const points = data.map((d, index) => {
      const x = padding + (index / (data.length - 1)) * (width - padding * 2)
      const val = Number(d[valueKey] || 0)
      const y = height - padding - ((val - min) / range) * (height - padding * 2)
      return `${x},${y}`
    }).join(' ')

    // Gradient fill points
    const fillPoints = `
      ${padding},${height - padding} 
      ${points} 
      ${width - padding},${height - padding}
    `

    return (
      <div className="w-full">
        <svg viewBox={`0 0 ${width} ${height}`} className="overflow-visible w-full h-auto">
          <defs>
            <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0.00" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(148,163,184,0.15)" strokeWidth={1} />
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="rgba(148,163,184,0.08)" strokeWidth={1} strokeDasharray="3 3" />
          <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="rgba(148,163,184,0.08)" strokeWidth={1} strokeDasharray="3 3" />

          {/* Area fill */}
          <polygon points={fillPoints} fill={`url(#grad-${color})`} />

          {/* Line path */}
          <polyline points={points} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />

          {/* Data points */}
          {data.map((d, index) => {
            const x = padding + (index / (data.length - 1)) * (width - padding * 2)
            const val = Number(d[valueKey] || 0)
            const y = height - padding - ((val - min) / range) * (height - padding * 2)

            return (
              <g key={index} className="group cursor-pointer">
                <circle cx={x} cy={y} r={4} fill="#ffffff" stroke={color} strokeWidth={2} />
                <circle cx={x} cy={y} r={8} fill={color} opacity={0} className="hover:opacity-20 transition-opacity" />
              </g>
            )
          })}
        </svg>

        {/* Labels */}
        <div className="flex justify-between px-4 mt-2 text-[10.5px] font-bold text-[var(--text-light)]">
          {data.map((d, index) => (
            <span key={index}>{d.date}</span>
          ))}
        </div>
      </div>
    )
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val)
  }

  return (
    <div className="space-y-8 pb-10 pt-6">
      {/* Header */}
      <header className="page-header">
        <h1 className="page-title text-[28px] font-black leading-tight text-[var(--text)]">Platform Analytics</h1>
        <p className="page-subtitle text-[13px] text-[var(--text-light)]">Real-time platform scaling, MRR projection, candidate base metrics, and registration volumes.</p>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[280px] rounded-2xl" />
          <Skeleton className="h-[280px] rounded-2xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Growth Chart */}
          <div className="rounded-[24px] p-6 border flex flex-col justify-between" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-[15px] font-black text-[var(--text)] flex items-center gap-2">
                  <BadgeCent className="text-emerald-500" size={17} />
                  Revenue Growth (MRR)
                </h3>
                <p className="text-[11px] text-[var(--text-light)]">Platform monthly recurring revenue trends.</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-emerald-500 bg-emerald-500/10">
                  +12% MRR
                </span>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center">
              {analytics?.revenue_growth && renderLineChart(analytics.revenue_growth, 'amount', '#10b981')}
            </div>
            <div className="mt-4 pt-4 border-t flex items-center justify-between" style={{ borderColor: 'rgba(108,71,255,0.06)' }}>
              <span className="text-[12px] font-semibold text-[var(--text-light)]">Current Revenue</span>
              <span className="text-[14px] font-black text-emerald-500">
                {analytics?.revenue_growth && formatCurrency(analytics.revenue_growth[analytics.revenue_growth.length - 1].amount || 0)}
              </span>
            </div>
          </div>

          {/* User Growth Chart */}
          <div className="rounded-[24px] p-6 border flex flex-col justify-between" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-[15px] font-black text-[var(--text)] flex items-center gap-2">
                  <Users className="text-[var(--violet)]" size={17} />
                  Active Users
                </h3>
                <p className="text-[11px] text-[var(--text-light)]">System-wide active accounts count scaling.</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-[var(--violet)] bg-[var(--violet)]/10">
                  +34% Growth
                </span>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center">
              {analytics?.user_growth && renderLineChart(analytics.user_growth, 'count', '#8b5cf6')}
            </div>
            <div className="mt-4 pt-4 border-t flex items-center justify-between" style={{ borderColor: 'rgba(108,71,255,0.06)' }}>
              <span className="text-[12px] font-semibold text-[var(--text-light)]">Total Accounts</span>
              <span className="text-[14px] font-black text-[var(--violet)]">
                {analytics?.user_growth && analytics.user_growth[analytics.user_growth.length - 1].count}
              </span>
            </div>
          </div>

          {/* Candidate Scaling Chart */}
          <div className="rounded-[24px] p-6 border flex flex-col justify-between" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-[15px] font-black text-[var(--text)] flex items-center gap-2">
                  <UserCheck className="text-pink-500" size={17} />
                  Candidate Directory Scale
                </h3>
                <p className="text-[11px] text-[var(--text-light)]">Cumulative candidates directory and resumes processed.</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-pink-500 bg-pink-500/10">
                  +1.1k resumes
                </span>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center">
              {analytics?.candidate_growth && renderLineChart(analytics.candidate_growth, 'count', '#ff6bc6')}
            </div>
            <div className="mt-4 pt-4 border-t flex items-center justify-between" style={{ borderColor: 'rgba(108,71,255,0.06)' }}>
              <span className="text-[12px] font-semibold text-[var(--text-light)]">Total Candidates</span>
              <span className="text-[14px] font-black text-pink-500">
                {analytics?.candidate_growth && analytics.candidate_growth[analytics.candidate_growth.length - 1].count?.toLocaleString()}
              </span>
            </div>
          </div>

          {/* System Performance / Cost Efficiency */}
          <div className="rounded-[24px] p-6 border flex flex-col justify-between" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <div className="mb-6">
              <h3 className="text-[15px] font-black text-[var(--text)] flex items-center gap-2">
                <LineChart className="text-blue-500" size={17} />
                Operational Highlights
              </h3>
              <p className="text-[11px] text-[var(--text-light)]">Key efficiency indicators of the AI matching platform.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
              <div className="p-4 rounded-xl border flex flex-col justify-center" style={{ borderColor: 'rgba(108,71,255,0.06)', background: 'var(--search-bg)' }}>
                <p className="text-[11px] font-bold text-[var(--text-light)]">Average Match Latency</p>
                <p className="text-[24px] font-black text-[var(--text)] mt-1">1.8s</p>
                <p className="text-[10.5px] text-emerald-500 font-semibold mt-1">&darr; 20% vs last month</p>
              </div>
              <div className="p-4 rounded-xl border flex flex-col justify-center" style={{ borderColor: 'rgba(108,71,255,0.06)', background: 'var(--search-bg)' }}>
                <p className="text-[11px] font-bold text-[var(--text-light)]">AI Parser Accuracy</p>
                <p className="text-[24px] font-black text-[var(--text)] mt-1">98.4%</p>
                <p className="text-[10.5px] text-emerald-500 font-semibold mt-1">Constant optimization active</p>
              </div>
              <div className="p-4 rounded-xl border flex flex-col justify-center" style={{ borderColor: 'rgba(108,71,255,0.06)', background: 'var(--search-bg)' }}>
                <p className="text-[11px] font-bold text-[var(--text-light)]">Cost per Interview Session</p>
                <p className="text-[24px] font-black text-[var(--text)] mt-1">₹4.20</p>
                <p className="text-[10.5px] text-emerald-500 font-semibold mt-1">&darr; 15% model optimization</p>
              </div>
              <div className="p-4 rounded-xl border flex flex-col justify-center" style={{ borderColor: 'rgba(108,71,255,0.06)', background: 'var(--search-bg)' }}>
                <p className="text-[11px] font-bold text-[var(--text-light)]">Admin Action Coverage</p>
                <p className="text-[24px] font-black text-[var(--text)] mt-1">100%</p>
                <p className="text-[10.5px] text-[var(--violet)] font-semibold mt-1">Full audit logs tracking</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
