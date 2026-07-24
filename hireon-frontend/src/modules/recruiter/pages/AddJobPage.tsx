import { useAuth } from '@/hooks/useAuth'
import React, { useState, useRef, KeyboardEvent, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { jobsApi } from '@/api/jobs'
import { aiApi } from '@/api/ai'
import type { Job } from '@/types'
import { AIJDReviewModal } from '@/modules/recruiter/components/AIJDReviewModal'
import { GlassIcon } from '@/components/common/GlassIcon'
import { Select } from '@/components/ui/Select'
import { ArrowRight, Loader2, Lock } from 'lucide-react'
import { superAdminApi } from '@/api/superAdmin'
import { Controller } from 'react-hook-form'
import toast from 'react-hot-toast'

// ─── Schema ────────────────────────────────────────────────────────────────────

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

// ─── Helpers ───────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  if (status === 'active') return { label: '● Active', color: '#10b981', bg: 'rgba(16,185,129,0.12)' }
  if (status === 'paused') return { label: '● Paused', color: '#d97706', bg: 'rgba(251,191,36,0.12)' }
  if (status === 'closed') return { label: '● Closed', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' }
  return { label: '● Draft', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' }
}

const ICON_COLORS = [
  'linear-gradient(135deg,#ddd6fe,#a78bfa)',
  'linear-gradient(135deg,#fce7f3,#f9a8d4)',
  'linear-gradient(135deg,#d1fae5,#6ee7b7)',
  'linear-gradient(135deg,#fef3c7,#fde68a)',
]

const getExperienceDisplay = (job: Job) => {
  const levelLabels: Record<string, string> = {
    entry: 'Entry Level',
    mid: 'Mid Level',
    senior: 'Senior',
    lead: 'Lead / Principal',
    director: 'Director+',
  }

  const parts: string[] = []
  if (job.min_experience_years != null && job.min_experience_years > 0) {
    parts.push(`${job.min_experience_years}+ years`)
  }

  if (job.experience_level) {
    const normalized = job.experience_level.toLowerCase().trim()
    const friendlyLevel = levelLabels[normalized] || job.experience_level
    parts.push(friendlyLevel)
  }

  return parts.join(' - ') || 'Not specified'
}

const updateDescriptionWithExperience = (
  description: string,
  minYears: number,
  level: string
) => {
  if (!description) return description

  const levelLabels: Record<string, string> = {
    entry: 'Entry Level',
    mid: 'Mid Level',
    senior: 'Senior',
    lead: 'Lead / Principal',
    director: 'Director+',
  }
  const friendlyLevel = levelLabels[level.toLowerCase()] || level

  let newDesc = description

  // 1. Replace years of experience: e.g. "3+ years", "5 years", "1-3 years", "5+ years of experience"
  const yearsRegex = /\b\d+[\d.+\-\s]*\s*years?(?:\s*of\s*experience)?\b/gi

  if (minYears > 0) {
    const newYearsStr = `${minYears}+ years of experience`
    if (yearsRegex.test(newDesc)) {
      newDesc = newDesc.replace(yearsRegex, newYearsStr)
    } else {
      // Append if not found in description
      newDesc = `${newDesc}\n\nRequired Experience: ${newYearsStr}`
    }
  }

  // 2. Replace experience level: e.g. "Senior", "Mid Level", etc.
  const levelsToMatch = ['Entry Level', 'Mid Level', 'Senior Level', 'Senior', 'Lead / Principal', 'Lead', 'Director+'].map(l => l.replace(/[+]/g, '\\+'))
  const levelRegex = new RegExp(`\\b(${levelsToMatch.join('|')})\\b`, 'gi')

  if (level) {
    if (levelRegex.test(newDesc)) {
      newDesc = newDesc.replace(levelRegex, friendlyLevel)
    }
  }

  return newDesc
}

const parseExperience = (expStr: string) => {
  if (!expStr) return { min_experience_years: 0, experience_level: 'entry' }

  const normalized = expStr.toLowerCase().trim()
  
  // Try to find the number of years
  const numMatch = normalized.match(/\d+/)
  const minYears = numMatch ? parseInt(numMatch[0], 10) : 0

  let level = 'mid' // default fallback

  if (normalized.includes('entry') || normalized.includes('junior') || normalized.includes('fresher') || minYears <= 1) {
    level = 'entry'
  } else if (normalized.includes('senior') || (minYears >= 5 && minYears < 8)) {
    level = 'senior'
  } else if (normalized.includes('lead') || normalized.includes('principal') || (minYears >= 8 && minYears < 12)) {
    level = 'lead'
  } else if (normalized.includes('director') || normalized.includes('vp') || minYears >= 12) {
    level = 'director'
  } else if (normalized.includes('mid') || (minYears > 1 && minYears < 5)) {
    level = 'mid'
  }

  return {
    min_experience_years: minYears,
    experience_level: level
  }
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AddJobPage() {
  const { basePath } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()
  const queryClient = useQueryClient()
  const { data: globalFlags } = useQuery({ queryKey: ['super-admin', 'global-flags'], queryFn: () => superAdminApi.getGlobalFlags() })
  const isEdit = Boolean(id)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [skillInput, setSkillInput] = useState('')
  const [serverError, setServerError] = useState('')
  const [saved, setSaved] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [showAIReview, setShowAIReview] = useState(false)
  const [aiGeneratedJD, setAiGeneratedJD] = useState<any>(null)
  const [isPreviewing, setIsPreviewing] = useState(false)

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

  // Fetch existing job when in edit mode
  const { data: jobData } = useQuery({
    queryKey: ['jobs', id],
    queryFn: () => jobsApi.get(id!).then((r: any) => r.data),
    enabled: isEdit,
  })

  useEffect(() => {
    if (jobData) {
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
        min_experience_years: (jobData as unknown as { min_experience_years?: number }).min_experience_years ?? 0,
        jd_url: jobData.jd_url,
        jd_filename: jobData.jd_filename,
      })
    }
  }, [jobData, reset])

  const prevMinExpRef = useRef<number | undefined>(undefined)
  const prevExpLevelRef = useRef<string | undefined>(undefined)

  const watchedMinExp = watch('min_experience_years')
  const watchedExpLevel = watch('experience_level')

  useEffect(() => {
    if (jobData) {
      prevMinExpRef.current = jobData.min_experience_years ?? 0
      prevExpLevelRef.current = jobData.experience_level || ''
    }
  }, [jobData])

  useEffect(() => {
    if (watchedMinExp === undefined && watchedExpLevel === undefined) return

    const prevMinExp = prevMinExpRef.current
    const prevExpLevel = prevExpLevelRef.current

    let shouldUpdate = false
    if (prevMinExp !== undefined && watchedMinExp !== undefined && Number(watchedMinExp) !== Number(prevMinExp)) {
      shouldUpdate = true
    }
    if (prevExpLevel !== undefined && watchedExpLevel !== undefined && watchedExpLevel !== prevExpLevel) {
      shouldUpdate = true
    }

    if (shouldUpdate) {
      const currentDescription = getValues('description') || ''
      const newDesc = updateDescriptionWithExperience(
        currentDescription,
        Number(watchedMinExp || 0),
        watchedExpLevel || ''
      )
      if (newDesc !== currentDescription) {
        setValue('description', newDesc, { shouldDirty: true, shouldValidate: true })
      }

      prevMinExpRef.current = Number(watchedMinExp || 0)
      prevExpLevelRef.current = watchedExpLevel || ''
    }
  }, [watchedMinExp, watchedExpLevel, setValue, getValues])

  const handleApplyAIJD = (approved: any) => {
    if (approved) {
      if (approved.title) setValue('title', approved.title)
      if (approved.location) setValue('location', approved.location)
      if (approved.description) setValue('description', approved.description)
      
      // Map refined fields back to the form
      const skills = [...(approved.required_qualifications_skills || []), ...(approved.good_to_have || [])]
      if (skills.length > 0) setValue('skills_required', skills)
      
      if (approved.key_responsibilities && approved.key_responsibilities.length > 0) {
        setValue('responsibilities', Array.isArray(approved.key_responsibilities) ? approved.key_responsibilities.join('\n• ') : approved.key_responsibilities)
      }

      if (approved.experience) {
        const { min_experience_years, experience_level } = parseExperience(approved.experience)
        setValue('min_experience_years', min_experience_years)
        setValue('experience_level', experience_level)
      }
    }
    setShowAIReview(false)
  }

  const handlePreviewPDF = async () => {
    const values = watch()
    try {
      setIsPreviewing(true)
      const jdData = {
        title: values.title,
        location: values.location || 'Remote',
        experience: values.experience_level || 'Not specified',
        key_responsibilities: values.responsibilities ? values.responsibilities.split('\n').map((s: string) => s.replace(/^[•\s*-]+/, '').trim()) : [],
        required_qualifications_skills: values.skills_required || [],
        good_to_have: [],
        description: values.description
      }
      const res = await aiApi.exportJDPDF(jdData)
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `Preview_JD_${values.title.replace(/\s+/g, '_')}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success('Preview PDF generated!')
    } catch (err) {
      console.error(err)
      toast.error('Failed to generate preview PDF.')
    } finally {
      setIsPreviewing(false)
    }
  }

  // Fetch all jobs for "Active Job Descriptions" panel
  const { data: jobsRes } = useQuery({
    queryKey: ['jobs', 'list'],
    queryFn: () => jobsApi.list({ limit: 10 }).then((r: any) => r.data),
  })
  const allJobs: Job[] = jobsRes?.items ?? []

  const skills = watch('skills_required') ?? []

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      isEdit ? jobsApi.update(id!, data) : jobsApi.create(data),
    onSuccess: () => {
      setSaved(true)
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['recent-activities'] })
      setTimeout(() => {
        navigate(`${basePath}/jobs`)
      }, 1200)
    },
    onError: (err: unknown) => {
      setServerError(
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        `Failed to ${isEdit ? 'update' : 'save'} job. Please try again.`
      )
    },
  })

  const addSkill = () => {
    const trimmed = skillInput.trim()
    if (trimmed && !skills.includes(trimmed)) {
      setValue('skills_required', [...skills, trimmed])
    }
    setSkillInput('')
  }

  const removeSkill = (skill: string) => {
    setValue('skills_required', skills.filter((s: any) => s !== skill))
  }

  const handleSkillKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addSkill()
    }
  }

  const handleFileUpload = async (file: File) => {
    try {
      setIsParsing(true)
      const parsed = await jobsApi.parseJD(file)
      if (parsed.title) setValue('title', parsed.title)
      if (parsed.location) setValue('location', parsed.location)
      if (parsed.key_responsibilities && parsed.key_responsibilities.length > 0) {
        setValue('responsibilities', typeof parsed.key_responsibilities === 'string' ? parsed.key_responsibilities : parsed.key_responsibilities.join('\n• '))
      }
      if (parsed.min_experience_years != null) {
        setValue('min_experience_years', parsed.min_experience_years)
        const { experience_level } = parseExperience(`${parsed.min_experience_years} years`)
        setValue('experience_level', experience_level)
      }
      if (parsed.description) setValue('description', parsed.description)
      if (parsed.required_skills) setValue('skills_required', parsed.required_skills)
      if (parsed.jd_url) setValue('jd_url', parsed.jd_url)
      if (parsed.jd_filename) setValue('jd_filename', parsed.jd_filename)
    } catch (err) {
      setServerError('Failed to parse JD file automatically.')
    } finally {
      setIsParsing(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleMagicGenerate = async () => {
    if (!aiPrompt.trim()) return
    try {
      setIsGenerating(true)
      setServerError('')
      const res = await aiApi.generateJD(aiPrompt)
      setAiGeneratedJD(res.data)
      setShowAIReview(true)
      setAiPrompt('')
    } catch (err) {
      console.error('AI Generation Debug:', err)
      const status = (err as any).response?.status
      const data = (err as any).response?.data
      let errorMsg = data?.detail 
        ? (typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail))
        : (data?.message || (err as any).message || 'Failed to generate JD with AI.')
      
      setServerError(`AI Status: ${errorMsg} (Code: ${status || 'Network'})`)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 26, fontWeight: 900, color: 'var(--text)', marginBottom: 6 }}>
          {isEdit ? 'Edit Job Description' : 'Upload / Add Job Description'}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-mid)' }}>
          Add a JD manually or upload a file — Hybent Hiring AI extracts requirements automatically.
        </p>
      </div>

      {serverError && (
        <div style={{ marginBottom: 16, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
          <GlassIcon icon="AlertTriangle" variant="rose" size={20} iconSize={12} glow={false} /> {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit((d: any) => mutation.mutate(d))}>
        <div className="flex flex-col lg:grid lg:grid-cols-2 gap-6 items-start">

          {/* ── LEFT PANEL: Job Details ── */}
          <div className="p-4 md:p-[22px]" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, boxShadow: 'var(--shadow)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 18 }}>Job Details</div>

            {/* Job Title */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Job Title</label>
              <input className="input-base" placeholder="Senior React Developer" {...register('title')} />
              {errors.title && <p style={errStyle}>{errors.title.message}</p>}
            </div>

            {/* Status & Location */}
            <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3 mb-3.5">
              <div>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <Select
                      label="Status"
                      value={field.value}
                      onChange={field.onChange}
                      options={[
                        { value: 'active', label: 'Active' },
                        { value: 'draft', label: 'Draft' },
                        { value: 'paused', label: 'Paused' },
                        { value: 'closed', label: 'Closed' },
                      ]}
                    />
                  )}
                />
              </div>
              <div>
                <label style={labelStyle}>Location</label>
                <input className="input-base" placeholder="Remote / Hybrid / City" {...register('location')} />
              </div>
            </div>

            {/* Job Type only */}
            <div style={{ marginBottom: 14 }}>
              <Controller
                name="job_type"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Job Type"
                    value={field.value}
                    onChange={field.onChange}
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
            </div>

            {/* Min Exp + Experience Level */}
            <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3 mb-3.5">
              <div>
                <label style={labelStyle}>Min. Experience (yrs)</label>
                <input
                  className="input-base"
                  type="number" min="0" placeholder="3"
                  {...register('min_experience_years')}
                />
              </div>
              <div>
                <Controller
                  name="experience_level"
                  control={control}
                  render={({ field }) => (
                    <Select
                      label="Experience Level"
                      value={field.value || ''}
                      onChange={field.onChange}
                      placeholder="Select level"
                      options={[
                        { value: 'entry', label: 'Entry Level' },
                        { value: 'mid', label: 'Mid Level' },
                        { value: 'senior', label: 'Senior' },
                        { value: 'lead', label: 'Lead / Principal' },
                        { value: 'director', label: 'Director+' },
                      ]}
                    />
                  )}
                />
              </div>
            </div>

            {/* Responsibilities */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Key Responsibilities</label>
              <textarea
                className="input-base"
                rows={4}
                placeholder="• Develop new features...&#10;• Maintain legacy systems..."
                {...register('responsibilities')}
              />
            </div>

            {/* Required Skills */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Required Skills</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input-base"
                  placeholder="React, TypeScript, Node.js"
                  value={skillInput}
                  onChange={(e: any) => setSkillInput(e.target.value)}
                  onKeyDown={handleSkillKeyDown}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={addSkill}
                  style={{ padding: '0 14px', borderRadius: 10, background: 'rgba(108,71,255,0.1)', border: 'none', color: '#6c47ff', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 13 }}
                >
                  + Add
                </button>
              </div>
              {skills.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                  {skills.map((skill: any) => (
                    <span key={skill} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', background: 'rgba(108,71,255,0.1)', borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#6c47ff' }}>
                      {skill}
                      <button type="button" onClick={() => removeSkill(skill)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6c47ff', lineHeight: 1, padding: 0, fontSize: 12 }}>×</button>
                    </span>
                  ))}
                </div>
              )}
              <p style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 4 }}>Press Enter or comma to add</p>
            </div>

            {/* JD Description */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>JD Description</label>
              <textarea
                className="input-base"
                rows={5}
                placeholder="We are looking for a Senior React Developer with 5+ years of experience building scalable web applications..."
                style={{ resize: 'vertical', minHeight: 100 }}
                {...register('description')}
              />
              {errors.description && <p style={errStyle}>{errors.description.message}</p>}
            </div>

            {/* Save button */}
            <button
              type="submit"
              disabled={mutation.isPending}
              style={{
                width: '100%', padding: '11px', borderRadius: 10,
                background: saved ? 'linear-gradient(135deg,#10b981,#34d399)' : 'linear-gradient(135deg,#6c47ff,#8b6bff)',
                color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                boxShadow: '0 4px 14px rgba(108,71,255,0.30)', transition: 'all 0.2s',
                opacity: mutation.isPending ? 0.7 : 1,
              }}
            >
            {mutation.isPending ? <>Saving...</> : saved ? <>Saved!</> : <>Save Job Description</>}
            {!mutation.isPending && !saved && <GlassIcon icon="Save" variant="violet" size={16} iconSize={10} glow={false} />}
          </button>
          </div>

          {/* ── RIGHT PANEL ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
            
            {/* AI Review / Output Section */}
            <div className="p-4 md:p-[22px]" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, boxShadow: 'var(--shadow)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>✨ AI JD Generator</div>
              <p style={{ fontSize: 12, color: 'var(--text-mid)', marginBottom: 12 }}>
                Enter a short prompt to generate a full job description instantly.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input 
                  className="input-base" 
                  placeholder="e.g. Senior Python dev with FastAPI..." 
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (!globalFlags?.ai) {
                        toast.error('Feature Locked: AI Scoring Engine is disabled for your organization. Please contact your administrator.')
                        return
                      }
                      if (aiPrompt.trim()) handleMagicGenerate()
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!globalFlags?.ai) {
                      toast.error('Feature Locked: AI Scoring Engine is disabled for your organization. Please contact your administrator.')
                      return
                    }
                    if (!aiPrompt.trim()) return;
                    handleMagicGenerate()
                  }}
                  disabled={isGenerating}
                  style={{ 
                    padding: '0 16px', borderRadius: 10, background: 'linear-gradient(135deg,#6c47ff,#8b6bff)', 
                    color: '#fff', border: 'none', fontWeight: 600, cursor: (!globalFlags?.ai) ? 'not-allowed' : 'pointer', fontSize: 13,
                    opacity: (!globalFlags?.ai) ? 0.6 : (isGenerating || !aiPrompt.trim()) ? 0.6 : 1,
                    filter: (!globalFlags?.ai) ? 'grayscale(100%)' : 'none'
                  }}
                  title={!globalFlags?.ai ? "Feature Locked" : "Generate JD"}
                >
                  {!globalFlags?.ai ? <Lock size={14} /> : isGenerating ? <Loader2 className="animate-spin" size={14} /> : 'Generate'}
                </button>
              </div>

              {aiGeneratedJD && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--table-border)' }}>
                  <button
                    type="button"
                    onClick={handlePreviewPDF}
                    disabled={isPreviewing}
                    style={{
                      width: '100%', padding: '8px', borderRadius: 10,
                      background: 'rgba(108,71,255,0.06)', border: '1px solid rgba(108,71,255,0.2)',
                      color: '#6c47ff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      opacity: isPreviewing ? 0.7 : 1
                    }}
                  >
                    {isPreviewing ? 'Generating Preview...' : '📄 Preview Professional PDF'}
                  </button>
                </div>
              )}
            </div>

            {/* Upload JD File */}
            <div className="p-4 md:p-[22px]" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, boxShadow: 'var(--shadow)', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Upload JD File</div>
                {watch('jd_url') && (
                  <button
                    type="button"
                    onClick={async () => {
                      const url = watch('jd_url')
                      if (!url) return
                      try {
                        const res = await fetch(url)
                        if (!res.ok) throw new Error('Failed to fetch JD')
                        const blob = await res.blob()
                        const obj = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
                        window.open(obj, '_blank')
                        setTimeout(() => window.URL.revokeObjectURL(obj), 60_000)
                      } catch (err) {
                        console.error(err)
                        try { window.open(url, '_blank') } catch (e) { /* ignore */ }
                      }
                    }}
                    style={{ background: 'none', border: 'none', color: '#6c47ff', fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    View Uploaded JD
                  </button>
                )}
              </div>

              {isParsing && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(2px)', borderRadius: 14, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin mb-3"></div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#6c47ff' }}>Extracting details with AI...</div>
                </div>
              )}

              <div
                onDragOver={(e: any) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e: any) => {
                  e.preventDefault()
                  setDragOver(false)
                  if (e.dataTransfer.files[0]) handleFileUpload(e.dataTransfer.files[0])
                }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? '#6c47ff' : 'rgba(108,71,255,0.28)'}`,
                  borderRadius: 14, padding: 36, textAlign: 'center', cursor: 'pointer',
                  background: dragOver ? 'rgba(108,71,255,0.05)' : 'var(--upload-zone, rgba(255,255,255,0.45))',
                  transition: 'all 0.3s',
                }}
              >
                <input
                  type="file"
                  id="jd-upload"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.txt"
                  ref={fileInputRef}
                  onChange={(e: any) => {
                    const f = e.target.files?.[0]
                    if (f) handleFileUpload(f)
                  }}
                />
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
                  <GlassIcon icon="ClipboardList" variant="violet" size={60} iconSize={32} glow={false} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Drop your JD file here</div>
                <div style={{ fontSize: 12, color: 'var(--text-mid)', marginBottom: 12 }}>
                  AI will auto-extract skills, experience &amp; requirements
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  {['PDF', 'DOCX', 'TXT'].map((t: any) => (
                    <span key={t} style={{ padding: '3px 10px', background: 'rgba(108,71,255,0.09)', borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#6c47ff' }}>{t}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Active Job Descriptions */}
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: 22, boxShadow: 'var(--shadow)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Active Job Descriptions</div>
                <div className="text-xl font-black text-violet-600 font-fraunces tracking-tight">
                  {allJobs.filter((j: any) => j.status === 'active').length} open roles
                </div>
              </div>

              {allJobs.filter((j: any) => j.status === 'active').length === 0 ? (
                <div className="text-center py-12 bg-white/50 rounded-2xl border border-dashed border-violet-100">
                  <p className="text-sm text-gray-400 italic">No active jobs yet. Create your first one below.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allJobs.filter((j: any) => j.status === 'active').slice(0, 5).map((job: any, i: any) => {
                    const badge = statusBadge(job.status)
                    return (
                      <div
                        key={job.id}
                        onClick={() => navigate(`${basePath}/jobs/${job.id}/edit`)}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--activity-bg)', border: '1px solid var(--table-border)', borderRadius: 10, cursor: 'pointer', transition: 'background 0.15s' }}
                        onMouseOver={(e: any) => (e.currentTarget.style.background = 'var(--kpi-bg)')}
                        onMouseOut={(e: any) => (e.currentTarget.style.background = 'var(--activity-bg)')}
                      >
                        <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: ICON_COLORS[i % ICON_COLORS.length] }}>
                          <GlassIcon icon="Briefcase" variant="violet" size={36} iconSize={18} glow={false} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {job.title}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-light)' }}>
                            {[job.location, getExperienceDisplay(job)].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: badge.bg, color: badge.color, flexShrink: 0 }}>
                          {badge.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}

              {allJobs.length > 5 && (
                <button
                  type="button"
                  onClick={() => navigate(`${basePath}/jobs`)}
                  style={{ marginTop: 12, width: '100%', padding: 8, background: 'transparent', border: 'none', color: '#6c47ff', fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  View all {allJobs.length} jobs <ArrowRight size={14} className="ml-1 inline" />
                </button>
              )}
            </div>
          </div>
        </div>
      </form>

      <AIJDReviewModal 
        open={showAIReview}
        onClose={() => setShowAIReview(false)}
        data={aiGeneratedJD}
        onApply={handleApplyAIJD}
      />
    </div>
  )
}

// ─── Style helpers ─────────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  color: 'var(--text-mid)',
  display: 'block',
  marginBottom: 6,
}

const errStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#ef4444',
  marginTop: 4,
}
