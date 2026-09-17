import api from './axios'
import type { EmailMessage, EmailMessageDetail } from '@/types'

export interface InboxAccountSummary {
  id: string
  email_address: string
  provider: string
}

export interface InboxListResponse {
  account: InboxAccountSummary | null
  messages: EmailMessage[]
}

export const inboxApi = {
  list: (params?: { limit?: number; offset?: number }) =>
    api.get<InboxListResponse>('/v1/inbox', { params }),

  sync: () => api.post<{ new_count: number }>('/v1/inbox/sync'),

  get: (messageId: string) => api.get<EmailMessageDetail>(`/v1/inbox/${messageId}`),
}
