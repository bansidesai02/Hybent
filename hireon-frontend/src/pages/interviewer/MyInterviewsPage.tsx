import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AddToCalendarDropdown } from '@/components/calendar/AddToCalendarDropdown'
import { motion, AnimatePresence } from 'framer-motion'
import { interviewsApi } from '@/api/interviews'
import { candidatesApi } from '@/api/candidates'
import type { Interview } from '@/types'
import { Skeleton } from '@/components/ui/Skeleton'
import { FileText, CheckCircle, BarChart2, Inbox, Sparkles, X, Plus, Check, Clock, Link as LinkIcon, AlertTriangle, XCircle, Layout, Video, Lock, Brain, User, ExternalLink } from 'lucide-react'
import { GlassIcon } from '@/components/common/GlassIcon'
import { groupInterviewsByCandidate } from '@/utils/grouping'
import { useInterviewStore } from '@/store/interviewStore'
import { useAuthStore } from '@/store/authStore'
import { Tooltip } from '@/components/ui/Tooltip'

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
  return new Date(dateStr).toLocaleTimeString('en-US', { hour12: true }).split(' ').pop() || ''
}

function fmtHourOnly(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).split(' ')[0]
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
                  background: '#f5f5f5', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666',
                }}
              >
                <X size={16} />
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
                    <button
                      onClick={() => {
                        const baseUrl = import.meta.env.VITE_API_BASE_URL || window.location.origin
                        const url = candidate.resume_url!.startsWith('http')
                          ? candidate.resume_url!
                          : `${baseUrl}${candidate.resume_url}`
                        window.open(url, '_blank', 'noopener,noreferrer')
                      }}
                      style={{
                        padding: '7px 14px', borderRadius: 8, background: '#6c47ff',
                        color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none',
                        display: 'flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer'
                      }}
                    >
                      <div className="logo-box">
                        <Layout size={14} color="white" strokeWidth={3} />
                      </div>
                      Open in new tab <ExternalLink size={12} />
                    </button>
                  </div>
                  <iframe
                    src={`${candidate.resume_url.startsWith('http') ? candidate.resume_url : `${import.meta.env.VITE_API_BASE_URL || window.location.origin}${candidate.resume_url}`}#toolbar=1&navpanes=0`}
                    title="Resume"
                    style={{ width: '100%', height: '68vh', borderRadius: 12, border: '1px solid #eee' }}
                  />
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '52px 0', color: '#aaa', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <GlassIcon icon="FileText" variant="gray" size={60} iconSize={28} glow={false} />
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
  interview, live, delay, showName = true,
  onEnterRoom, onViewResume, onPrepKit, onReschedule, onScorecard, onConfirm,
}: {
  interview: Interview
  live: boolean
  delay: number
  showName?: boolean
  onEnterRoom: () => void
  onViewResume: () => void
  onPrepKit: () => void
  onReschedule: () => void
  onScorecard: () => void
  onConfirm: () => void
}) {
  const { user } = useAuthStore()
  const isUnlocked = useInterviewStore(s => s.isComplete(interview.id)) || user?.role !== 'interviewer'

  const ampm = fmtAmPm(interview.scheduled_at)
  const hourMin = fmtHourOnly(interview.scheduled_at)
  const borderColor = live ? '#16a34a' : interview.status === 'completed' ? '#d1d5db' : '#6c47ff'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}
      className="flex flex-col md:flex-row w-full"
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: 20,
        overflow: 'visible',
        boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
        transition: 'all 0.3s ease',
      }}
    >
      {/* Time Column */}
      <div 
        className="w-full md:w-[100px] flex md:flex-col flex-row items-center md:justify-center justify-between p-4 md:py-6 border-b md:border-b-0 md:border-r rounded-t-[19px] md:rounded-l-[19px] md:rounded-tr-none flex-shrink-0"
        style={{
          borderColor: 'var(--card-border)',
          background: live ? 'rgba(22,163,74,0.03)' : 'transparent',
        }}
      >
        <span style={{
          fontSize: 28, fontWeight: 900, color: live ? '#16a34a' : '#6c47ff', lineHeight: 1,
          fontFamily: "'Fraunces', serif", letterSpacing: '-1px',
        }}>
          {hourMin}
        </span>
        <div className="flex md:flex-col flex-row items-center gap-2 md:gap-0" style={{ marginTop: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: live ? '#16a34a' : '#6c47ff', textTransform: 'uppercase' }}>{ampm}</span>
          <span className="hidden md:inline" style={{ fontSize: 10, color: 'var(--text-light)', marginTop: 2, fontWeight: 600 }}>Today</span>
        </div>
      </div>

      {/* Info Column */}
      <div className="flex-1 p-4 sm:p-5 flex flex-col gap-2.5 min-w-0">
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--text)', margin: '0 0 4px 0' }}>
            {showName ? (interview.candidate_name || interview.title) : (interview.title || 'General Round')}
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-mid)', fontWeight: 600 }}>
            {interviewTypeLabel(interview.interview_type)} · {interview.duration_minutes} min slot
          </p>
        </div>

        {/* Skills Rail */}
        {interview.candidate_skills && interview.candidate_skills.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '2px 0' }}>
            {interview.candidate_skills.slice(0, 5).map(skill => (
              <span key={skill} style={{
                padding: '4px 10px', borderRadius: 8, background: 'rgba(108,71,255,0.06)',
                color: '#6c47ff', fontSize: 11, fontWeight: 700, border: '1px solid rgba(108,71,255,0.1)'
              }}>
                {skill}
              </span>
            ))}
            {interview.candidate_skills.length > 5 && (
              <span style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 600, alignSelf: 'center', marginLeft: 4 }}>
                +{interview.candidate_skills.length - 5} more
              </span>
            )}
          </div>
        )}

        {/* Meeting Link */}
        {interview.meeting_link && interview.status !== 'completed' && (
          isUnlocked ? (
            <a
              href={interview.meeting_link}
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: 12, color: '#6c47ff', fontWeight: 700,
                textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
                marginTop: 4
              }}
            >
              <LinkIcon size={14} />
              {interview.meeting_link.replace(/^https?:\/\//, '')}
            </a>
          ) : (
            <div style={{
              fontSize: 11, color: 'var(--text-lite)', fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              marginTop: 4, background: 'var(--hover-row)', padding: '4px 8px', borderRadius: 6,
              alignSelf: 'flex-start'
            }}>
              <Lock size={12} /> Link Locked
              <span style={{ fontSize: 9, opacity: 0.7 }}>(Prep Required)</span>
            </div>
          )
        )}
      </div>

      {/* Actions Column */}
      <div 
        className="w-full md:w-auto p-4 sm:p-5 pt-0 md:pt-5 flex flex-col md:items-end justify-center gap-3 flex-shrink-0"
      >
        {live ? (
          isUnlocked ? (
            <motion.button
              whileHover={{ scale: 1.02, boxShadow: '0 10px 25px rgba(108,71,255,0.35)' }}
              whileTap={{ scale: 0.97 }}
              onClick={onEnterRoom}
              style={{
                padding: '12px 28px', borderRadius: 14,
                background: 'linear-gradient(135deg, #6c47ff 0%, #8b5cf6 100%)',
                color: '#fff', fontWeight: 800, fontSize: 13, border: 'none',
                cursor: 'pointer', whiteSpace: 'nowrap',
                boxShadow: '0 8px 20px rgba(108,71,255,0.25)',
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', justifyContent: 'center'
              }}
            >
              <Video size={15} /> Enter Room
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onPrepKit}
              style={{
                padding: '12px 28px', borderRadius: 14, background: 'var(--hover-row)',
                color: 'var(--text-mid)', fontWeight: 800, fontSize: 13, border: '1.5px dashed var(--card-border)',
                cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', justifyContent: 'center'
              }}
            >
              <Lock size={14} /> Prep Required
            </motion.button>
          )
        ) : interview.status === 'scheduled' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
            {!interview.is_confirmed ? (
              <motion.button
                whileHover={{ scale: 1.02, background: 'linear-gradient(135deg, #16a34a 0%, #10b981 100%)' }}
                whileTap={{ scale: 0.97 }}
                onClick={onConfirm}
                style={{
                  padding: '12px 28px', borderRadius: 14,
                  background: 'linear-gradient(135deg, #059669 0%, #16a34a 100%)',
                  color: '#fff', fontWeight: 800, fontSize: 13, border: 'none',
                  cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 10,
                  boxShadow: '0 8px 20px rgba(22,163,74,0.25)',
                  width: '100%', justifyContent: 'center'
                }}
              >
                <Check size={16} /> Confirm
              </motion.button>
            ) : (
              <div style={{
                padding: '10px 20px', borderRadius: 12, background: 'rgba(22,163,74,0.1)',
                color: '#16a34a', fontSize: 12, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8,
                border: '1px solid rgba(22,163,74,0.15)', width: '100%', justifyContent: 'center'
              }}>
                <CheckCircle size={14} /> Confirmed
              </div>
            )}
          </div>
        ) : interview.status === 'completed' && (
           <motion.button
            whileHover={{ scale: 1.02, boxShadow: '0 10px 25px rgba(59,130,246,0.35)' }}
            whileTap={{ scale: 0.97 }}
            onClick={onScorecard}
            style={{
              padding: '12px 28px', borderRadius: 14,
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: '#fff', fontWeight: 800, fontSize: 13, border: 'none',
              cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 8px 20px rgba(59,130,246,0.25)',
              display: 'flex', alignItems: 'center', gap: 12, width: '100%', justifyContent: 'center'
            }}
          >
            <BarChart2 size={16} /> Scorecard
          </motion.button>
        )}

        {/* Utility Belt for Secondary Actions */}
        <div className="flex flex-wrap items-center justify-center md:justify-end gap-2.5 mt-2.5 w-full">
          {interview.status === 'scheduled' && (
            <AddToCalendarDropdown interview={interview} />
          )}

          <Tooltip content="Review candidate resume">
            <motion.button
              whileHover={{ scale: 1.05, background: 'rgba(108,71,255,0.12)' }}
              whileTap={{ scale: 0.95 }}
              onClick={onViewResume}
              style={{
                padding: '8px 16px', borderRadius: 10, background: 'rgba(108,71,255,0.06)',
                border: '1px solid rgba(108,71,255,0.1)', color: '#6c47ff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 11
              }}
            >
              <FileText size={13} /> Resume
            </motion.button>
          </Tooltip>

          <Tooltip content="View prep checklist">
            <motion.button
              whileHover={{ scale: 1.05, background: 'rgba(108,71,255,0.12)' }}
              whileTap={{ scale: 0.95 }}
              onClick={onPrepKit}
              style={{
                padding: '8px 16px', borderRadius: 10, background: 'rgba(108,71,255,0.06)',
                border: '1px solid rgba(108,71,255,0.1)', color: '#6c47ff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 11
              }}
            >
              <Brain size={13} /> Prep
            </motion.button>
          </Tooltip>
        </div>
      </div>
    </motion.div>

  )
}

/* ── section label ────────────────────────────────────────────────────── */
function SectionLabel({ dot, color, label }: { dot: string; color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, marginTop: 8 }}>
      <span style={{
        width: 10, height: 10, borderRadius: '50%', background: dot, flexShrink: 0,
        boxShadow: `0 0 0 4px ${dot}22`,
      }} />
      <span style={{ fontSize: 12, fontWeight: 900, color, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
        {label}
      </span>
      <div style={{ height: 1, flex: 1, background: 'var(--card-border)', opacity: 0.5, marginLeft: 10 }} />
    </div>
  )
}

/* ── main ─────────────────────────────────────────────────────────────── */
export default function MyInterviewsPage() {
  const navigate = useNavigate()
  const queryControl = (window as any).queryClient
  const [resumeInterview, setResumeInterview] = useState<Interview | null>(null)

  const { data: interviews, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-interviews'],
    queryFn: () => interviewsApi.list().then((r) => r.data),
  })

  const { data: resumeCandidate, isLoading: resumeLoading } = useQuery({
    queryKey: ['candidate', resumeInterview?.candidate_id],
    queryFn: () => candidatesApi.get(resumeInterview!.candidate_id).then((r) => r.data),
    enabled: !!resumeInterview,
  })

  const liveNow       = interviews?.filter(isLiveNow) ?? []
  const upcomingToday = interviews?.filter(
    (i) => isToday(i.scheduled_at) && i.status === 'scheduled' && !isLiveNow(i)
  ).sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()) ?? []
  
  const completedToday = interviews?.filter(
    (i) => isToday(i.scheduled_at) && (i.status === 'completed' || i.status === 'no_show')
  ).sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()) ?? []

  const firstLive = liveNow[0]

  const handleConfirm = async (id: string) => {
    try {
      await interviewsApi.confirm(id)
      refetch()
    } catch (err) {
      console.error('Failed to confirm interview', err)
    }
  }

  const handlers = (i: Interview) => ({
    onEnterRoom:  () => navigate(`/interviewer/live-room/${i.id}`),
    onViewResume: () => setResumeInterview(i),
    onPrepKit:    () => navigate(`/interviewer/prep-kit/${i.id}`),
    onReschedule: () => navigate('/interviewer/interviews'),
    onScorecard:  () => navigate(`/interviewer/scorecard/${i.id}`),
    onConfirm:    () => handleConfirm(i.id),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, paddingBottom: 40 }}>

      {/* ── header ───────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 style={{
            fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 500, color: 'var(--text)',
            fontFamily: "'Poppins', sans-serif", lineHeight: 1.1,
            margin: 0
          }}>
            My Interview Queue
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-mid)', marginTop: 8, fontWeight: 500 }}>
            Your assigned interviews today — confirm, reschedule or jump into the live room.
          </p>
        </div>

        {firstLive ? (
          <motion.button
            whileHover={{ scale: 1.02, boxShadow: '0 10px 25px rgba(108,71,255,0.45)' }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(`/interviewer/live-room/${firstLive.id}`)}
            className="w-full sm:w-auto justify-center"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '12px 28px', borderRadius: 16,
              background: 'linear-gradient(135deg, #6c47ff 0%, #8b5cf6 100%)',
              color: '#fff', fontWeight: 800, fontSize: 14, border: 'none', cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(108,71,255,0.3)',
            }}
          >
             <span className="dot-pulse" style={{ width: 10, height: 10, borderRadius: '50%', background: '#4ade80' }} />
            Enter Live Room
          </motion.button>
        ) : (
          <div 
            className="w-full sm:w-auto justify-center"
            style={{ 
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '12px 28px', borderRadius: 16,
              background: 'var(--hover-row)', color: 'var(--text-lite)',
              fontWeight: 800, fontSize: 14, border: '1px solid var(--card-border)',
              opacity: 0.7, backdropFilter: 'blur(8px)'
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#d1d5db' }} />
            Enter Live Room
          </div>
        )}
      </div>

      {/* ── loading ───────────────────────────────────────────────────── */}
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[1, 2, 3].map((n) => (
            <div key={n} style={{
              display: 'flex', gap: 0, border: '1px solid var(--card-border)',
              borderRadius: 20, overflow: 'hidden', height: 120, background: 'var(--card-bg)'
            }}>
              <div style={{ width: 100, background: 'var(--card-border)', opacity: 0.1 }} />
              <div style={{ flex: 1, padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Skeleton className="h-5 w-64" />
                <Skeleton className="h-3 w-40" />
                <div style={{ display: 'flex', gap: 8 }}>
                   <Skeleton className="h-6 w-16" />
                   <Skeleton className="h-6 w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── error ────────────────────────────────────────────────────── */}
      {isError && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: 16, padding: '20px', fontSize: 14, color: '#dc2626',
          fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10
        }}>
          <AlertTriangle size={18} /> Failed to load interviews. Please refresh the page.
        </div>
      )}

      {/* ── contents ─────────────────────────────────────────────────── */}
      {!isLoading && !isError && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          
          {liveNow.length > 0 && (
            <div>
              <SectionLabel dot="#16a34a" color="#16a34a" label="LIVE NOW" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {groupInterviewsByCandidate(liveNow).map((group, gIdx) => (
                  <div key={group.candidate_id} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {group.interviews.map((i, idx) => (
                      <InterviewCard key={i.id} interview={i} live delay={(gIdx + idx) * 0.05} showName={false} {...handlers(i)} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {upcomingToday.length > 0 && (
            <div>
              <SectionLabel dot="#6c47ff" color="#6c47ff" label="UPCOMING TODAY" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {groupInterviewsByCandidate(upcomingToday).map((group, gIdx) => (
                  <div key={group.candidate_id} style={{
                    display: 'flex', flexDirection: 'column',
                    background: 'var(--card-bg)', backdropFilter: 'blur(10px)',
                    padding: '20px', borderRadius: 24, border: '1px solid var(--card-border)'
                  }}>
                    <h4 style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-mid)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <User size={13} /> {group.candidate_name}
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {group.interviews.map((i, idx) => (
                        <InterviewCard key={i.id} interview={i} live={false} delay={(gIdx + idx) * 0.05} showName={false} {...handlers(i)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {completedToday.length > 0 && (
            <div>
              <SectionLabel dot="#94a3b8" color="#64748b" label="COMPLETED" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {groupInterviewsByCandidate(completedToday).map((group, gIdx) => (
                  <div key={group.candidate_id} style={{
                    display: 'flex', flexDirection: 'column',
                    padding: '12px 0 0'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, paddingLeft: 8 }}>
                       <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-lite)' }}>{group.candidate_name}:</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {group.interviews.map((i, idx) => (
                        <InterviewCard key={i.id} interview={i} live={false} delay={(gIdx + idx) * 0.05} showName={false} {...handlers(i)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {liveNow.length === 0 && upcomingToday.length === 0 && completedToday.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '80px 20px',
              color: 'var(--text-mid)', fontSize: 15,
              background: 'var(--card-bg)', border: '1px dashed var(--card-border)', borderRadius: 24,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12
            }}>
              <GlassIcon icon="Sparkles" variant="emerald" size={60} iconSize={28} glow={false} />
              <p style={{ fontWeight: 800, color: 'var(--text)', fontSize: 18 }}>No interviews assigned today</p>
              <p style={{ fontSize: 14, marginTop: 6, opacity: 0.7 }}>Enjoy your day — we'll notify you when new ones are scheduled!</p>
            </div>
          )}

        </div>
      )}

      {/* ── resume modal ───────────────────── */}
      <ResumeModal
        interview={resumeInterview}
        candidate={resumeCandidate ?? null}
        loading={resumeLoading}
        onClose={() => setResumeInterview(null)}
      />

    </div>
  )
}
