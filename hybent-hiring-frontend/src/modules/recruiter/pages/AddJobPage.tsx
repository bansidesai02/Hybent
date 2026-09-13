import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowRight, BriefcaseBusiness, ClipboardList, FileDown, Lock, Sparkles } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { jobsApi } from '@/api/jobs'
import { aiApi } from '@/api/ai'
import { superAdminApi } from '@/api/superAdmin'
import type { Job } from '@/types'
import { AIJDReviewModal } from '@/modules/recruiter/components/AIJDReviewModal'
import {
  Button,
  Card,
  Dropzone,
  IconTile,
  Input,
  PageHeader,
  Select,
  StatusPill,
  TagInput,
  Textarea,
} from '@/components/hb'

/**
 * Create or edit a job description.
 *
 * Rebuilt on the design system in phase 6. The upload target was a
 * `<div onClick>` with a hidden input â€” visible but unreachable by keyboard â€”
 * and is now the `Dropzone` primitive. The skills field was a bare input plus
 * `Ã—` buttons with no accessible names; it is now `TagInput`.
 *
 * `ICON_COLORS` also went: four pastel gradients assigned to the "active jobs"
 * list by index, so the same job changed colour whenever the list reordered.
 */

const schema = z.object({
  title: z.string().min(2, 'Title is required'),
  location: z.string().optional(),
  responsibilities: z.string().optional(),
  description: z.string().min(10, 'Description is required'),
  requirements: z.string().optional(),
  skills_required: z.array(z.string()).default([]),
  job_type: z.string().default('full_time'),
  experience_level: z.string().optional(),
  min_experience_years: z.coerce.number().min(0).optional(),
  is_remote: z.boolean().default(false),
  openings: z.coerce.number().int().min(1).default(1),
  status: z.enum(['draft', 'active', 'paused', 'closed']).default('active'),
  jd_url: z.string().nullable().optional(),
  jd_filename: z.string().nullable().optional(),
})
type FormData = z.infer<typeof schema>

const EXPERIENCE_LEVELS = [
  { value: 'entry', label: 'Entry level' },
  { value: 'mid', label: 'Mid level' },
  { value: 'senior', label: 'Senior' },
  { value: 'lead', label: 'Lead / Principal' },
  { value: 'director', label: 'Director+' },
]

const LEVEL_LABEL: Record<string, string> = Object.fromEntries(
  EXPERIENCE_LEVELS.map((l) => [l.value, l.label])
)

function experienceDisplay(job: Job) {
  const parts: string[] = []
  if (job.min_experience_years != null && job.min_experience_years > 0) {
    parts.push(`${job.min_experience_years}+ years`)
  }
  if (job.experience_level) {
    const key = job.experience_level.toLowerCase().trim()
    parts.push(LEVEL_LABEL[key] || job.experience_level)
  }
  return parts.join(' · ') || 'Not specified'
}

/**
 * Rewrites the experience sentence inside a description when the structured
 * fields change, so the two never contradict each other.
 */
function syncExperienceInDescription(description: string, minYears: number, level: string) {
  if (!description) return description
  let next = description

  const yearsRegex = /\b\d+[\d.+\-\s]*\s*years?(?:\s*of\s*experience)?\b/gi
  if (minYears > 0) {
    const replacement = `${minYears}+ years of experience`
    next = yearsRegex.test(next)
      ? next.replace(yearsRegex, replacement)
      : `${next}\n\nRequired experience: ${replacement}`
  }

  if (level) {
    const friendly = LEVEL_LABEL[level.toLowerCase()] || level
    const levels = ['Entry Level', 'Mid Level', 'Senior Level', 'Senior', 'Lead / Principal', 'Lead', 'Director+']
      .map((l) => l.replace(/[+]/g, '\\+'))
    const levelRegex = new RegExp(`\\b(${levels.join('|')})\\b`, 'gi')
    if (levelRegex.test(next)) next = next.replace(levelRegex, friendly)
  }

  return next
}

/** Turns "5+ years senior" into the structured fields the form holds. */
function parseExperience(raw: string) {
  if (!raw) return { min_experience_years: 0, experience_level: 'entry' }
  const text = raw.toLowerCase().trim()
  const years = parseInt(text.match(/\d+/)?.[0] ?? '0', 10)

  let level = 'mid'
  if (text.includes('entry') || text.includes('junior') || text.includes('fresher') || years <= 1) level = 'entry'
  else if (text.includes('senior') || (years >= 5 && years < 8)) level = 'senior'
  else if (text.includes('lead') || text.includes('principal') || (years >= 8 && years < 12)) level = 'lead'
  else if (text.includes('director') || text.includes('vp') || years >= 12) level = 'director'
  else if (text.includes('mid') || (years > 1 && years < 5)) level = 'mid'

  return { min_experience_years: years, experience_level: level }
}

export default function AddJobPage() {
  const { basePath } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams()
  const queryClient = useQueryClient()
  const isEdit = Boolean(id)

  const [isParsing, setIsParsing] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [showAIReview, setShowAIReview] = useState(false)
  const [aiGeneratedJD, setAiGeneratedJD] = useState<any>(null)
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      status: 'active',
      openings: 1,
      is_remote: false,
      skills_required: [],
      job_type: 'full_time',
      min_experience_years: 0,
    },
  })

  const { data: globalFlags } = useQuery({
    queryKey: ['super-admin', 'global-flags'],
    queryFn: () => superAdminApi.getGlobalFlags(),
  })
  const aiEnabled = !!globalFlags?.ai

  const { data: jobData } = useQuery({
    queryKey: ['jobs', id],
    queryFn: () => jobsApi.get(id!).then((r: any) => r.data),
    enabled: isEdit,
  })

  useEffect(() => {
    if (!jobData) return
    reset({
      title: jobData.title,
      location: jobData.location || '',
      responsibilities: jobData.responsibilities || '',
      description: jobData.description,
      requirements: jobData.requirements || '',
      skills_required: jobData.skills_required || [],
      is_remote: jobData.is_remote,
      openings: jobData.openings,
      status: jobData.status as FormData['status'],
      job_type: jobData.job_type,
      experience_level: jobData.experience_level || '',
      min_experience_years: (jobData as any).min_experience_years ?? 0,
      jd_url: jobData.jd_url,
      jd_filename: jobData.jd_filename,
    })
  }, [jobData, reset])

  /* Keep the description's experience sentence in step with the structured
     fields, but only when the user actually changes one of them â€” running on
     every render would fight their typing. */
  const prevMinExp = useRef<number | undefined>(undefined)
  const prevLevel = useRef<string | undefined>(undefined)
  const watchedMinExp = watch('min_experience_years')
  const watchedLevel = watch('experience_level')

  useEffect(() => {
    if (jobData) {
      prevMinExp.current = jobData.min_experience_years ?? 0
      prevLevel.current = jobData.experience_level || ''
    }
  }, [jobData])

  useEffect(() => {
    if (watchedMinExp === undefined && watchedLevel === undefined) return

    const changed =
      (prevMinExp.current !== undefined &&
        watchedMinExp !== undefined &&
        Number(watchedMinExp) !== Number(prevMinExp.current)) ||
      (prevLevel.current !== undefined &&
        watchedLevel !== undefined &&
        watchedLevel !== prevLevel.current)

    if (!changed) return

    const current = getValues('description') || ''
    const next = syncExperienceInDescription(current, Number(watchedMinExp || 0), watchedLevel || '')
    if (next !== current) setValue('description', next, { shouldDirty: true, shouldValidate: true })

    prevMinExp.current = Number(watchedMinExp || 0)
    prevLevel.current = watchedLevel || ''
  }, [watchedMinExp, watchedLevel, setValue, getValues])

  const { data: jobsRes } = useQuery({
    queryKey: ['jobs', 'list'],
    queryFn: () => jobsApi.list({ limit: 10 }).then((r: any) => r.data),
  })
  const allJobs: Job[] = jobsRes?.items ?? []
  const activeJobs = allJobs.filter((j) => j.status === 'active')

  const mutation = useMutation({
    mutationFn: (data: FormData) => (isEdit ? jobsApi.update(id!, data) : jobsApi.create(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['recent-activities'] })
      toast.success(isEdit ? 'Job updated' : 'Job description saved')
      navigate(`${basePath}/jobs`)
    },
    onError: (err: any) =>
      setServerError(
        err?.response?.data?.message ||
          `Failed to ${isEdit ? 'update' : 'save'} the job. Please try again.`
      ),
  })

  const parseFile = async (file: File) => {
    setIsParsing(true)
    setServerError('')
    try {
      const parsed = await jobsApi.parseJD(file)
      if (parsed.title) setValue('title', parsed.title)
      if (parsed.location) setValue('location', parsed.location)
      if (parsed.key_responsibilities?.length) {
        setValue(
          'responsibilities',
          typeof parsed.key_responsibilities === 'string'
            ? parsed.key_responsibilities
            : parsed.key_responsibilities.join('\nâ€¢ ')
        )
      }
      if (parsed.min_experience_years != null) {
        setValue('min_experience_years', parsed.min_experience_years)
        setValue('experience_level', parseExperience(`${parsed.min_experience_years} years`).experience_level)
      }
      if (parsed.description) setValue('description', parsed.description)
      if (parsed.required_skills) setValue('skills_required', parsed.required_skills)
      if (parsed.jd_url) setValue('jd_url', parsed.jd_url)
      if (parsed.jd_filename) setValue('jd_filename', parsed.jd_filename)
      toast.success('Details extracted from your file')
    } catch {
      setServerError('Could not read that file automatically. Fill the fields in by hand.')
    } finally {
      setIsParsing(false)
    }
  }

  const generateWithAI = async () => {
    if (!aiEnabled) {
      toast.error('The AI engine is disabled for your organisation. Contact your administrator.')
      return
    }
    if (!aiPrompt.trim()) return

    setIsGenerating(true)
    setServerError('')
    try {
      const res = await aiApi.generateJD(aiPrompt)
      setAiGeneratedJD(res.data)
      setShowAIReview(true)
      setAiPrompt('')
    } catch (err: any) {
      const detail = err.response?.data?.message
      setServerError(
        typeof detail === 'string' ? detail : err.message || 'Could not generate a job description.'
      )
    } finally {
      setIsGenerating(false)
    }
  }

  const previewPdf = async () => {
    const values = watch()
    setIsPreviewing(true)
    try {
      const res = await aiApi.exportJDPDF({
        title: values.title,
        location: values.location || 'Remote',
        experience: values.experience_level || 'Not specified',
        key_responsibilities: values.responsibilities
          ? values.responsibilities.split('\n').map((s) => s.replace(/^[â€¢\s*-]+/, '').trim())
          : [],
        required_qualifications_skills: values.skills_required || [],
        good_to_have: [],
        description: values.description,
      })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `JD_${(values.title || 'preview').replace(/\s+/g, '_')}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      toast.success('Preview PDF downloaded')
    } catch (err) {
      console.error(err)
      toast.error('Failed to generate the preview PDF')
    } finally {
      setIsPreviewing(false)
    }
  }

  const applyAIJD = (approved: any) => {
    if (approved) {
      if (approved.title) setValue('title', approved.title, { shouldDirty: true, shouldValidate: true })
      if (approved.location) setValue('location', approved.location, { shouldDirty: true })
      if (approved.description) setValue('description', approved.description, { shouldDirty: true, shouldValidate: true })

      // Only use short keywords (Core Skills) — not full qualification sentences
      const skills = (approved.required_qualifications_skills ?? []).filter(
        (s: string) => s.length > 0 && s.length <= 50
      )
      if (skills.length) setValue('skills_required', skills, { shouldDirty: true })

      if (approved.key_responsibilities?.length) {
        setValue(
          'responsibilities',
          Array.isArray(approved.key_responsibilities)
            ? approved.key_responsibilities.join('\n• ')
            : approved.key_responsibilities,
          { shouldDirty: true }
        )
      }

      if (approved.experience) {
        const parsed = parseExperience(approved.experience)
        setValue('min_experience_years', parsed.min_experience_years, { shouldDirty: true })
        setValue('experience_level', parsed.experience_level, { shouldDirty: true })
      }
    }
    setShowAIReview(false)
  }

  useEffect(() => {
    // Check if there is a prefilled JD from Copilot
    const saved = sessionStorage.getItem('copilot_prefilled_jd')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        applyAIJD(parsed)
        sessionStorage.removeItem('copilot_prefilled_jd')
      } catch (e) {
        console.error('Error applying prefilled JD from storage:', e)
      }
    }

    const handleCopilotApply = (e: any) => {
      if (e?.detail) {
        applyAIJD(e.detail)
      }
    }

    window.addEventListener('copilot-apply-jd', handleCopilotApply)
    return () => {
      window.removeEventListener('copilot-apply-jd', handleCopilotApply)
    }
  }, [])

  const viewUploadedJd = async () => {
    const url = watch('jd_url')
    if (!url) return
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch')
      const blobUrl = URL.createObjectURL(new Blob([await res.blob()], { type: 'application/pdf' }))
      window.open(blobUrl, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
    } catch {
      /* Cross-origin JDs cannot be fetched; opening the URL directly still works. */
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow={isEdit ? 'Edit' : 'New'}
        title={isEdit ? 'Edit job description' : 'Add a job description'}
        description="Write it yourself, upload a file, or describe the role and let Hybent AI draft it."
        breadcrumbs={[
          { label: 'Jobs', to: `${basePath}/jobs` },
          { label: isEdit ? 'Edit' : 'New job' },
        ]}
      />

      {serverError && (
        <div
          role="alert"
          className="mb-hb-4 rounded-hb-md border border-hb-error/25 bg-hb-error/8 p-3.5 text-hb-sm text-hb-error"
        >
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))}>
        <div className="grid items-start gap-hb-6 lg:grid-cols-2">
          {/* â”€â”€ Job details â”€â”€ */}
          <Card padding="loose" className="space-y-hb-4">
            <h2 className="font-display text-hb-h3 text-hb-text">Job details</h2>

            <Input
              label="Job title"
              required
              placeholder="Senior React Developer"
              error={errors.title?.message}
              {...register('title')}
            />

            <div className="grid gap-hb-4 sm:grid-cols-2">
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    label="Status"
                    options={[
                      { value: 'active', label: 'Active' },
                      { value: 'draft', label: 'Draft' },
                      { value: 'paused', label: 'Paused' },
                      { value: 'closed', label: 'Closed' },
                    ]}
                  />
                )}
              />
              <Input label="Location" placeholder="Remote / Hybrid / City" {...register('location')} />
            </div>

            <div className="grid gap-hb-4 sm:grid-cols-2">
              <Controller
                name="job_type"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    label="Job type"
                    options={[
                      { value: 'full_time', label: 'Full-time' },
                      { value: 'part_time', label: 'Part-time' },
                      { value: 'contract', label: 'Contract' },
                      { value: 'internship', label: 'Internship' },
                      { value: 'freelance', label: 'Freelance' },
                    ]}
                  />
                )}
              />
              <Input
                label="Openings"
                type="number"
                min="1"
                {...register('openings')}
              />
            </div>

            <div className="grid gap-hb-4 sm:grid-cols-2">
              <Input
                label="Minimum experience (years)"
                type="number"
                min="0"
                placeholder="3"
                {...register('min_experience_years')}
              />
              <Controller
                name="experience_level"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    value={field.value || ''}
                    label="Experience level"
                    placeholder="Select a level..."
                    options={EXPERIENCE_LEVELS}
                  />
                )}
              />
            </div>

            <Textarea
              label="Key responsibilities"
              rows={4}
              placeholder={'• Build and ship new features\n• Own the front-end architecture'}
              {...register('responsibilities')}
            />

            <Controller
              name="skills_required"
              control={control}
              render={({ field }) => (
                <TagInput
                  label="Required skills"
                  placeholder="React, TypeScript, Node.js"
                  value={field.value ?? []}
                  onChange={field.onChange}
                />
              )}
            />

            <Textarea
              label="Description"
              required
              rows={6}
              placeholder="We're looking for a Senior React Developer with 5+ years of experience building scalable web applications..."
              error={errors.description?.message}
              {...register('description')}
            />

            <Button type="submit" fullWidth size="lg" loading={mutation.isPending}>
              {isEdit ? 'Save changes' : 'Save job description'}
            </Button>
          </Card>

          {/* —— Assist panel —— */}
          <div className="space-y-hb-6">
            <Card padding="loose">
              <h2 className="flex items-center gap-2 font-display text-hb-h3 text-hb-text">
                <Sparkles size={16} aria-hidden className="text-hb-cyan" />
                AI job description
              </h2>
              <p className="mb-hb-4 mt-1 text-hb-sm text-hb-muted">
                Describe the role in a sentence and review what comes back before it fills the form.
              </p>

              <div className="flex items-end gap-2">
                <Input
                  aria-label="Describe the role"
                  placeholder="e.g. Senior Python developer with FastAPI"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      generateWithAI()
                    }
                  }}
                  fieldClassName="flex-1"
                />
                <Button
                  onClick={generateWithAI}
                  loading={isGenerating}
                  disabled={!aiEnabled || !aiPrompt.trim()}
                  icon={!aiEnabled ? <Lock size={15} /> : undefined}
                  title={aiEnabled ? 'Generate' : 'The AI engine is disabled for your organisation'}
                >
                  Generate
                </Button>
              </div>

              {aiGeneratedJD && (
                <div className="mt-hb-4 border-t border-hb-border pt-hb-4">
                  <Button
                    variant="ghost"
                    fullWidth
                    icon={<FileDown size={15} />}
                    loading={isPreviewing}
                    onClick={previewPdf}
                  >
                    Download a formatted PDF
                  </Button>
                </div>
              )}
            </Card>

            <Card padding="loose">
              <div className="mb-hb-4 flex items-center justify-between gap-3">
                <h2 className="font-display text-hb-h3 text-hb-text">Upload a JD file</h2>
                {watch('jd_url') && (
                  <Button variant="quiet" size="sm" onClick={viewUploadedJd}>
                    View uploaded JD
                  </Button>
                )}
              </div>

              <Dropzone
                icon={<ClipboardList />}
                title="Drop your JD here"
                description="Hybent AI extracts the title, skills, experience and requirements automatically."
                formats={['PDF', 'DOCX', 'TXT']}
                accept=".pdf,.doc,.docx,.txt"
                busy={isParsing}
                busyLabel="Extracting details..."
                onFiles={([file]) => parseFile(file)}
              />
            </Card>

            <Card padding="loose">
              <div className="mb-hb-4 flex items-center justify-between gap-3">
                <h2 className="font-display text-hb-h3 text-hb-text">Active job descriptions</h2>
                <span className="font-mono text-hb-label uppercase text-hb-muted">
                  {activeJobs.length} open
                </span>
              </div>

              {activeJobs.length === 0 ? (
                <p className="rounded-hb-sm border border-dashed border-hb-border-strong py-8 text-center text-hb-sm text-hb-muted">
                  No active jobs yet. The one you save will appear here.
                </p>
              ) : (
                <ul className="space-y-2">
                  {activeJobs.slice(0, 5).map((job) => (
                    <li key={job.id}>
                      <Link
                        to={`${basePath}/jobs/${job.id}/edit`}
                        className="flex w-full items-center gap-3 rounded-hb-sm border border-hb-border bg-hb-surface-2 p-3 text-left transition-colors duration-hb hover:border-hb-border-strong hover:bg-hb-surface focus-visible:outline-none focus-visible:shadow-hb-ring"
                      >
                        <IconTile size="sm">
                          <BriefcaseBusiness />
                        </IconTile>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-hb-sm font-semibold text-hb-text">
                            {job.title}
                          </span>
                          <span className="block truncate text-hb-xs text-hb-muted">
                            {[job.location, experienceDisplay(job)].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                        <StatusPill status={job.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {allJobs.length > 5 && (
                <Button
                  variant="quiet"
                  size="sm"
                  fullWidth
                  className="mt-hb-3"
                  trailingIcon={<ArrowRight size={14} />}
                  to={`${basePath}/jobs`}
                >
                  View all {allJobs.length} jobs
                </Button>
              )}
            </Card>
          </div>
        </div>
      </form>

      <AIJDReviewModal
        open={showAIReview}
        onClose={() => setShowAIReview(false)}
        data={aiGeneratedJD}
        onApply={applyAIJD}
      />
    </div>
  )
}
