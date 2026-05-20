import { useAuth } from '@/hooks/useAuth'
import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { resumesApi } from '@/api/resumes'
import { jobsApi } from '@/api/jobs'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { EmptyState } from '@/components/ui/EmptyState'
import { Select } from '@/components/ui/Select'
import { GlassIcon } from '@/components/common/GlassIcon'
import type { Candidate, Job } from '@/types'
import { Plus, Search, X, AlertTriangle, FileText, CheckCircle, Upload, Trash2, Eye, ExternalLink, Star, Mail, Calendar } from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ScoringResult {
  final_score: number
  skills_score: number
  title_score: number
  experience_score: number
  education_score: number
  matched_skills: string[]
  missing_skills: string[]
  shortlisted: boolean
  reasoning: string
}

interface JobReq {
  job_id?: string
  role_title: string
  min_experience: string
  match_threshold: string
  required_skills: string
}

type Stage = 'idle' | 'uploading' | 'analyzing' | 'done' | 'error' | 'duplicate' | 'rejected'

const ANALYSIS_STEPS = [
  { id: 'parse', icon: <GlassIcon icon="FileText" variant="violet" size={24} iconSize={12} />, label: 'Parsing document', getDetail: (c: Candidate) => `Extracted ${(c.summary?.length || 0) + 500} tokens` },
  { id: 'skills', icon: <GlassIcon icon="Search" variant="blue" size={24} iconSize={12} />, label: 'Extracting explicit skills', getDetail: (c: Candidate) => `Found: ${c.skills.slice(0, 4).join(', ')}` },
  { id: 'score', icon: <GlassIcon icon="Target" variant="teal" size={24} iconSize={12} />, label: 'Generating match score', getDetail: (_: Candidate, s?: ScoringResult) => `Match: ${s?.final_score ?? '?'}% · ${s?.shortlisted ? 'Passes' : 'Below threshold'}` },
  { id: 'decide', icon: <GlassIcon icon="CheckCircle" variant="emerald" size={24} iconSize={12} />, label: 'Making shortlist decision', getDetail: (_: Candidate, s?: ScoringResult) => {
    if (s?.shortlisted) return `Shortlisted`
    return `Needs review`
  }},
]

// ─── Score Ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r = 32
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  return (
    <div className="relative w-[90px] h-[90px] flex-shrink-0">
      <svg width="90" height="90" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id="sg-upload">
            <stop offset="0%" stopColor="#6c47ff" />
            <stop offset="100%" stopColor="#ff6bc6" />
          </linearGradient>
        </defs>
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(108,71,255,0.12)" strokeWidth="8" />
        <motion.circle
          cx="40" cy="40" r={r}
          fill="none"
          stroke="url(#sg-upload)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
      </svg>
      {/* Score text centered inside */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span style={{ fontFamily: 'Fraunces, serif', fontWeight: 900, fontSize: 18, color: 'var(--text)' }}>
          {score}%
        </span>
        <span style={{ fontSize: 9, color: 'var(--text-mid)' }}>match</span>
      </div>
    </div>
  )
}

import { candidatesApi } from '@/api/candidates'
import toast from 'react-hot-toast'

// ─── Action Buttons ─────────────────────────────────────────────────────────────

function AnalysisActions({ navigate, basePath, candidateId, jobId, threshold, currentStage, scoring, onAction }: {
  navigate: any
  basePath: string
  candidateId: string
  jobId?: string
  threshold: number
  currentStage?: string
  scoring?: ScoringResult
  onAction: () => void
}) {
  const [loading, setLoading] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const handleStageUpdate = async (stage: string) => {
    setLoading(stage)
    try {
      await candidatesApi.updateStage(candidateId, stage, false, jobId)
      toast.success(stage === 'applied' ? 'Candidate added to pipeline!' : 'Candidate moved to talent DB')
      queryClient.invalidateQueries({ queryKey: ['candidates_pipeline'] })
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      onAction()
      if (stage === 'applied') {
        navigate(`${basePath}/pipeline`)
      }
    } catch (err) {
      toast.error('Failed to update candidate stage')
    } finally {
      setLoading(null)
    }
  }

  const handleReject = async () => {
    setLoading('reject')
    try {
      await candidatesApi.reject(candidateId)
      toast.success('Profile rejected. Rejection email sent.')
      onAction()
    } catch (err) {
      toast.error('Failed to reject profile')
    } finally {
      setLoading(null)
    }
  }

  const isHighMatch = (scoring?.final_score ?? 0) >= threshold

  return (
    <div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
      {isHighMatch ? (
        <>
          <div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
            {scoring?.reasoning && (
              <div style={{ marginTop: 12, marginBottom: 16, padding: 12, background: 'rgba(34,197,94,0.05)', borderRadius: 10, border: '1px solid rgba(34,197,94,0.1)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#22c55e', marginBottom: 6, textAlign: 'left' }}>
                  AI Match Summary
                </div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.5, textAlign: 'left', whiteSpace: 'pre-wrap' }}>
                  {scoring.reasoning}
                </p>
              </div>
            )}

            {scoring && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {[
                  { lbl: 'Skills', val: scoring.skills_score },
                  { lbl: 'Title', val: scoring.title_score },
                  { lbl: 'Exp.', val: scoring.experience_score },
                  { lbl: 'Edu.', val: scoring.education_score },
                ].map((m: any) => (
                  <div key={m.lbl} style={{ background: 'rgba(108,71,255,0.03)', border: '1px solid rgba(108,71,255,0.1)', borderRadius: 8, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 600 }}>{m.lbl}</span>
                    <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 700 }}>{m.val}%</span>
                  </div>
                ))}
              </div>
            )}

            {isHighMatch && !!jobId && (
              <button
                onClick={() => handleStageUpdate('applied')}
                disabled={!!loading}
                style={{
                  width: '100%', padding: '12px 16px',
                  background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff',
                  border: 'none', borderRadius: 10,
                  fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 4px 14px rgba(16,185,129,0.30)', transition: 'all 0.2s',
                  opacity: loading === 'applied' ? 0.7 : 1,
                }}
                onMouseOver={e => !loading && (e.currentTarget.style.transform = 'translateY(-1px)')}
                onMouseOut={e => !loading && (e.currentTarget.style.transform = 'none')}
              >
                {loading === 'applied' ? 'Adding...' : <><Plus size={16} /> Add in Pipeline</>}
              </button>
            )}


            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                onClick={() => navigate(`${basePath}/candidates`)}
                style={{
                  width: '100%', padding: '10px 16px',
                  background: 'rgba(108,71,255,0.05)', color: '#6c47ff',
                  border: '1.5px solid rgba(108,71,255,0.2)', borderRadius: 10,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'all 0.2s',
                }}
                onMouseOver={e => (e.currentTarget.style.background = 'rgba(108,71,255,0.1)')}
                onMouseOut={e => (e.currentTarget.style.background = 'rgba(108,71,255,0.05)')}
              >
                <Search size={14} /> View Candidate
              </button>

              <button
                onClick={() => navigate(`${basePath}/interviews`)}
                style={{
                  width: '100%', padding: '10px 16px',
                  background: 'transparent', color: '#6c47ff',
                  border: '1.5px solid rgba(108,71,255,0.2)', borderRadius: 10,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'all 0.2s',
                }}
                onMouseOver={e => (e.currentTarget.style.background = 'rgba(108,71,255,0.1)')}
                onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
              >
                <Calendar size={18} className="mr-1.5" /> Schedule Interview
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
            {scoring && (scoring.missing_skills.length > 0 || scoring.reasoning) ? (
              <div style={{ marginTop: 12, padding: 12, background: 'rgba(239,68,68,0.05)', borderRadius: 10, border: '1px solid rgba(239,68,68,0.1)' }}>
                {scoring.reasoning && (
                  <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid rgba(239,68,68,0.1)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#ef4444', marginBottom: 6, textAlign: 'left' }}>
                      AI Match Summary
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.5, textAlign: 'left', whiteSpace: 'pre-wrap' }}>
                      {scoring.reasoning}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-3">
                  {[
                    { lbl: 'Skills', val: scoring.skills_score },
                    { lbl: 'Title', val: scoring.title_score },
                    { lbl: 'Exp.', val: scoring.experience_score },
                    { lbl: 'Edu.', val: scoring.education_score },
                  ].map((m: any) => (
                    <div key={m.lbl} style={{ background: 'rgba(239,68,68,0.03)', border: '1px solid rgba(239,68,68,0.1)', borderRadius: 6, padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: '#ef4444', opacity: 0.7, fontWeight: 600 }}>{m.lbl}</span>
                      <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 700 }}>{m.val}%</span>
                    </div>
                  ))}
                </div>

                {scoring.missing_skills.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#ef4444', marginBottom: 8, textAlign: 'left' }}>
                      Missing Key Skills
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.6, textAlign: 'left' }}>
                      {(Array.isArray(scoring.missing_skills) ? scoring.missing_skills : []).map((skill, idx) => (
                        <li key={idx} style={{ marginBottom: 4 }}>{skill}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            ) : (
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}>
                Score is below your {threshold}% threshold.
              </p>
            )}

          <div className="flex flex-col sm:flex-row gap-2.5 mt-4">
            <button
              onClick={handleReject}
              disabled={!!loading || currentStage === 'rejected'}
              style={{
                width: '100%', padding: '10px 16px',
                background: currentStage === 'rejected' ? 'rgba(239,68,68,0.1)' : '#ef4444', 
                color: currentStage === 'rejected' ? '#ef4444' : '#fff',
                border: currentStage === 'rejected' ? '1.5px solid rgba(239,68,68,0.2)' : 'none', 
                borderRadius: 10,
                fontSize: 13, fontWeight: 600, cursor: (loading || currentStage === 'rejected') ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                boxShadow: currentStage === 'rejected' ? 'none' : '0 4px 14px rgba(239,68,68,0.30)', transition: 'all 0.2s',
                opacity: loading === 'reject' ? 0.7 : 1,
              }}
              onMouseOver={e => !loading && currentStage !== 'rejected' && (e.currentTarget.style.transform = 'translateY(-1px)')}
              onMouseOut={e => !loading && currentStage !== 'rejected' && (e.currentTarget.style.transform = 'none')}
            >
              {loading === 'reject' ? 'Rejecting...' : currentStage === 'rejected' ? '✉ Sent' : <><X size={14} /> Reject</>}
            </button>

            <button
              onClick={() => handleStageUpdate('screening')}
              disabled={!!loading}
              style={{
                width: '100%', padding: '10px 16px',
                background: 'transparent', color: '#d97706',
                border: '1.5px solid rgba(217,119,6,0.30)', borderRadius: 10,
                fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'all 0.2s',
                opacity: loading === 'screening' ? 0.7 : 1,
              }}
              onMouseOver={e => !loading && (e.currentTarget.style.background = 'rgba(217,119,6,0.07)')}
              onMouseOut={e => !loading && (e.currentTarget.style.background = 'transparent')}
            >
              {loading === 'screening' ? 'Adding...' : <><GlassIcon icon="Inbox" variant="violet" size={18} iconSize={10} className="mr-2" /> Talent DB</>}
            </button>
          </div>

        </>
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

import React from 'react'

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, color: 'red', background: '#ffebee' }}>
          <h2>Something went wrong in UploadResumePage.</h2>
          <pre>{this.state.error?.toString()}</pre>
          <pre>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function UploadResumePage() {
  return (
    <ErrorBoundary>
      <UploadResumePageInner />
    </ErrorBoundary>
  )
}

function UploadResumePageInner() {
  const { basePath } = useAuth()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [stage, setStage] = useState<Stage>('idle')
  const [duplicateParams, setDuplicateParams] = useState<{message: string, candidate_id: string} | null>(null)
  const [result, setResult] = useState<Candidate | null>(null)
  const [scoring, setScoring] = useState<ScoringResult | null>(null)
  const [completedSteps, setCompletedSteps] = useState(0)
  const [error, setError] = useState('')
  const [isAddedToPipeline, setIsAddedToPipeline] = useState(false)
  const [rejectionInfo, setRejectionInfo] = useState<{
    candidate_category: string
    target_category: string
    missing_skills: string[]
    suggested_roles: string[]
  } | null>(null)
  const [jobReq, setJobReq] = useState<JobReq>({
    job_id: undefined,
    role_title: '',
    min_experience: '3',
    match_threshold: '70',
    required_skills: '',
  })

  // Fetch active jobs
  const { data: jobsData } = useQuery({
    queryKey: ['active-jobs'],
    queryFn: () => jobsApi.list({ status: 'active', limit: 100 }).then((r) => r.data.items),
  })

  const handleJobSelect = (jobId: string) => {
    const job = jobsData?.find((j: Job) => j.id === jobId)
    if (!job) return

    // Use the new min_experience_years field specifically, fallback to experience_level parsing if missing
    const minExp = job.min_experience_years != null 
      ? String(job.min_experience_years)
      : (job.experience_level?.match(/\d+/) ? job.experience_level.match(/\d+/)![0] : '0')

    setJobReq({
      job_id: jobId,
      role_title: job.title,
      min_experience: minExp,
      match_threshold: '70', // Default
      required_skills: (job.skills_required || []).join(', '),
    })
  }

  // Auto-select if only one active job
  useEffect(() => {
    if (jobsData && jobsData.length === 1 && !jobReq.job_id) {
      handleJobSelect(jobsData[0].id)
    }
  }, [jobsData, jobReq.job_id])

  const handleFile = useCallback(async (file: File) => {
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['pdf', 'docx', 'doc'].includes(ext ?? '')) {
      setError('Only PDF, DOCX, and DOC files are supported.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be under 10 MB.')
      return
    }

    setError('')
    setCompletedSteps(0)
    setIsAddedToPipeline(false)
    setStage('uploading')

    try {
      const { data } = await resumesApi.uploadAndCreate(file, {
        job_id: jobReq.job_id,
        role_title: jobReq.role_title,
        required_skills: jobReq.required_skills,
        min_experience: parseFloat(jobReq.min_experience) || 0,
        match_threshold: parseFloat(jobReq.match_threshold) || 70,
      })

      // Animate through steps
      setStage('analyzing')
      const sc: ScoringResult | undefined = data.score_breakdown ?? undefined

      for (let i = 1; i <= ANALYSIS_STEPS.length; i++) {
        await new Promise((r) => setTimeout(r, 500 + Math.random() * 300))
        setCompletedSteps(i)
      }

      setResult(data)
      setScoring(sc ?? null)
      setStage('done')
    } catch (err: unknown) {
      const resp = (err as any)?.response;
      
      if (resp?.status === 409 && resp?.data?.details?.candidate_id) {
        setDuplicateParams({ 
          message: resp.data.message || 'Duplicate candidate detected.', 
          candidate_id: resp.data.details.candidate_id 
        });
        setStage('duplicate');
        return;
      }

      // Structured role mismatch error from backend
      const detail = resp?.data?.detail;
      if (resp?.status === 400 && detail?.type === 'role_mismatch') {
        setRejectionInfo({
          candidate_category: detail.candidate_category || 'Unknown',
          target_category: detail.target_category || jobReq.role_title,
          missing_skills: detail.missing_skills || [],
          suggested_roles: detail.suggested_roles || [],
        })
        setError(detail.message || 'Role mismatch detected.')
        setStage('rejected')
        return;
      }
      
      const msg = resp?.data?.message || (typeof detail === 'string' ? detail : null) || 'Upload failed. Please try again.';
      
      // Fallback: plain string rejection message
      if (resp?.status === 400 && (typeof msg === 'string' && msg.startsWith('Upload Rejected'))) {
        setError(msg)
        setStage('rejected')
        return;
      }
      
      setError(msg)
      setStage('error')
    }
  }, [jobReq])

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const reset = () => {
    setStage('idle')
    setResult(null)
    setScoring(null)
    setCompletedSteps(0)
    setError('')
    setRejectionInfo(null)
    setIsAddedToPipeline(false)
    setDuplicateParams(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const isAnalyzing = stage === 'uploading' || stage === 'analyzing'

  return (
    <div style={{ minHeight: '100%' }}>
      {/* Page header */}
      <header className="page-header">
        <h1 className="page-title">
          Upload Resume
        </h1>
        <p className="page-subtitle">
          Drop a resume and watch Hireon AI analyse it against your job requirements.
        </p>
      </header>

      <div className="flex flex-col lg:grid lg:grid-cols-2 gap-6 items-start">

        {/* ── LEFT PANEL ── */}
        <div>
          {/* Job Requirement Card */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: 22, marginBottom: 20, boxShadow: 'var(--shadow)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Job Requirement</div>

            {/* Select from existing Jobs */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text-mid)', display: 'block', marginBottom: 6 }}>
                Select Existing Job (Auto-fill)
              </label>
              <Select
                options={[
                  { value: '', label: 'Create custom requirement...' },
                  ...(Array.isArray(jobsData) ? jobsData.map((j: Job) => ({ value: j.id, label: j.title })) : [])
                ]}
                onChange={(e) => handleJobSelect(e.target.value)}
                value={jobReq.job_id || ''}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text-mid)', display: 'block', marginBottom: 6 }}>
                Role Title
              </label>
              <input
                className="input-base"
                placeholder="e.g. Senior React Developer"
                value={jobReq.role_title}
                onChange={e => setJobReq(p => ({ ...p, role_title: e.target.value }))}
              />
            </div>

            <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3 mb-3.5">
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text-mid)', display: 'block', marginBottom: 6 }}>
                  Min. Experience (yrs)
                </label>
                <input
                  className="input-base"
                  type="number"
                  min="0"
                  value={jobReq.min_experience}
                  onChange={e => setJobReq(p => ({ ...p, min_experience: e.target.value }))}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text-mid)', display: 'block', marginBottom: 6 }}>
                  Match Threshold (%)
                </label>
                <input
                  className="input-base"
                  type="number"
                  min="0" max="100"
                  value={jobReq.match_threshold}
                  onChange={e => setJobReq(p => ({ ...p, match_threshold: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text-mid)', display: 'block', marginBottom: 6 }}>
                Required Skills
              </label>
              <input
                className="input-base"
                placeholder="React, TypeScript, Node.js"
                value={jobReq.required_skills}
                onChange={e => setJobReq(p => ({ ...p, required_skills: e.target.value }))}
              />
              <p style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 4 }}>Separate skills with commas</p>
            </div>
          </div>

          {/* Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => !isAnalyzing && inputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--violet)' : 'var(--card-border)'}`,
              borderRadius: 14,
              padding: '44px 20px',
              textAlign: 'center',
              cursor: isAnalyzing ? 'not-allowed' : 'pointer',
              background: dragOver ? 'var(--sb-hover)' : 'var(--upload-zone, #ffffff)',
              transition: 'all 0.3s',
              opacity: isAnalyzing ? 0.6 : 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            <div style={{ marginBottom: 14 }}>
              <GlassIcon icon="FileText" variant="violet" size={44} iconSize={24} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
              {isAnalyzing ? 'Analysing…' : 'Drop a resume here or click to browse'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-mid)' }}>PDF, DOC, DOCX up to 10 MB</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
              {['PDF', 'DOCX', 'DOC'].map((t: any) => (
                <span key={t} style={{ padding: '3px 10px', background: 'rgba(108,71,255,0.09)', borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#6c47ff' }}>{t}</span>
              ))}
            </div>
          </div>
          
            {/* Only show small inline error for file-validation errors (not upload rejections) */}
            {error && stage !== 'rejected' && stage !== 'error' && (
              <div style={{ marginTop: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={14} /> {error}
              </div>
            )}
        </div>

        {/* ── RIGHT PANEL ── */}
        <div>
          <AnimatePresence mode="wait">
            {/* Placeholder when idle */}
            {(stage === 'idle' || stage === 'error') && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', boxShadow: 'var(--shadow)' }}>
                  {stage === 'error' && error ? (
                    <>
                      <div style={{ marginBottom: 16 }}>
                        <GlassIcon icon="AlertTriangle" variant="amber" size={60} iconSize={30} />
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#ef4444', marginBottom: 8 }}>Upload Failed</div>
                      <div style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.6, marginBottom: 20 }}>{error}</div>
                      <button onClick={reset} style={{ border: 'none', background: 'transparent', color: '#6c47ff', fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>Try again</button>
                    </>
                  ) : (
                    <>
                      <div className="mb-4">
                        <GlassIcon icon="Brain" variant="pink" size={60} iconSize={30} />
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>AI Analysis Ready</div>
                      <div style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.6 }}>
                        Fill in the job requirements and drop a resume to get an AI-powered match score, skill analysis, and shortlisting decision.
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}

            {/* Upload Rejected / Role Mismatch State — Option B */}
            {stage === 'rejected' && (
              <motion.div key="rejected" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <div style={{ background: 'var(--card-bg)', border: '1px solid #ef4444', borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 20px rgba(239,68,68,0.12)' }}>
                  {/* Header */}
                  <div style={{ padding: '20px 24px', background: 'rgba(239,68,68,0.06)', borderBottom: '1px solid rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <AlertTriangle size={20} color="#ef4444" />
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#ef4444' }}>Role Mismatch Detected</div>
                      <div style={{ fontSize: 12, color: 'var(--text-mid)', marginTop: 2 }}>This resume cannot be uploaded for the selected role</div>
                    </div>
                  </div>

                  {/* Body */}
                  <div style={{ padding: '20px 24px' }}>
                    {/* Candidate vs Job comparison */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                      <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#ef4444', marginBottom: 6 }}>Resume Category</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{rejectionInfo?.candidate_category || 'Unknown'}</div>
                      </div>
                      <div style={{ background: 'rgba(108,71,255,0.06)', border: '1px solid rgba(108,71,255,0.15)', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#6c47ff', marginBottom: 6 }}>Target Role</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{rejectionInfo?.target_category || jobReq.role_title}</div>
                      </div>
                    </div>

                    {/* Missing skills */}
                    {rejectionInfo?.missing_skills && rejectionInfo.missing_skills.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text-mid)', marginBottom: 8 }}>Missing Skills for This Role</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {(Array.isArray(rejectionInfo.missing_skills) ? rejectionInfo.missing_skills : []).map(skill => (
                            <span key={skill} style={{ padding: '3px 10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#ef4444' }}>{skill}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Suggested better fit */}
                    {rejectionInfo?.suggested_roles && rejectionInfo.suggested_roles.length > 0 && (
                      <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#10b981', marginBottom: 6 }}>Better Fit For</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {(Array.isArray(rejectionInfo.suggested_roles) ? rejectionInfo.suggested_roles : []).map(role => (
                            <span key={role} style={{ padding: '3px 12px', background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#10b981' }}>{role}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action button */}
                    <button
                      onClick={reset}
                      style={{
                        width: '100%', padding: '12px', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff',
                        border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        boxShadow: '0 4px 14px rgba(239,68,68,0.25)', transition: 'all 0.2s'
                      }}
                      onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                      onMouseOut={e => e.currentTarget.style.transform = 'none'}
                    >
                      <Upload size={14} /> Upload Correct Resume
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Duplicate Candidate State */}
            {stage === 'duplicate' && duplicateParams && (
              <motion.div key="duplicate" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <div style={{ background: 'var(--card-bg)', border: '1px solid #f59e0b', borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 20px rgba(245,158,11,0.15)' }}>
                  <div style={{ padding: '32px 24px', textAlign: 'center', background: 'rgba(245,158,11,0.05)' }}>
                    <div style={{ marginBottom: 16 }}>
                      <GlassIcon icon="AlertTriangle" variant="amber" size={48} iconSize={24} />
                    </div>
                    <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 22, fontWeight: 700, color: '#d97706', marginBottom: 12 }}>
                      Duplicate Detected
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.6, marginBottom: 24, maxWidth: 320, margin: '0 auto 24px auto' }}>
                      {duplicateParams.message}
                    </div>
                    
                    <button
                      onClick={() => navigate(`${basePath}/candidates`)}
                      style={{
                        padding: '12px 24px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', 
                        border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, 
                        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
                        boxShadow: '0 4px 14px rgba(245,158,11,0.25)', transition: 'all 0.2s',
                        width: '100%', justifyContent: 'center', maxWidth: 280
                      }}
                      onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                      onMouseOut={e => e.currentTarget.style.transform = 'none'}
                    >
                      <Search size={14} /> View Existing Profile
                    </button>
                    
                    <div style={{ marginTop: 20 }}>
                      <button
                        onClick={reset}
                        style={{ border: 'none', background: 'transparent', color: 'var(--text-mid)', fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Upload a different resume
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Analysis steps while uploading / analyzing */}
            {isAnalyzing && (
              <motion.div key="analyzing" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
                  {/* Header */}
                  <div style={{ padding: '15px 18px', background: 'var(--sb-hover)', borderBottom: '1px solid var(--table-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 20, height: 20, border: '2px solid var(--card-border)',
                      borderTopColor: 'var(--violet)', borderRadius: '50%',
                      animation: 'spin 0.7s linear infinite', flexShrink: 0
                    }} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Analysing resume…</div>
                    </div>
                    <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-mid)' }}>
                      {completedSteps} / {ANALYSIS_STEPS.length}
                    </div>
                  </div>
                  {/* Steps */}
                  <div style={{ padding: 18 }}>
                    {ANALYSIS_STEPS.map((step, i) => {
                      const done = completedSteps > i
                      const running = completedSteps === i
                      return (
                        <div key={step.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: i < ANALYSIS_STEPS.length - 1 ? '1px solid var(--table-border)' : 'none' }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0,
                            background: done ? 'rgba(16,185,129,0.12)' : running ? 'rgba(108,71,255,0.12)' : 'rgba(108,71,255,0.06)',
                            animation: running ? 'pop 0.5s ease infinite alternate' : 'none'
                          }}>
                            {step.icon}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: done ? '#10b981' : running ? '#6c47ff' : 'var(--text-mid)' }}>
                              {step.label}
                            </div>
                            {done && (
                              <motion.div
                                initial={{ opacity: 0, maxHeight: 0 }}
                                animate={{ opacity: 1, maxHeight: 40 }}
                                style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 2, overflow: 'hidden' }}
                              >
                                {/* Detail shown after completion — will render properly once we have result */}
                              </motion.div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Final result after done */}
            {stage === 'done' && result && (
              <motion.div key="done" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

                {/* Analysis complete header */}
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
                  <div style={{ padding: '15px 18px', background: 'var(--sb-hover)', borderBottom: '1px solid var(--table-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 20, height: 20, border: '2px solid #10b981', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#10b981', fontWeight: 700 }}>✓</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Analysis complete</div>
                    <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-mid)' }}>
                      {ANALYSIS_STEPS.length} / {ANALYSIS_STEPS.length} ✓
                    </div>
                  </div>
                  <div style={{ padding: 18 }}>
                    {ANALYSIS_STEPS.map((step, i) => (
                      <div key={step.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '8px 0', borderBottom: i < ANALYSIS_STEPS.length - 1 ? '1px solid var(--table-border)' : 'none' }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0, background: 'rgba(16,185,129,0.12)' }}>
                          {step.icon}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#10b981' }}>{step.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 2 }}>
                            {step.getDetail(result, scoring ?? undefined)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Result card */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: 22, boxShadow: 'var(--shadow)' }}
                >
                  {/* Candidate header */}
                  <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-6 mb-4 w-full">
                    {scoring && <ScoreRing score={scoring.final_score} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 4, wordBreak: 'break-word' }}>
                        {result.full_name}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-mid)', marginBottom: 10 }}>
                        {result.current_title || jobReq.role_title || 'Candidate'} · {result.experience_years || (result.years_experience != null ? `${result.years_experience} yrs` : '—')}
                      </div>
                      {/* Skill tags */}
                      <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start">
                        {(Array.isArray(result.skills) ? result.skills : []).slice(0, 7).map((skill: any) => (
                          <span key={skill} style={{
                            padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                            background: (Array.isArray(scoring?.matched_skills) ? scoring.matched_skills : []).map((s: any) => (s || '').toLowerCase()).includes((skill || '').toLowerCase())
                              ? 'rgba(108,71,255,0.12)' : 'rgba(0,212,200,0.10)',
                            color: (Array.isArray(scoring?.matched_skills) ? scoring.matched_skills : []).map((s: any) => (s || '').toLowerCase()).includes((skill || '').toLowerCase())
                              ? '#6c47ff' : '#00b4a8',
                          }}>
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Metrics row */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                    {[
                      { val: result.experience_years || (result.years_experience != null ? `${result.years_experience}y` : '—'), lbl: 'Years Exp.' },
                      { val: scoring?.final_score ?? '—', lbl: 'AI Score' },
                      { val: scoring?.shortlisted ? (
                        <div className="flex items-center gap-1">
                          <GlassIcon icon="CheckCircle" variant="emerald" size={16} iconSize={10} />
                          <span>YES</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <GlassIcon icon="Pause" variant="amber" size={16} iconSize={10} />
                          <span>REVIEW</span>
                        </div>
                      ), lbl: 'Shortlist' },
                    ].map((m: any) => (
                      <div key={m.lbl} style={{ background: 'var(--bg)', border: '1px solid var(--table-border)', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                        <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 22, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{m.val}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 4 }}>{m.lbl}</div>
                      </div>
                    ))}
                  </div>

                  {/* Summary */}
                  {result.summary && (
                    <div style={{ background: 'var(--kpi-bg)', border: '1px solid var(--table-border)', borderRadius: 10, padding: 12, marginBottom: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text-light)', marginBottom: 6 }}>AI Summary</div>
                      <div style={{ fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.7 }}>{result.summary}</div>
                    </div>
                  )}

                  {/* Shortlist badge */}
                  {scoring && (
                    <div style={{ marginBottom: 16 }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                        background: scoring.shortlisted ? 'rgba(16,185,129,0.12)' : 'rgba(251,191,36,0.12)',
                        color: scoring.shortlisted ? '#059669' : '#d97706',
                        border: `1px solid ${scoring.shortlisted ? 'rgba(16,185,129,0.25)' : 'rgba(251,191,36,0.25)'}`,
                      }}>
                        {scoring.shortlisted ? (
                          <div className="flex items-center gap-1">
                            <GlassIcon icon="CheckCircle" variant="emerald" size={18} iconSize={10} />
                            <span>Auto-Shortlisted</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <GlassIcon icon="Pause" variant="amber" size={18} iconSize={10} />
                            <span>In Review Queue</span>
                          </div>
                        )}
                      </span>
                    </div>
                  )}

                  {/* Action buttons */}
                  <AnalysisActions 
                    navigate={navigate} 
                    basePath={basePath}
                    candidateId={result.id}
                    jobId={jobReq.job_id}
                    threshold={parseFloat(jobReq.match_threshold) || 70}
                    currentStage={result.pipeline_stage || undefined}
                    scoring={scoring ?? undefined}
                    onAction={() => {
                       // When any action happens (Add to Pipeline, Talent DB, etc.),
                       // we want to refresh the candidate data to update the UI.
                       // For simplicity, we can just fetch the updated candidate or 
                       // manually update the local state if we had the new data.
                       // AnalysisActions already triggers a success toast.
                       // Let's just update the local result stage so the button disappears.
                       setResult(prev => prev ? { ...prev, pipeline_stage: 'applied' } : null)
                    }}
                  />

                  {/* Upload another */}
                  <button
                    onClick={reset}
                    style={{ marginTop: 10, width: '100%', padding: '8px', background: 'transparent', border: 'none', color: 'var(--text-mid)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Upload another resume
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* CSS for spin and pop */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pop { from { transform: scale(1); } to { transform: scale(1.1); } }
      `}</style>
    </div>
  )
}
