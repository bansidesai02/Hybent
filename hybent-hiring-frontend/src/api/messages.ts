import api from './axios'
import type { PaginatedResponse } from '@/types'

export interface Message {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  is_read: boolean
  created_at: string
}

export interface ConversationSummary {
  other_user_id: string
  other_user_full_name: string
  other_user_avatar_url: string | null
  last_message: string
  last_message_at: string
  unread_count: number
}

export const messagesApi = {
  getConversations: () => api.get<ConversationSummary[]>('/v1/messages/conversations'),
  
  getMessages: (otherUserId: string, params?: { limit?: number; offset?: number }) =>
    api.get<Message[]>(`/v1/messages/${otherUserId}`, { params }),
    
  sendMessage: (data: { receiver_id: string; content: string }) =>
    api.post<Message>('/v1/messages', data),
    
  markAsRead: (otherUserId: string) =>
    api.post(`/v1/messages/${otherUserId}/read`),
}
