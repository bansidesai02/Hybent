import api from './axios'
import type { EmailMessage, EmailMessageDetail } from '@/types'

export interface InboxAccountSummary {
  id: string
  email_address: string
  provider: string
}

/** One of the caller's own connected Gmail mailboxes. */
export interface InboxMailbox {
  id: string
  email_address: string
  is_default: boolean
}

export interface InboxListResponse {
  account: InboxAccountSummary | null
  messages: EmailMessage[]
  /** The caller's own readable mailboxes, for switching between them. */
  mailboxes: InboxMailbox[]
}

export const inboxApi = {
  // `account_id` picks one of the caller's own mailboxes; omitted = their primary.
  list: (params?: { limit?: number; offset?: number; account_id?: string }) =>
    api.get<InboxListResponse>('/v1/inbox', { params }),

  sync: (accountId?: string) =>
    api.post<{ new_count: number }>('/v1/inbox/sync', null, { params: { account_id: accountId } }),

  get: (messageId: string, accountId?: string) =>
    api.get<EmailMessageDetail>(`/v1/inbox/${messageId}`, { params: { account_id: accountId } }),

  /** One attachment's bytes, fetched live from the mailbox. */
  downloadAttachment: (messageId: string, index: number, accountId?: string) =>
    api.get<Blob>(`/v1/inbox/${messageId}/attachments/${index}`, {
      responseType: 'blob',
      params: { account_id: accountId },
    }),
}
