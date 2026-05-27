import api from './axios'
import type { Application, Interview, Offer, Candidate } from '@/types'

export const portalApi = {
  register: (data: {
    email: string
    full_name: string
    password: string
    organization_slug: string
  }) => api.post('/v1/portal/register', data),

  myApplications: () => api.get<Application[]>('/v1/portal/my-applications'),

  myApplicationsSummary: () => api.get<Array<{ id: string; stage: string; candidate_pipeline_stage: string | null }>>('/v1/portal/my-applications-summary'),

  myInterviews: () => api.get<Interview[]>('/v1/portal/my-interviews'),

  myOffers: () => api.get<Offer[]>('/v1/portal/my-offers'),

  respondOffer: (offerId: string, accept: boolean, decline_reason?: string) =>
    api.post(`/v1/portal/offers/${offerId}/respond`, { accept, decline_reason }),

  profile: () => api.get<Candidate>('/v1/portal/profile'),

  updateProfile: (data: Partial<Candidate>) => api.put<Candidate>('/v1/portal/profile', data),

  generatePrep: (applicationId: string) => api.get(`/v1/portal/applications/${applicationId}/prep-hub`),

  jobs: () => api.get<import('@/types').Job[]>('/v1/portal/jobs'),

  applyToJob: (jobId: string) => api.post<Application>(`/v1/portal/jobs/${jobId}/apply`),

  referJob: (jobId: string, data: FormData) =>
    api.post(`/v1/portal/jobs/${jobId}/refer`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  uploadResume: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<Candidate>('/v1/portal/profile/resume', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  /** Upload a new avatar image for the candidate (same endpoint as other portals) */
  uploadAvatar: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<Candidate>('/v1/users/me/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  /** Delete the candidate's avatar image */
  deleteAvatar: () => api.delete<Candidate>('/v1/users/me/avatar'),
}
