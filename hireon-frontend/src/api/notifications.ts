import api from './axios'
import type { Notification } from '@/types'

export const notificationsApi = {
  list: (unreadOnly?: boolean) =>
    api.get<Notification[]>('/v1/notifications', { params: unreadOnly ? { unread_only: true } : undefined }),

  unreadCount: () => api.get<{ count: number }>('/v1/notifications/unread-count'),

  markRead: (id: string) => api.post(`/v1/notifications/${id}/read`),

  markAllRead: () => api.post('/v1/notifications/read-all'),

  delete: (id: string) => api.delete(`/v1/notifications/${id}`),
}
