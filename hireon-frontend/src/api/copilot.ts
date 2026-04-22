import axios from './axios'
import type { ChatMessage, PageContext } from '@/store/useCopilotStore'

// ── Response Types ────────────────────────────────────────────────────────────

export interface CopilotChatResponse {
  reply: string
  error: boolean
  conversation_id: string | null
  requires_approval?: boolean
  pending_tool_call?: any
}

export interface ConversationSummary {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface ConversationDetail extends ConversationSummary {
  messages: ConversationMessage[]
}

// ── API-layer message (strips internal id field — backend doesn't need it) ───
type ApiMessage = { role: 'user' | 'assistant'; content: string }

// ── Copilot API ────────────────────────────────────────────────────────────────
export const copilotApi = {
  /** Send a chat message. Optionally link to an existing conversation. */
  chat: (
    message: string,
    history: ChatMessage[],
    page_context?: PageContext,
    conversation_id?: string | null,
    approved_tool_call?: any,
    signal?: AbortSignal
  ) => {
    const apiHistory: ApiMessage[] = history.map(({ role, content }) => ({ role, content }))
    return axios.post<CopilotChatResponse>(
      '/v1/copilot/chat',
      {
        message,
        history: apiHistory,
        page_context: page_context ?? null,
        conversation_id: conversation_id ?? null,
        approved_tool_call: approved_tool_call ?? null,
      },
      { signal }
    )
  },

  /** List past conversations (newest first, paginated). */
  getConversations: (page = 1, limit = 20) =>
    axios.get<ConversationSummary[]>('/v1/copilot/conversations', {
      params: { page, limit },
    }),

  /** Load a specific conversation with all its messages. */
  getConversation: (conversationId: string) =>
    axios.get<ConversationDetail>(`/v1/copilot/conversations/${conversationId}`),

  /** Delete a conversation and all its messages. */
  deleteConversation: (conversationId: string) =>
    axios.delete(`/v1/copilot/conversations/${conversationId}`),

  /** Transcribe audio file to text. */
  transcribe: (audioBlob: Blob) => {
    const formData = new FormData()
    formData.append('file', audioBlob, 'recording.webm')
    return axios.post<{ text: string }>('/v1/copilot/transcribe', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}
