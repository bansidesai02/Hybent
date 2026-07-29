import api from './axios'

export interface ScreeningQuestion {
  id: number
  text: string
  category: 'job_description' | 'resume' | 'role_awareness'
}

export interface PreScreeningResponse {
  id: string
  session_id: string
  question_index: number
  audio_file_path: string | null
  transcript: string | null
  duration_seconds: number | null
  recorded_at: string
}

export interface PreScreeningSession {
  id: string
  organization_id: string
  candidate_id: string
  application_id: string | null
  job_id: string | null
  created_by_id: string | null
  questions: ScreeningQuestion[]
  status: 'pending' | 'in_progress' | 'completed'
  invite_token: string
  expires_at: string
  overall_ai_summary: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  responses: PreScreeningResponse[]
  candidate_name: string | null
  candidate_email: string | null
  job_title: string | null
}

export interface PreScreeningListItem {
  id: string
  candidate_id: string
  job_id: string | null
  status: 'pending' | 'in_progress' | 'completed'
  created_at: string
  completed_at: string | null
  response_count: number
  candidate_name: string | null
  candidate_email: string | null
  job_title: string | null
}

export type ScreeningLanguage = 'english' | 'hindi' | 'gujarati'

export interface PublicSession {
  id: string
  candidate_name: string
  job_title: string | null
  questions: ScreeningQuestion[]
  status: string
  expires_at: string
  response_count: number
  language: ScreeningLanguage
  translated_questions: ScreeningQuestion[]
}

export interface CreateSessionPayload {
  candidate_id: string
  job_id?: string
  application_id?: string
}

export interface AISummary {
  overall_impression: string
  communication_score: number
  technical_score: number
  culture_fit_score: number
  key_strengths: string[]
  concerns: string[]
  recommendation: 'proceed' | 'hold' | 'reject'
  recommendation_reason: string
}

export const preScreeningApi = {
  createSession: (data: CreateSessionPayload) =>
    api.post<{
      id: string
      invite_token: string
      status: string
      questions_count: number
      expires_at: string
      screening_url: string
      candidate_name: string
      candidate_email: string
    }>('/v1/pre-screening/sessions', data),

  listSessions: (params?: {
    candidate_id?: string
    job_id?: string
    status?: string
    page?: number
    limit?: number
  }) => api.get<PreScreeningListItem[]>('/v1/pre-screening/sessions', { params }),

  getSession: (id: string) =>
    api.get<PreScreeningSession>(`/v1/pre-screening/sessions/${id}`),

  // Public — no auth required
  takeSession: (token: string) =>
    api.get<PublicSession>(`/v1/pre-screening/take/${token}`),

  updateStatus: (sessionId: string, status: 'in_progress' | 'completed') =>
    api.patch(`/v1/pre-screening/sessions/${sessionId}/status`, { status }),

  uploadResponse: (
    sessionId: string,
    questionIndex: number,
    audioBlob: Blob,
    durationSeconds?: number,
  ) => {
    const form = new FormData()
    form.append('audio', audioBlob, `q${questionIndex}.webm`)
    const params: Record<string, string> = { question_index: String(questionIndex) }
    if (durationSeconds != null) params.duration_seconds = String(durationSeconds)
    return api.post<{ id: string; audio_saved: boolean; transcription: string }>(
      `/v1/pre-screening/sessions/${sessionId}/responses`,
      form,
      {
        params,
        // Remove the default 'application/json' Content-Type so the browser
        // can set 'multipart/form-data; boundary=...' automatically for FormData.
        headers: { 'Content-Type': undefined },
      },
    )
  },

  getAudioUrl: (responseId: string) =>
    `/v1/pre-screening/audio/${responseId}`,

  fetchAudioBlob: (responseId: string) =>
    api.get<Blob>(`/v1/pre-screening/audio/${responseId}`, { responseType: 'blob' }),

  updateLanguage: (sessionId: string, language: ScreeningLanguage) =>
    api.patch<{ session_id: string; language: ScreeningLanguage; translated_questions: ScreeningQuestion[] }>(
      `/v1/pre-screening/sessions/${sessionId}/language`,
      { language },
    ),

  summariseSession: (sessionId: string) =>
    api.post<{ summary: AISummary }>(`/v1/pre-screening/sessions/${sessionId}/summarise`),
}
