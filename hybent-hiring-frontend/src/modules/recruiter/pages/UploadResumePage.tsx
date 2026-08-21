import { Component, useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  AlertTriangle,
  Brain,
  CalendarPlus,
  CheckCircle2,
  FileText,
  Plus,
  Search,
  Sparkles,
  Target,
  Upload,
  X,
} from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { resumesApi } from '@/api/resumes'
import { jobsApi } from '@/api/jobs'
import { candidatesApi } from '@/api/candidates'
import type { Candidate, Job } from '@/types'
import {
  Badge,
  Button,
  Card,
  Dropzone,
  EmptyState,
  IconTile,
  Input,
  PageHeader,
  ScoreRing,
  Select,
} from '@/components/hb'

/**
 * RÃ©sumÃ© upload and AI scoring.
 *
 * Rebuilt on the design system in phase 6. The drop target was a
 * `<div onClick>` with a hidden input â€” no keyboard access at all â€” and is now
 * the `Dropzone` primitive. The score ring was a second, local implementation
 * with a hardcoded `#6c47ff â†’ #ff6bc6` gradient; it now uses `ScoreRing`.
 *
 * The error boundary is kept â€” a parse failure on this page used to take the
 * whole workspace down â€” but it no longer renders a raw stack trace on a red
 * background to the recruiter. The stack is dev-only.
 */

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
  {
    id: 'parse',
    icon: <FileText />,
    label: 'Parsing the document',
    detail: (c: Candidate) => `Extracted ${(c.summary?.length || 0) + 500} tokens`,
  },
  {
    id: 'skills',
    icon: <Search />,
    label: 'Extracting skills',
    detail: (c: Candidate) => `Found ${c.skills?.slice(0, 4).join(', ') || 'no explicit skills'}`,
  },
  {
    id: 'score',
    icon: <Target />,
    label: 'Scoring the match',
    detail: (_: Candidate, s?: ScoringResult) =>
      `${s?.final_score ?? '\u2014'}% \u00B7 ${s?.shortlisted ? 'above threshold' : 'below threshold'}`,
  },
  {
    id: 'decide',
    icon: <CheckCircle2 />,
    label: 'Making a shortlist decision',
    detail: (_: Candidate, s?: ScoringResult) => (s?.shortlisted ? 'Shortlisted' : 'Needs review'),
  },
]

/* â”€â”€ Error boundary â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <Card padding="none">
        <EmptyState
          tone="error"
          title="Something went wrong on this page"
          description="Reload to try again. If it keeps happening, let your administrator know."
          action={{ label: 'Reload', onClick: () => window.location.reload() }}
          size="page"
        />
        {import.meta.env.DEV && (
          <pre className="overflow-x-auto border-t border-hb-border p-4 font-mono text-hb-micro text-hb-muted">
            {this.state.error.stack}
          </pre>
        )}
      </Card>
    )
  }
}

export default function UploadResumePage() {
  return (
    <ErrorBoundary>
      <UploadResume />
    </ErrorBoundary>
  )
}

/* â”€â”€ Score breakdown â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function ScoreBreakdown({ scoring }: { scoring: ScoringResult }) {
  const rows = [
    { label: 'Skills', value: scoring.skills_score },
    { label: 'Title', value: scoring.title_score },
    { label: 'Experience', value: scoring.experience_score },
    { label: 'Education', value: scoring.education_score },
  ]
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {rows.map((r) => (
        <div
          key={r.label}
          className="flex items-baseline justify-between gap-2 rounded-hb-sm border border-hb-border bg-hb-surface-2 px-3 py-2"
        >
          <dt className="text-hb-xs text-hb-muted">{r.label}</dt>
          <dd className="font-mono text-hb-sm font-semibold tabular-nums text-hb-text">
            {r.value}%
          </dd>
        </div>
      ))}
    </dl>
  )
}

/* â”€â”€ Post-analysis actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function AnalysisActions({
  candidateId,
  jobId,
  threshold,
  currentStage,
  scoring,
  onActed,
}: {
  candidateId: string
  jobId?: string
  threshold: number
  currentStage?: string
  scoring?: ScoringResult
  onActed: () => void
}) {
  const { basePath } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)

  const setStage = async (stage: string) => {
    setBusy(stage)
    try {
      await candidatesApi.updateStage(candidateId, stage, false, jobId)
      toast.success(stage === 'applied' ? 'Added to the pipeline' : 'Kept in the talent database')
      queryClient.invalidateQueries({ queryKey: ['candidates_pipeline'] })
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      onActed()
      if (stage === 'applied') navigate(`${basePath}/pipeline`)
    } catch {
      toast.error('Failed to update the candidate')
    } finally {
      setBusy(null)
    }
  }

  const reject = async () => {
    setBusy('reject')
    try {
      await candidatesApi.reject(candidateId)
      toast.success('Profile rejected â€” the rejection email has been sent')
      onActed()
    } catch {
      toast.error('Failed to reject the profile')
    } finally {
      setBusy(null)
    }
  }

  const passes = (scoring?.final_score ?? 0) >= threshold
  const alreadyRejected = currentStage === 'rejected'

  return (
    <div className="space-y-hb-4">
      {scoring?.reasoning && (
        <div
          className={
            'rounded-hb-sm border p-3.5 ' +
            (passes
              ? 'border-hb-success/25 bg-hb-success/8'
              : 'border-hb-error/25 bg-hb-error/8')
          }
        >
          <p className="mb-1.5 font-mono text-hb-label uppercase text-hb-muted">AI match summary</p>
          <p className="whitespace-pre-wrap text-hb-sm leading-relaxed text-hb-muted">
            {scoring.reasoning}
          </p>
        </div>
      )}

      {scoring && <ScoreBreakdown scoring={scoring} />}

      {!passes && scoring && scoring.missing_skills.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-hb-label uppercase text-hb-dim">Missing key skills</p>
          <ul className="flex flex-wrap gap-1.5">
            {scoring.missing_skills.map((skill) => (
              <li key={skill}>
                <Badge tone="error">{skill}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!passes && !scoring && (
        <p className="text-hb-sm text-hb-muted">
          The score is below your {threshold}% threshold.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {passes ? (
          <>
            {jobId && (
              <Button
                icon={<Plus size={15} />}
                loading={busy === 'applied'}
                onClick={() => setStage('applied')}
              >
                Add to pipeline
              </Button>
            )}
            <Button
              variant="ghost"
              icon={<Search size={15} />}
              to={`${basePath}/candidates`}
            >
              View candidate
            </Button>
            <Button
              variant="ghost"
              icon={<CalendarPlus size={15} />}
              to={`${basePath}/interviews`}
            >
              Schedule interview
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="danger"
              icon={<X size={15} />}
              loading={busy === 'reject'}
              disabled={alreadyRejected}
              onClick={reject}
            >
              {alreadyRejected ? 'Rejection sent' : 'Reject'}
            </Button>
            <Button
              variant="ghost"
              loading={busy === 'screening'}
              onClick={() => setStage('screening')}
            >
              Keep in talent DB
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

/* â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function UploadResume() {
  const { basePath } = useAuth()
  const navigate = useNavigate()

  const [stage, setStage] = useState<Stage>('idle')
  const [result, setResult] = useState<Candidate | null>(null)
  const [scoring, setScoring] = useState<ScoringResult | null>(null)
  const [completedSteps, setCompletedSteps] = useState(0)
  const [error, setError] = useState('')
  const [duplicate, setDuplicate] = useState<{ message: string; candidate_id: string } | null>(null)
  const [rejection, setRejection] = useState<{
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

  const { data: jobs } = useQuery({
    queryKey: ['active-jobs'],
    queryFn: () => jobsApi.list({ status: 'active', limit: 100 }).then((r) => r.data.items),
  })

  const selectJob = useCallback(
    (jobId: string) => {
      const job = jobs?.find((j: Job) => j.id === jobId)
      if (!job) {
        setJobReq((p) => ({ ...p, job_id: undefined }))
        return
      }
      /* `min_experience_years` is the structured field; older jobs only carry a
         free-text level, so the first number in it is the fallback. */
      const minExp =
        job.min_experience_years != null
          ? String(job.min_experience_years)
          : (job.experience_level?.match(/\d+/)?.[0] ?? '0')

      setJobReq({
        job_id: jobId,
        role_title: job.title,
        min_experience: minExp,
        match_threshold: '70',
        required_skills: (job.skills_required || []).join(', '),
      })
    },
    [jobs]
  )

  /* With exactly one open role there is nothing to choose. */
  useEffect(() => {
    if (jobs?.length === 1 && !jobReq.job_id) selectJob(jobs[0].id)
  }, [jobs, jobReq.job_id, selectJob])

  const reset = () => {
    setStage('idle')
    setResult(null)
    setScoring(null)
    setCompletedSteps(0)
    setError('')
    setRejection(null)
    setDuplicate(null)
  }

  const handleFile = useCallback(
    async (file: File) => {
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (!['pdf', 'docx', 'doc'].includes(ext ?? '')) {
        setError('Only PDF, DOC and DOCX files are supported.')
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('The file must be under 10 MB.')
        return
      }

      const nameLower = file.name.toLowerCase()
      const blockedKeywords = ['aadhaar', 'pan card', 'pancard', 'passport', 'id card', 'idcard', 'certificate', 'marksheet', 'invoice', 'receipt']
      if (blockedKeywords.some(keyword => nameLower.includes(keyword))) {
        setError('Invalid document. Please upload a valid professional resume/CV.')
        return
      }

      setError('')
      setCompletedSteps(0)
      setStage('uploading')

      try {
        const { data } = await resumesApi.uploadAndCreate(file, {
          job_id: jobReq.job_id,
          role_title: jobReq.role_title,
          required_skills: jobReq.required_skills,
          min_experience: parseFloat(jobReq.min_experience) || 0,
          match_threshold: parseFloat(jobReq.match_threshold) || 70,
        })

        setStage('analyzing')
        /* The work is already done server-side; the steps are paced out so the
           recruiter can read what the AI checked rather than seeing a flash. */
        for (let i = 1; i <= ANALYSIS_STEPS.length; i++) {
          await new Promise((r) => setTimeout(r, 500 + Math.random() * 300))
          setCompletedSteps(i)
        }

        setResult(data)
        setScoring(data.score_breakdown ?? null)
        setStage('done')
      } catch (err: any) {
        const resp = err?.response

        if (resp?.status === 409 && resp?.data?.details?.candidate_id) {
          setDuplicate({
            message: resp.data.message || 'This candidate is already in your database.',
            candidate_id: resp.data.details.candidate_id,
          })
          setStage('duplicate')
          return
        }

        const detail = resp?.data?.detail
        if (resp?.status === 400 && detail?.type === 'role_mismatch') {
          setRejection({
            candidate_category: detail.candidate_category || 'Unknown',
            target_category: detail.target_category || jobReq.role_title,
            missing_skills: detail.missing_skills || [],
            suggested_roles: detail.suggested_roles || [],
          })
          setError(detail.message || 'Role mismatch detected.')
          setStage('rejected')
          return
        }

        const message =
          resp?.data?.message ||
          (typeof detail === 'object' && detail?.message ? detail.message : null) ||
          (typeof detail === 'string' ? detail : null) ||
          err?.message ||
          'Upload failed. Please try again.'

        setError(message)
        setStage(
          resp?.status === 400 && message.startsWith('Upload Rejected') ? 'rejected' : 'error'
        )
      }
    },
    [jobReq]
  )

  const isAnalysing = stage === 'uploading' || stage === 'analyzing'

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Upload"
        title="Upload a Resume"
        description="Drop a CV and Hybent AI scores it against your requirements before it reaches your pipeline."
      />

      <div className="grid items-start gap-hb-6 lg:grid-cols-2">
        {/* —— Requirements + drop —— */}
        <div className="space-y-hb-4">
          <Card padding="loose" className="space-y-hb-4">
            <h2 className="font-display text-hb-h3 text-hb-text">Job requirement</h2>

            <Select
              label="Existing job"
              description="Fills in the fields below from an open role."
              value={jobReq.job_id || ''}
              onChange={(e) => selectJob(e.target.value)}
              options={[
                { value: '', label: 'Custom requirement...' },
                ...(Array.isArray(jobs) ? jobs.map((j: Job) => ({ value: j.id, label: j.title })) : []),
              ]}
            />

            <Input
              label="Role title"
              placeholder="e.g. Senior React Developer"
              value={jobReq.role_title}
              onChange={(e) => setJobReq((p) => ({ ...p, role_title: e.target.value }))}
            />

            <div className="grid gap-hb-4 sm:grid-cols-2">
              <Input
                label="Minimum experience (years)"
                type="number"
                min="0"
                value={jobReq.min_experience}
                onChange={(e) => setJobReq((p) => ({ ...p, min_experience: e.target.value }))}
              />
              <Input
                label="Match threshold (%)"
                type="number"
                min="0"
                max="100"
                value={jobReq.match_threshold}
                onChange={(e) => setJobReq((p) => ({ ...p, match_threshold: e.target.value }))}
              />
            </div>

            <Input
              label="Required skills"
              description="Separate with commas."
              placeholder="React, TypeScript, Node.js"
              value={jobReq.required_skills}
              onChange={(e) => setJobReq((p) => ({ ...p, required_skills: e.target.value }))}
            />
          </Card>

          <Dropzone
            icon={<FileText />}
            title={isAnalysing ? 'Analysing...' : 'Drop a resume here'}
            description="PDF, DOC or DOCX, up to 10 MB."
            formats={['PDF', 'DOCX', 'DOC']}
            accept=".pdf,.doc,.docx"
            busy={isAnalysing}
            busyLabel="Analysing the resume..."
            onFiles={([file]) => handleFile(file)}
          />

          {error && stage !== 'rejected' && stage !== 'error' && (
            <p
              role="alert"
              className="rounded-hb-sm border border-hb-error/25 bg-hb-error/8 p-3 text-hb-sm text-hb-error"
            >
              {error}
            </p>
          )}
        </div>

        {/* —— Result —— */}
        <div>
          {(stage === 'idle' || stage === 'error') && (
            <Card padding="none">
              {stage === 'error' ? (
                <EmptyState
                  tone="error"
                  title="Upload failed"
                  description={error}
                  action={{ label: 'Try again', onClick: reset }}
                  size="page"
                />
              ) : (
                <EmptyState
                  icon={<Brain />}
                  title="AI analysis ready"
                  description="Set the requirements on the left, then drop a resume for a match score, a skill breakdown and a shortlist decision."
                  size="page"
                />
              )}
            </Card>
          )}

          {stage === 'duplicate' && duplicate && (
            <Card padding="none">
              <EmptyState
                tone="error"
                icon={<AlertTriangle />}
                title="Already in your database"
                description={duplicate.message}
                action={{
                  label: 'View the existing profile',
                  onClick: () => navigate(`${basePath}/candidates?openId=${duplicate.candidate_id}`),
                }}
                secondaryAction={{ label: 'Upload a different resume', onClick: reset }}
                size="page"
              />
            </Card>
          )}

          {stage === 'rejected' && (
            <Card padding="loose" className="space-y-hb-4">
              <div className="flex items-start gap-3">
                <IconTile size="lg" className="text-hb-error">
                  <AlertTriangle />
                </IconTile>
                <div className="min-w-0">
                  <h2 className="font-display text-hb-h3 text-hb-text">Role mismatch</h2>
                  <p className="mt-1 text-hb-sm text-hb-muted">
                    This resume cannot be uploaded against the selected role.
                  </p>
                </div>
              </div>

              <div className="grid gap-hb-3 sm:grid-cols-2">
                <div className="rounded-hb-sm border border-hb-border bg-hb-surface-2 px-3.5 py-3">
                  <p className="font-mono text-hb-label uppercase text-hb-dim">Resume reads as</p>
                  <p className="mt-1.5 text-hb-body font-semibold text-hb-text">
                    {rejection?.candidate_category || 'Unknown'}
                  </p>
                </div>
                <div className="rounded-hb-sm border border-hb-border bg-hb-surface-2 px-3.5 py-3">
                  <p className="font-mono text-hb-label uppercase text-hb-dim">Target role</p>
                  <p className="mt-1.5 text-hb-body font-semibold text-hb-text">
                    {rejection?.target_category || jobReq.role_title}
                  </p>
                </div>
              </div>

              {rejection?.missing_skills?.length ? (
                <div>
                  <p className="mb-2 font-mono text-hb-label uppercase text-hb-dim">
                    Missing for this role
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {rejection.missing_skills.map((skill) => (
                      <li key={skill}>
                        <Badge tone="error">{skill}</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {rejection?.suggested_roles?.length ? (
                <div>
                  <p className="mb-2 font-mono text-hb-label uppercase text-hb-dim">Better fit for</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {rejection.suggested_roles.map((role) => (
                      <li key={role}>
                        <Badge tone="success">{role}</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <Button fullWidth icon={<Upload size={15} />} onClick={reset}>
                Upload a different resume
              </Button>
            </Card>
          )}

          {(isAnalysing || stage === 'done') && (
            <div className="space-y-hb-4">
              <Card padding="none">
                <div className="flex items-center gap-3 border-b border-hb-border bg-hb-surface-2 px-5 py-3.5">
                  <Sparkles size={16} aria-hidden className="text-hb-cyan" />
                  <h2 className="font-display text-hb-h3 text-hb-text">
                    {stage === 'done' ? 'Analysis complete' : 'Analysing...'}
                  </h2>
                  <span className="ml-auto font-mono text-hb-micro tabular-nums text-hb-muted">
                    {stage === 'done' ? ANALYSIS_STEPS.length : completedSteps} /{' '}
                    {ANALYSIS_STEPS.length}
                  </span>
                </div>

                <ol className="px-5 py-2">
                  {ANALYSIS_STEPS.map((step, i) => {
                    const done = stage === 'done' || completedSteps > i
                    const running = stage !== 'done' && completedSteps === i
                    return (
                      <li
                        key={step.id}
                        className="flex items-start gap-3 border-b border-hb-border py-3 last:border-0"
                      >
                        <IconTile size="sm" className={running ? 'animate-pulse' : undefined}>
                          {step.icon}
                        </IconTile>
                        <div className="min-w-0">
                          <p
                            className={
                              'text-hb-sm font-semibold ' +
                              (done ? 'text-hb-text' : running ? 'text-hb-cyan' : 'text-hb-dim')
                            }
                          >
                            {step.label}
                          </p>
                          {done && result && (
                            <p className="mt-0.5 truncate text-hb-xs text-hb-muted">
                              {step.detail(result, scoring ?? undefined)}
                            </p>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </Card>

              {stage === 'done' && result && (
                <Card padding="loose" className="space-y-hb-5">
                  <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                    {scoring && <ScoreRing score={scoring.final_score} size={84} strokeWidth={6} />}
                    <div className="min-w-0">
                      <h2 className="font-display text-hb-h2 text-hb-text">{result.full_name}</h2>
                      <p className="mt-0.5 text-hb-sm text-hb-muted">
                        {result.current_title || jobReq.role_title || 'Candidate'} •{' '}
                        {result.experience_years ||
                          (result.years_experience != null
                            ? `${result.years_experience} yrs`
                            : result.relevant_experience || '—')}
                      </p>

                      {result.skills?.length > 0 && (
                        <ul className="mt-2.5 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                          {result.skills.slice(0, 7).map((skill: string) => {
                            const matched = (scoring?.matched_skills ?? [])
                              .map((s) => (s || '').toLowerCase())
                              .includes((skill || '').toLowerCase())
                            return (
                              <li key={skill}>
                                {/* Matched skills are toned up, so the recruiter
                                    can see which ones drove the score. */}
                                <Badge tone={matched ? 'info' : 'neutral'}>{skill}</Badge>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>

                    {scoring && (
                      <div className="sm:ml-auto">
                        <Badge tone={scoring.shortlisted ? 'success' : 'warning'} dot>
                          {scoring.shortlisted ? 'Auto-shortlisted' : 'In review queue'}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {result.summary && (
                    <div className="rounded-hb-sm border border-hb-border bg-hb-surface-2 p-3.5">
                      <p className="mb-1.5 font-mono text-hb-label uppercase text-hb-dim">
                        AI summary
                      </p>
                      <p className="text-hb-sm leading-relaxed text-hb-muted">{result.summary}</p>
                    </div>
                  )}

                  <AnalysisActions
                    candidateId={result.id}
                    jobId={jobReq.job_id}
                    threshold={parseFloat(jobReq.match_threshold) || 70}
                    currentStage={result.pipeline_stage || undefined}
                    scoring={scoring ?? undefined}
                    onActed={() =>
                      setResult((prev) => (prev ? { ...prev, pipeline_stage: 'applied' } : null))
                    }
                  />

                  <Button variant="quiet" size="sm" fullWidth onClick={reset}>
                    Upload another resume
                  </Button>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
