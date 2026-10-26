import api from './axios'

/** AI Calls — the Hybent AI Agent (backend: app/routers/voice_calls.py). */

export type VoiceTaskStatus = 'SCHEDULED' | 'IN_CALL' | 'ANALYZING' | 'DONE' | 'CANCELLED' | 'FAILED_TO_START'
export type VoiceOutcome =
  | 'COMPLETED' | 'PARTIAL' | 'NO_ANSWER' | 'BUSY' | 'UNREACHABLE' | 'VOICEMAIL' | 'WRONG_PERSON'
  | 'CALLBACK_REQUESTED' | 'DECLINED' | 'HUMAN_REQUESTED' | 'OPTED_OUT' | 'INVALID_NUMBER' | 'EXPIRED' | 'FAILED'
export type VoiceDecision = 'RECOMMEND_NEXT_ROUND' | 'HOLD' | 'NOT_RECOMMENDED'
export type VoiceTab = 'queue' | 'needs_action' | 'history' | 'all'
export type VoiceCallType = 'PRESCREEN' | 'AVAILABILITY' | 'REMINDER'
/** Availability / reminder result (Spec §6.6, §7.5). */
export type UseCaseOutcome =
  | 'SLOT_CONFIRMED' | 'SLOT_PROPOSED_NEEDS_APPROVAL' | 'CANDIDATE_NOT_INTERESTED'
  | 'CONFIRMED' | 'RESCHEDULE_REQUESTED' | 'CANCELLED_BY_CANDIDATE' | 'UNSURE'

export interface Money {
  value: number
  currency: string
  period?: string
  raw?: string
}

export interface Communication {
  clarity: number
  fluency: number
  vocabulary_grammar: number
  relevance: number
  confidence_score: number
  listening: number
  overall: number
  audio_quality: string
  /** NORMAL, or LOW_CONFIDENCE when poor audio makes the scores unreliable. */
  confidence: 'NORMAL' | 'LOW_CONFIDENCE'
  notes: string
}

export interface UseCaseResult {
  outcome?: UseCaseOutcome
  confirmed_slot?: { start: string; duration_min: number | null; mode: string | null }
  proposed_slot?: { start: string; note: string }
  alternatives_offered?: string[]
  constraints?: string[]
  reason?: string | null
  link_resent?: boolean
}

export interface VoiceResult {
  structured_data: {
    answers?: Record<string, number | string | Money | boolean | string[] | null>
    answers_raw?: Record<string, string>
    /** Availability / reminder calls. */
    result?: UseCaseResult
  }
  summary_text: string
  communication: Communication | null
  recommendation: {
    decision: VoiceDecision
    reasons: string[]
    suggested_round?: string
    focus_areas?: string[]
  } | null
  flags: string[]
}

export interface TranscriptTurn {
  role: 'user' | 'assistant'
  text: string
}

export interface VoiceCall {
  id: string
  candidate_id: string
  candidate_name: string | null
  job_id: string | null
  job_title: string | null
  interview_id: string | null
  type: VoiceCallType
  reminder_number: number | null
  use_case_outcome: UseCaseOutcome | null
  task_status: VoiceTaskStatus
  outcome: VoiceOutcome | null
  attempt_no: number
  final: boolean
  next_attempt_at: string | null
  error: string | null
  started_at: string | null
  duration_sec: number | null
  language: string
  language_detected: string | null
  audio_quality: string | null
  callback_at: string | null
  decision: VoiceDecision | null
  hr_override: { decision: VoiceDecision; note: string | null; by_name: string; at: string } | null
  resolved_at: string | null
  profile_updated_at: string | null
  created_at: string
  updated_at: string
}

export interface VoiceCallDetail extends VoiceCall {
  request: { round?: string; mode?: string; duration_min?: number; slots?: string[] } | null
  transcript: TranscriptTurn[]
  recording_url: string | null
  result: VoiceResult | null
  summary_text: string | null
}

export interface CandidateCalls {
  calls: VoiceCallDetail[]
  consent_at: string | null
  consent_source: string | null
  opted_out_at: string | null
}

export interface StartResult {
  candidate_id: string
  voice_call_id: string | null
  error: string | null
}

export interface VoiceSettings {
  window_start: string
  window_end: string
  max_attempts: number
  retry_gap_minutes: number
  default_language: 'en' | 'hi'
  communication_threshold_client_facing: number
  communication_threshold_other: number
  auto_update_profile: boolean
  recording_retention_days: number
  reminder_calls: boolean
}

export interface AvailabilityWindow {
  from_date: string
  to_date: string
  day_start: string
  day_end: string
  weekdays_only: boolean
}

export interface AvailabilityRequest {
  candidate_id: string
  round: string
  mode: 'VIDEO' | 'PHONE' | 'IN_PERSON'
  duration_min: number
  location?: string | null
  job_id?: string | null
  application_id?: string | null
  panelists: Array<{ user_id: string; role?: string | null }>
  window: AvailabilityWindow
}

export interface JobVoiceConfig {
  questions: Array<{ field: string; question: string; required: boolean }>
  criteria: {
    min_experience_years?: number | null
    max_experience_years?: number | null
    budget_max?: { value: number; currency: string } | null
    max_notice_days?: number | null
    communication_threshold?: number | null
  }
  client_facing: boolean
  currency: string
}

export interface ReminderStatus {
  task_status: VoiceTaskStatus
  outcome: VoiceOutcome | null
  use_case_outcome: UseCaseOutcome | null
  next_attempt_at: string | null
}

/** What the AI Agent did for one interview (Schedule page). */
export interface InterviewAIStatus {
  booked_by_ai: boolean
  /** Keyed "1" (day before) and "2" (1 hour before). */
  reminders: Record<string, ReminderStatus>
}

/** React Query key prefix for every AI Calls query (page, tab, nav badge). */
export const VOICE_CALLS_KEY = ['voice-calls'] as const

export const voiceCallsApi = {
  status: () => api.get<{ enabled: boolean }>('/v1/voice-calls/status'),

  startPrescreen: (jobId: string, candidateIds: string[]) =>
    api.post<StartResult[]>('/v1/voice-calls/prescreen', { job_id: jobId, candidate_ids: candidateIds }),

  list: (tab: VoiceTab = 'all', limit = 50) =>
    api.get<{ items: VoiceCall[]; counts: Record<'queue' | 'needs_action' | 'history', number> }>(
      '/v1/voice-calls',
      { params: { tab, limit } },
    ),

  previewSlots: (req: AvailabilityRequest) =>
    api.post<{ slots: string[]; timezone: string }>('/v1/voice-calls/availability/slots', req),
  startAvailability: (req: AvailabilityRequest) => api.post<VoiceCall>('/v1/voice-calls/availability', req),

  interviewStatus: (interviewIds: string[]) =>
    api.get<Record<string, InterviewAIStatus>>('/v1/voice-calls/interviews', { params: { ids: interviewIds.join(',') } }),

  get: (id: string) => api.get<VoiceCallDetail>(`/v1/voice-calls/${id}`),
  forCandidate: (candidateId: string) => api.get<CandidateCalls>(`/v1/voice-calls/candidates/${candidateId}`),
  recordConsent: (candidateId: string, source = 'HR_RECORDED_OTHER') =>
    api.post(`/v1/voice-calls/candidates/${candidateId}/consent`, { source }),

  cancel: (id: string) => api.post<VoiceCall>(`/v1/voice-calls/${id}/cancel`),
  override: (id: string, decision: VoiceDecision, note?: string) =>
    api.post<VoiceCall>(`/v1/voice-calls/${id}/override`, { decision, note }),
  resolve: (id: string) => api.post(`/v1/voice-calls/${id}/resolve`),

  getSettings: () => api.get<VoiceSettings>('/v1/voice-calls/settings'),
  saveSettings: (values: Partial<VoiceSettings>) => api.put<VoiceSettings>('/v1/voice-calls/settings', values),

  getJobConfig: (jobId: string) => api.get<JobVoiceConfig>(`/v1/voice-calls/jobs/${jobId}/config`),
  saveJobConfig: (jobId: string, config: JobVoiceConfig) =>
    api.put<JobVoiceConfig>(`/v1/voice-calls/jobs/${jobId}/config`, config),
}

/* ── Display helpers shared by the AI Calls page and the candidate tab ───── */

export const DECISION_LABEL: Record<VoiceDecision, { label: string; tone: 'success' | 'warning' | 'error' }> = {
  RECOMMEND_NEXT_ROUND: { label: 'Recommend next round', tone: 'success' },
  HOLD: { label: 'Hold', tone: 'warning' },
  NOT_RECOMMENDED: { label: 'Not recommended', tone: 'error' },
}

export const OUTCOME_LABEL: Record<VoiceOutcome, string> = {
  COMPLETED: 'Completed',
  PARTIAL: 'Partly completed',
  NO_ANSWER: 'No answer',
  BUSY: 'Busy',
  UNREACHABLE: 'Unreachable',
  VOICEMAIL: 'Voicemail',
  WRONG_PERSON: 'Wrong person',
  CALLBACK_REQUESTED: 'Callback requested',
  DECLINED: 'Not interested',
  HUMAN_REQUESTED: 'Wants a recruiter',
  OPTED_OUT: 'Opted out',
  INVALID_NUMBER: 'Invalid number',
  EXPIRED: 'Expired',
  FAILED: 'Failed',
}

export const TYPE_LABEL: Record<VoiceCallType, string> = {
  PRESCREEN: 'AI pre-screen',
  AVAILABILITY: 'Availability check',
  REMINDER: 'Interview reminder',
}

export function callTypeLabel(c: Pick<VoiceCall, 'type' | 'reminder_number'>): string {
  if (c.type === 'REMINDER' && c.reminder_number) {
    return c.reminder_number === 1 ? 'Reminder · day before' : 'Reminder · 1 hour before'
  }
  return TYPE_LABEL[c.type] ?? c.type
}

export const USE_CASE_LABEL: Record<UseCaseOutcome, { label: string; tone: 'success' | 'warning' | 'error' | 'info' }> = {
  SLOT_CONFIRMED: { label: 'Interview booked', tone: 'success' },
  SLOT_PROPOSED_NEEDS_APPROVAL: { label: 'Time needs approval', tone: 'warning' },
  CANDIDATE_NOT_INTERESTED: { label: 'Not interested', tone: 'error' },
  CONFIRMED: { label: 'Attendance confirmed', tone: 'success' },
  RESCHEDULE_REQUESTED: { label: 'Wants to reschedule', tone: 'warning' },
  CANCELLED_BY_CANDIDATE: { label: "Can't attend", tone: 'error' },
  UNSURE: { label: 'Unsure about attending', tone: 'warning' },
}

/** One short status line for a call, e.g. "Calling now", "No answer · retry 4:30 PM". */
export function callStatusLabel(c: VoiceCall): string {
  if (c.task_status === 'FAILED_TO_START') return "Couldn't start"
  if (c.task_status === 'IN_CALL') return 'Calling now'
  if (c.task_status === 'ANALYZING') return 'Analysing call'
  if (c.task_status === 'CANCELLED') return 'Cancelled'
  if (c.task_status === 'SCHEDULED') {
    const when = c.next_attempt_at ? formatWhen(c.next_attempt_at) : ''
    const prefix = c.outcome ? `${OUTCOME_LABEL[c.outcome]} · retry` : 'Scheduled'
    return when ? `${prefix} ${when}` : prefix
  }
  return c.outcome ? OUTCOME_LABEL[c.outcome] : 'Done'
}

export function formatWhen(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return sameDay ? time : `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${time}`
}

export function formatDuration(sec: number | null): string {
  if (sec == null) return ''
  return `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, '0')}s`
}
