import api from './axios'

export interface SmsEventSetting {
  key: string
  audience: 'candidate' | 'interviewer'
  label: string
  /** The DLT-registered text; {#var#} marks the parts that change. */
  text: string
  on: boolean
  template_id: string
}

export interface SmsSettings {
  enabled: boolean
  /** An SMS provider key is configured; otherwise messages are only logged. */
  live: boolean
  /** "android" = the company's own phone (free); "msg91" = DLT templates. */
  provider: 'android' | 'msg91'
  needs_template_ids: boolean
  daily_limit: number
  sender_id: string
  events: SmsEventSetting[]
}

export interface SmsLogRow {
  id: string
  event: string
  audience: string
  recipient_name: string | null
  phone: string | null
  body: string
  status: 'sent' | 'test' | 'failed' | 'skipped'
  error: string | null
  created_at: string | null
}

export const SMS_KEY = ['sms'] as const

export const smsApi = {
  getSettings: () => api.get<SmsSettings>('/v1/sms/settings'),
  saveSettings: (body: { enabled: boolean; events: Record<string, { on: boolean; template_id: string }> }) =>
    api.put<SmsSettings>('/v1/sms/settings', body),
  test: (event: string, phone: string) =>
    api.post<{ status: string; error: string | null; body: string }>('/v1/sms/test', { event, phone }),
  logs: () => api.get<SmsLogRow[]>('/v1/sms/logs', { params: { limit: 30 } }),
}
