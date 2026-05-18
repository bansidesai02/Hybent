import axios from './axios'

export const reportsApi = {
  getSummary: (params?: { days?: number; start_date?: string; end_date?: string; recruiter_id?: string }) =>
    axios.get('/v1/reports/summary', { params }),
  export: (params?: { days?: number; recruiter_id?: string; start_date?: string; end_date?: string }) => 
    axios.get('/v1/reports/export', { responseType: 'blob', params }),
}
