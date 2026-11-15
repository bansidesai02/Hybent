import api from './axios'
import type { EmailMessage, EmailMessageDetail } from '@/types'

export interface InboxAccountSummary {
  id: string
  email_address: string
  provider: string
  /** connected | reauth_required | error */
  status?: string
  /** A company mailbox someone else connected. */
  shared?: boolean
  last_synced_at?: string | null
  /** Every older resume has been brought in. */
  history_done?: boolean
}

/** A mailbox the caller can open: their own, or a company one. */
export interface InboxMailbox {
  id: string
  email_address: string
  is_default: boolean
  shared?: boolean
  status?: string
}

export type InboxView = 'all' | 'candidates' | 'review' | 'processing'

export interface InboxListResponse {
  account: InboxAccountSummary | null
  messages: EmailMessage[]
  mailboxes: InboxMailbox[]
  counts: Partial<Record<InboxView, number>>
}

export interface SendEmailPayload {
  to: string[]
  cc?: string[]
  subject: string
  body: string
  reply_to_message_id?: string
}

export const inboxApi = {
  // `account_id` picks a mailbox; omitted = the caller's own, else the company's.
  list: (params?: { limit?: number; offset?: number; account_id?: string; view?: InboxView }) =>
    api.get<InboxListResponse>('/v1/inbox', { params }),

  sync: (accountId?: string) =>
    api.post<{ new_count: number; history_done: boolean }>('/v1/inbox/sync', null, { params: { account_id: accountId } }),

  get: (messageId: string, accountId?: string) =>
    api.get<EmailMessageDetail>(`/v1/inbox/${messageId}`, { params: { account_id: accountId } }),

  /** Send or reply through the connected Gmail; it also lands in Gmail's Sent. */
  send: (payload: SendEmailPayload, accountId?: string) =>
    api.post('/v1/inbox/send', payload, { params: { account_id: accountId } }),

  /** Process an email's resumes again on the next run. */
  retry: (messageId: string, accountId?: string) =>
    api.post(`/v1/inbox/${messageId}/retry`, null, { params: { account_id: accountId } }),

  /** One attachment's bytes, fetched live from the mailbox. */
  downloadAttachment: (messageId: string, index: number, accountId?: string) =>
    api.get<Blob>(`/v1/inbox/${messageId}/attachments/${index}`, {
      responseType: 'blob',
      params: { account_id: accountId },
    }),
}
