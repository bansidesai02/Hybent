import { useAuth } from '@/hooks/useAuth'
import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '@/api/analytics'
import { interviewsApi } from '@/api/interviews'
import { useAuthStore } from '@/store/authStore'
import { Skeleton } from '@/components/ui/Skeleton'
import React from 'react'
import { formatDistanceToNow, isToday, format } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { RecentActivityFeed } from '@/components/common/RecentActivityFeed'
import { GlassIcon } from '@/components/common/GlassIcon'
import { ArrowRight } from 'lucide-react'

// ─── KPI Card ──────────────────────────────────────────────────────────────────
interface KpiCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  delta?: { label: string; up: boolean }
}

function KpiCard({ icon, label, value, delta }: KpiCardProps) {
  return (
    <div
      className="rounded-[20px] p-6 transition-all duration-300"
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        boxShadow: 'var(--shadow)',
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <span className="text-[22px]">{icon}</span>
        {delta && (
          <span
            className="text-[11px] font-bold px-2 py-[3px] rounded-full"
            style={{
              background: delta.up ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              color: delta.up ? '#10b981' : '#ef4444',
            }}
          >
            {delta.label}
          </span>
        )}
      </div>
        <p
          className="font-black leading-none mb-1.5"
          style={{ fontFamily: "'Poppins', sans-serif", fontSize: '36px', color: 'var(--text)', letterSpacing: '-1px', fontWeight: 700 }}
        >
          {value}
        </p>
      <p className="text-[12px] font-semibold" style={{ color: 'var(--text-mid)' }}>{label}</p>
    </div>
  )
}

// ─── Funnel Row ────────────────────────────────────────────────────────────────
function FunnelRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-4 mb-4 last:mb-0">
      <span className="text-[12px] font-semibold w-24 text-right flex-shrink-0" style={{ color: 'var(--text-mid)' }}>
        {label}
      </span>
      <div className="flex-1 h-[10px] rounded-full overflow-hidden" style={{ background: 'rgba(108, 71, 255, 0.05)' }}>
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="flex items-center gap-3 flex-shrink-0 w-24 justify-end">
        <span className="text-[13px] font-bold" style={{ color: 'var(--text)' }}>{count.toLocaleString()}</span>
      </div>
    </div>
  )
}

// ─── Activity Item ─────────────────────────────────────────────────────────────
interface ActivityItemProps {
  icon: React.ReactNode
  title: string
  sub: string
  time: string
  iconBg: string
}

function ActivityItem({ icon, title, sub, time, iconBg }: ActivityItemProps) {
  return (
    <div className="flex items-center gap-4 py-4 first:pt-0 last:pb-0 border-b last:border-0" style={{ borderColor: 'rgba(108, 71, 255, 0.05)' }}>
      <div
        className="w-10 h-10 rounded-[12px] flex items-center justify-center text-[16px] flex-shrink-0"
        style={{ background: iconBg }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold truncate text-[var(--text)]">{title}</p>
        <p className="text-[11px] font-medium truncate text-[var(--text-light)]">{sub}</p>
      </div>
      <span className="text-[10px] font-semibold flex-shrink-0" style={{ color: '#c4b9de' }}>{time}</span>
    </div>
  )
}

// ─── Interview Card ────────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  scheduled: { label: 'Confirmed', bg: 'rgba(16, 185, 129, 0.1)', color: 'var(--teal, #10b981)' },
  completed: { label: 'Completed', bg: 'var(--violet)/10', color: 'var(--violet)' },
  cancelled: { label: 'Cancelled', bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' },
  no_show: { label: 'No Show', bg: 'rgba(251, 191, 36, 0.1)', color: '#f59e0b' },
}

interface InterviewCardProps {
  time: string
  name: string
  type: string
  status: string
  meetingLink?: string | null
}

function InterviewCard({ time, name, type, status, meetingLink }: InterviewCardProps) {
  const cfg = STATUS_MAP[status] || STATUS_MAP.scheduled
  const isScheduled = status === 'scheduled'

  return (
    <div
      className="p-5 rounded-[20px] transition-all duration-300 min-w-[280px] flex-1"
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        boxShadow: 'var(--shadow)',
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--violet)' }}>{time}</p>
        {isScheduled && meetingLink && (
          <a
            href={meetingLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all hover:scale-105 active:scale-95"
            style={{ 
              background: 'linear-gradient(135deg, var(--violet), var(--brand2, #ff6bc6))', 
              color: '#fff',
              boxShadow: '0 4px 12px rgba(167, 139, 250, 0.2)'
            }}
          >
            Join Now
          </a>
        )}
      </div>
      <p className="text-[15px] font-black mb-1 text-[var(--text)]">{name}</p>
      <p className="text-[11px] font-medium mb-4 text-[var(--text-light)]">{type}</p>
      <div className="flex items-center gap-2">
        <div
          className="px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5"
          style={{
            background: cfg.bg,
            color: cfg.color,
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
          {cfg.label}
        </div>
      </div>
    </div>
  )
}

// ─── Quick Link ────────────────────────────────────────────────────────────────
function QuickLink({ label, icon, onClick, bg }: { label: string; icon: React.ReactNode; onClick: () => void; bg: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 p-4 rounded-[20px] transition-all duration-300 hover:scale-[1.02] hover:shadow-lg text-left"
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
      }}
    >
      <div className="w-10 h-10 rounded-[14px] flex items-center justify-center text-[18px]" style={{ background: bg }}>
        {icon}
      </div>
      <span className="text-[13px] font-bold text-[var(--text)]">{label}</span>
      <ArrowRight size={14} className="ml-auto" style={{ color: '#c4b9de' }} />
    </button>
  )
}

const NOTIFICATION_MAP: Record<string, { icon: React.ReactNode; bg: string }> = {
  application_received: { icon: <GlassIcon icon="MessageSquare" variant="pink" size={32} iconSize={14} />, bg: 'rgba(255, 107, 198, 0.1)' },
  stage_changed: { icon: <GlassIcon icon="CheckCircle" variant="emerald" size={32} iconSize={14} />, bg: 'rgba(16, 185, 129, 0.1)' },
  interview_scheduled: { icon: <GlassIcon icon="Calendar" variant="violet" size={32} iconSize={14} />, bg: 'rgba(108, 71, 255, 0.1)' },
  interview_reminder: { icon: <GlassIcon icon="Clock" variant="violet" size={32} iconSize={14} />, bg: 'rgba(108, 71, 255, 0.1)' },
  scorecard_submitted: { icon: <GlassIcon icon="Brain" variant="indigo" size={32} iconSize={14} />, bg: 'rgba(139, 92, 246, 0.1)' },
  offer_sent: { icon: <GlassIcon icon="Send" variant="amber" size={32} iconSize={14} />, bg: 'rgba(251, 191, 36, 0.1)' },
  offer_accepted: { icon: <GlassIcon icon="Trophy" variant="emerald" size={32} iconSize={14} />, bg: 'rgba(10, 185, 129, 0.1)' },
  default: { icon: <GlassIcon icon="Bell" variant="violet" size={32} iconSize={14} />, bg: 'rgba(108, 71, 255, 0.1)' },
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function OverviewPage() {
  const { basePath } = useAuth()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: () => analyticsApi.overview().then((r: any) => r.data),
  })

  const { data: interviews, isLoading: interviewsLoading } = useQuery({
    queryKey: ['interviews', 'today'],
    queryFn: () => interviewsApi.list().then((r: any) => r.data),
  })

  const todayInterviews = interviews?.filter((i: any) => isToday(new Date(i.scheduled_at))) || []

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  // Returns a delta badge object only when the backend supplies a real numeric delta.
  // If the field is absent or non-numeric, returns undefined → badge is hidden.
  const getKpiDelta = (val: any): { label: string; up: boolean } | undefined => {
    if (val === undefined || val === null) return undefined
    const num = typeof val === 'number' ? val : parseFloat(val)
    if (isNaN(num)) return undefined
    const isUp = num >= 0
    const arrow = isUp ? '↑' : '↓'
    // Use the value as-is if the backend already formatted it (e.g. '↑ 18%'), otherwise format it.
    const label =
      typeof val === 'string' && (val.includes('%') || val.includes('↑') || val.includes('↓'))
        ? val
        : `${arrow} ${Math.abs(num)}%`
    return { label, up: isUp }
  }

  const kpis = [
    {
      label: 'Resumes Processed',
      value: analytics?.total_applications ?? 0,
      icon: <GlassIcon icon="FileText" variant="violet" size={42} iconSize={20} ghost />,
      delta: getKpiDelta(analytics?.total_applications_delta),
    },
    {
      label: 'Auto-Shortlisted',
      value: analytics?.total_candidates ?? 0,
      icon: <GlassIcon icon="CheckCircle" variant="emerald" size={42} iconSize={20} ghost />,
      delta: getKpiDelta(analytics?.total_candidates_delta),
    },
    {
      label: 'Interviews Booked',
      value: analytics?.interviews_scheduled ?? 0,
      icon: <GlassIcon icon="Calendar" variant="violet" size={42} iconSize={20} ghost />,
      delta: getKpiDelta(analytics?.interviews_scheduled_delta),
    },
    {
      label: 'Hires Made',
      value: analytics?.offers_accepted ?? 0,
      icon: <GlassIcon icon="Trophy" variant="emerald" size={42} iconSize={20} ghost />,
      delta: getKpiDelta(analytics?.offers_accepted_delta),
    },
  ]

  const funnelTotal = analytics?.total_applications ?? 1

  return (
    <div className="space-y-8 pb-10 pt-6">
      {/* Header Section */}
      <header className="page-header">
        <h1 className="page-title">
          {greeting}, {user?.full_name?.split(' ')[0] || 'there'} 
        </h1>
        <p className="page-subtitle">
          Here's your hiring pipeline at a glance — Hireon AI is working 24/7.
        </p>
      </header>

      {/* Quick Links Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickLink
          label="Post New Job"
          icon={<GlassIcon icon="BriefcaseMedical" variant="violet" size={40} iconSize={18} ghost />}
          bg="rgba(108, 71, 255, 0.1)"
          onClick={() => navigate(`${basePath}/jobs/new`)}
        />
        <QuickLink
          label="Add Candidate"
          icon={<GlassIcon icon="UserPlus" variant="emerald" size={40} iconSize={18} ghost />}
          bg="rgba(16, 185, 129, 0.1)"
          onClick={() => navigate(`${basePath}/upload`)}
        />
        <QuickLink
          label="Schedule Call"
          icon={<GlassIcon icon="Calendar" variant="pink" size={40} iconSize={18} ghost />}
          bg="rgba(255, 107, 198, 0.1)"
          onClick={() => navigate(`${basePath}/interviews`)}
        />
        <QuickLink
          label="AI Insights"
          icon={<GlassIcon icon="Bot" variant="indigo" size={40} iconSize={18} ghost />}
          bg="rgba(139, 92, 246, 0.1)"
          onClick={() => navigate(`${basePath}/analytics`)}
        />
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {analyticsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[140px] rounded-[20px]" />
          ))
        ) : (
          kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hiring Funnel */}
        <div
          className="rounded-[24px] p-4 sm:p-8"
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            boxShadow: 'var(--shadow)',
          }}
        >
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <h3 className="text-[16px] font-black text-[var(--text)]" style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700 }}>
              Hiring Funnel
            </h3>
            <span className="text-[10px] font-bold px-2 py-1 rounded-[6px] uppercase tracking-wider" style={{ background: 'var(--violet)/10', color: 'var(--violet)' }}>
              This Month
            </span>
          </div>

          <div className="space-y-6">
            <FunnelRow label="Applied" count={analytics?.total_applications ?? 0} total={funnelTotal} color="var(--violet)" />
            <FunnelRow label="Shortlisted" count={analytics?.total_candidates ?? 0} total={funnelTotal} color="#3b82f6" />
            <FunnelRow label="Interviewed" count={analytics?.interviews_scheduled ?? 0} total={funnelTotal} color="#ff6bc6" />
            <FunnelRow label="Hired" count={analytics?.offers_accepted ?? 0} total={funnelTotal} color="var(--teal, #10b981)" />
          </div>
        </div>

        {/* Recent Activity */}
        <div
          className="rounded-[24px] p-4 sm:p-8"
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            boxShadow: 'var(--shadow)',
          }}
        >
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <h3 className="text-[16px] font-black text-[var(--text)]" style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700 }}>
              Recent Activity
            </h3>
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-[#10b981] uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
              Live
            </span>
          </div>

          <div className="space-y-1">
            <RecentActivityFeed limit={4} />
          </div>
        </div>
      </div>

      {/* Today's Interviews Section */}
      <div
        className="rounded-[24px] p-4 sm:p-8"
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          boxShadow: 'var(--shadow)',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 sm:mb-8">
          <div className="flex items-center gap-4">
            <h3 className="text-[16px] font-black text-[var(--text)]" style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700 }}>
              Today's Interviews
            </h3>
            <span className="text-[10px] font-bold px-2 py-1 rounded-[6px] " style={{ background: 'var(--violet)/10', color: 'var(--violet)' }}>
              {format(new Date(), 'MMM dd')}
            </span>
          </div>
          <button
            onClick={() => navigate(`${basePath}/interviews`)}
            className="text-[11px] font-bold flex items-center gap-1"
            style={{ color: 'var(--violet)' }}
          >
            View Schedule <ArrowRight size={14} />
          </button>
        </div>

        {interviewsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[140px] rounded-[20px]" />
            ))}
          </div>
        ) : todayInterviews.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {todayInterviews.map((int: any) => (
              <InterviewCard
                key={int.id}
                time={format(new Date(int.scheduled_at), 'hh:mm a')}
                name={int.candidate_name || 'Anonymous Candidate'}
                type={int.interview_type}
                status={int.status}
                meetingLink={int.meeting_link}
              />
            ))}
          </div>
        ) : (
          <div className="py-8 text-center bg-[var(--sb-active)] dark:bg-[var(--violet)]/5 rounded-[20px] border border-dashed border-[var(--sidebar-border)]">
            <div className="mb-2 flex justify-center">
              <GlassIcon icon="Calendar" variant="violet" size={48} iconSize={24} />
            </div>
            <p className="text-[13px] font-medium text-[var(--text-mid)]">No interviews scheduled for today.</p>
          </div>
        )}
      </div>
    </div>
  )
}
