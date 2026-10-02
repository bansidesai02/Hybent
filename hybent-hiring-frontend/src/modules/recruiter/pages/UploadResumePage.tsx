import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowUp,
  CalendarPlus,
  Check,
  CheckCircle2,
  RefreshCw,
  FileText,
  Plus,
  Search,
  Target,
  X,
} from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { jobsApi } from '@/api/jobs'
import { candidatesApi } from '@/api/candidates'
import type { Candidate, Job } from '@/types'
import { useResumeUploadStore, type ScoringResult } from '@/store/resumeUploadStore'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  IconTile,
  Input,
  PageHeader,
  ScoreRing,
  Select,
  Tabs,
  TagInput,
} from '@/components/hb'

/**
 * RÃ©sumÃ© upload and AI scoring.
 *
 * Rebuilt on the design system in phase 6. The drop target was a
 * `<div onClick>` with a hidden input â€” no keyboard access at all â€” and is now
 * `ResumeDrop`, a focusable zone that opens the picker on Enter or Space (it
 * outgrew the `Dropzone` primitive for its drag-over animation). The score ring was a second, local implementation
 * with a hardcoded `#6c47ff â†’ #ff6bc6` gradient; it now uses `ScoreRing`.
 *
 * The error boundary is kept â€” a parse failure on this page used to take the
 * whole workspace down â€” but it no longer renders a raw stack trace on a red
 * background to the recruiter. The stack is dev-only.
 */


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
      s
        ? `${s.final_score}% \u00B7 ${s.shortlisted ? 'above threshold' : 'below threshold'}`
        : 'Skipped \u2014 no job to match against',
  },
  {
    id: 'decide',
    icon: <CheckCircle2 />,
    label: 'Making a shortlist decision',
    detail: (_: Candidate, s?: ScoringResult) =>
      s ? (s.shortlisted ? 'Shortlisted' : 'Needs review') : 'Saved to the talent database',
  },
]

/** "Analysing" with three dots that pulse in sequence, instead of a static string. */
function AnalysingLabel() {
  return (
    <span className="inline-flex items-baseline">
      Analysing
      {[0, 1, 2].map((i) => (
        <span key={i} className="animate-pulse-slow" style={{ animationDelay: `${i * 0.2}s` }}>
          .
        </span>
      ))}
    </span>
  )
}

/** Match threshold as a slider, so the bar reads as a position on 0–100 rather than a bare number. */
function ThresholdSlider({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const n = Math.min(100, Math.max(0, parseFloat(value) || 0))
  const tone = n >= 70 ? 'text-hb-success' : n >= 50 ? 'text-hb-warning' : 'text-hb-error'
  return (
    <Field label="Shortlist at">
      {({ id, describedBy }) => (
        <div className="flex items-center gap-3">
          <input
            id={id}
            type="range"
            min={0}
            max={100}
            step={5}
            value={n}
            aria-describedby={describedBy}
            onChange={(e) => onChange(e.target.value)}
            className="h-2 flex-1 cursor-pointer accent-hb-blue focus-visible:outline-none focus-visible:shadow-hb-ring"
          />
          <span className={'w-12 shrink-0 text-right font-mono text-hb-body font-semibold tabular-nums ' + tone}>
            {n}%
          </span>
        </div>
      )}
    </Field>
  )
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** Skeleton text lines for the résumé sheets; `lit` lines turn cyan as the parse reads them. */
function SheetLines({ lead, lit = 0 }: { lead?: boolean; lit?: number }) {
  const widths = ['72%', '100%', '86%', '100%', '58%', '92%']
  return (
    <div className="space-y-1.5">
      {lead && (
        <div className="mb-2.5 flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 shrink-0 rounded-full bg-hb-grad opacity-80" />
          <span className="h-1.5 w-1/2 rounded-full bg-hb-border-strong" />
        </div>
      )}
      {widths.map((w, i) => (
        <span
          key={i}
          className={
            'block h-1 rounded-full transition-colors duration-hb-slow ' +
            (i < lit ? 'bg-hb-cyan/60' : 'bg-hb-border')
          }
          style={{ width: w }}
        />
      ))}
    </div>
  )
}

/**
 * Three résumé sheets that fan out when a file is dragged over the zone (or it
 * is hovered), so the drop target answers the pointer before anything lands.
 */
function DocStack({ active }: { active: boolean }) {
  const sheet =
    'absolute left-1/2 top-3 h-[100px] w-[78px] rounded-hb-sm border border-hb-border bg-hb-surface p-2.5 shadow-hb-1 transition-transform duration-hb-slow ease-hb'
  return (
    <div
      aria-hidden
      className={'relative mx-auto h-[128px] w-[190px] ' + (active ? '' : 'motion-safe:animate-hb-float')}
    >
      <div
        className={sheet}
        style={{ transform: active ? 'translateX(-112%) rotate(-14deg)' : 'translateX(-80%) rotate(-7deg)' }}
      >
        <SheetLines />
      </div>
      <div
        className={sheet}
        style={{ transform: active ? 'translateX(12%) rotate(14deg)' : 'translateX(-20%) rotate(7deg)' }}
      >
        <SheetLines />
      </div>
      <div
        className={sheet + ' z-[1]'}
        style={{ transform: active ? 'translateX(-50%) translateY(-10px)' : 'translateX(-50%)' }}
      >
        <SheetLines lead />
        <span
          className={
            'absolute -bottom-3.5 -right-3.5 grid h-9 w-9 place-items-center rounded-full bg-hb-grad text-hb-on-brand shadow-hb-2 transition-transform duration-hb-slow ease-hb ' +
            (active ? 'scale-110' : '')
          }
        >
          <ArrowUp size={16} className={active ? 'motion-safe:animate-bounce' : ''} />
        </span>
      </div>
    </div>
  )
}

/**
 * The drop target. The zone itself is the control — clickable and focusable,
 * Enter or Space opens the picker. The input sits outside the zone so its own
 * click cannot bubble back into it.
 */
function ResumeDrop({ onFile }: { onFile: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  /* A depth counter, because dragenter/dragleave also fire for every child the
     pointer crosses — a boolean flickers. */
  const [dragDepth, setDragDepth] = useState(0)
  const [hover, setHover] = useState(false)
  const dragging = dragDepth > 0

  const take = (files: FileList | null) => {
    const file = files?.[0]
    if (file) onFile(file)
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a resume: PDF, DOC or DOCX, up to 10 MB"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault()
          setDragDepth((d) => d + 1)
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setDragDepth((d) => Math.max(0, d - 1))}
        onDrop={(e) => {
          e.preventDefault()
          setDragDepth(0)
          take(e.dataTransfer.files)
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className={
          'flex min-h-[320px] flex-1 cursor-pointer flex-col items-center justify-center rounded-hb-md border-2 border-dashed px-6 py-10 text-center transition-[border-color,background-color,box-shadow] duration-hb ease-hb focus-visible:outline-none focus-visible:shadow-hb-ring ' +
          (dragging
            ? 'border-hb-blue bg-hb-blue/8 shadow-hb-ring'
            : 'border-hb-border-strong bg-hb-surface-2 hover:border-hb-blue/50')
        }
      >
        <DocStack active={dragging || hover} />

        <p className="mt-6 font-display text-hb-h3 text-hb-text" aria-live="polite">
          {dragging ? (
            'Release to analyse'
          ) : (
            <>
              Drop a resume or <span className="text-hb-blue">browse</span>
            </>
          )}
        </p>
        <p className="mt-1.5 text-hb-sm text-hb-muted">{'PDF, DOC or DOCX · up to 10 MB'}</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          take(e.target.files)
          /* Picking the same file again after a reset should still fire. */
          e.target.value = ''
        }}
      />
    </>
  )
}

/** The résumé being read: a sheet with a scan beam sweeping it, lines lighting up as steps finish. */
function ScanningDoc({ lit, scanning }: { lit: number; scanning: boolean }) {
  return (
    <div
      aria-hidden
      className="relative h-[156px] w-[122px] shrink-0 overflow-hidden rounded-hb-sm border border-hb-border bg-hb-surface p-3 shadow-hb-2"
    >
      <SheetLines lead lit={lit} />
      <div className="mt-3">
        <SheetLines lit={lit - 6} />
      </div>
      {scanning && (
        <div className="absolute inset-x-0 top-0 h-12 motion-safe:animate-hb-scan">
          <div className="h-full bg-gradient-to-b from-transparent via-hb-cyan/20 to-transparent" />
          <div className="absolute inset-x-0 top-1/2 h-[2px] bg-hb-cyan shadow-[0_0_10px_rgb(var(--hb-cyan))]" />
        </div>
      )}
    </div>
  )
}

/** The four analysis steps as a checklist that ticks off as the run moves on. */
function StepChecklist({
  finished,
  completedSteps,
  result,
  scoring,
}: {
  finished: boolean
  completedSteps: number
  result: Candidate | null
  scoring?: ScoringResult
}) {
  return (
    <ol className="space-y-3.5">
      {ANALYSIS_STEPS.map((step, i) => {
        const done = finished || completedSteps > i
        const running = !finished && completedSteps === i
        return (
          <li key={step.id} className="flex items-start gap-3">
            <span
              className={
                'relative grid h-7 w-7 shrink-0 place-items-center rounded-full transition-colors duration-hb [&>svg]:h-3.5 [&>svg]:w-3.5 ' +
                (done
                  ? 'bg-hb-grad text-hb-on-brand'
                  : running
                    ? 'bg-hb-cyan/12 text-hb-cyan'
                    : 'border border-hb-border bg-hb-surface-2 text-hb-dim')
              }
            >
              {running && (
                <span
                  aria-hidden
                  className="absolute -inset-1 rounded-full border-2 border-hb-cyan/25 border-t-hb-cyan animate-spin"
                />
              )}
              {done ? <Check strokeWidth={3} /> : step.icon}
            </span>
            <div className="min-w-0 pt-0.5">
              <p
                className={
                  'text-hb-sm font-semibold transition-colors duration-hb ' +
                  (done ? 'text-hb-text' : running ? 'text-hb-cyan' : 'text-hb-dim')
                }
              >
                {step.label}
              </p>
              {done && result && (
                <p className="mt-0.5 animate-fade-in truncate text-hb-xs text-hb-muted">
                  {step.detail(result, scoring)}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

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

  /* Uploaded without a job: nothing was matched, so there is no pass or fail
     to act on — only the profile to open. */
  if (!scoring) {
    return (
      <div className="space-y-hb-4">
        <p className="text-hb-sm text-hb-muted">
          Not matched against a job. Pick a role and upload again to score this resume.
        </p>
        <Button
          variant="ghost"
          icon={<Search size={15} />}
          to={`${basePath}/candidates?openId=${candidateId}`}
        >
          View candidate
        </Button>
      </div>
    )
  }

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
  const queryClient = useQueryClient()

  const {
    stage,
    file,
    unscored,
    result,
    scoring,
    completedSteps,
    error,
    duplicate,
    rejection,
    jobReq,
    setJobReq,
    setError,
    setResult,
    setPageMounted,
    reset,
    startUpload,
  } = useResumeUploadStore()

  /* Lets a run that finishes while the recruiter is elsewhere raise a toast. */
  useEffect(() => {
    setPageMounted(true)
    return () => setPageMounted(false)
  }, [setPageMounted])

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

  /* Scoring against an open role or a one-off custom requirement. */
  const hasJobs = Array.isArray(jobs) && jobs.length > 0
  const [mode, setMode] = useState<'existing' | 'custom'>(
    !jobReq.job_id && jobReq.role_title ? 'custom' : 'existing'
  )
  const effectiveMode = hasJobs ? mode : 'custom'

  const switchMode = (next: 'existing' | 'custom') => {
    setMode(next)
    if (next === 'custom') setJobReq((p) => ({ ...p, job_id: undefined }))
  }

  /* With exactly one open role there is nothing to choose. */
  useEffect(() => {
    if (mode === 'existing' && jobs?.length === 1 && !jobReq.job_id) selectJob(jobs[0].id)
  }, [mode, jobs, jobReq.job_id, selectJob])

  const skills = jobReq.required_skills
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  /* A resume dropped with no job selected, waiting on the confirm dialog. */
  const [pendingFile, setPendingFile] = useState<File | null>(null)

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

      /* Nothing to match against: ask first, rather than inventing a score. */
      if (!jobReq.job_id && !jobReq.role_title.trim() && !jobReq.required_skills.trim()) {
        setPendingFile(file)
        return
      }

      startUpload(file, queryClient)
    },
    [setError, startUpload, queryClient, jobReq]
  )

  const isAnalysing = stage === 'uploading' || stage === 'analyzing'

  return (
    <div className="pb-hb-10">
      <PageHeader
        title="Upload Resume"
        description="Score a resume against your hiring criteria."
      />

      <div className="grid items-stretch gap-hb-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* —— Scoring criteria —— */}
        <Card padding="loose" className="flex flex-col">
          {/* Locked while a run is in flight, so the criteria shown match the
              ones the resume is being scored against. */}
          <fieldset disabled={isAnalysing} className="min-w-0 space-y-hb-5 disabled:opacity-60">
            <div className="flex min-h-10 flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-hb-h3 text-hb-text">Scoring criteria</h2>
              {hasJobs && (
                <Tabs
                  aria-label="Requirement source"
                  value={effectiveMode}
                  onChange={switchMode}
                  items={[
                    { value: 'existing', label: 'Open role', count: jobs?.length },
                    { value: 'custom', label: 'Custom' },
                  ]}
                />
              )}
            </div>

            {effectiveMode === 'existing' && (
              <Select
                label="Open role"
                value={jobReq.job_id || ''}
                onChange={(e) => selectJob(e.target.value)}
                options={[
                  { value: '', label: 'Choose a role...' },
                  ...(jobs ?? []).map((j: Job) => ({ value: j.id, label: j.title })),
                ]}
              />
            )}

            <div className="grid gap-hb-4 sm:grid-cols-[1fr_140px]">
              <Input
                label="Role title"
                placeholder="e.g. Senior React Developer"
                value={jobReq.role_title}
                onChange={(e) => setJobReq((p) => ({ ...p, role_title: e.target.value }))}
              />
              <Input
                label="Experience"
                type="number"
                min="0"
                value={jobReq.min_experience}
                trailingSlot={<span className="pr-1 text-hb-sm text-hb-dim">yrs+</span>}
                onChange={(e) => setJobReq((p) => ({ ...p, min_experience: e.target.value }))}
              />
            </div>

            <TagInput
              label="Required skills"
              description=""
              placeholder="Type a skill and press Enter"
              value={skills}
              onChange={(next) => setJobReq((p) => ({ ...p, required_skills: next.join(', ') }))}
            />

            <ThresholdSlider
              value={jobReq.match_threshold}
              onChange={(v) => setJobReq((p) => ({ ...p, match_threshold: v }))}
            />
          </fieldset>
        </Card>

        {/* —— Resume ——
            The drop target holds this card until a file lands; it then turns
            into a file row, a scan with a checklist, and finally the score. */}
        <Card padding="loose" className="order-first flex flex-col lg:order-none">
          <div className="mb-hb-5 flex min-h-10 items-center justify-between gap-3">
            <h2 className="font-display text-hb-h3 text-hb-text">Resume</h2>
            {isAnalysing ? (
              <Button variant="quiet" size="sm" icon={<X size={14} />} onClick={reset}>
                Cancel
              </Button>
            ) : stage !== 'idle' ? (
              <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={reset}>
                {stage === 'error' ? 'Try again' : 'Upload another'}
              </Button>
            ) : null}
          </div>

          {stage === 'idle' ? (
            <div className="flex flex-1 flex-col gap-hb-3">
              <ResumeDrop onFile={handleFile} />
              {error && (
                <p
                  role="alert"
                  className="rounded-hb-sm border border-hb-error/25 bg-hb-error/8 p-3 text-hb-sm text-hb-error"
                >
                  {error}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-hb-5">
              {/* File row */}
              <div className="rounded-hb-md border border-hb-border bg-hb-surface-2 p-3.5">
                <div className="flex items-center gap-3">
                  <IconTile className={isAnalysing || stage === 'done' ? undefined : 'text-hb-error'}>
                    <FileText />
                  </IconTile>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-hb-sm font-semibold text-hb-text">
                      {file?.name ?? 'Resume'}
                    </p>
                    <p className="mt-0.5 text-hb-xs text-hb-muted" aria-live="polite">
                      {file && `${formatSize(file.size)} · `}
                      {isAnalysing ? (
                        <span className="text-hb-cyan">
                          <AnalysingLabel />
                        </span>
                      ) : stage === 'done' ? (
                        <span className="text-hb-success">{unscored ? 'Saved, not scored' : 'Analysed'}</span>
                      ) : (
                        <span className="text-hb-error">
                          {stage === 'duplicate'
                            ? 'Already in your database'
                            : stage === 'rejected'
                              ? 'Role mismatch'
                              : 'Upload failed'}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                {(isAnalysing || stage === 'done') && (
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-hb-border">
                    <div
                      className="h-full rounded-full bg-hb-grad transition-[width] duration-hb-slow ease-hb"
                      style={{
                        width: `${((stage === 'done' ? ANALYSIS_STEPS.length : completedSteps) / ANALYSIS_STEPS.length) * 100}%`,
                      }}
                    />
                  </div>
                )}
              </div>

              {/* While it runs: the sheet being scanned beside the checklist. */}
              {isAnalysing && (
                <div className="flex flex-col items-center gap-hb-6 py-hb-4 sm:flex-row sm:justify-center sm:gap-12">
                  <ScanningDoc lit={completedSteps * 3} scanning />
                  <StepChecklist
                    finished={false}
                    completedSteps={completedSteps}
                    result={result}
                    scoring={scoring ?? undefined}
                  />
                </div>
              )}

              {stage === 'error' && error && (
                <p role="alert" className="text-hb-sm text-hb-error">
                  {error}
                </p>
              )}

              {stage === 'duplicate' && duplicate && (
                <div className="space-y-hb-4">
                  <p className="text-hb-sm text-hb-muted">{duplicate.message}</p>
                  <Button
                    onClick={() =>
                      navigate(`${basePath}/candidates?openId=${duplicate.candidate_id}`)
                    }
                  >
                    View existing profile
                  </Button>
                </div>
              )}

              {stage === 'rejected' && (
                <div className="space-y-hb-4">
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
                      <p className="mb-2 font-mono text-hb-label uppercase text-hb-dim">
                        Better fit for
                      </p>
                      <ul className="flex flex-wrap gap-1.5">
                        {rejection.suggested_roles.map((role) => (
                          <li key={role}>
                            <Badge tone="success">{role}</Badge>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Done: the score leads, then the why and the next step. */}
              {stage === 'done' && result && (
                <div className="animate-fade-up space-y-hb-5">
                  <div className="flex items-center gap-hb-5">
                    {scoring && <ScoreRing score={scoring.final_score} size={96} strokeWidth={7} />}
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-hb-h2 text-hb-text">
                        {result.full_name}
                      </h3>
                      <p className="mt-0.5 truncate text-hb-sm text-hb-muted">
                        {result.current_title || jobReq.role_title || 'Candidate'} •{' '}
                        {result.experience_years ||
                          (result.years_experience != null
                            ? `${result.years_experience} yrs`
                            : result.relevant_experience || '—')}
                      </p>
                      {scoring && (
                        <div className="mt-2">
                          <Badge tone={scoring.shortlisted ? 'success' : 'warning'} dot>
                            {scoring.shortlisted ? 'Auto-shortlisted' : 'In review queue'}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>

                  {result.skills?.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5">
                      {result.skills.slice(0, 8).map((skill: string) => {
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

                  {result.summary && (
                    <p className="text-hb-sm leading-relaxed text-hb-muted">{result.summary}</p>
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
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={!!pendingFile}
        onClose={() => setPendingFile(null)}
        onConfirm={() => {
          if (pendingFile) startUpload(pendingFile, queryClient, { skipScoring: true })
          setPendingFile(null)
        }}
        title="No job selected"
        description="The resume will be parsed and added to your talent database, but not matched or scored against a role. Upload anyway?"
        confirmLabel="Upload without matching"
        cancelLabel="Choose a job"
      />
    </div>
  )
}
