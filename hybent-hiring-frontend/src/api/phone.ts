import api from './axios'

export interface PhoneStatus {
  phone: string | null
  verified: boolean
  sms_opt_in: boolean
  /** WhatsApp OTP is set up and approved; hide the prompt otherwise. */
  available?: boolean
}

export const PHONE_KEY = ['portal', 'phone'] as const

export const phoneApi = {
  status: () => api.get<PhoneStatus>('/v1/portal/phone'),
  /** Sends a 6-digit code on WhatsApp. */
  sendCode: (phone: string) => api.post<{ to: string }>('/v1/portal/phone/send-code', { phone }),
  verify: (code: string) => api.post<PhoneStatus>('/v1/portal/phone/verify', { code }),
  setSmsOptIn: (on: boolean) => api.put<PhoneStatus>('/v1/portal/phone/sms', { sms_opt_in: on }),
}
