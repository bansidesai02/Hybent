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
}
