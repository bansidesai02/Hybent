import api from './axios'
import type { Notification } from '@/types'

export const notificationsApi = {
  list: (unreadOnly?: boolean) =>
    api.get<Notification[]>('/v1/notifications', { params: unreadOnly ? { unread_only: true } : undefined }),

  unreadCount: () => api.get<{ count: number }>('/v1/notifications/unread-count'),

  markRead: (id: string) => api.post(`/v1/notifications/${id}/read`),

  markAllRead: () => api.post('/v1/notifications/read-all'),

  /** Mark only these notification types read (e.g. new applicants once Candidates is opened). */
  markTypesRead: (types: string[]) => api.post('/v1/notifications/read-all', null, { params: { types: types.join(',') } }),

  delete: (id: string) => api.delete(`/v1/notifications/${id}`),
}
