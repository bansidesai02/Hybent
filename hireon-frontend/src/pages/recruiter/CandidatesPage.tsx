import React from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { candidatesApi } from '@/api/candidates'
import { jobsApi } from '@/api/jobs'
import { adminApi } from '@/api/admin'
import type { Candidate } from '@/types'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/ui/Pagination'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { DatePicker } from '@/components/ui/DatePicker'
import { formatDate, formatCandidateDate } from '@/utils/formatters'
// import { formatDistanceToNow } from 'date-fns'
import { GlassIcon } from '@/components/common/GlassIcon'
import { CandidateProfileView } from '@/components/recruiter/CandidateProfileView'
import { GenerateOfferModal } from '@/components/recruiter/GenerateOfferModal'
import { Search, Plus, Ban, Calendar, FileText, Trash2, Play, Pause, Inbox, Users, CheckCircle, XCircle } from 'lucide-react'

// ─── Stage config (full pipeline) ─────────────────────────────────────────────

const STAGE_CFG: Record<string, { color: string; bg: string; label: string }> = {
  applied:                      { color: 'var(--violet)', bg: 'var(--violet)/10', label: 'Applied' },
  screening:                    { color: '#3b82f6', bg: 'rgba(59,130,246,0.10)', label: 'Screening' },
  interview:                    { color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)', label: 'Interview' },
  pre_screening:                { color: '#3b82f6', bg: 'rgba(59,130,246,0.10)', label: 'Pre-screening' },
  technical_round:              { color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)', label: 'Technical Round' },
  practical_round:              { color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)', label: 'Practical Round' },
  techno_functional_round:      { color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)', label: 'Techno-Functional Round' },
  management_round:             { color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)', label: 'Management Round' },
  hr_round:                     { color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)', label: 'HR Round' },
  interviewed:                  { color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)', label: 'Interviewed' },
  offer:                        { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', label: 'Offer' },
  hired:                        { color: 'var(--teal, #10b981)', bg: 'rgba(16,185,129,0.10)', label: 'Hired' },
  rejected:                     { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'Rejected' },
  pre_screening_selected:       { color: 'var(--teal, #10b981)', bg: 'rgba(16,185,129,0.10)', label: 'Pre-screening Selected' },
  pre_screening_rejected:       { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'Pre-screening Rejected' },
  technical_round_selected:     { color: 'var(--teal, #10b981)', bg: 'rgba(16,185,129,0.10)', label: 'Technical Round Selected' },
  technical_round_rejected:     { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'Technical Round Rejected' },
  technical_round_back_out:     { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', label: 'Technical Round Back Out' },
  practical_round_selected:     { color: 'var(--teal, #10b981)', bg: 'rgba(16,185,129,0.10)', label: 'Practical Round Selected' },
  practical_round_rejected:     { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'Practical Round Rejected' },
  practical_round_back_out:     { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', label: 'Practical Round Back Out' },
  techno_functional_selected:   { color: 'var(--teal, #10b981)', bg: 'rgba(16,185,129,0.10)', label: 'Techno-Functional Selected' },
  techno_functional_rejected:   { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'Techno-Functional Rejected' },
  management_round_selected:    { color: 'var(--teal, #10b981)', bg: 'rgba(16,185,129,0.10)', label: 'Management Round Selected' },
  management_round_rejected:    { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'Management Round Rejected' },
  hr_round_selected:            { color: 'var(--teal, #10b981)', bg: 'rgba(16,185,129,0.10)', label: 'HR Round Selected' },
  hr_round_rejected:            { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'HR Round Rejected' },
  offered:                      { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', label: 'Offered' },
  offered_back_out:             { color: '#f97316', bg: 'rgba(249,115,22,0.10)', label: 'Offered Back Out' },
  offer_withdrawn:              { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'Offer Withdrawn' },
  hired_joined:                 { color: 'var(--teal, #10b981)', bg: 'rgba(16,185,129,0.10)', label: 'Hired / Joined' },
  completed:                    { color: 'var(--teal, #10b981)', bg: 'rgba(16,185,129,0.10)', label: 'Completed' },
  inactive:                     { color: '#94a3b8', bg: 'rgba(148,163,184,0.10)', label: 'Inactive' },
  needs_review:                 { color: '#0891b2', bg: 'rgba(8,145,178,0.10)', label: 'Needs Review' },
}

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { color: string; bg: string; dot: string; label: string }> = {
  shortlisted: { color: 'var(--teal, #059669)', bg: 'rgba(16,185,129,0.12)', dot: 'var(--teal, #10b981)', label: 'Shortlisted' },
  in_review:   { color: 'var(--violet)', bg: 'var(--violet)/10', dot: 'var(--violet)', label: 'In Review' },
  scheduled:   { color: '#3b82f6', bg: 'rgba(59,130,246,0.10)', dot: '#3b82f6', label: 'Scheduled' },
  rejected:    { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', dot: '#ef4444', label: 'Rejected' },
  inactive:    { color: '#94a3b8', bg: 'rgba(148,163,184,0.10)', dot: '#94a3b8', label: 'Inactive' },
}

const REJECTION_STAGES = [
  'rejected',
  'pre_screening_rejected',
  'technical_round_rejected',
  'technical_round_back_out',
  'practical_round_rejected',
  'practical_round_back_out',
  'techno_functional_rejected',
  'management_round_rejected',
  'hr_round_rejected',
  'offered_back_out',
  'offer_withdrawn'
]

// Stages where "+ Add in Pipeline" button should be shown
// (candidates not yet in the main interview pipeline)
const PRE_PIPELINE_STAGES: Array<string | null | undefined> = [
  null,
  undefined,
  'needs_review',
  'pre_screening',
  'pre_screening_selected',
]

function isCandidateInActivePipeline(stage: string | null | undefined): boolean {
  if (!stage) return false
  if (stage === 'inactive') return false
  if (PRE_PIPELINE_STAGES.includes(stage)) return false
  if (REJECTION_STAGES.includes(stage)) return false
  return true
}

function getStatusFromStage(stage: string | undefined): string {
  if (!stage || stage === 'applied' || stage === 'needs_review') return 'in_review'
  if (stage === 'pre_screening_selected' || stage === 'completed') return 'shortlisted'
  // Any round selected / offered = scheduled (actively moving forward)
  const scheduledStages = [
    'technical_round_selected', 'practical_round_selected',
    'techno_functional_selected', 'management_round_selected',
    'hr_round_selected', 'offered', 'hired', 'hired_joined',
    // neutral stages
    'pre_screening', 'technical_round', 'practical_round',
    'techno_functional_round', 'management_round', 'hr_round',
    // legacy values
    'screening', 'interview', 'interviewed',
  ]
  if (scheduledStages.includes(stage)) return 'scheduled'
  if (stage === 'inactive') return 'inactive'
  if (REJECTION_STAGES.includes(stage)) return 'rejected'
  // fallback
  return 'in_review'
}

function StatusBadge({ type, label }: { type: string; label: string }) {
  const cfg = STATUS_CFG[type] || STATUS_CFG.in_review
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
      background: cfg.bg, color: cfg.color,
      display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 4, height: 4, borderRadius: '50%', background: cfg.dot }} />
      {label}
    </span>
  )
}

function scoreColor(s: number) {
  if (s >= 80) return { text: 'var(--teal, #059669)', bg: 'rgba(16,185,129,0.12)', track: 'var(--teal, #10b981)' }
  if (s >= 60) return { text: '#d97706', bg: 'rgba(251,191,36,0.12)', track: '#f59e0b' }
  return { text: '#ef4444', bg: 'rgba(239,68,68,0.10)', track: '#ef4444' }
}

// ─── Full pipeline stage dropdown groups ──────────────────────────────────────

const STAGE_GROUPS = [
  {
    label: 'Pre-Screening',
    icon: <GlassIcon icon="Search" variant="blue" size={26} iconSize={14} ghost />,
    stages: [
      { key: 'pre_screening',            icon: <GlassIcon icon="Clock" variant="amber" size={20} iconSize={10} ghost />,  label: 'In Pre-screening' },
      { key: 'pre_screening_selected',   icon: <GlassIcon icon="CheckCircle" variant="emerald" size={20} iconSize={10} ghost />, label: 'Pre-screening Selected' },
      { key: 'pre_screening_rejected',   icon: <GlassIcon icon="XCircle" variant="rose" size={20} iconSize={10} ghost />,  label: 'Pre-screening Rejected' },
    ],
  },
  {
    label: 'Technical Round',
    icon: <GlassIcon icon="Code" variant="violet" size={26} iconSize={14} ghost />,
    stages: [
      { key: 'technical_round',          icon: <GlassIcon icon="Clock" variant="amber" size={20} iconSize={10} ghost />,  label: 'In Technical Round' },
      { key: 'technical_round_selected', icon: <GlassIcon icon="CheckCircle" variant="emerald" size={20} iconSize={10} ghost />, label: 'Technical Round Selected' },
      { key: 'technical_round_rejected', icon: <GlassIcon icon="XCircle" variant="rose" size={20} iconSize={10} ghost />,  label: 'Technical Round Rejected' },
      { key: 'technical_round_back_out', icon: <GlassIcon icon="RotateCcw" variant="amber" size={20} iconSize={10} ghost />,  label: 'Technical Round Back Out' },
    ],
  },
  {
    label: 'Practical Round',
    icon: <GlassIcon icon="FileText" variant="violet" size={26} iconSize={14} ghost />,
    stages: [
      { key: 'practical_round',          icon: <GlassIcon icon="Clock" variant="amber" size={20} iconSize={10} ghost />,  label: 'In Practical Round' },
      { key: 'practical_round_selected', icon: <GlassIcon icon="CheckCircle" variant="emerald" size={20} iconSize={10} ghost />, label: 'Practical Round Selected' },
      { key: 'practical_round_rejected', icon: <GlassIcon icon="XCircle" variant="rose" size={20} iconSize={10} ghost />,  label: 'Practical Round Rejected' },
      { key: 'practical_round_back_out', icon: <GlassIcon icon="RotateCcw" variant="amber" size={20} iconSize={10} ghost />,  label: 'Practical Round Back Out' },
    ],
  },
  {
    label: 'Techno-Functional Round',
    icon: <GlassIcon icon="Settings" variant="violet" size={26} iconSize={14} ghost />,
    stages: [
      { key: 'techno_functional_round',    icon: <GlassIcon icon="Clock" variant="amber" size={20} iconSize={10} />,  label: 'In Techno-Functional' },
      { key: 'techno_functional_selected', icon: <GlassIcon icon="CheckCircle" variant="emerald" size={20} iconSize={10} />, label: 'Techno-Functional Selected' },
      { key: 'techno_functional_rejected', icon: <GlassIcon icon="XCircle" variant="rose" size={20} iconSize={10} />,  label: 'Techno-Functional Rejected' },
    ],
  },
  {
    label: 'Management Round',
    icon: <GlassIcon icon="Briefcase" variant="violet" size={26} iconSize={14} />,
    stages: [
      { key: 'management_round',          icon: <GlassIcon icon="Clock" variant="amber" size={20} iconSize={10} />,  label: 'In Management Round' },
      { key: 'management_round_selected', icon: <GlassIcon icon="CheckCircle" variant="emerald" size={20} iconSize={10} />, label: 'Management Round Selected' },
      { key: 'management_round_rejected', icon: <GlassIcon icon="XCircle" variant="rose" size={20} iconSize={10} />,  label: 'Management Round Rejected' },
    ],
  },
  {
    label: 'HR Round',
    icon: <GlassIcon icon="Users" variant="violet" size={26} iconSize={14} />,
    stages: [
      { key: 'hr_round',          icon: <GlassIcon icon="Clock" variant="amber" size={20} iconSize={10} />,  label: 'In HR Round' },
      { key: 'hr_round_selected', icon: <GlassIcon icon="CheckCircle" variant="emerald" size={20} iconSize={10} />, label: 'HR Round Selected' },
      { key: 'hr_round_rejected', icon: <GlassIcon icon="XCircle" variant="rose" size={20} iconSize={10} />,  label: 'HR Round Rejected' },
    ],
  },
  {
    label: 'Offer & Joining',
    icon: <GlassIcon icon="Trophy" variant="emerald" size={26} iconSize={14} />,
    stages: [
      { key: 'completed',         icon: <GlassIcon icon="CheckCircle" variant="emerald" size={20} iconSize={10} />, label: 'Interview Completed' },
      { key: 'offered',           icon: <GlassIcon icon="Tag" variant="amber" size={20} iconSize={10} />, label: 'Offered' },
      { key: 'offered_back_out',  icon: <GlassIcon icon="RotateCcw" variant="amber" size={20} iconSize={10} />,  label: 'Offered Back Out' },
      { key: 'offer_withdrawn',   icon: <GlassIcon icon="Ban" variant="rose" size={20} iconSize={10} />,   label: 'Offer Withdrawn' },
      { key: 'hired_joined',      icon: <GlassIcon icon="Trophy" variant="emerald" size={20} iconSize={10} />,      label: 'Hired / Joined' },
    ],
  },
]


// ─── Score bar pill ───────────────────────────────────────────────────────────

function ScorePill({ score }: { score: number }) {
  const c = scoreColor(score)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 12, fontWeight: 800, color: c.text }}>{Math.round(score)}%</span>
      <div style={{ width: 40, height: 3, background: 'rgba(0,0,0,0.06)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: c.track, borderRadius: 3, transition: 'width 0.5s' }} />
      </div>
    </div>
  )
}

// ─── Stage Dropdown ───────────────────────────────────────────────────────────

function CandidateActionsDropdown({
  candidateId,
  currentStage,
  onSelect,
  onDelete,
  onInactivate,
  onClose,
  user,
  onGenerateOffer,
  onAddToPipeline,
  onViewProfile,
  hasActiveJobs,
  isInPipeline,
}: {
  candidateId: string
  currentStage: string
  onSelect: (stage: string) => void
  onDelete: (id: string) => void
  onInactivate: (id: string) => void
  onClose: () => void
  user: any
  onGenerateOffer: () => void
  onAddToPipeline: () => void
  onViewProfile: () => void
  hasActiveJobs: boolean
  isInPipeline: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 6 }}
      transition={{ duration: 0.14 }}
      style={{
        position: 'absolute', top: 38, right: 0, zIndex: 9999, width: 260,
        background: 'var(--kpi-bg)', borderRadius: 14,
        boxShadow: '0 16px 48px rgba(0,0,0,0.22)', border: '1px solid var(--table-border)',
        padding: '8px', transformOrigin: 'top right',
        maxHeight: 420, overflowY: 'auto',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onViewProfile(); onClose() }}
        style={{
          width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 9,
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 12.5, fontWeight: 700, color: 'var(--violet)',
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(108,71,255,0.08)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
      >
        <Search size={13} />
        <span style={{ flex: 1 }}>View Full Profile</span>
      </button>

      <div style={{ height: 1, background: 'var(--table-border)', margin: '4px 6px' }} />

      {/* "+ Add in Pipeline" at the top — above PRE-SCREENING */}
      {hasActiveJobs && (
        <>
          {isInPipeline ? (
            <div
              style={{
                width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 9,
                background: 'rgba(148, 163, 184, 0.1)', border: '1.5px solid rgba(148, 163, 184, 0.2)',
                cursor: 'not-allowed', fontSize: 12.5, fontWeight: 700, color: '#94a3b8',
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
              }}
            >
              <CheckCircle size={13} />
              <span style={{ flex: 1 }}>Already in Pipeline</span>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onAddToPipeline(); onClose() }}
              style={{
                width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 9,
                background: 'rgba(16,185,129,0.10)', border: '1.5px solid rgba(16,185,129,0.20)',
                cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: '#059669',
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(16,185,129,0.18)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(16,185,129,0.10)' }}
            >
              <Plus size={13} />
              <span style={{ flex: 1 }}>Add in Pipeline</span>
            </button>
          )}
          <div style={{ height: 1, background: 'var(--table-border)', margin: '2px 6px 6px' }} />
        </>
      )}

      {STAGE_GROUPS.map((group, gi) => {
        return (
          <div key={group.label}>
            {gi > 0 && <div style={{ height: 1, background: 'var(--table-border)', margin: '4px 6px' }} />}
            <p style={{
              fontSize: 9, fontWeight: 800, color: 'var(--text-light)',
              textTransform: 'uppercase', letterSpacing: '0.9px',
              padding: '6px 10px 4px', display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span>{group.icon}</span> {group.label}
            </p>
            {group.stages.map((item) => {
              const cfg = STAGE_CFG[item.key] ?? STAGE_CFG.applied
              const isActive = currentStage === item.key
              const isGreen = React.isValidElement(item.icon) && (item.icon.props as any).variant === 'emerald'
              const isRed = React.isValidElement(item.icon) && (item.icon.props as any).variant === 'rose'
              const iconColor = isGreen ? 'var(--teal, #10b981)' : isRed ? '#ef4444' : cfg.color
              return (
                <button
                  key={item.key}
                  onClick={(e) => { e.stopPropagation(); onSelect(item.key) }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: 9,
                    background: isActive ? cfg.bg : 'none', border: 'none', cursor: 'pointer',
                    fontSize: 12.5, fontWeight: isActive ? 700 : 500, color: isActive ? cfg.color : 'var(--text)',
                    display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.12s',
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = cfg.bg }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'none' }}
                >
                  <span style={{ fontSize: 11, color: iconColor, fontWeight: 700, minWidth: 12, textAlign: 'center' }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {isActive && (
                    <span style={{ fontSize: 9, background: cfg.bg, color: cfg.color, borderRadius: 10, padding: '1px 7px', fontWeight: 700 }}>Active</span>
                  )}
                </button>
              )
            })}
          </div>
        )
      })}

      <div style={{ height: 1, background: 'var(--table-border)', margin: '4px 6px' }} />
      <p style={{
        fontSize: 9, fontWeight: 800, color: 'var(--text-light)',
        textTransform: 'uppercase', letterSpacing: '0.9px',
        padding: '6px 10px 4px', display: 'flex', alignItems: 'center', gap: 5,
      }}>
        <GlassIcon icon="Settings" variant="gray" size={20} iconSize={10} ghost glow={false} /> Management & Offers
      </p>

      <button
        onClick={(e) => { e.stopPropagation(); onGenerateOffer() }}
        style={{
          width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: 9,
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 12.5, fontWeight: 500, color: 'var(--teal, #10b981)',
          display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.12s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(16,185,129,0.1)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
      >
        <GlassIcon icon="FileText" variant="teal" size={20} iconSize={12} ghost glow={false} />
        <span style={{ flex: 1 }}>Generate Offer Letter</span>
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); onInactivate(candidateId) }}
        style={{
          width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: 9,
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 12.5, fontWeight: 500, color: '#94a3b8',
          display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.12s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(148,163,184,0.1)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
      >
        <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, minWidth: 14, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {currentStage === 'inactive' ? <Play size={10} fill="currentColor" /> : <Pause size={10} fill="currentColor" />}
        </span>
        <span style={{ flex: 1 }}>{currentStage === 'inactive' ? 'Activate Candidate' : 'Inactivate Candidate'}</span>
      </button>

      {/* Management Actions (Only Admin can Delete) */}
      {user?.role === 'admin' && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(candidateId); onClose() }}
          style={{
            width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: 9,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12.5, fontWeight: 500, color: '#ef4444',
            display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.12s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
        >
          <Trash2 size={12} />
          <span style={{ flex: 1 }}>Delete Candidate</span>
        </button>
      )}
    </motion.div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CandidatesPage() {
  const { basePath, user } = useAuth()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [stageFilter, setStageFilter] = useState<string | undefined>(undefined)
  const [recruiterId, setRecruiterId] = useState<string>('all')
  const [recruiters, setRecruiters] = useState<{ id: string; name: string }[]>([])
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)

  const statusTabs = [
    { id: 'all', label: 'All', icon: <Users size={14} /> },
    { id: 'in_review', label: 'In Review', icon: <Search size={14} /> },
    { id: 'shortlisted', label: 'Shortlisted', icon: <CheckCircle size={14} /> },
    { id: 'scheduled', label: 'Scheduled', icon: <Calendar size={14} /> },
    { id: 'rejected', label: 'Rejected', icon: <Ban size={14} /> },
  ]
  const queryClient = useQueryClient()
  const [selectedJobId, setSelectedJobId] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [customDateRange, setCustomDateRange] = useState<[string, string]>(['', ''])
  const [candidateToAdd, setCandidateToAdd] = useState<{ id: string; name: string } | null>(null)
  const [inactivePipelineBlock, setInactivePipelineBlock] = useState<{ id: string; name: string } | null>(null)
  const [offerCandidate, setOfferCandidate] = useState<Candidate | null>(null)
  const [viewTarget, setViewTarget] = useState<Candidate | null>(null)
  const [candidateToDelete, setCandidateToDelete] = useState<{ id: string; name: string } | null>(null)
  const [showAddJobModal, setShowAddJobModal] = useState(false)
  const [newJobTitle, setNewJobTitle] = useState('')
  const [isCreatingJob, setIsCreatingJob] = useState(false)
  const newJobInputRef = useRef<HTMLInputElement>(null)

  const inviteMutation = useMutation({
    mutationFn: (data: { email: string; full_name: string }) => candidatesApi.invite(data),
    onSuccess: (_, variables) => {
      toast.success(
        <div>
          <p style={{ margin: 0, fontWeight: 700 }}>Invitation Sent!</p>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 500, opacity: 0.8 }}>
            Joining invitation was sent to <strong>{variables.full_name}</strong>
          </p>
        </div>
      )
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['recent-activities'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to send invite'),
  })

  useEffect(() => {
    adminApi.listUsers().then((res: any) => {
      const users = res.data
        .filter((u: any) => u.role !== 'candidate')
        .map((u: any) => ({ id: u.id, name: u.full_name }))
      setRecruiters(users)
    }).catch((err: any) => console.error("Failed to fetch recruiters", err))
  }, [])

  const queryParams = useMemo(() => ({
    page,
    limit: 50,
    ...(search ? { search } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(stageFilter ? { stage: stageFilter } : {}),
    ...(recruiterId !== 'all' ? { created_by_id: recruiterId } : {}),
    ...(selectedJobId !== 'all' ? { job_id: selectedJobId } : {}),
    ...(dateFilter !== 'all' ? (() => {
      const now = new Date()
      if (dateFilter === 'today') return { date_from: new Date(now.setHours(0,0,0,0)).toISOString() }
      if (dateFilter === 'week') return { date_from: new Date(now.setDate(now.getDate() - 7)).toISOString() }
      if (dateFilter === 'month') return { date_from: new Date(now.setDate(now.getDate() - 30)).toISOString() }
      if (dateFilter === 'custom' && customDateRange[0]) {
        const from = new Date(customDateRange[0]).toISOString()
        let to = from
        if (customDateRange[1]) {
          const end = new Date(customDateRange[1])
          end.setHours(23, 59, 59, 999)
          to = end.toISOString()
        }
        return { date_from: from, date_to: to }
      }
      return {}
    })() : {}),
  }), [page, search, statusFilter, stageFilter, recruiterId, selectedJobId, dateFilter, customDateRange])

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['candidates', queryParams],
    queryFn: () => candidatesApi.list(queryParams).then((r: any) => r.data),
  })

  useEffect(() => {
    if (!isError) return
    const err = error as any
    console.error('Failed to load candidates', {
      status: err?.response?.status,
      body: err?.response?.data,
      params: queryParams,
    })
  }, [isError, error, queryParams])

  const { data: activeJobs } = useQuery({
    queryKey: ['jobs', 'active'],
    queryFn: () => jobsApi.list({ status: 'active', limit: 100 }).then((r: any) => r.data.items),
  })

  const resolveJobForCandidate = (candidate: any): string | null => {
    if (!activeJobs || activeJobs.length === 0) return null

    const normalize = (v?: string | null) => (v || '').trim().toLowerCase()
    const appliedTitle = normalize(candidate?.applied_job_title)
    const currentTitle = normalize(candidate?.current_title)

    const exactMatch =
      activeJobs.find((j: any) => normalize(j.title) === appliedTitle) ||
      activeJobs.find((j: any) => normalize(j.title) === currentTitle)
    if (exactMatch?.id) return exactMatch.id

    const partialMatch =
      activeJobs.find((j: any) => appliedTitle && normalize(j.title).includes(appliedTitle)) ||
      activeJobs.find((j: any) => currentTitle && normalize(j.title).includes(currentTitle))
    if (partialMatch?.id) return partialMatch.id

    return activeJobs[0]?.id || null
  }

  const handleAddToPipeline = async (
    candidateId: string,
    jobId: string,
    candidateStage?: string | null,
    candidateName?: string,
  ) => {
    const resolvedStage =
      candidateStage ?? (displayItems.find((c: any) => c.id === candidateId)?.pipeline_stage as string | undefined)
    if (resolvedStage === 'inactive') {
      setInactivePipelineBlock({
        id: candidateId,
        name: candidateName || displayItems.find((c: any) => c.id === candidateId)?.full_name || 'this candidate',
      })
      return
    }

    if (!jobId) {
      toast.error('Please select a job first')
      return
    }

    try {
      await candidatesApi.updateStage(candidateId, 'applied', false, jobId)
      toast.success('Added to pipeline successfully')
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['candidates_pipeline'] })
    } catch (error) {
      toast.error('Failed to add to pipeline')
    }
  }

  const handleCreateJob = async () => {
    const title = newJobTitle.trim()
    if (!title) return
    setIsCreatingJob(true)
    try {
      const res = await jobsApi.create({ title, status: 'active', openings: 1, description: title, job_type: 'full_time' })
      toast.success(`Designation "${title}" added!`)
      setNewJobTitle('')
      setShowAddJobModal(false)
      queryClient.invalidateQueries({ queryKey: ['jobs', 'active'] })
      // Auto-select the new job tab
      const newJob = (res as any).data
      if (newJob?.id) setSelectedJobId(newJob.id)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to create designation')
    } finally {
      setIsCreatingJob(false)
    }
  }

  const stageMutation = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) =>
      candidatesApi.updateStage(id, stage, REJECTION_STAGES.includes(stage)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['candidates_pipeline'] })
      queryClient.invalidateQueries({ queryKey: ['recent-activities'] })
      toast.success('Stage updated')
      setOpenDropdownId(null)
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to update stage'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => candidatesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['recent-activities'] })
      queryClient.invalidateQueries({ queryKey: ['candidates_pipeline'] })
      toast.success('Candidate deleted')
      setOpenDropdownId(null)
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to delete candidate'),
  })

  const displayItems = data?.items ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <header className="page-header">
          <h1 className="page-title">
            Candidates
          </h1>
          <p className="page-subtitle">
            {data ? `${data.total} total candidates` : 'All candidates in your organisation'}
          </p>
        </header>
        <button
          onClick={() => navigate(`${basePath}/upload`)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg, var(--violet), var(--brand2, #6c47ff))', color: '#fff',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(167, 139, 250, 0.30)', transition: 'all 0.2s',
          }}
        >
          <Plus size={16} />
          Add Candidate
        </button>
      </div>

      {/* Filters Row */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 bg-white dark:bg-[var(--color-bg-sidebar)] p-4 rounded-2xl border border-gray-100 dark:border-[var(--card-border)]">
        <div className="flex flex-wrap items-center gap-3 flex-1 w-full">
          {/* Search Input */}
          <div className="w-full sm:max-w-[280px]">
            <Input
              placeholder="Search candidates…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              leftIcon={<Search size={15} />}
            />
          </div>

          <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block mx-1" />

          <div className="flex flex-wrap items-center gap-3">
            <div className="w-[140px]">
              <Select
                value={selectedJobId}
                onChange={(e) => { setSelectedJobId(e.target.value); setPage(1) }}
                options={[
                  { value: 'all', label: 'All Roles' },
                  ...(activeJobs || []).map((j: any) => ({ value: j.id, label: j.title }))
                ]}
              />
            </div>

            <div className="w-[140px]">
              <Select
                value={recruiterId}
                onChange={(e) => { setRecruiterId(e.target.value); setPage(1) }}
                options={[
                  { value: 'all', label: 'All Recruiters' },
                  ...recruiters.map(r => ({ value: r.id, label: r.name }))
                ]}
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="w-[130px]">
                <Select
                  value={dateFilter}
                  onChange={(e) => { setDateFilter(e.target.value); setPage(1) }}
                  options={[
                    { value: 'all', label: 'Any Date' },
                    { value: 'today', label: 'Today' },
                    { value: 'week', label: 'Last 7 Days' },
                    { value: 'month', label: 'Last 30 Days' },
                    { value: 'custom', label: 'Custom Date…' },
                  ]}
                />
              </div>

              {dateFilter === 'custom' && (
                <div className="w-[180px] flex-shrink-0 animate-in fade-in slide-in-from-left-2 duration-300">
                  <DatePicker
                    value={customDateRange}
                    onChange={(range) => { setCustomDateRange(range); setPage(1) }}
                    className="relative z-50"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar Tabs */}
      <div className="flex items-center gap-2 px-1 w-full overflow-hidden">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mr-2 flex-shrink-0">Status:</span>
        <div className="flex items-center p-1 bg-gray-100/50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700 overflow-x-auto max-w-full scrollbar-none whitespace-nowrap flex-1">
          {statusTabs.map(tab => {
            const isActive = (statusFilter === tab.id) || (tab.id === 'all' && !statusFilter)
            return (
              <button
                key={tab.id}
                onClick={() => { setStatusFilter(tab.id === 'all' ? undefined : tab.id); setPage(1) }}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[12px] font-bold transition-all flex-shrink-0 ${
                  isActive 
                    ? 'bg-[#f5f3ff] text-[#6c47ff] border border-[#e8e4ff] shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700 border border-transparent'
                }`}
              >
                <span className={isActive ? '' : (
                  tab.id === 'all' ? 'text-violet-500' :
                  tab.id === 'in_review' ? 'text-blue-500' :
                  tab.id === 'shortlisted' ? 'text-emerald-500' :
                  tab.id === 'scheduled' ? 'text-violet-600' :
                  tab.id === 'rejected' ? 'text-rose-500' : ''
                )}>
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>




      {/* Table */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 18, borderRadius: 14, background: 'var(--kpi-bg)', border: '1px solid var(--table-border)' }}>
              <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div style={{ borderRadius: 12, padding: 16, fontSize: 13, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.20)', color: '#ef4444' }}>
          Failed to load candidates. Please refresh.
        </div>
      ) : !displayItems.length ? (
        <EmptyState
          icon={<Users size={48} className="text-gray-200 dark:text-gray-700" />}
          title="No candidates found"
          description={search ? 'Try adjusting your search.' : 'Upload resumes or invite candidates to get started.'}
        />
      ) : (
        <>
          {/* Column header — now hidden on mobile */}
          <div className="hidden lg:grid" style={{
            gridTemplateColumns: '2.2fr 100px 1.5fr 110px 60px 60px 1.5fr 110px 100px 220px',
            gap: 14, padding: '0 24px',
            fontSize: 10, fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.8px',
          }}>
            <span>Candidate</span>
            <span style={{ textAlign: 'center' }}>Date</span>
            <span>Role</span>
            <span>Skills</span>
            <span style={{ textAlign: 'center' }}>Exp</span>
            <span style={{ textAlign: 'center' }}>Score</span>
            <span style={{ textAlign: 'center' }}>Stage</span>
            <span style={{ textAlign: 'center' }}>Status</span>
            <span style={{ textAlign: 'center' }}>Added By</span>
            <span style={{ textAlign: 'center' }}>Actions</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 80 }}>
            {displayItems.map((candidate: any, i: number) => {
              const stage = candidate.pipeline_stage
              const stageCfg = stage ? STAGE_CFG[stage] : null
              const isAlreadyInPipeline = isCandidateInActivePipeline(stage)
              const hasInvitation = candidate.invitations?.length > 0
              const isAccountCreated = hasInvitation && candidate.invitations[0].is_used
              const statusKey = getStatusFromStage(candidate.pipeline_stage ?? undefined)
              const statusCfg = STATUS_CFG[statusKey]

              return (
                  <div
                    key={candidate.id}
                    onClick={() => {
                      setViewTarget(candidate)
                      candidatesApi.recordView(candidate.id)
                    }}
                    className="flex flex-col lg:grid gap-4 lg:gap-[14px] p-5 lg:px-6 lg:py-3.5"
                    style={{
                      gridTemplateColumns: '2.2fr 100px 1.5fr 110px 60px 60px 1.5fr 110px 100px 220px',
                      alignItems: 'center',
                      borderRadius: 14,
                      background: 'var(--kpi-bg)',
                      border: '1px solid var(--table-border)',
                      boxShadow: 'var(--shadow)',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLElement
                    el.style.borderColor = 'var(--violet)'
                    el.style.boxShadow = 'var(--shadow-h)'
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLElement
                    el.style.borderColor = 'var(--table-border)'
                    el.style.boxShadow = 'var(--shadow)'
                  }}
                >
                  {/* Row content for both Mobile and Desktop */}
                  <div className="flex items-center justify-between lg:contents w-full">
                    {/* Candidate */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }} className="lg:w-auto">
                      <Avatar name={candidate.full_name} src={candidate.avatar_url} size="md" />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--violet)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {candidate.full_name}
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--text-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {candidate.email}
                        </p>
                      </div>
                    </div>

                    {/* Status (Visible on mobile top right) */}
                    <div className="lg:hidden flex items-center gap-2">
                      <StatusBadge type={statusKey} label={statusCfg.label} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:contents gap-y-4 gap-x-3 w-full border-t border-dashed border-gray-200 dark:border-gray-800 lg:border-t-0 pt-3 lg:pt-0">
                    {/* Date */}
                    <p className="text-[12px] text-[var(--text-mid)] lg:text-center">
                      <span className="lg:hidden text-[10px] uppercase text-gray-400 font-bold block mb-0.5">Applied</span>
                      {formatCandidateDate(candidate, 'MMM dd, yyyy')}
                    </p>

                    {/* Role */}
                    <p className="text-[13px] text-[var(--text-mid)] truncate">
                      <span className="lg:hidden text-[10px] uppercase text-gray-400 font-bold block mb-0.5">Role</span>
                      {candidate.applied_job_title || candidate.current_title || '—'}
                    </p>

                    {/* Skills */}
                    <p className="text-[12px] text-[var(--text-mid)] truncate">
                      <span className="lg:hidden text-[10px] uppercase text-gray-400 font-bold block mb-0.5">Skills</span>
                      {candidate.skills?.slice(0, 3).join(', ') || '—'}
                    </p>

                    {/* Exp */}
                    <p className="lg:text-center text-[12px] font-semibold text-[var(--text-mid)]">
                      <span className="lg:hidden text-[10px] uppercase text-gray-400 font-bold block mb-0.5">Experience</span>
                      {candidate.experience_years || (candidate.years_experience != null ? `${candidate.years_experience}y` : (candidate.relevant_experience || '—'))}
                    </p>

                    {/* Score */}
                    <div className="lg:flex lg:justify-center">
                      <span className="lg:hidden text-[10px] uppercase text-gray-400 font-bold block mb-0.5">Match</span>
                      {candidate.match_score != null
                        ? <ScorePill score={candidate.match_score} />
                        : <span style={{ fontSize: 11, color: 'var(--text-light)' }}>—</span>}
                    </div>

                    {/* Stage */}
                    <div className="flex flex-col gap-1 lg:items-center">
                      <span className="lg:hidden text-[10px] uppercase text-gray-400 font-bold block mb-0.5">Pipeline Stage</span>
                      {/* Only show Reject / Talent DB for recruiter-uploaded candidates
                           who haven't set up a portal account yet */}
                      {!isAlreadyInPipeline && activeJobs && activeJobs.length > 0 && !isAccountCreated && (
                        candidate.match_score != null && candidate.match_score >= 70 ? (
                          <button
                            onClick={(e: any) => {
                              e.stopPropagation()
                              const resolvedJobId = resolveJobForCandidate(candidate)
                              if (!resolvedJobId) {
                                toast.error('No active jobs found. Please create a job first.')
                                return
                              }
                              handleAddToPipeline(candidate.id, resolvedJobId, stage, candidate.full_name)
                            }}
                            className="text-[10px] font-bold px-3 py-1.5 rounded-full bg-emerald-500 text-white shadow-sm hover:scale-105 active:scale-95 transition-all w-fit"
                          >
                            + Add in Pipeline
                          </button>
                        ) : candidate.match_score != null ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e: any) => {
                                e.stopPropagation()
                                stageMutation.mutate({ id: candidate.id, stage: 'rejected' })
                              }}
                              className="text-[10px] font-bold px-3 py-1.5 rounded-full bg-red-500 text-white shadow-sm hover:scale-105 active:scale-95 transition-all w-fit"
                            >
                              Reject
                            </button>
                            <button
                              onClick={(e: any) => {
                                e.stopPropagation()
                                toast.success('Kept in Talent Database')
                              }}
                              className="text-[10px] font-bold px-3 py-1.5 rounded-full bg-gray-500 text-white shadow-sm hover:scale-105 active:scale-95 transition-all w-fit"
                            >
                              Talent DB
                            </button>
                          </div>
                        ) : null
                      )}
                      {stageCfg ? (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: stageCfg.bg, color: stageCfg.color, display: 'inline-block', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {stageCfg.label}
                        </span>
                      ) : (
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(108,71,255,0.05)', color: 'var(--text-light)', border: '1px dashed var(--table-border)' }}>
                          {candidate.match_score != null ? 'New / Needs Action' : 'Unprocessed'}
                        </span>
                      )}
                    </div>

                    {/* Desktop Status */}
                    <div className="hidden lg:flex flex-col items-center gap-1.5 justify-center">
                      <StatusBadge type={statusKey} label={statusCfg.label} />
                    </div>

                    {/* Added By */}
                    <p className="text-[11px] font-semibold text-[var(--text-mid)] lg:text-center">
                      <span className="lg:hidden text-[10px] uppercase text-gray-400 font-bold block mb-0.5">Added By</span>
                      {candidate.created_by_name || 'Admin'}
                    </p>

                    {/* Actions Buttons Group */}
                    <div className="flex items-center gap-2 lg:justify-center col-span-2 sm:col-span-3 md:col-span-4 lg:col-span-1 border-t border-gray-100 dark:border-gray-800 lg:border-none pt-3 lg:pt-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          inviteMutation.mutate({ email: candidate.email, full_name: candidate.full_name })
                        }}
                        className="flex-1 lg:flex-none text-[11px] flex items-center justify-center gap-1.5 font-bold px-3 py-2 rounded-lg bg-violet-50 text-violet-600 hover:bg-violet-100 transition-all border border-violet-100"
                      >
                        <Inbox size={13} />
                        Invite
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`${basePath}/interviews?candidateId=${candidate.id}`)
                        }}
                        className="flex-1 lg:flex-none text-[11px] flex items-center justify-center gap-1.5 font-bold px-3 py-2 rounded-lg bg-[#6c47ff] text-white shadow-sm hover:bg-[#5a3ae6] transition-all"
                      >
                        <Calendar size={13} />
                        Schedule
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenDropdownId(openDropdownId === candidate.id ? null : candidate.id)
                        }}
                        className="w-10 h-10 lg:w-8 lg:h-8 rounded-lg border border-gray-200 dark:border-[var(--card-border)] flex items-center justify-center hover:bg-gray-50 dark:hover:bg-[var(--color-bg-sidebar)] transition-colors text-[var(--text)]"
                      >
                        ⋯
                      </button>
                    </div>
                  </div>
                  <AnimatePresence>
                    {openDropdownId === candidate.id && (
                      <CandidateActionsDropdown
                        candidateId={candidate.id}
                        currentStage={stage || 'applied'}
                        onSelect={(s) => stageMutation.mutate({ id: candidate.id, stage: s })}
                        onInactivate={(id) => stageMutation.mutate({ id, stage: stage === 'inactive' ? 'applied' : 'inactive' })}
                        onDelete={(id) => setCandidateToDelete({ id, name: candidate.full_name })}
                        onClose={() => setOpenDropdownId(null)}
                        onGenerateOffer={() => setOfferCandidate(candidate)}
                        onAddToPipeline={() => {
                          const resolvedJobId = resolveJobForCandidate(candidate)
                          if (!resolvedJobId) {
                            toast.error('No active jobs found. Please create a job first.')
                            return
                          }
                          handleAddToPipeline(candidate.id, resolvedJobId, stage, candidate.full_name)
                        }}
                        onViewProfile={() => {
                          setViewTarget(candidate)
                          candidatesApi.recordView(candidate.id)
                        }}
                        hasActiveJobs={!!(activeJobs && activeJobs.length > 0)}
                        isInPipeline={isAlreadyInPipeline}
                        user={user}

                      />
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>

          {data && (
            <Pagination
              page={data.page}
              pages={data.pages}
              total={data.total}
              limit={data.limit}
              onPage={setPage}
            />
          )}
        </>
      )}



      {offerCandidate && (
        <GenerateOfferModal 
          candidate={offerCandidate} 
          onClose={() => setOfferCandidate(null)}
          application={{ job: { title: offerCandidate.applied_job_title } } as any}
        />
      )}

      {candidateToAdd && (
        <Modal
          open={!!candidateToAdd}
          onClose={() => setCandidateToAdd(null)}
          title={`Add ${candidateToAdd.name} to Pipeline`}
          size="sm"
        >
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-2">
                Select Active Job
              </label>
              <div className="space-y-2">
                {activeJobs && activeJobs.length > 0 ? (
                  activeJobs.map((job: any) => (
                    <button
                      key={job.id}
                      onClick={() => handleAddToPipeline(candidateToAdd.id, job.id, undefined, candidateToAdd.name)}
                      className="w-full p-4 rounded-xl border border-gray-100 hover:border-violet-200 hover:bg-violet-50 transition-all text-left flex items-center justify-between group"
                    >
                      <div>
                        <p className="font-bold text-gray-900 group-hover:text-violet-700">{job.title}</p>
                        <p className="text-xs text-gray-500">{job.location} • {job.type}</p>
                      </div>
                      <svg className="w-5 h-5 text-gray-300 group-hover:text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 italic py-4">No active jobs found. Please create a job first.</p>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {inactivePipelineBlock && (
        <Modal
          open={!!inactivePipelineBlock}
          onClose={() => setInactivePipelineBlock(null)}
          title="Candidate is Inactive"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600 leading-relaxed">
              Please activate <strong>{inactivePipelineBlock.name}</strong> first, then move this candidate to pipeline.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  stageMutation.mutate({ id: inactivePipelineBlock.id, stage: 'applied' })
                  setInactivePipelineBlock(null)
                }}
                className="flex-1 text-[12px] font-bold px-4 py-2.5 rounded-lg bg-[#6c47ff] text-white hover:bg-[#5a3ae6] transition-colors"
              >
                Activate Candidate
              </button>
              <button
                onClick={() => setInactivePipelineBlock(null)}
                className="flex-1 text-[12px] font-bold px-4 py-2.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
      {/* Profile Modal */}
      {viewTarget && (
        <Modal open onClose={() => setViewTarget(null)} title="Candidate Profile" size="xl">
          <CandidateProfileView 
            candidate={viewTarget} 
            onInvite={() => inviteMutation.mutate({ email: viewTarget.email, full_name: viewTarget.full_name })}
            onSchedule={() => navigate(`${basePath}/interviews?candidateId=${viewTarget.id}`)}
            hasInvitation={Boolean(viewTarget.invitations && viewTarget.invitations.length > 0)}
            hideInvite
            hideSchedule
          />
        </Modal>
      )}

      {/* Quick Add Designation Modal */}
      {showAddJobModal && (
        <Modal open onClose={() => { setShowAddJobModal(false); setNewJobTitle('') }} title="Add New Designation" size="sm">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.6 }}>
              Create a new job designation. It will appear in the Jobs tabs immediately — even before any candidates are added.
            </p>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-mid)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>
                Designation / Job Title
              </label>
              <input
                ref={newJobInputRef}
                className="input-base"
                placeholder="e.g. Senior React Developer"
                value={newJobTitle}
                onChange={e => setNewJobTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateJob(); if (e.key === 'Escape') { setShowAddJobModal(false); setNewJobTitle('') } }}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleCreateJob}
                disabled={isCreatingJob || !newJobTitle.trim()}
                style={{
                  flex: 1, padding: '10px', borderRadius: 10,
                  background: 'linear-gradient(135deg,#6c47ff,#8b6bff)',
                  color: '#fff', border: 'none', fontWeight: 700, fontSize: 13,
                  cursor: isCreatingJob || !newJobTitle.trim() ? 'not-allowed' : 'pointer',
                  opacity: isCreatingJob || !newJobTitle.trim() ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {isCreatingJob ? 'Creating...' : '+ Add Designation'}
              </button>
              <button
                onClick={() => { setShowAddJobModal(false); setNewJobTitle('') }}
                style={{ padding: '10px 16px', borderRadius: 10, border: '1.5px solid var(--table-border)', background: 'var(--kpi-bg)', color: 'var(--text-mid)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {candidateToDelete && (
        <Modal
          open={!!candidateToDelete}
          onClose={() => setCandidateToDelete(null)}
          title="Delete Candidate"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              Are you sure you want to delete <strong>{candidateToDelete.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  deleteMutation.mutate(candidateToDelete.id)
                  setCandidateToDelete(null)
                }}
                className="flex-1 text-[12px] font-bold px-4 py-2.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Delete Candidate
              </button>
              <button
                onClick={() => setCandidateToDelete(null)}
                className="flex-1 text-[12px] font-bold px-4 py-2.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
