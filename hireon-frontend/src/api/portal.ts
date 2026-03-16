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

  myInterviews: () => api.get<Interview[]>('/v1/portal/my-interviews'),

  myOffers: () => api.get<Offer[]>('/v1/portal/my-offers'),

  respondOffer: (offerId: string, accept: boolean, decline_reason?: string) =>
    api.post(`/v1/portal/offers/${offerId}/respond`, { accept, decline_reason }),

  profile: () => api.get<Candidate>('/v1/portal/profile'),
}
