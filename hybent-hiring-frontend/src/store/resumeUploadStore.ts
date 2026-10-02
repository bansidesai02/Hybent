import { create } from 'zustand'
import toast from 'react-hot-toast'
import type { QueryClient } from '@tanstack/react-query'

import { resumesApi } from '@/api/resumes'
import type { Candidate } from '@/types'

/**
 * Résumé upload session, kept outside the Upload page.
 *
 * The upload and the paced analysis steps used to live in the page's local
 * state, so navigating away mid-parse unmounted the page and threw the run
 * away — coming back showed the idle "AI analysis ready" card. Holding the
 * session here lets the request finish in the background and the page pick up
 * wherever it is when the recruiter returns.
 */

export interface ScoringResult {
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

export interface JobReq {
  job_id?: string
  role_title: string
  min_experience: string
  match_threshold: string
  required_skills: string
}

export type UploadStage =
  | 'idle'
  | 'uploading'
  | 'analyzing'
  | 'done'
  | 'error'
  | 'duplicate'
  | 'rejected'

export interface Rejection {
  candidate_category: string
  target_category: string
  missing_skills: string[]
  suggested_roles: string[]
}

export const ANALYSIS_STEP_COUNT = 4

const DEFAULT_JOB_REQ: JobReq = {
  job_id: undefined,
  role_title: '',
  min_experience: '3',
  match_threshold: '70',
  required_skills: '',
}

interface ResumeUploadState {
  stage: UploadStage
  /** The picked file, for the file card — the File itself is not kept. */
  file: { name: string; size: number } | null
  /** This run was uploaded without a job, so it was never matched or scored. */
  unscored: boolean
  result: Candidate | null
  scoring: ScoringResult | null
  completedSteps: number
  error: string
  duplicate: { message: string; candidate_id: string } | null
  rejection: Rejection | null
  jobReq: JobReq
  /** Whether the Upload page is on screen, so a background finish can toast. */
  pageMounted: boolean

  setJobReq: (update: JobReq | ((prev: JobReq) => JobReq)) => void
  setError: (error: string) => void
  setResult: (update: (prev: Candidate | null) => Candidate | null) => void
  setPageMounted: (mounted: boolean) => void
  reset: () => void
  startUpload: (file: File, queryClient: QueryClient, opts?: { skipScoring?: boolean }) => Promise<void>
}

/* Bumped on every new upload or reset, so a run that was superseded stops
   writing into the store. */
let runId = 0

export const useResumeUploadStore = create<ResumeUploadState>((set, get) => ({
  stage: 'idle',
  file: null,
  unscored: false,
  result: null,
  scoring: null,
  completedSteps: 0,
  error: '',
  duplicate: null,
  rejection: null,
  jobReq: DEFAULT_JOB_REQ,
  pageMounted: false,

  setJobReq: (update) =>
    set((s) => ({ jobReq: typeof update === 'function' ? update(s.jobReq) : update })),
  setError: (error) => set({ error }),
  setResult: (update) => set((s) => ({ result: update(s.result) })),
  setPageMounted: (pageMounted) => set({ pageMounted }),

  reset: () => {
    runId++
    set({
      stage: 'idle',
      file: null,
      unscored: false,
      result: null,
      scoring: null,
      completedSteps: 0,
      error: '',
      rejection: null,
      duplicate: null,
    })
  },

  startUpload: async (file, queryClient, opts) => {
    const myRun = ++runId
    const isCurrent = () => myRun === runId
    const { jobReq } = get()

    set({
      error: '',
      completedSteps: 0,
      stage: 'uploading',
      file: { name: file.name, size: file.size },
      unscored: !!opts?.skipScoring,
      result: null,
      scoring: null,
      duplicate: null,
      rejection: null,
    })

    /* Only tell the recruiter when they are somewhere else — on the page the
       result card already says it. */
    const notifyAway = (fn: () => void) => {
      if (!get().pageMounted) fn()
    }

    try {
      const { data } = await resumesApi.uploadAndCreate(
        file,
        opts?.skipScoring
          ? { skip_scoring: true }
          : {
              job_id: jobReq.job_id,
              role_title: jobReq.role_title,
              required_skills: jobReq.required_skills,
              min_experience: parseFloat(jobReq.min_experience) || 0,
              match_threshold: parseFloat(jobReq.match_threshold) || 70,
            }
      )

      /* The new candidate exists server-side now. Other recruiters' open
         Candidates tabs already learn this via the activity websocket, but
         that broadcast excludes the acting user's own connections — so the
         uploader's own All Candidates tab needs this explicit invalidation
         to show it without a manual refresh. */
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['candidates_pipeline'] })
      queryClient.invalidateQueries({ queryKey: ['all-talent-full'] })

      if (!isCurrent()) return
      set({ stage: 'analyzing' })

      /* The work is already done server-side; the steps are paced out so the
         recruiter can read what the AI checked rather than seeing a flash. */
      for (let i = 1; i <= ANALYSIS_STEP_COUNT; i++) {
        await new Promise((r) => setTimeout(r, 500 + Math.random() * 300))
        if (!isCurrent()) return
        set({ completedSteps: i })
      }

      set({ result: data, scoring: data.score_breakdown ?? null, stage: 'done' })
      notifyAway(() =>
        toast.success(`Resume analysed — ${data.full_name || 'candidate'} is ready on the Upload page`)
      )
    } catch (err: any) {
      if (!isCurrent()) return
      const resp = err?.response

      if (resp?.status === 409 && resp?.data?.details?.candidate_id) {
        set({
          duplicate: {
            message: resp.data.message || 'This candidate is already in your database.',
            candidate_id: resp.data.details.candidate_id,
          },
          stage: 'duplicate',
        })
        notifyAway(() => toast.error('That resume is already in your database'))
        return
      }

      const detail = resp?.data?.detail
      if (resp?.status === 400 && detail?.type === 'role_mismatch') {
        set({
          rejection: {
            candidate_category: detail.candidate_category || 'Unknown',
            target_category: detail.target_category || jobReq.role_title,
            missing_skills: detail.missing_skills || [],
            suggested_roles: detail.suggested_roles || [],
          },
          error: detail.message || 'Role mismatch detected.',
          stage: 'rejected',
        })
        notifyAway(() => toast.error('Resume upload rejected — role mismatch'))
        return
      }

      const message =
        resp?.data?.message ||
        (typeof detail === 'object' && detail?.message ? detail.message : null) ||
        (typeof detail === 'string' ? detail : null) ||
        err?.message ||
        'Upload failed. Please try again.'

      set({
        error: message,
        stage: resp?.status === 400 && message.startsWith('Upload Rejected') ? 'rejected' : 'error',
      })
      notifyAway(() => toast.error('Resume upload failed'))
    }
  },
}))
