import axios from './axios'

/** Hybent Talent Network, candidate side. No login: each step is a secret link from an email. */

export interface TalentProfileView {
  full_name: string
  email: string
  phone: string | null
  location: string | null
  current_title: string | null
  current_company: string | null
  years_experience: number | null
  skills: string[]
  looking_for: string | null
  is_visible: boolean
  verified: boolean
  /** How companies see the name, e.g. "Priya S." */
  shown_to_companies_as: string
  /** Companies that asked for contact (manage page only). */
  requests?: Array<{
    company: string
    job_title: string | null
    status: 'pending' | 'accepted' | 'declined'
    token: string
    message: string | null
    created_at: string | null
  }>
}

export interface TalentRequestView {
  company: string
  company_logo: string | null
  job_title: string | null
  message: string | null
  status: 'pending' | 'accepted' | 'declined'
}

export const talentNetworkApi = {
  consent: () => axios.get<{ version: string; text: string }>('/api/public/talent/consent'),

  signup: (data: {
    full_name: string
    email: string
    phone?: string
    location?: string
    looking_for?: string
    linkedin_url?: string
    source?: string
    consent: boolean
    resume: File
  }) => {
    const form = new FormData()
    Object.entries(data).forEach(([k, v]) => {
      if (v === undefined || v === '') return
      form.append(k, v instanceof File ? v : String(v))
    })
    // The shared client defaults to JSON; a FormData body needs multipart.
    return axios.post<{ email: string }>('/api/public/talent/signup', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  verify: (token: string) =>
    axios.post<{ manage_token: string; profile: TalentProfileView }>(`/api/public/talent/verify/${token}`),

  getProfile: (token: string) => axios.get<TalentProfileView>(`/api/public/talent/manage/${token}`),
  setVisible: (token: string, is_visible: boolean) =>
    axios.patch<TalentProfileView>(`/api/public/talent/manage/${token}`, { is_visible }),
  deleteProfile: (token: string) => axios.delete(`/api/public/talent/manage/${token}`),

  getRequest: (token: string) => axios.get<TalentRequestView>(`/api/public/talent/respond/${token}`),
  answer: (token: string, accept: boolean) =>
    axios.post<TalentRequestView>(`/api/public/talent/respond/${token}`, { accept }),
}
