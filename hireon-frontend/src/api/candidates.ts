import api from './axios'
import type { Candidate, PaginatedResponse } from '@/types'

export const candidatesApi = {
  list: (params?: { 
    page?: number; 
    limit?: number; 
    search?: string; 
    tag?: string; 
    stage?: string; 
    status?: string; 
    created_by_id?: string;
    job_id?: string;
    date_from?: string;
    date_to?: string;
  }) =>
    api.get<PaginatedResponse<Candidate>>('/v1/candidates', { params }),

  create: (data: Partial<Candidate>) => api.post<Candidate>('/v1/candidates', data),

  get: (id: string) => api.get<Candidate>(`/v1/candidates/${id}`),

  update: (id: string, data: Partial<Candidate>) => api.put<Candidate>(`/v1/candidates/${id}`, data),

  delete: (id: string) => api.delete(`/v1/candidates/${id}`),

  getApplications: (id: string) => api.get(`/v1/candidates/${id}/applications`),

  invite: (data: { email: string; full_name: string; job_id?: string }) =>
    api.post<Candidate>('/v1/candidates/invite', data),

  getPipeline: () => api.get<any>('/v1/candidates/pipeline'),

  updateStage: (id: string, pipeline_stage: string, send_rejection_email = false, job_id?: string) =>
    api.patch<Candidate>(`/v1/candidates/${id}/stage`, { pipeline_stage, send_rejection_email, job_id }),

  updateDesignation: (id: string, designation_id: string) =>
    api.patch<Candidate>(`/v1/candidates/${id}/designation`, { designation_id }),

  reject: (id: string) => api.post<Candidate>(`/v1/candidates/${id}/reject`),

  recordView: (id: string) => api.post(`/v1/candidates/${id}/view`),

  suggest: (q: string) =>
    api.get<any[]>('/v1/candidates/suggest', { params: { q } }),
}
