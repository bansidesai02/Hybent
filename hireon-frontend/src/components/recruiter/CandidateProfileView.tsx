import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { useCopilotStore } from '@/store/useCopilotStore'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import type { Candidate, Scorecard } from '@/types'
import { Avatar } from '@/components/ui/Avatar'
import { formatDate } from '@/utils/formatters'
import { candidatesApi } from '@/api/candidates'
import { scorecardsApi } from '@/api/scorecards'
import { activitiesApi } from '@/api/activities'
import { preScreeningApi, type PreScreeningListItem, type PreScreeningSession } from '@/api/preScreening'
import { PreScreeningSessionView, STATUS_CFG as PS_STATUS_CFG } from '@/components/PreScreening/PreScreeningSessionView'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { GlassIcon } from '@/components/common/GlassIcon'
import { 
  ArrowRight, 
  Check, 
  ChevronDown, 
  Mic, 
  Lock, 
  ClipboardList, 
  Phone, 
  Mail, 
  Target, 
  MapPin, 
  Clock, 
  CircleDollarSign, 
  Calendar, 
  Link, 
  PenTool,
  Sparkles,
  Star,
  HelpingHand,
  X,
  Ban,
  Zap,
  ExternalLink,
  ChevronRight,
  User,
  AlertTriangle,
  FileText,
  Activity,
  Loader2,
  Briefcase,
  CheckCircle,
  Plus,
} from 'lucide-react'


interface CandidateProfileViewProps {
  candidate: Candidate
  onInvite?: () => void
  onSchedule?: () => void
  hasInvitation?: boolean
  hideInvite?: boolean
  hideSchedule?: boolean
  initialTab?: 'details' | 'feedback' | 'timeline' | 'prescreen'
}

const STAGE_CFG: Record<string, { color: string; bg: string; label: string }> = {
  applied:                      { color: 'var(--violet)', bg: 'rgba(167,139,250,0.10)', label: 'Applied' },
  screening:                    { color: '#3b82f6', bg: 'rgba(59,130,246,0.10)', label: 'Screening' },
  interview:                    { color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)', label: 'Interview' },
  pre_screening:                { color: '#3b82f6', bg: 'rgba(59,130,246,0.10)', label: 'Pre-screening' },
  technical_round:              { color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)', label: 'Technical Round' },
  practical_round:              { color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)', label: 'Practical Round' },
  techno_functional_round:      { color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)', label: 'Techno-Functional Round' },
  management_round:             { color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)', label: 'Management Round' },
  hr_round:                     { color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)', label: 'HR Round' },
  interviewed:                  { color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)', label: 'Interviewed' },
  offer:                        { color: 'var(--amber, #f59e0b)', bg: 'rgba(245,158,11,0.10)', label: 'Offer' },
  hired:                        { color: 'var(--teal, #10b981)', bg: 'rgba(16,185,129,0.10)', label: 'Hired' },
  rejected:                     { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'Rejected' },
  pre_screening_selected:       { color: 'var(--teal, #10b981)', bg: 'rgba(16,185,129,0.10)', label: 'Pre-screening Selected' },
  pre_screening_rejected:       { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'Pre-screening Rejected' },
  technical_round_selected:     { color: 'var(--teal, #10b981)', bg: 'rgba(16,185,129,0.10)', label: 'Technical Round Selected' },
  technical_round_rejected:     { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'Technical Round Rejected' },
  technical_round_back_out:     { color: 'var(--amber, #f59e0b)', bg: 'rgba(245,158,11,0.10)', label: 'Technical Round Back Out' },
  practical_round_selected:     { color: 'var(--teal, #10b981)', bg: 'rgba(16,185,129,0.10)', label: 'Practical Round Selected' },
  practical_round_rejected:     { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'Practical Round Rejected' },
  practical_round_back_out:     { color: 'var(--amber, #f59e0b)', bg: 'rgba(245,158,11,0.10)', label: 'Practical Round Back Out' },
  techno_functional_selected:   { color: 'var(--teal, #10b981)', bg: 'rgba(16,185,129,0.10)', label: 'Techno-Functional Selected' },
  techno_functional_rejected:   { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'Techno-Functional Rejected' },
  management_round_selected:    { color: 'var(--teal, #10b981)', bg: 'rgba(16,185,129,0.10)', label: 'Management Round Selected' },
  management_round_rejected:    { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'Management Round Rejected' },
  hr_round_selected:            { color: 'var(--teal, #10b981)', bg: 'rgba(16,185,129,0.10)', label: 'HR Round Selected' },
  hr_round_rejected:            { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'HR Round Rejected' },
  offered:                      { color: 'var(--amber, #f59e0b)', bg: 'rgba(245,158,11,0.10)', label: 'Offered' },
  offered_back_out:             { color: '#f97316', bg: 'rgba(249,115,22,0.10)', label: 'Offered Back Out' },
  offer_withdrawn:              { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'Offer Withdrawn' },
  hired_joined:                 { color: 'var(--teal, #10b981)', bg: 'rgba(16,185,129,0.10)', label: 'Hired / Joined' },
}

/** Stages that have past pre-screening and qualify for interview feedback */
const INTERVIEW_STAGES = new Set([
  'technical_round', 'technical_round_selected', 'technical_round_rejected', 'technical_round_back_out',
  'practical_round', 'practical_round_selected', 'practical_round_rejected', 'practical_round_back_out',
  'techno_functional_round', 'techno_functional_selected', 'techno_functional_rejected',
  'management_round', 'management_round_selected', 'management_round_rejected',
  'hr_round', 'hr_round_selected', 'hr_round_rejected',
  'interview', 'interviewed',
  'offered', 'offer', 'hired', 'hired_joined', 'rejected',
])

const REC_CFG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  strong_yes: { label: 'Strong Hire',  color: 'var(--teal, #059669)', bg: 'rgba(16,185,129,0.12)', icon: <Star size={12} fill="currentColor" /> },
  yes:        { label: 'Hire',         color: 'var(--teal, #10b981)', bg: 'rgba(16,185,129,0.10)', icon: <Check size={12} strokeWidth={3} /> },
  maybe:      { label: 'Maybe',        color: 'var(--amber, #d97706)', bg: 'rgba(251,191,36,0.12)', icon: <HelpingHand size={12} /> },
  no:         { label: 'No Hire',      color: '#ef4444', bg: 'rgba(239,68,68,0.10)',  icon: <X size={12} strokeWidth={3} /> },
  strong_no:  { label: 'Strong No',   color: '#dc2626', bg: 'rgba(239,68,68,0.12)',  icon: <Ban size={12} /> },
}

function scoreColor(s: number) {
  if (s >= 80) return { text: 'var(--teal, #059669)', bg: 'rgba(16,185,129,0.12)', track: 'var(--teal, #10b981)' }
  if (s >= 60) return { text: 'var(--amber, #d97706)', bg: 'rgba(251,191,36,0.12)', track: 'var(--amber, #f59e0b)' }
  return { text: '#ef4444', bg: 'rgba(239,68,68,0.10)', track: '#ef4444' }
}

function AiSummaryBlock({ interviewId }: { interviewId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['ai-summary', interviewId],
    queryFn: () => scorecardsApi.getAiSummary(interviewId).then((r: any) => r.data),
    staleTime: 5 * 60_000,
    enabled: !!interviewId && interviewId !== 'unknown',
  })

  const summary: string | null = data?.ai_summary ?? null

  return (
    <div style={{
      background: 'linear-gradient(135deg, var(--violet)/6, rgba(168,85,247,0.06))',
      border: '1px solid var(--violet)/18',
      borderRadius: 14,
      padding: '16px 20px',
    }}>
      <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--violet)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Sparkles size={12} /> AI Summary
      </p>

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 14, height: 14, border: '2px solid var(--violet)/30', borderTopColor: 'var(--violet)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: 12, color: 'var(--text-light)', fontStyle: 'italic' }}>
            AI is synthesizing interviewers' feedback…
          </span>
        </div>
      ) : summary ? (
        <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.7, margin: 0, fontStyle: 'italic' }}>
          "{summary}"
        </p>
      ) : (
        <p style={{ fontSize: 12, color: 'var(--text-light)', margin: 0, fontStyle: 'italic' }}>
          AI summary could not be generated. Ensure at least one scorecard has been submitted.
        </p>
      )}
    </div>
  )
}



function SingleInterviewerCard({ sc, expandedIds, toggleExpand }: { sc: any, expandedIds: Set<string>, toggleExpand: (id: string) => void }) {
  const rec = REC_CFG[sc.recommendation]
  const ratingColor = scoreColor((sc.overall_rating / 5) * 100)
  const criteria = sc.criteria_scores ?? []
  const isExpanded = expandedIds.has(sc.id)

  return (
    <div style={{
      border: '1px solid var(--table-border)',
      borderRadius: 12,
      overflow: 'hidden',
      background: 'rgba(0,0,0,0.01)',
      transition: 'box-shadow 0.2s',
    }}>
      {/* Card header — click to expand */}
      <div
        onClick={() => toggleExpand(sc.id)}
        style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, cursor: 'pointer', userSelect: 'none' }}
        className="hover:bg-gray-50/50 transition-colors"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, var(--violet), #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 800, flexShrink: 0 }}>
            {(sc.submitted_by_name ?? 'R').charAt(0).toUpperCase()}
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{sc.submitted_by_name ?? 'Interviewer'}</p>
            <p style={{ fontSize: 11, color: 'var(--text-light)', margin: 0 }}>{formatDate(sc.submitted_at)}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Star rating */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {[1, 2, 3, 4, 5].map((s: number) => (
              <Star 
                key={s} 
                size={14} 
                fill={s <= sc.overall_rating ? 'var(--amber, #fbbf24)' : 'transparent'} 
                stroke={s <= sc.overall_rating ? 'var(--amber, #fbbf24)' : 'var(--text-mid)'}
                style={{ opacity: s <= sc.overall_rating ? 1 : 0.2 }}
              />
            ))}
            <span style={{ fontSize: 12, fontWeight: 700, color: ratingColor.text, marginLeft: 4, background: ratingColor.bg, padding: '2px 8px', borderRadius: 20 }}>
              {sc.overall_rating}/5
            </span>
          </div>
          {rec && (
            <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 20, background: rec.bg, color: rec.color, border: `1px solid ${rec.color}22` }}>
              {rec.icon} {rec.label}
            </span>
          )}
          <ChevronDown 
            size={14} 
            className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
            style={{ color: 'var(--text-light)' }} 
          />
        </div>
      </div>

      {/* Expandable detail */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ borderTop: '1px solid var(--table-border)' }}>
              {/* Criteria scores */}
              {criteria.length > 0 && (
                <div style={{ padding: '14px 18px 12px' }}>
                  <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Evaluation Criteria</p>
                  <div className="flex flex-col sm:grid sm:grid-cols-2 gap-[10px_20px]">
                    {criteria.map((c: any) => (
                      <div key={c.criterion}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-mid)' }}>{c.criterion}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-light)' }}>{c.score}/5</span>
                        </div>
                        <div style={{ height: 5, background: 'var(--violet)/10', borderRadius: 4 }}>
                          <div style={{ height: '100%', width: `${(c.score / 5) * 100}%`, background: 'linear-gradient(90deg, var(--violet), #a855f7)', borderRadius: 4, transition: 'width 0.6s ease' }} />
                        </div>
                        {c.notes && <p style={{ fontSize: 10, color: 'var(--text-light)', marginTop: 2, fontStyle: 'italic' }}>{c.notes}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Strengths / Weaknesses / Summary */}
              {(sc.strengths || sc.weaknesses || sc.summary) && (
                <div style={{ borderTop: criteria.length > 0 ? '1px solid var(--table-border)' : 'none', padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {sc.strengths && (
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--teal, #10b981)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Star size={10} fill="currentColor" /> Strengths
                      </p>
                      <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.6, margin: 0 }}>{sc.strengths}</p>
                    </div>
                  )}
                  {sc.weaknesses && (
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Zap size={10} fill="currentColor" /> Areas to Improve
                      </p>
                      <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.6, margin: 0 }}>{sc.weaknesses}</p>
                    </div>
                  )}
                  {sc.summary && (
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--violet)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <PenTool size={10} /> Summary
                      </p>
                      <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.6, fontStyle: 'italic', margin: 0 }}>"{sc.summary}"</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}


function RoundScorecardsGroup({ group, expandedIds, toggleExpand }: { group: any, expandedIds: Set<string>, toggleExpand: (id: string) => void }) {
  const hasAiSummary = group.interview_id && !group.interview_id.startsWith('unknown_')
  // Default active tab: 'ai' if available, else first interviewer id
  const [activeTab, setActiveTab] = useState<string>(hasAiSummary ? 'ai' : group.cards[0]?.id)

  if (!group.cards || group.cards.length === 0) return null

  const avgScore = group.cards.reduce((sum: number, sc: any) => sum + sc.overall_rating, 0) / group.cards.length

  // Build tab list: [AI Summary, ...interviewers]
  const tabs: { key: string; label: string; icon?: string }[] = [
    ...(hasAiSummary ? [{ key: 'ai', label: 'AI Summary', icon: <Sparkles size={12} /> }] : []),
    ...group.cards.map((sc: any, idx: number) => ({
      key: sc.id,
      label: sc.submitted_by_name?.split(' ')[0] ?? `Interviewer ${idx + 1}`,
      icon: (sc.submitted_by_name ?? 'I').charAt(0).toUpperCase(),
      isInterviewer: true,
    })),
  ]

  const activeCard = group.cards.find((sc: any) => sc.id === activeTab)

  return (
    <div style={{
      background: 'var(--kpi-bg)',
      border: `1px solid var(--table-border)`,
      borderLeft: `4px solid var(--violet)`,
      borderRadius: 16,
      overflow: 'hidden',
      marginBottom: 16,
    }}>
      {/* ── HEADER ROW: left = round info, right = pill tab buttons ── */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid var(--table-border)',
        background: 'rgba(0,0,0,0.01)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'nowrap',
        overflowX: 'auto',
      }}>
        {/* Left: round title */}
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <Mic size={14} className="text-[var(--violet)]" /> {group.title}
        </span>

        {/* Divider */}
        <span style={{ height: 14, width: 1, background: 'var(--table-border)', flexShrink: 0 }} />

        {/* Avg score */}
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-mid)', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          Avg. Score: <span style={{ color: avgScore >= 4 ? 'var(--teal, #10b981)' : avgScore >= 3 ? 'var(--amber, #fbbf24)' : '#ef4444' }}>★ {avgScore.toFixed(1)}</span>
        </span>

        {/* ── PILL TAB BUTTONS pushed to the right ── */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          {tabs.map((tab: any) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 12px 5px 8px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#fff' : 'var(--text-mid)',
                  background: isActive
                    ? (tab.key === 'ai' ? 'linear-gradient(135deg, var(--violet), #a855f7)' : 'linear-gradient(135deg, var(--violet), #a855f7)')
                    : 'var(--violet)/10',
                  border: isActive ? '1px solid transparent' : '1px solid var(--violet)/20',
                  cursor: 'pointer',
                  transition: 'all 0.18s',
                  whiteSpace: 'nowrap',
                  boxShadow: isActive ? '0 2px 8px rgba(108,71,255,0.25)' : 'none',
                }}
              >
                {tab.isInterviewer ? (
                  <>
                    {/* Avatar circle inside pill */}
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%',
                      background: isActive ? 'rgba(255,255,255,0.25)' : 'linear-gradient(135deg, var(--violet), #a855f7)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff',
                      fontSize: 8, fontWeight: 900, flexShrink: 0,
                    }}>
                      {tab.icon}
                    </div>
                    {tab.label}
                  </>
                ) : (
                  <>
                    {tab.icon}
                    {tab.label}
                  </>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── TAB CONTENT ── */}
      <div style={{ padding: '16px 20px' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            {activeTab === 'ai' && hasAiSummary ? (
              <AiSummaryBlock interviewId={group.interview_id} />
            ) : activeCard ? (
              <SingleInterviewerCard sc={activeCard} expandedIds={expandedIds} toggleExpand={toggleExpand} />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Feedback Tab ─────────────────────────────────────────────────────────────

function FeedbackTab({ candidate }: { candidate: Candidate }) {
  const stage = candidate.pipeline_stage || 'applied'
  const hasInterviewStage = INTERVIEW_STAGES.has(stage)

  const { data: scorecards = [], isLoading: loadingSC } = useQuery({
    queryKey: ['scorecards', 'candidate', candidate.id],
    queryFn: () => scorecardsApi.getForCandidate(candidate.id).then((r: any) => r.data as Scorecard[]),
    enabled: hasInterviewStage,
    staleTime: 30_000,
  })

  const currentStageCfg = STAGE_CFG[stage]
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpand = (id: string) => {
    setExpandedIds((prev: Set<string>) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── Locked state ──
  if (!hasInterviewStage) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center', gap: 16 }}>
      <Lock size={48} className="text-[var(--text-light)] opacity-20" />
        <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Interview Feedback Not Available Yet</h3>
        <p style={{ fontSize: 13, color: 'var(--text-light)', lineHeight: 1.7, maxWidth: 340, margin: 0 }}>
          Interview feedback unlocks once the candidate has been{' '}
          {currentStageCfg && (
            <strong style={{ color: currentStageCfg.color }}>{currentStageCfg.label}</strong>
          )}{' '}
          and progressed to at least the <strong style={{ color: 'var(--brand2, #8b5cf6)' }}>Technical Round</strong>. Update the
          candidate's stage using the Action dropdown to unlock this section.
        </p>
      </div>
    )
  }

  if (loadingSC) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '24px 0' }}>
        {[1, 2].map((i: number) => (
          <div key={i} style={{ height: 120, borderRadius: 16, background: 'var(--kpi-bg)', border: '1px solid var(--table-border)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
    )
  }

  // ── No scorecards state ──
  if (!scorecards.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center', gap: 16 }}>
      <ClipboardList size={48} className="text-[var(--text-light)] opacity-20" />
      <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', margin: 0 }}>No Feedback Submitted Yet</h3>
        <p style={{ fontSize: 13, color: 'var(--text-light)', lineHeight: 1.7, maxWidth: 340, margin: 0 }}>
          The candidate is in the interview pipeline. Interviewers can submit feedback from the <strong>Schedule</strong> page after completing an interview.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 8 }}>
      {/* Summary bar */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {['strong_yes','yes','maybe','no','strong_no'].map((r: string) => {
          const count = scorecards.filter((sc: Scorecard) => sc.recommendation === r).length
          if (!count) return null
          const cfg = REC_CFG[r]
          return (
            <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: cfg.bg, border: `1px solid ${cfg.color}22` }}>
              <span className="flex items-center">{cfg.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>{count} × {cfg.label}</span>
            </div>
          )
        })}
        {(() => {
          const avgRatingVal = scorecards.reduce((s: any, sc: any) => s + sc.overall_rating, 0) / scorecards.length
          const avgRatingNum = Number(avgRatingVal.toFixed(1))
          
          let ratingCategory = ''
          if (avgRatingNum < 2.5) ratingCategory = 'Below Average'
          else if (avgRatingNum >= 2.5 && avgRatingNum < 3.5) ratingCategory = 'Average'
          else if (avgRatingNum >= 3.5 && avgRatingNum < 4.5) ratingCategory = 'Good'
          else ratingCategory = 'Excellent'

          // Optional: Add some subtle color-coding based on the category
          let colorTheme = 'var(--violet)' // Default Good
          if (ratingCategory === 'Below Average') colorTheme = '#ef4444' // Red
          else if (ratingCategory === 'Average') colorTheme = 'var(--amber, #f59e0b)' // Amber
          else if (ratingCategory === 'Excellent') colorTheme = 'var(--teal, #10b981)' // Emerald

          return (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              {/* Numeric Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: 'var(--violet)/10', border: '1px solid var(--violet)/20' }}>
                <Star size={12} fill="currentColor" className="text-[var(--violet)]" />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--violet)' }}>
                  {avgRatingNum.toFixed(1)} / 5
                </span>
              </div>
              
              {/* Category Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: `${colorTheme}12`, border: `1px solid ${colorTheme}30` }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: colorTheme }} />
                <span style={{ fontSize: 12, fontWeight: 800, color: colorTheme, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {ratingCategory}
                </span>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Grouped Scorecards by Round */}
      {(() => {
        const groups: Record<string, { interview_id: string; title: string; cards: any[] }> = {}
        scorecards.forEach((sc: any) => {
          const key = sc.interview_id || 'unknown_' + Math.random()
          if (!groups[key]) {
            groups[key] = {
              interview_id: key,
              title: sc.interview_title || 'Overall Feedback',
              cards: [],
            }
          }
          groups[key].cards.push(sc)
        })

        const groupedArray = Object.values(groups)

        return groupedArray.map((group) => (
          <RoundScorecardsGroup 
            key={group.interview_id}
            group={group}
            expandedIds={expandedIds}
            toggleExpand={toggleExpand}
          />
        ))
      })()}
    </div>
  )
}

// ─── Details Tab ─────────────────────────────────────────────────────────────

function DetailsTab({ candidate }: { candidate: Candidate }) {
  const { user } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [notes, setNotes] = useState(candidate.hr_notes || '')
  
  const [formData, setFormData] = useState({
    phone: candidate.phone || '',
    email: candidate.email || '',
    location: candidate.location || '',
    experience_years: candidate.experience_years || '',
    notice_period_days: candidate.notice_period_days || '',
    current_ctc: candidate.current_ctc || candidate.current_salary || '',
    expected_ctc: candidate.expected_ctc || candidate.expected_salary || '',
    availability_status: candidate.availability_status || '',
    interview_availability_days: candidate.interview_availability_days || '',
    interview_time_slot: candidate.interview_time_slot || '',
    linkedin_url: candidate.linkedin_url || '',
    github_url: candidate.github_url || '',
    portfolio_url: candidate.portfolio_url || '',
    full_name: candidate.full_name || '',
    current_company: candidate.current_company || '',
    current_title: candidate.current_title || '',
    applied_job_title: candidate.applied_job_title || '',
    relevant_experience: candidate.relevant_experience || '',
    remarks_hr: candidate.remarks_hr || '',
    remarks_technical: candidate.remarks_technical || '',
    remarks_practical: candidate.remarks_practical || '',
    techno_functional_hr_interview: candidate.techno_functional_hr_interview || '',
    technical_panel: candidate.technical_panel || '',
    reference: candidate.reference || '',
    import_status: candidate.import_status || 'active',
    hr_name: candidate.hr_name || '',
    sr_no: candidate.sr_no || '',
  })

  const queryClient = useQueryClient()

  useEffect(() => {
    setNotes(candidate.hr_notes || '')
    setFormData({
      phone: candidate.phone || '',
      email: candidate.email || '',
      location: candidate.location || '',
      experience_years: candidate.experience_years || '',
      notice_period_days: candidate.notice_period_days || '',
      current_ctc: candidate.current_ctc || candidate.current_salary || '',
      expected_ctc: candidate.expected_ctc || candidate.expected_salary || '',
      availability_status: candidate.availability_status || '',
      interview_availability_days: candidate.interview_availability_days || '',
      interview_time_slot: candidate.interview_time_slot || '',
      linkedin_url: candidate.linkedin_url || '',
      github_url: candidate.github_url || '',
      portfolio_url: candidate.portfolio_url || '',
      full_name: candidate.full_name || '',
      current_company: candidate.current_company || '',
      current_title: candidate.current_title || '',
      applied_job_title: candidate.applied_job_title || '',
      relevant_experience: candidate.relevant_experience || '',
      remarks_hr: candidate.remarks_hr || '',
      remarks_technical: candidate.remarks_technical || '',
      remarks_practical: candidate.remarks_practical || '',
      techno_functional_hr_interview: candidate.techno_functional_hr_interview || '',
      technical_panel: candidate.technical_panel || '',
      reference: candidate.reference || '',
      import_status: candidate.import_status || 'active',
      hr_name: candidate.hr_name || '',
      sr_no: candidate.sr_no || '',
    })
  }, [candidate])

  const saveDetailsMutation = useMutation({
    mutationFn: (data: typeof formData) => candidatesApi.update(candidate.id, data),
    onSuccess: () => {
      toast.success('Candidate details updated')
      setIsEditing(false)
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['talent-pool'] })
      queryClient.invalidateQueries({ queryKey: ['all-talent-full'] })
    },
    onError: () => toast.error('Failed to update details')
  })

  const saveNotesMutation = useMutation({
    mutationFn: (newNotes: string) => candidatesApi.update(candidate.id, { hr_notes: newNotes }),
    onSuccess: () => {
      toast.success('Notes saved')
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['talent-pool'] })
      queryClient.invalidateQueries({ queryKey: ['all-talent-full'] })
    },
    onError: () => toast.error('Failed to save notes')
  })

  const handleBlurNotes = () => {
    if (notes !== (candidate.hr_notes || '')) {
      saveNotesMutation.mutate(notes)
    }
  }

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const isEmpty = (val: any) => {
    if (val === null || val === undefined) return true;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      return trimmed === '' || trimmed.toLowerCase() === 'n/a' || trimmed.toLowerCase() === 'undefined' || trimmed.toLowerCase() === 'null';
    }
    return false;
  };

  const sections = [
    {
      title: 'Personal Information',
      fields: [
        { label: 'Name', icon: <User size={11} />, value: candidate.full_name },
        { label: 'Phone Number', icon: <Phone size={11} />, value: candidate.phone },
        { label: 'Email ID', icon: <Mail size={11} />, value: candidate.email },
        { label: 'Current Location', icon: <MapPin size={11} />, value: candidate.location },
      ].filter(f => !isEmpty(f.value)),
    },
    {
      title: 'Experience Details',
      fields: [
        { label: 'Position', icon: <User size={11} />, value: candidate.current_title },
        { label: 'Role / Designation', icon: <User size={11} />, value: candidate.applied_job_title },
        { label: 'Current Employer', icon: <Target size={11} />, value: candidate.current_company },
        { 
          label: 'Experience', 
          icon: <Clock size={11} />, 
          value: candidate.experience_years || (candidate.years_experience != null ? `${candidate.years_experience} Yrs` : (candidate.relevant_experience || null))
        },
        { label: 'Relevant Experience', icon: <Sparkles size={11} />, value: candidate.relevant_experience },
      ].filter(f => !isEmpty(f.value)),
    },
    {
      title: 'Salary Details',
      fields: [
        { label: 'Current Salary', icon: <CircleDollarSign size={11} />, value: candidate.current_salary || candidate.current_ctc },
        { label: 'Expected Salary', icon: <CircleDollarSign size={11} />, value: candidate.expected_salary || candidate.expected_ctc },
        { label: 'Notice Period', icon: <Clock size={11} />, value: candidate.notice_period_days },
        { label: 'Joining Availability', icon: <Clock size={11} />, value: candidate.availability_status },
      ].filter(f => !isEmpty(f.value)),
    },
    {
      title: 'Interview Details',
      fields: [
        { label: 'Practical Round', icon: <ClipboardList size={11} />, value: candidate.remarks_practical },
        { label: 'HR Interview', icon: <Mic size={11} />, value: candidate.techno_functional_hr_interview },
        { 
          label: 'Final Status', 
          icon: <Target size={11} />, 
          value: candidate.import_status && candidate.import_status !== 'active' 
            ? candidate.import_status 
            : (candidate.pipeline_stage && STAGE_CFG[candidate.pipeline_stage] 
                ? STAGE_CFG[candidate.pipeline_stage].label 
                : 'Applied') 
        },
        { 
          label: 'Preferred Interview Time', 
          icon: <Calendar size={11} />, 
          value: [candidate.interview_availability_days, candidate.interview_time_slot].filter(Boolean).join(' • ') 
        },
      ].filter(f => !isEmpty(f.value)),
    },
    {
      title: 'HR Feedback',
      fields: [
        { label: 'Remarks (HR)', icon: <ClipboardList size={11} />, value: candidate.remarks_hr },
      ].filter(f => !isEmpty(f.value)),
    },
    {
      title: 'Technical Feedback',
      fields: [
        { label: 'Technical Panel', icon: <User size={11} />, value: candidate.technical_panel },
        { label: 'Remarks (Technical)', icon: <ClipboardList size={11} />, value: candidate.remarks_technical },
      ].filter(f => !isEmpty(f.value)),
    },
    {
      title: 'Source & Import Info',
      fields: [
        { label: 'Source', icon: <Link size={11} />, value: candidate.source },
        { label: 'Reference / Referral', icon: <User size={11} />, value: candidate.reference },
        { label: 'HR Name', icon: <User size={11} />, value: candidate.hr_name },
        { label: 'Import Sheet/Panel Name', icon: <FileText size={11} />, value: candidate.import_panel_name },
        { 
          label: 'Import Date', 
          icon: <Calendar size={11} />, 
          value: (() => {
            if (candidate.import_row_date) {
              const datePart = candidate.import_row_date.split(' ')[0];
              try {
                const dateObj = new Date(datePart);
                if (!isNaN(dateObj.getTime())) {
                  return formatDate(dateObj.toISOString());
                }
              } catch (e) {}
              return datePart;
            }
            return candidate.import_date 
              ? formatDate(candidate.import_date) 
              : (candidate.imported_at ? formatDate(candidate.imported_at) : null);
          })()
        },
        { label: 'Serial No', icon: <FileText size={11} />, value: candidate.sr_no },
      ].filter(f => !isEmpty(f.value)),
    },
  ];

  const visibleSections = sections.filter(sec => sec.fields.length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      
      {/* HEADER WITH EDIT TOGGLE */}
      <div className="flex justify-between items-center -mb-2">
        <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Overview & Info
        </p>
        {!isEditing ? (
          user?.role === 'admin' && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="gap-2 rounded-xl text-xs h-8">
              Edit Details
            </Button>
          )
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsEditing(false)} className="gap-2 rounded-xl text-xs h-8">
              Cancel
            </Button>
            <Button size="sm" onClick={() => saveDetailsMutation.mutate(formData)} loading={saveDetailsMutation.isPending} className="gap-2 rounded-xl bg-[var(--violet)] hover:bg-[var(--violet)]/90 text-xs h-8">
              Save Changes
            </Button>
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="flex flex-col gap-6">
          
          {/* Section: Personal Information */}
          <div className="flex flex-col gap-3 p-4 bg-[var(--card-bg)]/30 rounded-2xl border border-[var(--card-border)]">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <User size={13} /> Personal Information
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Full Name" value={formData.full_name} onChange={(e: any) => handleInputChange('full_name', e.target.value)} placeholder="e.g. John Doe" />
              <Input label="Phone" value={formData.phone} onChange={(e: any) => handleInputChange('phone', e.target.value)} placeholder="+1 555-0000" />
              <Input label="Email" value={formData.email} onChange={(e: any) => handleInputChange('email', e.target.value)} placeholder="name@company.com" disabled />
              <Input label="Location" value={formData.location} onChange={(e: any) => handleInputChange('location', e.target.value)} placeholder="City, Country" />
            </div>
          </div>

          {/* Section: Experience Details */}
          <div className="flex flex-col gap-3 p-4 bg-[var(--card-bg)]/30 rounded-2xl border border-[var(--card-border)]">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Target size={13} /> Experience Details
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Position" value={formData.current_title} onChange={(e: any) => handleInputChange('current_title', e.target.value)} placeholder="e.g. Senior Software Engineer" />
              <Input label="Role / Designation" value={formData.applied_job_title} onChange={(e: any) => handleInputChange('applied_job_title', e.target.value)} placeholder="e.g. Fullstack Developer" />
              <Input label="Current Employer" value={formData.current_company} onChange={(e: any) => handleInputChange('current_company', e.target.value)} placeholder="e.g. Google" />
              <Input label="Experience" value={formData.experience_years} onChange={(e: any) => handleInputChange('experience_years', e.target.value)} placeholder="e.g. 5 Years" />
              <Input label="Relevant Experience" value={formData.relevant_experience} onChange={(e: any) => handleInputChange('relevant_experience', e.target.value)} placeholder="e.g. 3 Years" />
            </div>
          </div>

          {/* Section: Salary & Joining Details */}
          <div className="flex flex-col gap-3 p-4 bg-[var(--card-bg)]/30 rounded-2xl border border-[var(--card-border)]">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <CircleDollarSign size={13} /> Salary & Joining Details
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Current Salary / CTC" value={formData.current_ctc} onChange={(e: any) => handleInputChange('current_ctc', e.target.value)} placeholder="e.g. ₹22,00,000" />
              <Input label="Expected Salary / CTC" value={formData.expected_ctc} onChange={(e: any) => handleInputChange('expected_ctc', e.target.value)} placeholder="e.g. ₹32,00,000" />
              <Input label="Notice Period" value={formData.notice_period_days} onChange={(e: any) => handleInputChange('notice_period_days', e.target.value)} placeholder="e.g. 30 Days" />
              <Input label="You will able to join within" value={formData.availability_status} onChange={(e: any) => handleInputChange('availability_status', e.target.value)} placeholder="e.g. 15 Days" />
            </div>
          </div>

          {/* Section: Interview & Feedback Details */}
          <div className="flex flex-col gap-3 p-4 bg-[var(--card-bg)]/30 rounded-2xl border border-[var(--card-border)]">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <ClipboardList size={13} /> Interview & Feedback Details
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Technical Panel" value={formData.technical_panel} onChange={(e: any) => handleInputChange('technical_panel', e.target.value)} placeholder="e.g. Tech Panel A" />
              <Input label="Final Status / Import Status" value={formData.import_status} onChange={(e: any) => handleInputChange('import_status', e.target.value)} placeholder="e.g. Hired / Joined" />
              
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Practical Round Feedback</label>
                <textarea
                  value={formData.remarks_practical}
                  onChange={(e: any) => handleInputChange('remarks_practical', e.target.value)}
                  placeholder="Enter remarks for practical round..."
                  style={{
                    width: '100%',
                    minHeight: 80,
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid rgba(0,0,0,0.1)',
                    background: 'rgba(0,0,0,0.01)',
                    fontSize: 13,
                    color: 'var(--text)',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">HR Interview Remarks</label>
                <textarea
                  value={formData.techno_functional_hr_interview}
                  onChange={(e: any) => handleInputChange('techno_functional_hr_interview', e.target.value)}
                  placeholder="Enter remarks for HR Interview..."
                  style={{
                    width: '100%',
                    minHeight: 80,
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid rgba(0,0,0,0.1)',
                    background: 'rgba(0,0,0,0.01)',
                    fontSize: 13,
                    color: 'var(--text)',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Remarks (HR)</label>
                <textarea
                  value={formData.remarks_hr}
                  onChange={(e: any) => handleInputChange('remarks_hr', e.target.value)}
                  placeholder="Enter remarks (HR)..."
                  style={{
                    width: '100%',
                    minHeight: 80,
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid rgba(0,0,0,0.1)',
                    background: 'rgba(0,0,0,0.01)',
                    fontSize: 13,
                    color: 'var(--text)',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Remarks (Technical)</label>
                <textarea
                  value={formData.remarks_technical}
                  onChange={(e: any) => handleInputChange('remarks_technical', e.target.value)}
                  placeholder="Enter remarks (Technical)..."
                  style={{
                    width: '100%',
                    minHeight: 80,
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid rgba(0,0,0,0.1)',
                    background: 'rgba(0,0,0,0.01)',
                    fontSize: 13,
                    color: 'var(--text)',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Section: Source, References & Links */}
          <div className="flex flex-col gap-4 p-4 bg-[var(--card-bg)]/30 rounded-2xl border border-[var(--card-border)]">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Link size={13} /> References & Links
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="Reference / Referral" value={formData.reference} onChange={(e: any) => handleInputChange('reference', e.target.value)} placeholder="e.g. Ref Person Name" />
              <Input label="HR Name" value={formData.hr_name} onChange={(e: any) => handleInputChange('hr_name', e.target.value)} placeholder="e.g. HR Recruiter Name" />
              <Input label="Serial No" value={formData.sr_no} onChange={(e: any) => handleInputChange('sr_no', e.target.value)} placeholder="e.g. 1" />
            </div>
            
            <div className="h-px bg-gray-200 dark:bg-gray-700 my-2" />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="LinkedIn URL" value={formData.linkedin_url} onChange={(e: any) => handleInputChange('linkedin_url', e.target.value)} placeholder="linkedin.com/in/username" />
              <Input label="GitHub URL" value={formData.github_url} onChange={(e: any) => handleInputChange('github_url', e.target.value)} placeholder="github.com/username" />
              <Input label="Portfolio URL" value={formData.portfolio_url} onChange={(e: any) => handleInputChange('portfolio_url', e.target.value)} placeholder="https://yoursite.com" />
            </div>
          </div>

        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {visibleSections.map((sec, idx) => (
            <div key={idx} className="flex flex-col gap-3">
              <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 6 }}>
                {sec.title}
              </p>
              <div className="flex flex-col sm:grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                {sec.fields.map((field, fIdx) => (
                  <div key={fIdx} style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.05)', borderRadius: 14, padding: '12px 16px' }}>
                    <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {field.icon} {field.label}
                    </p>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', wordBreak: 'break-word' }}>{field.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Social Links — always visible, show Add if missing */}
          <div className="flex flex-wrap gap-2 items-center pt-2">
            <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', marginRight: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Link size={12} /> Links:
            </p>
            {candidate.linkedin_url ? (
              <a href={candidate.linkedin_url} target="_blank" rel="noreferrer" className="text-xs font-bold px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1.5">LinkedIn Profile <ExternalLink size={10} /></a>
            ) : (
              <button onClick={() => setIsEditing(true)} className="text-xs font-bold px-3 py-1.5 border border-dashed border-blue-200 text-blue-400 rounded-lg hover:bg-blue-50 hover:border-blue-400 hover:text-blue-600 transition-colors">+ Add LinkedIn</button>
            )}
            {candidate.github_url ? (
              <a href={candidate.github_url} target="_blank" rel="noreferrer" className="text-xs font-bold px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1.5">GitHub Profile <ExternalLink size={10} /></a>
            ) : (
              <button onClick={() => setIsEditing(true)} className="text-xs font-bold px-3 py-1.5 border border-dashed border-gray-200 text-gray-400 rounded-lg hover:bg-gray-50 hover:border-gray-400 hover:text-gray-600 transition-colors">+ Add GitHub</button>
            )}
            {candidate.portfolio_url ? (
              <a href={candidate.portfolio_url} target="_blank" rel="noreferrer" className="text-xs font-bold px-3 py-1.5 bg-violet-50 text-violet-600 rounded-lg hover:bg-violet-100 transition-colors flex items-center gap-1.5">Portfolio <ExternalLink size={10} /></a>
            ) : (
              <button onClick={() => setIsEditing(true)} className="text-xs font-bold px-3 py-1.5 border border-dashed border-violet-200 text-violet-400 rounded-lg hover:bg-violet-50 hover:border-violet-400 hover:text-violet-600 transition-colors">+ Add Portfolio</button>
            )}
          </div>
        </div>
      )}

      {/* Skills Section */}
      {!isEditing && Boolean(candidate.skills && candidate.skills.length > 0) && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            Technical Expertise <span style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.05)' }} />
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {candidate.skills.map((skill: any) => (
              <span key={skill} style={{ fontSize: 11, fontWeight: 600, padding: '6px 14px', borderRadius: 10, background: 'var(--card-bg)', color: 'var(--violet)', border: '1px solid var(--violet)/20', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Work Experience */}
      {!isEditing && Boolean(candidate.parsed_data?.experience && Array.isArray(candidate.parsed_data.experience) && (candidate.parsed_data.experience as any[]).length > 0) && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            Career Journey <span style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.05)' }} />
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {(candidate.parsed_data?.experience as any[]).map((exp: any, idx: number) => (
              <div key={idx} style={{ position: 'relative', paddingLeft: 20 }}>
                <div style={{ position: 'absolute', left: 0, top: 4, bottom: 0, width: 2, background: 'linear-gradient(to bottom, var(--violet), transparent)', borderRadius: 1 }} />
                <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{exp.title}</h4>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--violet)', marginBottom: 6 }}>{exp.company} <span style={{ color: 'var(--text-mid)', fontWeight: 500, marginLeft: 6 }}>· {exp.duration}</span></p>
                {exp.description && <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.6 }}>{exp.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Education */}
      {!isEditing && Boolean(candidate.parsed_data?.education && Array.isArray(candidate.parsed_data.education) && (candidate.parsed_data.education as any[]).length > 0) && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            Academic Foundation <span style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.05)' }} />
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(candidate.parsed_data?.education as any[]).map((edu: any, idx: number) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{edu.degree}</h4>
                  <p style={{ fontSize: 13, color: 'var(--text-mid)' }}>{edu.institution}</p>
                </div>
                {edu.year && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-light)', background: 'rgba(0,0,0,0.03)', padding: '4px 12px', borderRadius: 20 }}>{edu.year}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recruitment Notes / Confidential Notes section */}
      {!isEditing && (
        <div className="flex flex-col gap-3 pt-2">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Lock size={12} /> Recruitment Notes
            </p>
            {saveNotesMutation.isPending && <span style={{ fontSize: 11, color: 'var(--violet)', fontWeight: 600 }}>Saving...</span>}
          </div>
          <textarea
            value={notes}
            onChange={(e: any) => setNotes(e.target.value)}
            onBlur={handleBlurNotes}
            placeholder="Add private notes about this candidate here. These notes are only visible to your team..."
            style={{
              width: '100%',
              minHeight: 120,
              padding: '14px 16px',
              borderRadius: 14,
              border: '1px solid rgba(0,0,0,0.1)',
              background: 'rgba(0,0,0,0.01)',
              fontSize: 13,
              color: 'var(--text)',
              resize: 'vertical',
              fontFamily: 'inherit',
              lineHeight: 1.5,
              transition: 'border-color 0.2s, background 0.2s',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--violet)'
              e.currentTarget.style.background = 'var(--card-bg)'
            }}
            onBlurCapture={(e) => {
              e.currentTarget.style.borderColor = 'var(--card-border)'
              e.currentTarget.style.background = 'var(--card-bg)/50'
            }}
          />
          <p style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 0, fontStyle: 'italic' }}>
            Notes auto-save when you click outside the text box.
          </p>
        </div>
      )}

    </div>
  )
}

// ─── Timeline Tab ────────────────────────────────────────────────────────────

function TimelineTab({ candidate }: { candidate: Candidate }) {
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['candidate-activities', candidate.id],
    queryFn: () => activitiesApi.list(50, candidate.id).then((r: any) => r.data),
  })

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '24px 0' }}>
        <div style={{ height: 60, borderRadius: 16, background: 'var(--kpi-bg)', border: '1px solid var(--table-border)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
    )
  }

  if (!activities.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center', gap: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', margin: 0 }}>No Audit Activity Logged</h3>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Audit Trail
        </p>
        <RouterLink 
          to={`/admin/audit?resource_id=${candidate.id}`}
          style={{ fontSize: 11, fontWeight: 700, color: '#6c47ff', textDecoration: 'none', background: 'rgba(108,71,255,0.1)', padding: '4px 12px', borderRadius: 12 }}
        >
          View Full Audit Log
        </RouterLink>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {activities.map((a: any) => (
          <div key={a.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6c47ff', marginTop: 6, opacity: 0.5 }} />
            <div style={{ flex: 1, background: 'rgba(0,0,0,0.02)', padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>{a.action}</p>
              <div style={{ fontSize: 11, color: 'var(--text-mid)', display: 'flex', justifyContent: 'space-between' }}>
                <span>by {a.user_name || 'System'}</span>
                <span>{new Date(a.created_at).toLocaleString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────

// ── PreScreenTab ──────────────────────────────────────────────────────────────

function PreScreenTab({
  candidate,
  onNewSession,
}: {
  candidate: Candidate
  onNewSession: () => void
}) {
  const queryClient = useQueryClient()
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<PreScreeningListItem[]>({
    queryKey: ['pre-screening-list', candidate.id],
    queryFn: async () => {
      const res = await preScreeningApi.listSessions({ candidate_id: candidate.id })
      return res.data
    },
  })

  // Auto-select most recent session
  React.useEffect(() => {
    if (sessions.length > 0 && !selectedSessionId) {
      setSelectedSessionId(sessions[0].id)
    }
  }, [sessions, selectedSessionId])

  const { data: selectedSession, isLoading: detailLoading } = useQuery<PreScreeningSession>({
    queryKey: ['pre-screening', selectedSessionId],
    queryFn: async () => {
      const res = await preScreeningApi.getSession(selectedSessionId!)
      return res.data
    },
    enabled: !!selectedSessionId,
  })

  const summariseMutation = useMutation({
    mutationFn: () => preScreeningApi.summariseSession(selectedSessionId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pre-screening', selectedSessionId] })
      toast.success('AI summary generated')
    },
    onError: () => {
      toast.error('Failed to generate summary')
    },
  })

  if (sessionsLoading) {
    return (
      <div style={psTabStyles.root}>
        <div style={psTabStyles.skeleton} />
        <div style={{ ...psTabStyles.skeleton, width: '70%' }} />
        <div style={{ ...psTabStyles.skeleton, height: '120px' }} />
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div style={psTabStyles.emptyWrap}>
        <div style={psTabStyles.emptyIcon}>
          <Mic size={28} color="#6c47ff" />
        </div>
        <h3 style={psTabStyles.emptyTitle}>No Pre-Screening Yet</h3>
        <p style={psTabStyles.emptyText}>
          Send a pre-screening invite to have the candidate answer AI-generated questions before the interview.
        </p>
        <button style={psTabStyles.newBtn} onClick={onNewSession}>
          <Plus size={15} />
          Send Pre-Screen Invite
        </button>
      </div>
    )
  }

  return (
    <div style={psTabStyles.root}>
      {/* Session list */}
      <div style={psTabStyles.sessionList}>
        {sessions.map(s => {
          const cfg = PS_STATUS_CFG[s.status] || PS_STATUS_CFG.pending
          const isActive = s.id === selectedSessionId
          return (
            <button
              key={s.id}
              style={{
                ...psTabStyles.sessionCard,
                ...(isActive ? psTabStyles.sessionCardActive : {}),
              }}
              onClick={() => setSelectedSessionId(s.id)}
            >
              <div style={psTabStyles.sessionCardTop}>
                <span style={{ ...psTabStyles.statusPill, color: cfg.color, background: cfg.bg }}>
                  {cfg.label}
                </span>
                <span style={psTabStyles.sessionDate}>{formatDate(s.created_at)}</span>
              </div>
              {s.job_title && (
                <div style={psTabStyles.sessionJob}>
                  <Briefcase size={12} />
                  {s.job_title}
                </div>
              )}
              <div style={psTabStyles.sessionMeta}>
                <Mic size={11} />
                {s.response_count} response{s.response_count !== 1 ? 's' : ''}
                {s.status === 'completed' && s.response_count > 0 && (
                  <><CheckCircle size={11} style={{ marginLeft: '6px' }} /> Completed</>
                )}
              </div>
            </button>
          )
        })}
        <button style={psTabStyles.addSessionBtn} onClick={onNewSession} title="Start new pre-screen">
          <Plus size={14} />
          New
        </button>
      </div>

      {/* Detail view */}
      {selectedSessionId && (
        <div style={psTabStyles.detailWrap}>
          {detailLoading || !selectedSession ? (
            <div style={psTabStyles.root}>
              <div style={psTabStyles.skeleton} />
              <div style={{ ...psTabStyles.skeleton, width: '70%' }} />
              <div style={{ ...psTabStyles.skeleton, height: '200px' }} />
            </div>
          ) : (
            <>
              <div style={psTabStyles.detailHeader}>
                <div style={psTabStyles.detailMeta}>
                  {selectedSession.job_title && (
                    <span style={psTabStyles.detailJob}>
                      <Briefcase size={13} />
                      {selectedSession.job_title}
                    </span>
                  )}
                  {selectedSession.completed_at && (
                    <span style={psTabStyles.detailCompleted}>
                      <CheckCircle size={12} />
                      Completed {formatDate(selectedSession.completed_at)}
                    </span>
                  )}
                </div>
                <button
                    onClick={() => {
                      const base = user?.role === 'admin' ? '/admin' : '/recruiter'
                      navigate(`${base}/pre-screening/${selectedSession.id}`)
                    }}
                    style={psTabStyles.fullPageLink}
                  >
                    <ExternalLink size={13} />
                    Open Full Review
                  </button>
              </div>
              <PreScreeningSessionView
                session={selectedSession}
                onSummarise={() => summariseMutation.mutate()}
                summarising={summariseMutation.isPending}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}

const psTabStyles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  skeleton: {
    width: '100%',
    height: '24px',
    borderRadius: '8px',
    background: '#f0edff',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  emptyWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '48px 24px',
    textAlign: 'center',
  },
  emptyIcon: {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    background: 'rgba(108,71,255,0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#1a1040',
    margin: 0,
  },
  emptyText: {
    fontSize: '13px',
    color: '#6b7280',
    maxWidth: '360px',
    lineHeight: 1.6,
    margin: 0,
  },
  newBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 20px',
    borderRadius: '10px',
    border: 'none',
    background: 'linear-gradient(135deg, #6c47ff, #9b80ff)',
    color: '#fff',
    fontWeight: 700,
    fontSize: '13px',
    cursor: 'pointer',
    marginTop: '4px',
  },
  sessionList: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap' as const,
    alignItems: 'center',
  },
  sessionCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1.5px solid #e8e6ff',
    background: '#fff',
    cursor: 'pointer',
    textAlign: 'left' as const,
    minWidth: '160px',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  sessionCardActive: {
    border: '1.5px solid #6c47ff',
    background: 'rgba(108,71,255,0.04)',
    boxShadow: '0 0 0 3px rgba(108,71,255,0.08)',
  },
  sessionCardTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  statusPill: {
    padding: '2px 8px',
    borderRadius: '20px',
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.4px',
  },
  sessionDate: {
    fontSize: '11px',
    color: '#9ca3af',
    whiteSpace: 'nowrap' as const,
  },
  sessionJob: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#374151',
  },
  sessionMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    color: '#9ca3af',
  },
  addSessionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '8px 14px',
    borderRadius: '10px',
    border: '1.5px dashed #c4bfec',
    background: 'transparent',
    color: '#9ca3af',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  detailWrap: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
    paddingTop: '4px',
  },
  detailHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap' as const,
  },
  detailMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap' as const,
  },
  detailJob: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#6c47ff',
    background: 'rgba(108,71,255,0.08)',
    padding: '3px 10px',
    borderRadius: '20px',
  },
  detailCompleted: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    color: '#22c55e',
    fontWeight: 600,
  },
  fullPageLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#6c47ff',
    textDecoration: 'none',
    padding: '5px 12px',
    borderRadius: '8px',
    border: '1px solid rgba(108,71,255,0.2)',
    background: 'rgba(108,71,255,0.04)',
  },
}

// ── PreScreeningModal ─────────────────────────────────────────────────────────

function PreScreeningModal({
  candidate,
  onClose,
}: {
  candidate: Candidate
  onClose: () => void
}) {
  const navigate = useNavigate()
  const [selectedJobId, setSelectedJobId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()

  const { data: jobsData } = useQuery({
    queryKey: ['jobs-list-for-prescreening'],
    queryFn: async () => {
      const { jobsApi } = await import('@/api/jobs')
      const res = await jobsApi.list({ limit: 50, status: 'active' })
      return res.data
    },
  })

  const jobs = (jobsData as any)?.items || (Array.isArray(jobsData) ? jobsData : [])

  const handleCreate = async () => {
    setLoading(true)
    try {
      const res = await preScreeningApi.createSession({
        candidate_id: candidate.id,
        job_id: selectedJobId || undefined,
      })
      toast.success(`Pre-screening invite sent to ${candidate.email}`)
      onClose()
      // then in handleCreate, replace both navigate calls:
      navigate(`${user?.role === 'admin' ? '/admin' : '/recruiter'}/pre-screening/${res.data.id}`)
      // and the 409 branch:
      navigate(`${user?.role === 'admin' ? '/admin' : '/recruiter'}/pre-screening/${res.data.id}`)
    } catch (err: any) {
      const detail: string = err?.response?.data?.detail || ''
      if (err?.response?.status === 409 && detail.startsWith('completed_session:')) {
        const sessionId = detail.split(':')[1]
        toast.success('A completed pre-screening already exists — opening results.')
        onClose()
        navigate(`/recruiter/pre-screening/${sessionId}`)
      } else {
        toast.error(detail || 'Failed to create pre-screening session')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '460px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#1a1040', margin: '0 0 6px 0' }}>
          Request Pre-Screening
        </h2>
        <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 20px 0' }}>
          AI will generate 10 personalised questions and email an invite to <strong>{candidate.email}</strong>.
        </p>

        <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '6px' }}>
          Select Job (optional)
        </label>
        <select
          value={selectedJobId}
          onChange={e => setSelectedJobId(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '14px', color: '#1a1040', background: '#fafafa', marginBottom: '20px', outline: 'none' }}
        >
          <option value="">— No specific job —</option>
          {jobs.map((j: any) => (
            <option key={j.id} value={j.id}>{j.title}</option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '11px', borderRadius: '10px', border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 600, cursor: 'pointer', fontSize: '14px' }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            style={{ flex: 2, padding: '11px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #6c47ff, #9b80ff)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '14px', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Sending…' : 'Send Pre-Screening Invite'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function CandidateProfileView({ 
  candidate: initialCandidate, 
  onInvite, 
  onSchedule, 
  hasInvitation,
  hideInvite,
  hideSchedule,
  initialTab,
}: CandidateProfileViewProps) {
  const { data: candidate = initialCandidate } = useQuery({
    queryKey: ['candidates', initialCandidate.id],
    queryFn: () => candidatesApi.get(initialCandidate.id).then((r: any) => r.data),
    initialData: initialCandidate,
  })

  const setPageContext = useCopilotStore(s => s.setPageContext)
  const [activeTab, setActiveTab] = useState<'details' | 'feedback' | 'timeline' | 'prescreen'>(initialTab ?? 'details')
  const [showPreScreeningModal, setShowPreScreeningModal] = useState(false)
  const stage = candidate.pipeline_stage || 'applied'
  const stageCfg = candidate.pipeline_stage ? STAGE_CFG[stage] : null

  useEffect(() => {
    setPageContext({
      candidate_id: candidate.id,
      candidate_name: candidate.full_name
    })
    return () => setPageContext(null)
  }, [candidate.id, candidate.full_name, setPageContext])

  const tabs = [
    { key: 'details',   label: <span className="flex items-center gap-2"><User size={14} /> Candidate Details</span> },
    { key: 'feedback',  label: <span className="flex items-center gap-2"><Mic size={14} /> Interview Feedback</span> },
    { key: 'prescreen', label: <span className="flex items-center gap-2"><Sparkles size={14} /> Pre-Screen</span> },
    { key: 'timeline',  label: <span className="flex items-center gap-2"><Activity size={14} /> Audit Trail</span> },
  ] as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: '4px 0' }}>
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start gap-4 pb-5">
        <Avatar name={candidate.full_name} src={candidate.avatar_url} size="xl" className="ring-4 ring-violet-50 shadow-lg" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', fontFamily: "'Fraunces', serif", marginBottom: 2, letterSpacing: '-0.02em' }}>
            {candidate.full_name}
          </h3>
          {candidate.current_title && (
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-mid)', marginBottom: 6 }}>
              {candidate.current_title}{candidate.current_company ? ` · ${candidate.current_company}` : ''}
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {stageCfg ? (
              <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 14px', borderRadius: 20, background: stageCfg.bg, color: stageCfg.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {stageCfg.label}
              </span>
            ) : (
              <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 14px', borderRadius: 20, background: 'rgba(0,0,0,0.05)', color: 'var(--text-mid)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Talent Pool
              </span>
            )}
            {candidate.match_score != null && (() => {
              const sc = scoreColor(candidate.match_score)
              return (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 20, background: sc.bg, color: sc.text, border: `1px solid ${sc.track}30` }}>
                  <Zap size={12} fill="currentColor" /> {Math.round(candidate.match_score)}% Match
                </span>
              )
            })()}
            {(candidate.resume_storage_path || candidate.resume_url) && (
              <button
                onClick={async (e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  // If stored in Supabase, always fetch a fresh signed URL
                  if (candidate.resume_storage_path) {
                    try {
                      const { candidatesApi } = await import('@/api/candidates')
                      const res = await candidatesApi.getResumeUrl(candidate.id)
                      const data = (res.data as any)?.data ?? res.data
                      if (data?.url) {
                        window.open(data.url, '_blank', 'noopener,noreferrer')
                      }
                    } catch {
                      alert('Could not load resume. Please try again.')
                    }
                  } else {
                    // Legacy: Cloudinary or local URL — open directly
                    const baseUrl = import.meta.env.VITE_API_BASE_URL || window.location.origin
                    const url = candidate.resume_url!.startsWith('http')
                      ? candidate.resume_url!
                      : `${baseUrl}${candidate.resume_url}`
                    window.open(url, '_blank', 'noopener,noreferrer')
                  }
                }}
                style={{ fontSize: 11, fontWeight: 700, color: '#6c47ff', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', background: 'rgba(108,71,255,0.08)', padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer' }}>
                <FileText size={14} /> Resume
              </button>
            )}
            {onInvite && !hideInvite && (
              <button
                onClick={(e) => { e.stopPropagation(); onInvite() }}
                style={{ fontSize: 11, fontWeight: 700, background: 'rgba(108,71,255,0.06)', color: '#6c47ff', border: '1px solid rgba(108,71,255,0.15)', padding: '4px 14px', borderRadius: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Mail size={12} /> {hasInvitation ? 'Resend Invite' : 'Invite'}
              </button>
            )}
            {onSchedule && !hideSchedule && (
              <button
                onClick={(e) => { e.stopPropagation(); onSchedule() }}
                style={{ fontSize: 11, fontWeight: 700, background: '#6c47ff', color: '#fff', border: 'none', padding: '4px 16px', borderRadius: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(108,71,255,0.25)' }}
              >
                <Calendar size={12} /> Schedule
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setActiveTab('prescreen') }}
              style={{ fontSize: 11, fontWeight: 700, background: 'rgba(108,71,255,0.08)', color: '#6c47ff', border: '1px solid rgba(108,71,255,0.15)', padding: '4px 14px', borderRadius: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Sparkles size={12} /> Pre-Screen
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--table-border)', marginBottom: 24, position: 'relative' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: activeTab === tab.key ? 700 : 500,
              color: activeTab === tab.key ? '#6c47ff' : 'var(--text-light)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              transition: 'color 0.2s',
            }}
          >
            {tab.label}
            {activeTab === tab.key && (
              <span style={{ position: 'absolute', bottom: -2, left: 0, right: 0, height: 2, background: '#6c47ff', borderRadius: 2 }} />
            )}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      {activeTab === 'details' && <DetailsTab candidate={candidate} />}
      {activeTab === 'feedback' && <FeedbackTab candidate={candidate} />}
      {activeTab === 'prescreen' && (
        <PreScreenTab
          candidate={candidate}
          onNewSession={() => setShowPreScreeningModal(true)}
        />
      )}
      {activeTab === 'timeline' && <TimelineTab candidate={candidate} />}

      {/* Pre-Screening Modal */}
      {showPreScreeningModal && (
        <PreScreeningModal
          candidate={candidate}
          onClose={() => setShowPreScreeningModal(false)}
        />
      )}
    </div>
  )
}
