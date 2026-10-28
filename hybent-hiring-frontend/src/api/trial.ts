import api from './axios'

export type TrialPlan = 'standard' | 'pro'

/** hybent.com/free-trial. The server checks the business email and company. */
export interface TrialRequestPayload {
  company_name: string
  company_website: string
  company_linkedin_url: string
  company_size?: string
  industry?: string
  country?: string
  hires_per_year?: string
  contact_name: string
  contact_title: string
  contact_email: string
  /** E.164, e.g. "+14155552671". */
  contact_phone: string
  contact_linkedin_url: string
  hiring_needs?: string
  accept_terms: boolean
  /** The plan to try; the trial gets that plan's features and seats. */
  plan: TrialPlan
  /** From verifyCode: proves the applicant owns contact_email. */
  email_verification_token: string
  /** Time from the form appearing to it being sent; bots are instant. */
  elapsed_ms?: number
  /** Honeypot, hidden from people. */
  homepage?: string
}

/** The signed-in organization's free trial, or null when it isn't on one. */
export interface TrialStatus {
  is_trial: true
  status: 'active' | 'expired'
  trial_start: string | null
  trial_end: string
  data_purge_at: string | null
  seconds_left: number
  upgrade_plans: string[]
  /** Stripe is set up, so upgrading is self-serve. */
  payments_enabled: boolean
  /** The plan this trial mirrors: suggested first when upgrading. */
  plan: 'Standard' | 'Pro'
}

export type ExportFormat = 'xlsx' | 'csv' | 'pdf'

/** What the organization setup page (/setup?token=) fills in. */
export interface TrialSetupInfo {
  plan: 'Standard' | 'Pro'
  email: string
  full_name: string
  company_name: string
  website: string | null
  industry: string | null
  size: string | null
  logo_url: string | null
  trial_end: string
  industries: string[]
  company_sizes: string[]
}

export interface TrialSetupPayload {
  password: string
  full_name: string
  company_name: string
  website?: string
  industry?: string
  size?: string
  timezone?: string
  logo_url?: string
  brand_color?: string
  email_sender_name?: string
}

export const trialApi = {
  /** Email a 6-digit code to the work address. */
  sendCode: (email: string) =>
    api.post('/api/public/trial-request/send-code', { email }, { skipLoader: true }).then((res) => res.data),
  verifyCode: (email: string, code: string): Promise<{ verification_token: string }> =>
    api.post('/api/public/trial-request/verify-code', { email, code }, { skipLoader: true }).then((res) => res.data),

  setupInfo: (token: string): Promise<TrialSetupInfo> =>
    api.get(`/api/public/trial-setup/${encodeURIComponent(token)}`, { skipLoader: true }).then((res) => res.data),
  uploadSetupLogo: (token: string, file: File): Promise<{ logo_url: string }> => {
    const form = new FormData()
    form.append('file', file)
    // The instance defaults to JSON; a file needs multipart.
    return api.post(`/api/public/trial-setup/${encodeURIComponent(token)}/logo`, form, {
      skipLoader: true,
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((res) => res.data)
  },
  /** Finishes setup; returns a signed-in session. */
  completeSetup: (token: string, payload: TrialSetupPayload) =>
    api.post(`/api/public/trial-setup/${encodeURIComponent(token)}`, payload, { skipLoader: true }).then((res) => res.data),

  request: (payload: TrialRequestPayload) =>
    api.post('/api/public/trial-request', payload, { skipLoader: true }).then((res) => res.data),

  status: (): Promise<TrialStatus | null> =>
    api.get('/v1/trial/status', { skipLoader: true }).then((res) => res.data),

  /** The organization's data as a file (admins only). */
  exportData: (format: ExportFormat): Promise<{ blob: Blob; filename: string }> =>
    api.get('/v1/trial/export', { params: { format }, responseType: 'blob' }).then((res) => {
      const disposition = String(res.headers['content-disposition'] || '')
      const filename = /filename="([^"]+)"/.exec(disposition)?.[1] || `hybent-export.${format === 'csv' ? 'zip' : format}`
      return { blob: res.data as Blob, filename }
    }),

  /** Stripe Checkout for Standard or Pro; redirect the browser to the URL. */
  upgrade: (plan_name: 'Standard' | 'Pro'): Promise<{ checkout_url: string }> =>
    api.post('/v1/billing/upgrade', { plan_name }).then((res) => res.data),
}
