import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  ClipboardCheck, 
  BookOpen, 
  Brain,
  Video, 
  User, 
  Calendar, 
  Clock, 
  Link as LinkIcon, 
  Lock, 
  ChevronRight 
} from 'lucide-react'
import { interviewsApi } from '@/api/interviews'
import type { Interview, InterviewStatus } from '@/types'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDateTime } from '@/utils/formatters'
import { groupInterviewsByCandidate } from '@/utils/grouping'
import { useInterviewStore } from '@/store/interviewStore'
import { useAuthStore } from '@/store/authStore'

// ─── Types ────────────────────────────────────────────────────────────────────

export type HubMode = 'scorecard' | 'prepkit' | 'liveroom'

function statusVariant(s: InterviewStatus): 'info' | 'success' | 'danger' | 'warning' {
  return { scheduled: 'info', completed: 'success', cancelled: 'danger', no_show: 'warning' }[s] as 'info' | 'success' | 'danger' | 'warning'
}

interface ModeConfig {
  icon: any
  title: string
  subtitle: string
  filter: (i: Interview) => boolean
  accentColor: string
  accentBg: string
  ctaLabel: (i: Interview) => React.ReactNode
  ctaPath: (id: string) => string
  ctaBg: string
  emptyTitle: string
  emptyDesc: string
}

const MODE: Record<HubMode, ModeConfig> = {
  scorecard: {
    icon: <ClipboardCheck size={20} />,
    title: 'Scoreboard',
    subtitle: 'Select an interview to submit or review your evaluation',
    filter: () => true,
    accentColor: '#6c47ff',
    accentBg: 'rgba(108,71,255,0.09)',
    ctaLabel: (i) => i.status === 'completed' 
      ? 'View Scorecard' 
      : <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ClipboardCheck size={14} /> Submit Scorecard</span>,
    ctaPath: (id) => `/interviewer/scorecard/${id}`,
    ctaBg: 'linear-gradient(135deg, #6c47ff, #8b6bff)',
    emptyTitle: 'No interviews assigned yet',
    emptyDesc: 'Interviews assigned to you will appear here',
  },
  prepkit: {
    icon: <Brain size={20} />,
    title: 'Prep Kit',
    subtitle: "Open AI-generated questions tailored to the candidate's resume",
    filter: (i) => i.status === 'scheduled',
    accentColor: '#f59e0b',
    accentBg: 'rgba(245,158,11,0.09)',
    ctaLabel: () => <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Brain size={14} /> Open Prep Kit</span>,
    ctaPath: (id) => `/interviewer/prep-kit/${id}`,
    ctaBg: 'linear-gradient(135deg, #f59e0b, #d97706)',
    emptyTitle: 'No upcoming interviews',
    emptyDesc: 'Scheduled interviews will show prep kits here',
  },
  liveroom: {
    icon: <Video size={20} />,
    title: 'Live Room',
    subtitle: 'Enter the live interview room — track ratings, overall summary & meeting link',
    filter: (i) => i.status === 'scheduled',
    accentColor: '#10b981',
    accentBg: 'rgba(16,185,129,0.09)',
    ctaLabel: () => <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Video size={14} /> Enter Live Room</span>,
    ctaPath: (id) => `/interviewer/live-room/${id}`,
    ctaBg: 'linear-gradient(135deg, #10b981, #059669)',
    emptyTitle: 'No scheduled interviews',
    emptyDesc: 'Scheduled interviews will appear here for live sessions',
  },
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InterviewHubPage({ mode }: { mode: HubMode }) {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isUnlocked = useInterviewStore(s => s.isComplete)
  const cfg = MODE[mode]

  const { data: interviews, isLoading, isError } = useQuery({
    queryKey: ['my-interviews'],
    queryFn: () => interviewsApi.list().then((r) => r.data),
  })

  const filtered = interviews?.filter(cfg.filter).sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  ) ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        {/* Feature banner */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 14px', borderRadius: 20,
          background: cfg.accentBg,
          border: `1px solid ${cfg.accentColor}22`,
          marginBottom: 10,
        }}>
          <span style={{ color: cfg.accentColor, display: 'flex', alignItems: 'center' }}>{cfg.icon}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: cfg.accentColor, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            {cfg.title}
          </span>
        </div>
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 500, color: 'var(--text)', fontFamily: "'Poppins', sans-serif", lineHeight: 1.1 }}>
          Pick an Interview
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-mid)', marginTop: 4 }}>
          {cfg.subtitle}
        </p>
      </motion.div>

      {/* ── Count pill ──────────────────────────────────────────────────── */}
      {!isLoading && !isError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
            background: cfg.accentBg, color: cfg.accentColor,
            border: `1px solid ${cfg.accentColor}22`,
          }}>
            {filtered.length} interview{filtered.length !== 1 ? 's' : ''}
          </span>
          {mode === 'scorecard' && (
            <span style={{ fontSize: 12, color: 'var(--text-lite)' }}>
              · all statuses shown
            </span>
          )}
          {(mode === 'prepkit' || mode === 'liveroom') && (
            <span style={{ fontSize: 12, color: 'var(--text-lite)' }}>
              · upcoming only
            </span>
          )}
        </div>
      )}

      {/* ── List ────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px',
              borderRadius: 14, border: '1px solid var(--card-border)',
            }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Skeleton className="h-5 w-56" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-9 w-32 rounded-lg" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div style={{
          background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.20)',
          borderRadius: 12, padding: '14px 18px', fontSize: 13,
          color: '#ef4444', fontWeight: 600,
        }}>
          Failed to load interviews. Please refresh.
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Calendar size={48} strokeWidth={1.5} />}
          title={cfg.emptyTitle}
          description={cfg.emptyDesc}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {groupInterviewsByCandidate(filtered).map((group, gIdx) => (
            <div key={group.candidate_id} style={{
              display: 'flex', flexDirection: 'column', gap: 12,
              background: 'var(--card-bg)', backdropFilter: 'blur(10px)',
              padding: '24px', borderRadius: 24, border: '1px solid var(--card-border)'
            }}>
              {/* Candidate Info Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, paddingLeft: 4 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <User size={18} style={{ color: 'var(--violet)' }} /> {group.candidate_name}
                </span>
                <span style={{
                   fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 12,
                   background: 'var(--hover-row)', color: 'var(--text-mid)', opacity: 0.8
                }}>
                  {group.interviews.length} Round{group.interviews.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Rounds List inside Candidate Card */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {group.interviews.map((interview, i) => (
                  <motion.div
                    key={interview.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: (gIdx + i) * 0.045 }}
                  >
                    <Card
                      hover
                      style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: '14px 20px' }}
                    >
                      {/* Accent bar */}
                      <div style={{
                        width: 4, alignSelf: 'stretch', borderRadius: 2, flexShrink: 0,
                        background: `linear-gradient(180deg, ${cfg.accentColor}, ${cfg.accentColor}55)`,
                        minHeight: 38,
                      }} />

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                            {interview.title === group.candidate_name ? 'General Interview' : (interview.title || 'General Interview')}
                          </span>
                          <Badge variant={statusVariant(interview.status)}>
                            {interview.status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                          </Badge>
                          <Badge variant="default">
                            {interview.interview_type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                          </Badge>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--text-mid)', flexWrap: 'wrap' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={12} /> {formatDateTime(interview.scheduled_at)}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> {interview.duration_minutes} min</span>
                          {interview.meeting_link && (
                            isUnlocked(interview.id) || user?.role !== 'interviewer' ? (
                              <a 
                                href={interview.meeting_link} 
                                target="_blank" 
                                rel="noreferrer"
                                style={{ 
                                  color: '#10b981', 
                                  fontWeight: 600, 
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                              >
                                <Video size={12} /> Link available
                              </a>
                            ) : (
                              <span style={{ color: 'var(--text-lite)', fontWeight: 600, opacity: 0.7, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Lock size={12} /> Prep required
                              </span>
                            )
                          )}
                        </div>
                      </div>

                      {/* CTA */}
                      <button
                        onClick={() => navigate(cfg.ctaPath(interview.id))}
                        style={{
                          padding: '8px 16px', borderRadius: 10, border: 'none',
                          background: interview.status === 'completed' && mode === 'scorecard'
                            ? 'rgba(108,71,255,0.12)'
                            : cfg.ctaBg,
                          color: interview.status === 'completed' && mode === 'scorecard'
                            ? '#6c47ff'
                            : '#fff',
                          fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          fontFamily: "'Sora', sans-serif",
                          boxShadow: interview.status !== 'completed' || mode !== 'scorecard'
                            ? `0 4px 10px ${cfg.accentColor}22`
                            : 'none',
                          whiteSpace: 'nowrap', flexShrink: 0,
                        }}
                      >
                        {cfg.ctaLabel(interview)}
                      </button>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
