import React, { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import type { Candidate, Scorecard } from '@/types'
import { Avatar } from '@/components/ui/Avatar'
import { formatDate } from '@/utils/formatters'
import { candidatesApi } from '@/api/candidates'
import { scorecardsApi } from '@/api/scorecards'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'


interface CandidateProfileViewProps {
  candidate: Candidate
}

const STAGE_CFG: Record<string, { color: string; bg: string; label: string }> = {
  applied:                      { color: '#6c47ff', bg: 'rgba(108,71,255,0.10)', label: 'Applied' },
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
  hired:                        { color: '#10b981', bg: 'rgba(16,185,129,0.10)', label: 'Hired' },
  rejected:                     { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'Rejected' },
  pre_screening_selected:       { color: '#10b981', bg: 'rgba(16,185,129,0.10)', label: 'Pre-screening Selected' },
  pre_screening_rejected:       { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'Pre-screening Rejected' },
  technical_round_selected:     { color: '#10b981', bg: 'rgba(16,185,129,0.10)', label: 'Technical Round Selected' },
  technical_round_rejected:     { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'Technical Round Rejected' },
  technical_round_back_out:     { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', label: 'Technical Round Back Out' },
  practical_round_selected:     { color: '#10b981', bg: 'rgba(16,185,129,0.10)', label: 'Practical Round Selected' },
  practical_round_rejected:     { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'Practical Round Rejected' },
  practical_round_back_out:     { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', label: 'Practical Round Back Out' },
  techno_functional_selected:   { color: '#10b981', bg: 'rgba(16,185,129,0.10)', label: 'Techno-Functional Selected' },
  techno_functional_rejected:   { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'Techno-Functional Rejected' },
  management_round_selected:    { color: '#10b981', bg: 'rgba(16,185,129,0.10)', label: 'Management Round Selected' },
  management_round_rejected:    { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'Management Round Rejected' },
  hr_round_selected:            { color: '#10b981', bg: 'rgba(16,185,129,0.10)', label: 'HR Round Selected' },
  hr_round_rejected:            { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'HR Round Rejected' },
  offered:                      { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', label: 'Offered' },
  offered_back_out:             { color: '#f97316', bg: 'rgba(249,115,22,0.10)', label: 'Offered Back Out' },
  offer_withdrawn:              { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', label: 'Offer Withdrawn' },
  hired_joined:                 { color: '#10b981', bg: 'rgba(16,185,129,0.10)', label: 'Hired / Joined' },
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

const REC_CFG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  strong_yes: { label: 'Strong Hire',  color: '#059669', bg: 'rgba(16,185,129,0.12)', icon: '🌟' },
  yes:        { label: 'Hire',         color: '#10b981', bg: 'rgba(16,185,129,0.10)', icon: '✅' },
  maybe:      { label: 'Maybe',        color: '#d97706', bg: 'rgba(251,191,36,0.12)', icon: '🤔' },
  no:         { label: 'No Hire',      color: '#ef4444', bg: 'rgba(239,68,68,0.10)',  icon: '❌' },
  strong_no:  { label: 'Strong No',   color: '#dc2626', bg: 'rgba(239,68,68,0.12)',  icon: '🚫' },
}

function scoreColor(s: number) {
  if (s >= 80) return { text: '#059669', bg: 'rgba(16,185,129,0.12)', track: '#10b981' }
  if (s >= 60) return { text: '#d97706', bg: 'rgba(251,191,36,0.12)', track: '#f59e0b' }
  return { text: '#ef4444', bg: 'rgba(239,68,68,0.10)', track: '#ef4444' }
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

  // ── Locked state ──
  if (!hasInterviewStage) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center', gap: 16 }}>
        <div style={{ fontSize: 56 }}>🔒</div>
        <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Interview Feedback Not Available Yet</h3>
        <p style={{ fontSize: 13, color: 'var(--text-light)', lineHeight: 1.7, maxWidth: 340, margin: 0 }}>
          Interview feedback unlocks once the candidate has been{' '}
          {currentStageCfg && (
            <strong style={{ color: currentStageCfg.color }}>{currentStageCfg.label}</strong>
          )}{' '}
          and progressed to at least the <strong style={{ color: '#8b5cf6' }}>Technical Round</strong>. Update the
          candidate's stage using the Action dropdown to unlock this section.
        </p>
      </div>
    )
  }

  if (loadingSC) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '24px 0' }}>
        {[1, 2].map((i: any) => (
          <div key={i} style={{ height: 120, borderRadius: 16, background: 'var(--kpi-bg)', border: '1px solid var(--table-border)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
    )
  }

  // ── No scorecards state ──
  if (!scorecards.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center', gap: 16 }}>
        <div style={{ fontSize: 48 }}>📋</div>
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
        {['strong_yes','yes','maybe','no','strong_no'].map((r: any) => {
          const count = scorecards.filter((sc: any) => sc.recommendation === r).length
          if (!count) return null
          const cfg = REC_CFG[r]
          return (
            <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: cfg.bg, border: `1px solid ${cfg.color}22` }}>
              <span>{cfg.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>{count} × {cfg.label}</span>
            </div>
          )
        })}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: 'rgba(108,71,255,0.08)', border: '1px solid rgba(108,71,255,0.15)' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#6c47ff' }}>
            Avg Rating: {(scorecards.reduce((s: any, sc: any) => s + sc.overall_rating, 0) / scorecards.length).toFixed(1)} / 5
          </span>
        </div>
      </div>

      {/* Scorecard cards */}
      {scorecards.map((sc: any) => {
        const rec = REC_CFG[sc.recommendation]
        const ratingColor = scoreColor((sc.overall_rating / 5) * 100)
        const criteria = sc.criteria_scores ?? []
        return (
          <div key={sc.id} style={{
            background: 'var(--kpi-bg)',
            border: `1px solid var(--table-border)`,
            borderLeft: `4px solid ${rec?.color ?? '#6c47ff'}`,
            borderRadius: 16,
            overflow: 'hidden',
            transition: 'box-shadow 0.2s',
          }}>
            {/* Card header */}
            <div style={{ padding: '18px 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #6c47ff, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, fontWeight: 800, flexShrink: 0 }}>
                  {(sc.submitted_by_name ?? 'R').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{sc.submitted_by_name ?? 'Interviewer'}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-light)', margin: 0 }}>{formatDate(sc.submitted_at)}</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Star rating */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {[1,2,3,4,5].map((s: any) => (
                    <span key={s} style={{ fontSize: 16, color: s <= sc.overall_rating ? '#fbbf24' : 'rgba(0,0,0,0.12)' }}>★</span>
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
              </div>
            </div>

            {/* Criteria scores */}
            {criteria.length > 0 && (
              <div style={{ padding: '0 20px 16px' }}>
                <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Evaluation Criteria</p>
                <div className="flex flex-col sm:grid sm:grid-cols-2 gap-[10px_20px]">
                  {criteria.map((c: any) => (
                    <div key={c.criterion}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-mid)' }}>{c.criterion}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-light)' }}>{c.score}/5</span>
                      </div>
                      <div style={{ height: 5, background: 'rgba(108,71,255,0.08)', borderRadius: 4 }}>
                        <div style={{ height: '100%', width: `${(c.score / 5) * 100}%`, background: 'linear-gradient(90deg,#6c47ff,#a855f7)', borderRadius: 4, transition: 'width 0.6s ease' }} />
                      </div>
                      {c.notes && <p style={{ fontSize: 10, color: 'var(--text-light)', marginTop: 2, fontStyle: 'italic' }}>{c.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Strengths / Weaknesses / Summary */}
            {(sc.strengths || sc.weaknesses || sc.summary) && (
              <div style={{ borderTop: '1px solid var(--table-border)', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {sc.strengths && (
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>💪 Strengths</p>
                    <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.6 }}>{sc.strengths}</p>
                  </div>
                )}
                {sc.weaknesses && (
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>⚡ Areas to Improve</p>
                    <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.6 }}>{sc.weaknesses}</p>
                  </div>
                )}
                {sc.summary && (
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 800, color: '#6c47ff', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>📝 Overall Summary</p>
                    <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.6, fontStyle: 'italic' }}>"{sc.summary}"</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
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
    current_ctc: candidate.current_ctc || '',
    expected_ctc: candidate.expected_ctc || '',
    availability_status: candidate.availability_status || '',
    interview_availability_days: candidate.interview_availability_days || '',
    interview_time_slot: candidate.interview_time_slot || '',
    linkedin_url: candidate.linkedin_url || '',
    github_url: candidate.github_url || '',
    portfolio_url: candidate.portfolio_url || '',
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
      current_ctc: candidate.current_ctc || '',
      expected_ctc: candidate.expected_ctc || '',
      availability_status: candidate.availability_status || '',
      interview_availability_days: candidate.interview_availability_days || '',
      interview_time_slot: candidate.interview_time_slot || '',
      linkedin_url: candidate.linkedin_url || '',
      github_url: candidate.github_url || '',
      portfolio_url: candidate.portfolio_url || '',
    })
  }, [candidate])

  const saveDetailsMutation = useMutation({
    mutationFn: (data: typeof formData) => candidatesApi.update(candidate.id, data),
    onSuccess: () => {
      toast.success('Candidate details updated')
      setIsEditing(false)
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['talent-pool'] })
    },
    onError: () => toast.error('Failed to update details')
  })

  const saveNotesMutation = useMutation({
    mutationFn: (newNotes: string) => candidatesApi.update(candidate.id, { hr_notes: newNotes }),
    onSuccess: () => {
      toast.success('Notes saved')
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['talent-pool'] })
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      
      {/* HEADER WITH EDIT TOGGLE */}
      <div className="flex justify-between items-center -mb-2">
        <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Personal Information
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
            <Button size="sm" onClick={() => saveDetailsMutation.mutate(formData)} loading={saveDetailsMutation.isPending} className="gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-xs h-8">
              Save Changes
            </Button>
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Phone" value={formData.phone} onChange={(e: any) => handleInputChange('phone', e.target.value)} placeholder="+1 555-0000" />
            <Input label="Location" value={formData.location} onChange={(e: any) => handleInputChange('location', e.target.value)} placeholder="City, Country" />
            <Input label="Experience" value={formData.experience_years} onChange={(e: any) => handleInputChange('experience_years', e.target.value)} placeholder="e.g. 5 Years" />
            <Input label="Notice Period" value={formData.notice_period_days} onChange={(e: any) => handleInputChange('notice_period_days', e.target.value)} placeholder="e.g. 30 Days" />
            <Input label="Current CTC" value={formData.current_ctc} onChange={(e: any) => handleInputChange('current_ctc', e.target.value)} placeholder="e.g. ₹22,00,000" />
            <Input label="Expected CTC" value={formData.expected_ctc} onChange={(e: any) => handleInputChange('expected_ctc', e.target.value)} placeholder="e.g. ₹32,00,000" />
            <Input label="You will able to join within" value={formData.availability_status} onChange={(e: any) => handleInputChange('availability_status', e.target.value)} placeholder="e.g. 15 Days" />
          </div>

          <div className="flex flex-col gap-4 mt-2 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">📅 Interview Availability</p>
              <p className="text-sm font-semibold text-gray-800">
                {[candidate.interview_availability_days, candidate.interview_time_slot].filter(Boolean).join(' • ') || 'Not provided by candidate'}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">🔗 Social Links</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input label="LinkedIn URL" value={formData.linkedin_url} onChange={(e: any) => handleInputChange('linkedin_url', e.target.value)} placeholder="linkedin.com/in/username" />
                <Input label="GitHub URL" value={formData.github_url} onChange={(e: any) => handleInputChange('github_url', e.target.value)} placeholder="github.com/username" />
                <Input label="Portfolio URL" value={formData.portfolio_url} onChange={(e: any) => handleInputChange('portfolio_url', e.target.value)} placeholder="https://yoursite.com" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: '📞 Phone Number', value: candidate.phone, show: !!candidate.phone },
              { label: '✉ Email ID', value: candidate.email, show: true },
              { label: '🎯 Experience', value: candidate.experience_years || (candidate.years_experience != null ? `${candidate.years_experience} Yrs` : null) || 'N/A', show: true },
              { label: '📍 Location', value: candidate.location || 'Remote', show: true },
              { label: '⏳ Notice Period', value: candidate.notice_period_days || 'N/A', show: true },
              { label: '💰 Current CTC', value: candidate.current_ctc || 'N/A', show: true },
              { label: '💰 Expected CTC', value: candidate.expected_ctc || 'N/A', show: true },
              { label: '📅 Pref. Interview', value: [candidate.interview_availability_days, candidate.interview_time_slot].filter(Boolean).join(' • ') || 'N/A', show: !!(candidate.interview_availability_days || candidate.interview_time_slot) },
              { label: '🔗 Source', value: candidate.source || 'Sourced', show: true },
            ].filter((f: any) => f.show).map((item: any, i: any) => (
              <div key={i} style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.05)', borderRadius: 14, padding: '12px 16px' }}>
                <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{item.label}</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', wordBreak: 'break-word' }}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Social Links — always visible, show Add if missing */}
          <div className="flex flex-wrap gap-2 items-center">
            <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', marginRight: 4 }}>🔗 Links:</p>
            {candidate.linkedin_url ? (
              <a href={candidate.linkedin_url} target="_blank" rel="noreferrer" className="text-xs font-bold px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">LinkedIn Profile ↗</a>
            ) : (
              <button onClick={() => setIsEditing(true)} className="text-xs font-bold px-3 py-1.5 border border-dashed border-blue-200 text-blue-400 rounded-lg hover:bg-blue-50 hover:border-blue-400 hover:text-blue-600 transition-colors">+ Add LinkedIn</button>
            )}
            {candidate.github_url ? (
              <a href={candidate.github_url} target="_blank" rel="noreferrer" className="text-xs font-bold px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">GitHub Profile ↗</a>
            ) : (
              <button onClick={() => setIsEditing(true)} className="text-xs font-bold px-3 py-1.5 border border-dashed border-gray-200 text-gray-400 rounded-lg hover:bg-gray-50 hover:border-gray-400 hover:text-gray-600 transition-colors">+ Add GitHub</button>
            )}
            {candidate.portfolio_url ? (
              <a href={candidate.portfolio_url} target="_blank" rel="noreferrer" className="text-xs font-bold px-3 py-1.5 bg-violet-50 text-violet-600 rounded-lg hover:bg-violet-100 transition-colors">Portfolio ↗</a>
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
              <span key={skill} style={{ fontSize: 11, fontWeight: 600, padding: '6px 14px', borderRadius: 10, background: '#fff', color: '#6c47ff', border: '1px solid rgba(108,71,255,0.15)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
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
                <div style={{ position: 'absolute', left: 0, top: 4, bottom: 0, width: 2, background: 'linear-gradient(to bottom, #6c47ff, transparent)', borderRadius: 1 }} />
                <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{exp.title}</h4>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#6c47ff', marginBottom: 6 }}>{exp.company} <span style={{ color: 'var(--text-mid)', fontWeight: 500, marginLeft: 6 }}>· {exp.duration}</span></p>
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

      {/* HR Notes section */}
      {!isEditing && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 6 }}>
              📝 HR Confidential Notes
            </p>
            {saveNotesMutation.isPending && <span style={{ fontSize: 11, color: '#6c47ff', fontWeight: 600 }}>Saving...</span>}
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
              e.currentTarget.style.borderColor = '#6c47ff'
              e.currentTarget.style.background = '#fff'
            }}
            onBlurCapture={(e) => {
              e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)'
              e.currentTarget.style.background = 'rgba(0,0,0,0.01)'
            }}
          />
          <p style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 8, fontStyle: 'italic' }}>
            Notes auto-save when you click outside the text box.
          </p>
        </div>
      )}

    </div>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function CandidateProfileView({ candidate }: CandidateProfileViewProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'feedback'>('details')
  const stage = candidate.pipeline_stage || 'applied'
  const stageCfg = candidate.pipeline_stage ? STAGE_CFG[stage] : null

  const tabs = [
    { key: 'details',  label: '📋 Candidate Details' },
    { key: 'feedback', label: '🎙️ Interview Feedback' },
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
                  ⚡ {Math.round(candidate.match_score)}% Match
                </span>
              )
            })()}
            {candidate.resume_url && (
              <a href={candidate.resume_url} target="_blank" rel="noreferrer"
                style={{ fontSize: 11, fontWeight: 700, color: '#6c47ff', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', background: 'rgba(108,71,255,0.08)', padding: '4px 12px', borderRadius: 20 }}>
                📄 Resume
              </a>
            )}
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
      {activeTab === 'details'
        ? <DetailsTab candidate={candidate} />
        : <FeedbackTab candidate={candidate} />
      }
    </div>
  )
}
