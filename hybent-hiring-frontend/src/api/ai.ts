import axios from './axios'

export const aiApi = {
  evaluateNotes: (rawNotes: string) => 
    axios.post('/v1/ai/evaluate-notes', { raw_notes: rawNotes }),
  scoreAll: (jobId: string) =>
    axios.post(`/v1/ai/score-all/${jobId}`),
  generateJD: (prompt: string) =>
    axios.post('/v1/ai/generate-jd', { prompt }),

  exportJDPDF: (data: any) =>
    axios.post('/v1/ai/generate-jd-pdf', data, { responseType: 'blob' }),

  generateLinkedInPost: (data: {
    title: string
    location?: string | null
    job_type?: string
    experience_level?: string | null
    skills_required?: string[]
    description?: string
    responsibilities?: string | null
    requirements?: string | null
    benefits?: string | null
    min_experience_years?: number | null
    openings?: number
    is_remote?: boolean
    application_deadline?: string | null
    apply_url?: string
    /** Formats already used for this draft — the next one avoids them. */
    recent_styles?: string[]
  }) => axios.post('/v1/ai/generate-linkedin-post', data),

  generateImagePrompt: (data: {
    title: string
    description?: string
  }) => axios.post('/v1/ai/generate-image-prompt', data),

  generateImage: (prompt: string) => 
    axios.post('/v1/ai/generate-image', { prompt }),

  getCreditsBalance: () =>
    axios.get('/v1/ai/credits/balance'),
  getCreditsHistory: (page: number = 1, limit: number = 10) =>
    axios.get(`/v1/ai/credits/history?page=${page}&limit=${limit}`),
  getUsageByFeature: () =>
    axios.get('/v1/ai/credits/usage-by-feature'),
  getUsageOverTime: () =>
    axios.get('/v1/ai/credits/usage-over-time'),
  /** Admin only. Emails the Hybent team, who invoice and add the credits. */
  requestTopup: (credits: number) =>
    axios.post('/v1/ai/credits/request-topup', { credits }),
  /** Admin only. Each staff member's monthly limit and usage. */
  getUserCreditLimits: () =>
    axios.get('/v1/ai/credits/users'),
  setUserCreditLimit: (userId: string, monthlyLimit: number) =>
    axios.put(`/v1/ai/credits/users/${userId}`, { monthly_limit: monthlyLimit }),
}
