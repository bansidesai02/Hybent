import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { interviewsApi } from '@/api/interviews'
import { Interview, InterviewStatus } from '@/types'
import { Skeleton } from '@/components/ui/Skeleton'
import { useInterviewStore } from '@/store/interviewStore'
import { useAuthStore } from '@/store/authStore'
import { GlassIcon } from '@/components/common/GlassIcon'
import { groupInterviewsByCandidate } from '@/utils/grouping'

/* ── helpers ──────────────────────────────────────────────────────────── */
function isToday(dateStr: string) {
  const d = new Date(dateStr), n = new Date()
  return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()
}

function isThisMonth(dateStr: string) {
  const d = new Date(dateStr), n = new Date()
  return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()
}

function isLiveNow(i: Interview) {
  if (i.status !== 'scheduled') return false
  const start = new Date(i.scheduled_at).getTime()
  const end = start + (i.duration_minutes ?? 60) * 60 * 1000
  const now = Date.now()
  return now >= start - 5 * 60 * 1000 && now <= end
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function initials(name?: string | null) {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0].slice(0, 2).toUpperCase()
}

const AVATAR_COLORS = ['#6c47ff', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ff6bc6', '#8b5cf6']
function avatarColor(name?: string | null) {
  if (!name) return AVATAR_COLORS[0]
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function fmtTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
}

type ScheduleBadge = 'live' | 'upcoming' | 'unconfirmed' | 'fill' | 'done'

function getBadge(i: Interview): ScheduleBadge | null {
  if (isLiveNow(i)) return 'live'
  if (i.status === 'scheduled' && !i.is_confirmed) return 'unconfirmed'
  if (i.status === 'scheduled') return 'upcoming'
  return null
}

function getSubtext(i: Interview, badge: ScheduleBadge) {
  const t = fmtTime(i.scheduled_at)
  if (badge === 'live') {
    const link = i.meeting_link ? ` · ${i.meeting_link.replace(/^https?:\/\//, '')}` : ''
    return `${t} · In Progress${link}`
  }
  if (badge === 'fill') return `${t} · Completed · Scorecard due`
  if (badge === 'done') return `${t} · Completed`
  if (badge === 'unconfirmed') return `${t} · Awaiting confirm`
  return `${t} · Confirmed`
}

/* ── badge chip ───────────────────────────────────────────────────────── */
function ScheduleBadgeChip({ badge }: { badge: ScheduleBadge | null }) {
  if (!badge) return null
  if (badge === 'live') return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px',
      borderRadius: 20, background: '#dcfce7', color: '#16a34a', fontSize: 11, fontWeight: 700,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
      Live
    </span>
  )
  if (badge === 'upcoming') return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px',
      borderRadius: 20, background: '#ede9fe', color: '#7c3aed', fontSize: 11, fontWeight: 700,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#7c3aed', display: 'inline-block' }} />
      Upcoming
    </span>
  )
  if (badge === 'unconfirmed') return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px',
      borderRadius: 20, background: '#fff7ed', color: '#ea580c', fontSize: 11, fontWeight: 700,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ea580c', display: 'inline-block' }} />
      Unconfirmed
    </span>
  )
  return null
}

/* ── stat icon box ────────────────────────────────────────────────────── */
function StatIcon({ icon, variant }: { icon: string; variant: any }) {
  return (
    <GlassIcon icon={icon} variant={variant} size={40} iconSize={18} glow={false} />
  )
}

/* ── main component ───────────────────────────────────────────────────── */
export default function InterviewerDashboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isUnlocked = useInterviewStore(s => s.isComplete)

  const todayLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  const { data: interviews, isLoading } = useQuery({
    queryKey: ['my-interviews'],
    queryFn: () => interviewsApi.list().then((r) => r.data),
  })

  const todayScheduled  = interviews?.filter((i) => isToday(i.scheduled_at) && i.status === 'scheduled') ?? []
  const completedToday  = interviews?.filter((i) => isToday(i.scheduled_at) && i.status === 'completed') ?? []
  const scorecardsdue   = interviews?.filter((i) => i.status === 'completed' && !i.feedback) ?? []
  const totalMonth      = interviews?.filter((i) => isThisMonth(i.scheduled_at)) ?? []
  const liveNowCount    = interviews?.filter(isLiveNow).length ?? 0

  // Today's schedule sorted by time
  const todayItems = interviews
    ?.filter((i) => isToday(i.scheduled_at) && i.status !== 'cancelled')
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
    ?? []

  const STATS = [
    {
      label: 'Interviews Today', value: todayScheduled.length,
      badge: 'Today', badgeColor: '#16a34a', badgeBg: '#dcfce7',
      icon: 'Calendar', variant: 'blue',
    },
    {
      label: 'Scorecards Due', value: scorecardsdue.length,
      badge: 'Pending', badgeColor: '#7c3aed', badgeBg: '#ede9fe',
      icon: 'Clock', variant: 'amber',
    },
    {
      label: 'Completed Today', value: completedToday.length,
      badge: 'Done', badgeColor: '#16a34a', badgeBg: '#dcfce7',
      icon: 'CheckCircle', variant: 'emerald',
    },
    {
      label: 'Total Interviews', value: totalMonth.length,
      badge: 'This month', badgeColor: '#16a34a', badgeBg: '#dcfce7',
      icon: 'BarChart3', variant: 'pink',
    },
  ]



  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--text)', fontFamily: "'Fraunces', serif", lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: 10 }}>
          {getGreeting()}{user ? `, ${user.full_name.split(' ')[0]}` : ''} <GlassIcon icon="Sparkles" variant="violet" size={32} iconSize={18} glow={false} />
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text)', marginTop: 6, fontWeight: 500 }}>
          {isLoading ? (
            <span style={{ color: 'var(--text-mid)' }}>Loading your schedule…</span>
          ) : (
            <>
              You have{' '}
              <strong>{todayScheduled.length} interview{todayScheduled.length !== 1 ? 's' : ''} today</strong>
              {liveNowCount > 0 && <>{' — '}{liveNowCount} live right now</>}
              {". Let's go! "}
            </>
          )}
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-mid)', marginTop: 2 }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </motion.div>



      {/* ── 4 Stat Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {STATS.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            style={{
              background: 'var(--card-bg)', border: '1px solid var(--card-border)',
              borderRadius: 16, padding: '18px 20px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}
          >
            {/* top row: icon + badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <StatIcon icon={s.icon} variant={s.variant} />
              <span style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                background: s.badgeBg, color: s.badgeColor,
              }}>
                {s.badge}
              </span>
            </div>
            {/* number */}
            <p style={{
              fontSize: 38, fontWeight: 900, color: 'var(--text)', lineHeight: 1,
              fontFamily: "'Fraunces', serif",
            }}>
              {isLoading ? '–' : s.value}
            </p>
            {/* label */}
            <p style={{ fontSize: 12, color: 'var(--text-mid)', marginTop: 6, fontWeight: 500 }}>
              {s.label}
            </p>
          </motion.div>
        ))}
      </div>

      {/* ── Today's Schedule ─────────────────────────────────────────── */}
      <div style={{
        background: 'var(--card-bg)', border: '1px solid var(--card-border)',
        borderRadius: 24, padding: '28px',
        boxShadow: 'var(--shadow)',
        backdropFilter: 'blur(20px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Today's Schedule
            </h2>
            <span style={{
              background: 'rgba(108, 71, 255, 0.08)', color: '#6c47ff',
              padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 800
            }}>
              {todayLabel}
            </span>
          </div>
          <button
            onClick={() => navigate('/interviewer/interviews')}
            style={{ fontSize: 14, fontWeight: 700, color: '#6c47ff', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            View Full Calendar <GlassIcon icon="ArrowRight" variant="violet" size={16} iconSize={10} glow={false} />
          </button>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[1, 2].map((n) => <Skeleton key={n} className="h-28 w-full rounded-2xl" />)}
          </div>
        ) : todayItems.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 20px',
            background: 'rgba(108,71,255,0.02)', borderRadius: 24,
            border: '2px dashed var(--card-border)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12
          }}>
            <span style={{ fontSize: 40 }}>📅</span>
            <div>
              <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', margin: 0 }}>No interviews today</p>
              <p style={{ fontSize: 13, color: 'var(--text-mid)', margin: '4px 0 0' }}>Your schedule is clear. Take a breather! ☕</p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, position: 'relative' }}>
            {groupInterviewsByCandidate(todayItems).map((group, idx) => {
              const name = group.candidate_name
              const color = avatarColor(name)
              
              return (
                <motion.div
                  key={group.candidate_id}
                  initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  style={{
                    display: 'flex', flexDirection: 'column',
                    borderRadius: 24,
                    background: 'var(--card-bg)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid var(--card-border)',
                    boxShadow: 'var(--shadow)',
                    overflow: 'hidden',
                    position: 'relative', zIndex: 1,
                  }}
                >
                  {/* Candidate Header */}
                  <div style={{
                    padding: '20px 24px', 
                    background: 'var(--hover-row)',
                    borderBottom: '1px solid var(--card-border)',
                    display: 'flex', alignItems: 'center', gap: 18
                  }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 14,
                      background: `${color}15`, color, fontSize: 16, fontWeight: 900,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: `2px solid ${color}30`, flexShrink: 0,
                    }}>
                      {initials(name)}
                    </div>
                    <div>
                      <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)', margin: 0, letterSpacing: '-0.3px' }}>
                        {name}
                      </h3>
                      <p style={{ fontSize: 12, color: 'var(--text-mid)', fontWeight: 600, margin: 0 }}>
                        Candidate · {group.interviews.length} round{group.interviews.length !== 1 ? 's' : ''} assigned
                      </p>
                    </div>
                  </div>

                  {/* Rounds List */}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {group.interviews.map((interview, rIdx) => {
                      const badge = getBadge(interview)
                      const time = fmtTime(interview.scheduled_at)
                      const isLive = badge === 'live'
                      const isCompleted = interview.status === 'completed'
                      
                      return (
                        <div
                          key={interview.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 20,
                            padding: '16px 24px',
                            background: isLive ? 'rgba(22,163,74,0.03)' : 'transparent',
                            borderBottom: rIdx === group.interviews.length - 1 ? 'none' : '1px solid var(--card-border)',
                            transition: 'all 0.2s'
                          }}
                        >
                          {/* Time */}
                          <div style={{ width: 85, flexShrink: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 800, color: isLive ? '#16a34a' : 'var(--text)', margin: 0 }}>
                              {time}
                            </p>
                            {isLive && (
                              <span style={{ fontSize: 9, fontWeight: 900, color: '#16a34a', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                • Live Now
                              </span>
                            )}
                          </div>

                          {/* Round Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                                {interview.title || 'General Interview'}
                              </span>
                              <ScheduleBadgeChip badge={badge} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-mid)', fontWeight: 600, marginTop: 2 }}>
                              <span>💻 {interview.interview_type || 'Video'}</span>
                              <span style={{ opacity: 0.4 }}>|</span>
                              <span>⏱️ {interview.duration_minutes}m</span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {isLive && interview.meeting_link && (
                              isUnlocked(interview.id) || user?.role !== 'interviewer' ? (
                                <a href={interview.meeting_link} target="_blank" rel="noreferrer">
                                  <button style={{
                                    padding: '7px 14px', borderRadius: 8, border: 'none',
                                    background: 'rgba(16,185,129,0.12)', color: '#059669',
                                    fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Sora', sans-serif"
                                  }}>
                                    🎥 Join
                                  </button>
                                </a>
                              ) : (
                                <button 
                                  disabled
                                  style={{
                                    padding: '7px 14px', borderRadius: 8, border: 'none',
                                    background: 'var(--hover-row)', color: 'var(--text-lite)',
                                    fontSize: 12, fontWeight: 700, cursor: 'not-allowed', fontFamily: "'Sora', sans-serif",
                                    display: 'flex', alignItems: 'center', gap: 6, opacity: 0.7
                                  }}
                                  title="Complete Prep Kit to unlock"
                                >
                                  🔒 Locked
                                </button>
                              )
                            )}
                            
                            <button
                              onClick={() => navigate(`/interviewer/scorecard/${interview.id}`)}
                              style={{
                                padding: '8px 14px', borderRadius: 10,
                                background: isCompleted ? 'rgba(108,71,255,0.08)' : 'transparent',
                                border: `1px solid ${isCompleted ? 'rgba(108,71,255,0.2)' : 'var(--card-border)'}`,
                                color: isCompleted ? 'var(--violet)' : 'var(--text)',
                                fontSize: 12, fontWeight: 800, cursor: 'pointer',
                              }}
                            >
                              {isCompleted ? 'View Result' : 'Fill Scorecard'}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
