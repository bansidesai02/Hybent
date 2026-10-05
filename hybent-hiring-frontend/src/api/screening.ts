import api from './axios'

/** What the Candidate Screening Agent suggests for a new candidate. */
export type ScreeningRecommendationKind = 'pre_screen' | 'shortlist' | 'talent_pool' | 'reject' | 'duplicate'
export type ScreeningAction = Exclude<ScreeningRecommendationKind, 'duplicate'>
export type ScreeningStatus = 'pending' | 'approved' | 'overridden' | 'dismissed'

export interface ScreeningItem {
  id: string
  recommendation: ScreeningRecommendationKind
  reasons: string[]
  risks: string[]
  confidence: 'low' | 'medium' | 'high' | null
  score: number | null
  /** "ai": one AI call decided it. "rules": a clear case settled without AI. */
  engine: 'ai' | 'rules'
  status: ScreeningStatus
  action_taken: ScreeningAction | 'none' | null
  /** Set when the last decision on this card didn't go through. */
  error: string | null
  created_at: string
  decided_at: string | null
  job: { id: string; title: string } | null
  matches: Array<{ job_id: string; title: string; score: number }>
  duplicate_of: { id: string; full_name: string } | null
  candidate: {
    id: string
    full_name: string
    email: string
    current_title: string | null
    current_company: string | null
    years_experience: number | null
    location: string | null
    source: string | null
    skills: string[]
  }
}

export interface ScreeningQueue {
  enabled: boolean
  pending_total: number
  counts: Partial<Record<ScreeningRecommendationKind, number>>
  items: ScreeningItem[]
}

export interface DecidePayload {
  ids: string[]
  action: 'approve' | 'override' | 'dismiss'
  override_to?: ScreeningAction
  job_id?: string
}

export interface DecideResult {
  id: string
  status: ScreeningStatus | 'failed' | 'missing'
  action: string | null
  error?: string
}

/** React Query key prefix for every screening query (page + nav badge). */
export const SCREENING_QUEUE_KEY = ['screening-queue'] as const

export const screeningApi = {
  getQueue: (status: 'pending' | 'decided' = 'pending', limit = 100) =>
    api.get<ScreeningQueue>('/v1/screening/queue', { params: { status, limit } }),

  decide: (payload: DecidePayload) =>
    api.post<{ results: DecideResult[] }>('/v1/screening/decide', payload),
}
