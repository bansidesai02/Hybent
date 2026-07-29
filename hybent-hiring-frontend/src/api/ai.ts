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
    tone?: string
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
  buyCredits: (amount: number) =>
    axios.post('/v1/ai/credits/buy', { amount }),
}
