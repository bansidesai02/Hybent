import api from './axios'
import type { Organization } from '@/types'

export const organizationsApi = {
  getMe: () => api.get<Organization>('/v1/organizations/me'),

  update: (data: Partial<Organization>) => api.put<Organization>('/v1/organizations/me', data),

  /** Upload a new organization logo (multipart/form-data) */
  uploadLogo: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<Organization>('/v1/organizations/me/logo', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}
