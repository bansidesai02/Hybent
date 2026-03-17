import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { interviewsApi } from '@/api/interviews'
import { candidatesApi } from '@/api/candidates'
import type { Interview } from '@/types'
import { Skeleton } from '@/components/ui/Skeleton'

/* ── helpers ──────────────────────────────────────────────────────────── */
function isToday(dateStr: string) {
  const d = new Date(dateStr), n = new Date()
  return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()
}

function isLiveNow(i: Interview) {
  if (i.status !== 'scheduled') return false
  const start = new Date(i.scheduled_at).getTime()
  const end = start + (i.duration_minutes ?? 60) * 60 * 1000
  const now = Date.now()
  return now >= start - 5 * 60 * 1000 && now <= end
}

function fmtAmPm(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour12: true }).slice(-2)
}

function fmtHourOnly(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

function interviewTypeLabel(type: string) {
  const map: Record<string, string> = {
    phone: 'Phone Screen',
    video: 'Video Interview',
    onsite: 'On-site Round',
    technical: 'Technical Round',
    hr: 'HR Round',
    final: 'Final Round',
  }
  return map[type] ?? type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/* ── resume modal (portal) ────────────────────────────────────────────── */
function ResumeModal({
  interview, candidate, loading, onClose,
}: {
  interview: Interview | null
  candidate: { full_name: string; current_title?: string | null; years_experience?: number | null; resume_url: string | null } | null
  loading: boolean
  onClose: () => void
}) {
  useEffect(() => {
    if (!interview) return
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [interview, onClose])

  useEffect(() => {
    document.body.style.overflow = interview ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [interview])

  return createPortal(
    <AnimatePresence>
      {interview && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          {/* backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          />
          {/* panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.18 }}
            style={{
              position: 'relative', width: '100%', maxWidth: 860,
              background: '#fff', borderRadius: 20,
              boxShadow: '0 24px 60px rgba(0,0,0,0.18)',
              overflow: 'hidden',
            }}
          >
            {/* header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '18px 24px', borderBottom: '1px solid #f0f0f0',
            }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>
                {interview.candidate_name ?? 'Candidate'} — Resume
              </h2>
              <button
                onClick={onClose}
                style={{
                  width: 32, height: 32, borderRadius: 8, border: 'none',
                  background: '#f5f5f5', cursor: 'pointer', fontSize: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666',
                }}
              >
                ✕
              </button>
            </div>

            {/* body */}
            <div style={{ padding: '20px 24px' }}>
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-[60vh] w-full rounded-xl" />
                </div>
              ) : candidate?.resume_url ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{candidate.full_name}</p>
                      <p style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                        {candidate.current_title ?? interview.title}
                        {candidate.years_experience ? ` · ${candidate.years_experience} yrs exp` : ''}
                      </p>
                    </div>
                    <a
                      href={candidate.resume_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        padding: '7px 14px', borderRadius: 8, background: '#6c47ff',
                        color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none',
                      }}
                    >
                      Open in new tab ↗
                    </a>
                  </div>
                  <iframe
                    src={`${candidate.resume_url}#toolbar=1&navpanes=0`}
                    title="Resume"
                    style={{ width: '100%', height: '68vh', borderRadius: 12, border: '1px solid #eee' }}
                  />
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '52px 0', color: '#aaa' }}>
                  <div style={{ fontSize: 38, marginBottom: 12 }}>📄</div>
                  <p style={{ fontWeight: 700, color: '#333', fontSize: 15 }}>No resume uploaded</p>
                  <p style={{ fontSize: 12, marginTop: 4 }}>This candidate hasn't uploaded a resume yet.</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}

/* ── card component ───────────────────────────────────────────────────── */
function InterviewCard({
  interview, live, delay,
  onEnterRoom, onViewResume, onPrepKit, onReschedule, onScorecard,
}: {
  interview: Interview
  live: boolean
  delay: number
  onEnterRoom: () => void
  onViewResume: () => void
  onPrepKit: () => void
  onReschedule: () => void
  onScorecard: () => void
}) {
  const ampm = fmtAmPm(interview.scheduled_at)
  const hourMin = fmtHourOnly(interview.scheduled_at)
  const borderColor = live ? '#16a34a' : '#6c47ff'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      style={{
        display: 'flex', gap: 0,
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
      }}
    >
      {/* left accent bar */}
      <div style={{ width: 5, flexShrink: 0, background: borderColor }} />

      {/* time block */}
      <div style={{
        width: 90, flexShrink: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '20px 0 20px 12px',
        borderRight: '1px solid var(--card-border)',
      }}>
        <span style={{
          fontSize: 26, fontWeight: 900, color: '#6c47ff', lineHeight: 1,
          fontFamily: "'Fraunces', serif", letterSpacing: '-1px',
        }}>
          {hourMin}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#6c47ff', marginTop: 2 }}>{ampm}</span>
        <span style={{ fontSize: 10, color: 'var(--text-mid)', marginTop: 3, fontWeight: 500 }}>Today</span>
      </div>

      {/* main content */}
      <div style={{ flex: 1, padding: '18px 20px', minWidth: 0 }}>
        <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>
          {interview.candidate_name || interview.title}
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-mid)', marginBottom: 10 }}>
          {interviewTypeLabel(interview.interview_type)} · {interview.duration_minutes} min slot
        </p>

        {/* meeting link */}
        {interview.meeting_link && (
          <a
            href={interview.meeting_link}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: 12, color: '#6c47ff', fontWeight: 600,
              textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5,
            }}
          >
            <span>🎥</span>
            {interview.meeting_link.replace(/^https?:\/\//, '')}
          </a>
        )}
      </div>

      {/* action buttons */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
        justifyContent: 'center', gap: 8, padding: '18px 20px', flexShrink: 0,
      }}>
        {live ? (
          <>
            <button
              onClick={onEnterRoom}
              style={{
                padding: '7px 16px', borderRadius: 10, background: '#6c47ff',
                color: '#fff', fontWeight: 700, fontSize: 12, border: '1.5px solid #6c47ff',
                cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit', transition: 'all 0.18s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(108,71,255,0.6)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#6c47ff' }}
            >
              Enter Room
            </button>
            <button
              onClick={onViewResume}
              style={{
                background: 'rgba(108,71,255,0.08)', border: '1.5px solid #6c47ff', color: '#6c47ff',
                fontWeight: 600, fontSize: 12, cursor: 'pointer',
                padding: '7px 16px', borderRadius: 10, fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.18s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(108,71,255,0.6)'; (e.currentTarget as HTMLButtonElement).style.color = '#fff' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(108,71,255,0.08)'; (e.currentTarget as HTMLButtonElement).style.color = '#6c47ff' }}
            >
              View Resume
            </button>
            <button
              onClick={onPrepKit}
              style={{
                background: 'rgba(108,71,255,0.08)', border: '1.5px solid #6c47ff', color: '#6c47ff',
                fontWeight: 600, fontSize: 12, cursor: 'pointer',
                padding: '7px 16px', borderRadius: 10, fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.18s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(108,71,255,0.6)'; (e.currentTarget as HTMLButtonElement).style.color = '#fff' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(108,71,255,0.08)'; (e.currentTarget as HTMLButtonElement).style.color = '#6c47ff' }}
            >
              Prep Kit
            </button>
          </>
        ) : interview.status === 'completed' ? (
          <>
            <button
              onClick={onScorecard}
              style={{
                padding: '7px 16px', borderRadius: 10, background: '#6c47ff',
                color: '#fff', fontWeight: 700, fontSize: 12, border: '1.5px solid #6c47ff',
                cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit', transition: 'all 0.18s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(108,71,255,0.6)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#6c47ff' }}
            >
              View Scorecard
            </button>
            <button
              onClick={onViewResume}
              style={{
                background: 'rgba(108,71,255,0.08)', border: '1.5px solid #6c47ff', color: '#6c47ff',
                fontWeight: 600, fontSize: 12, cursor: 'pointer',
                padding: '7px 16px', borderRadius: 10, fontFamily: 'inherit', transition: 'all 0.18s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(108,71,255,0.6)'; (e.currentTarget as HTMLButtonElement).style.color = '#fff' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(108,71,255,0.08)'; (e.currentTarget as HTMLButtonElement).style.color = '#6c47ff' }}
            >
              View Resume
            </button>
          </>
        ) : (
          <>
            <button
              style={{
                padding: '7px 16px', borderRadius: 10, background: '#10b981',
                color: '#fff', fontWeight: 700, fontSize: 12, border: '1.5px solid #10b981',
                cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
              }}
            >
              ✓ Confirm
            </button>
            <button
              onClick={onViewResume}
              style={{
                background: 'rgba(108,71,255,0.08)', border: '1.5px solid #6c47ff', color: '#6c47ff',
                fontWeight: 600, fontSize: 12, cursor: 'pointer',
                padding: '7px 16px', borderRadius: 10, fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.18s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(108,71,255,0.6)'; (e.currentTarget as HTMLButtonElement).style.color = '#fff' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(108,71,255,0.08)'; (e.currentTarget as HTMLButtonElement).style.color = '#6c47ff' }}
            >
              View Resume
            </button>
            <button
              onClick={onReschedule}
              style={{
                background: 'rgba(108,71,255,0.08)', border: '1.5px solid #6c47ff', color: '#6c47ff',
                fontWeight: 600, fontSize: 12, cursor: 'pointer',
                padding: '7px 16px', borderRadius: 10, fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.18s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(108,71,255,0.6)'; (e.currentTarget as HTMLButtonElement).style.color = '#fff' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(108,71,255,0.08)'; (e.currentTarget as HTMLButtonElement).style.color = '#6c47ff' }}
            >
              Reschedule
            </button>
          </>
        )}
      </div>
    </motion.div>
  )
}

/* ── section label ────────────────────────────────────────────────────── */
function SectionLabel({ dot, color, label }: { dot: string; color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0,
        boxShadow: `0 0 0 3px ${dot}33`,
      }} />
      <span style={{ fontSize: 11, fontWeight: 800, color, letterSpacing: '1.2px' }}>
        {label}
      </span>
    </div>
  )
}

/* ── main ─────────────────────────────────────────────────────────────── */
export default function MyInterviewsPage() {
  const navigate = useNavigate()
  const [resumeInterview, setResumeInterview] = useState<Interview | null>(null)

  const { data: interviews, isLoading, isError } = useQuery({
    queryKey: ['my-interviews'],
    queryFn: () => interviewsApi.list().then((r) => r.data),
  })

  const { data: resumeCandidate, isLoading: resumeLoading } = useQuery({
    queryKey: ['candidate', resumeInterview?.candidate_id],
    queryFn: () => candidatesApi.get(resumeInterview!.candidate_id).then((r) => r.data),
    enabled: !!resumeInterview,
  })

  const liveNow     = interviews?.filter(isLiveNow) ?? []
  const upcomingToday = interviews?.filter(
    (i) => isToday(i.scheduled_at) && i.status === 'scheduled' && !isLiveNow(i)
  ).sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()) ?? []

  const firstLive = liveNow[0]

  const handlers = (i: Interview) => ({
    onEnterRoom:  () => navigate(`/interviewer/live-room/${i.id}`),
    onViewResume: () => setResumeInterview(i),
    onPrepKit:    () => navigate(`/interviewer/prep-kit/${i.id}`),
    onReschedule: () => navigate('/interviewer/interviews'),
    onScorecard:  () => navigate(`/interviewer/scorecard/${i.id}`),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* ── header ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{
            fontSize: 24, fontWeight: 900, color: 'var(--text)',
            fontFamily: "'Fraunces', serif", display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span>📥</span> My Interview Queue
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-mid)', marginTop: 5 }}>
            Your assigned interviews today — reschedule or jump into the live room.
          </p>
        </div>

        {firstLive ? (
          <button
            onClick={() => navigate(`/interviewer/live-room/${firstLive.id}`)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 12,
              background: '#6c47ff', color: '#fff',
              fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', flexShrink: 0,
            }}
          >
            <span style={{
              width: 9, height: 9, borderRadius: '50%', background: '#4ade80',
              boxShadow: '0 0 0 3px rgba(74,222,128,0.4)',
              animation: 'pulse 1.5s ease-in-out infinite',
            }} />
            Enter Live Room
          </button>
        ) : (
          <button
            onClick={() => navigate('/interviewer/interviews')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 12,
              background: '#6c47ff', color: '#fff',
              fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', flexShrink: 0, opacity: 0.7,
            }}
          >
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#d1d5db' }} />
            Enter Live Room
          </button>
        )}
      </div>

      {/* ── loading ───────────────────────────────────────────────────── */}
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map((n) => (
            <div key={n} style={{
              display: 'flex', gap: 0, border: '1px solid var(--card-border)',
              borderRadius: 16, overflow: 'hidden', height: 100,
            }}>
              <div style={{ width: 5, background: '#e5e7eb' }} />
              <div style={{ width: 80, background: '#f9fafb', borderRight: '1px solid var(--card-border)' }} />
              <div style={{ flex: 1, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── error ────────────────────────────────────────────────────── */}
      {isError && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: 12, padding: '14px 18px', fontSize: 13, color: '#dc2626',
        }}>
          Failed to load interviews. Please refresh.
        </div>
      )}

      {/* ── live now ─────────────────────────────────────────────────── */}
      {!isLoading && liveNow.length > 0 && (
        <div>
          <SectionLabel dot="#16a34a" color="#16a34a" label="LIVE NOW" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {liveNow.map((i, idx) => (
              <InterviewCard key={i.id} interview={i} live delay={idx * 0.06} {...handlers(i)} />
            ))}
          </div>
        </div>
      )}

      {/* ── upcoming today ────────────────────────────────────────────── */}
      {!isLoading && upcomingToday.length > 0 && (
        <div>
          <SectionLabel dot="#6c47ff" color="#6c47ff" label="UPCOMING TODAY" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {upcomingToday.map((i, idx) => (
              <InterviewCard key={i.id} interview={i} live={false} delay={idx * 0.06} {...handlers(i)} />
            ))}
          </div>
        </div>
      )}

      {/* ── empty state ───────────────────────────────────────────────── */}
      {!isLoading && !isError && liveNow.length === 0 && upcomingToday.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          color: 'var(--text-mid)', fontSize: 14,
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
          <p style={{ fontWeight: 700, color: 'var(--text)' }}>No interviews today</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>Enjoy the break — check back tomorrow!</p>
        </div>
      )}

      {/* ── resume modal (portal — covers sidebar) ───────────────────── */}
      <ResumeModal
        interview={resumeInterview}
        candidate={resumeCandidate ?? null}
        loading={resumeLoading}
        onClose={() => setResumeInterview(null)}
      />

    </div>
  )
}
