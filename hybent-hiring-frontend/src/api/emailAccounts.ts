import api from './axios'
import type { EmailAccount } from '@/types'

export interface ConnectSmtpPayload {
  email_address: string
  display_name?: string
  smtp_host: string
  smtp_port: number
  smtp_username: string
  smtp_password: string
  use_tls: boolean
}

export const emailAccountsApi = {
  list: () => api.get<EmailAccount[]>('/v1/email-accounts'),

  connectSmtp: (data: ConnectSmtpPayload) =>
    api.post<EmailAccount>('/v1/email-accounts/smtp', data),

  gmailAuthorize: () => api.get<{ auth_url: string }>('/v1/email-accounts/gmail/authorize'),

  update: (id: string, data: { display_name?: string; is_default?: boolean }) =>
    api.patch<EmailAccount>(`/v1/email-accounts/${id}`, data),

  disconnect: (id: string) => api.delete(`/v1/email-accounts/${id}`),

  setDefault: (id: string) => api.post<EmailAccount>(`/v1/email-accounts/${id}/set-default`),

  testSend: (id: string) =>
    api.post<{ success: boolean; detail?: string }>(`/v1/email-accounts/${id}/test`),
}
