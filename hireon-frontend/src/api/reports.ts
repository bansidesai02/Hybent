import axios from './axios'

export const reportsApi = {
  getSummary: () => axios.get('/v1/reports/summary'),
  export: () => axios.get('/v1/reports/export', { responseType: 'blob' }),
}
