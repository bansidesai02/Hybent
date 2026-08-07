import axios from './axios'
import type { ChatMessage, PageContext } from '@/store/useCopilotStore'
import { tokenStorage } from '@/utils/tokenStorage'

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

  /** Stream chat using native fetch & Server-Sent Events (SSE) */
  chatStream: async (
    message: string,
    history: ChatMessage[],
    page_context?: PageContext,
    conversation_id?: string | null,
    approved_tool_call?: any,
    signal?: AbortSignal,
    callbacks?: {
      onMeta?: (meta: any) => void
      onChunk?: (content: string) => void
      onApproval?: (approvalData: any) => void
      onDone?: () => void
      onError?: (err: any) => void
    }
  ) => {
    const apiHistory: ApiMessage[] = history.map(({ role, content }) => ({ role, content }))
    const token = tokenStorage.getAccessToken()
    const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
    
    try {
      const response = await fetch(`${BASE_URL}/v1/copilot/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          message,
          history: apiHistory,
          page_context: page_context ?? null,
          conversation_id: conversation_id ?? null,
          approved_tool_call: approved_tool_call ?? null,
        }),
        signal
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      if (!response.body) throw new Error("No response body")

      const reader = response.body.getReader()
      const decoder = new TextDecoder("utf-8")
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line)
              if (data.type === 'meta' && callbacks?.onMeta) callbacks.onMeta(data)
              else if (data.type === 'chunk' && callbacks?.onChunk) callbacks.onChunk(data.content)
              else if (data.type === 'approval' && callbacks?.onApproval) callbacks.onApproval(data)
              else if (data.type === 'done' && callbacks?.onDone) callbacks.onDone()
            } catch (e) {
              console.error("Failed to parse SSE chunk", e)
            }
          }
        }
      }
      
      if (buffer.trim()) {
        try {
           const data = JSON.parse(buffer)
           if (data.type === 'meta' && callbacks?.onMeta) callbacks.onMeta(data)
           else if (data.type === 'chunk' && callbacks?.onChunk) callbacks.onChunk(data.content)
           else if (data.type === 'approval' && callbacks?.onApproval) callbacks.onApproval(data)
           else if (data.type === 'done' && callbacks?.onDone) callbacks.onDone()
        } catch(e) {}
      }
    } catch (err) {
      if (callbacks?.onError) callbacks.onError(err)
    }
  },

  /** Clean speech transcript using LLM */
  cleanTranscript: (text: string) => {
    return axios.post<{ text: string }>('/v1/copilot/clean-transcript', { text })
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

  /** Delete all conversations and messages. */
  deleteAllConversations: () =>
    axios.delete('/v1/copilot/conversations'),

  /** Transcribe audio file to text. */
  transcribe: (audioBlob: Blob) => {
    const formData = new FormData()
    formData.append('file', audioBlob, 'recording.webm')
    return axios.post<{ text: string }>('/v1/copilot/transcribe', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}
