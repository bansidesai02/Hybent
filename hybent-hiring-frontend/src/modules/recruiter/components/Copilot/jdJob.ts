/**
 * Turns a Copilot JD (already parsed from its markdown) into a job, so a
 * recruiter can create the job straight from the chat instead of the form.
 */
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { copilotApi } from '@/api/copilot'
import { useAuthStore } from '@/store/authStore'
import { useCopilotStore } from '@/store/useCopilotStore'
import type { Job } from '@/types'

export interface ParsedJD {
  title: string
  location: string
  experience: string
  description: string
  key_responsibilities: string[]
  required_qualifications_skills: string[]
  good_to_have: string[]
}

/** Turns "5+ years senior" into the structured fields the job form holds. */
export function parseExperience(raw: string) {
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

/** Same fields the job form fills from a Copilot JD, saved as an Active job. */
export function jobFromJD(jd: ParsedJD, fullText: string): Partial<Job> {
  const skills = jd.required_qualifications_skills.filter((s) => s.length > 0 && s.length <= 50)
  const location = jd.location || ''
  return {
    title: jd.title || 'Untitled role',
    location: location || undefined,
    is_remote: /remote/i.test(location) && !/hybrid|on-?site/i.test(location),
    description: jd.description || fullText.slice(0, 2000),
    responsibilities: jd.key_responsibilities.length ? jd.key_responsibilities.join('\n• ') : undefined,
    skills_required: skills,
    ...parseExperience(jd.experience),
    job_type: 'full_time',
    openings: 1,
    status: 'active',
  }
}

/** The server stamps a JD's chat message once a job is created from it. */
export const JOB_CREATED_RE = /\n?\[JOB_CREATED:([0-9a-f-]{36})\]/

export function jobIdFromContent(content: string): string | null {
  return content.match(JOB_CREATED_RE)?.[1] ?? null
}

export function stripJobCreated(content: string): string {
  return content.replace(new RegExp(JOB_CREATED_RE, 'g'), '').trim()
}

/** Opens a hiring page without leaving the SPA (the Copilot lives outside the router). */
export function goToHiringPath(path: string) {
  const role = useAuthStore.getState().user?.role
  const basePath = role === 'admin' ? '/hiring/admin' : '/hiring/recruiter'
  window.history.pushState({}, '', `${basePath}${path}`)
  window.dispatchEvent(new PopStateEvent('popstate', { state: {} }))
}

/**
 * "Generate job" on a Copilot JD. The created job id is saved on the chat
 * message by the server, so the button stays "Job created" after leaving and
 * coming back, and a repeat click returns the same job instead of a new one.
 */
export function useGenerateJob(createdJobId: string | null) {
  const queryClient = useQueryClient()
  const [jobId, setJobId] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const currentJobId = createdJobId ?? jobId

  const generate = async (jd: ParsedJD, jdText: string) => {
    if (currentJobId || isGenerating) return
    const conversationId = useCopilotStore.getState().conversationId
    if (!conversationId) {
      toast.error('This chat is still saving. Try again in a moment.')
      return
    }
    setIsGenerating(true)
    try {
      const res = await copilotApi.createJobFromJD(conversationId, jdText, jobFromJD(jd, jdText) as Record<string, unknown>)
      const { job, created } = res.data
      setJobId(job.id)
      // Keep the in-memory chat in step with the server's stamp.
      useCopilotStore.setState((s) => ({
        messages: s.messages.map((m) =>
          m.role === 'assistant' && !jobIdFromContent(m.content) && m.content.includes(jdText)
            ? { ...m, content: `${m.content}\n[JOB_CREATED:${job.id}]` }
            : m,
        ),
      }))
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['recent-activities'] })
      toast.success(created ? `Job "${job.title}" created` : `"${job.title}" was already created from this JD`)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not create the job. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  return { jobId: currentJobId, isGenerating, generate }
}
