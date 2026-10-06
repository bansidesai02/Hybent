import api from './axios'

export interface ChatAttachment {
  id: string
  file_name: string
  mime_type: string
  size_bytes: number
  created_at: string
}

export interface Message {
  id: string
  sender_id: string
  receiver_id: string | null
  group_id?: string | null
  content: string
  is_read: boolean
  created_at: string
  attachments?: ChatAttachment[]
  /** Group messages only */
  sender_name?: string | null
  sender_avatar?: string | null
}

export interface ConversationSummary {
  other_user_id: string
  other_user_full_name: string
  other_user_avatar_url: string | null
  last_message: string
  last_message_at: string
  unread_count: number
}

export type ChatGroupRole = 'owner' | 'admin' | 'member'

export interface ChatGroup {
  id: string
  name: string
  description: string | null
  created_by: string | null
  is_archived: boolean
  created_at: string
  member_count: number
  my_role: ChatGroupRole | 'none'
  can_add_members: boolean
  can_manage: boolean
  last_message: string | null
  last_message_at: string | null
  last_message_sender_name: string | null
  unread_count: number
}

export interface ChatGroupMember {
  user_id: string
  full_name: string
  email: string
  avatar_url: string | null
  user_role: string
  role: ChatGroupRole
  joined_at: string
}

export interface ChatGroupDetail extends ChatGroup {
  members: ChatGroupMember[]
}

/** Strict per-file limit, enforced again by the server. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
export const MAX_ATTACHMENTS_PER_MESSAGE = 5
export const ALLOWED_ATTACHMENT_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt', '.ppt', '.pptx',
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.zip',
]

export const messagesApi = {
  getConversations: () => api.get<ConversationSummary[]>('/v1/messages/conversations'),

  getMessages: (otherUserId: string, params?: { limit?: number; offset?: number }) =>
    api.get<Message[]>(`/v1/messages/${otherUserId}`, { params }),

  sendMessage: (data: { receiver_id: string; content: string; attachment_ids?: string[] }) =>
    api.post<Message>('/v1/messages', data),

  markAsRead: (otherUserId: string) =>
    api.post(`/v1/messages/${otherUserId}/read`),
}

export const chatApi = {
  uploadAttachment: (file: File, onProgress?: (pct: number) => void, signal?: AbortSignal) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<ChatAttachment>('/v1/chat/attachments', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      signal,
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100))
      },
    })
  },

  getAttachmentUrl: (attachmentId: string, download = false) =>
    api.get<{ url: string; expires_in: number }>(`/v1/chat/attachments/${attachmentId}/url`, {
      params: download ? { download: true } : undefined,
    }),

  listGroups: () => api.get<ChatGroup[]>('/v1/chat/groups'),

  getGroup: (groupId: string) => api.get<ChatGroupDetail>(`/v1/chat/groups/${groupId}`),

  createGroup: (data: { name: string; description?: string; member_ids: string[] }) =>
    api.post<ChatGroupDetail>('/v1/chat/groups', data),

  updateGroup: (groupId: string, data: { name?: string; description?: string; is_archived?: boolean }) =>
    api.patch<ChatGroupDetail>(`/v1/chat/groups/${groupId}`, data),

  addMembers: (groupId: string, userIds: string[]) =>
    api.post<ChatGroupDetail>(`/v1/chat/groups/${groupId}/members`, { user_ids: userIds }),

  removeMember: (groupId: string, userId: string) =>
    api.delete(`/v1/chat/groups/${groupId}/members/${userId}`),

  setMemberRole: (groupId: string, userId: string, role: 'admin' | 'member') =>
    api.patch(`/v1/chat/groups/${groupId}/members/${userId}`, { role }),

  getGroupMessages: (groupId: string, params?: { before?: string; limit?: number }) =>
    api.get<Message[]>(`/v1/chat/groups/${groupId}/messages`, { params }),

  sendGroupMessage: (groupId: string, data: { content: string; attachment_ids?: string[] }) =>
    api.post<Message>(`/v1/chat/groups/${groupId}/messages`, data),

  markGroupRead: (groupId: string) => api.post(`/v1/chat/groups/${groupId}/read`),
}
