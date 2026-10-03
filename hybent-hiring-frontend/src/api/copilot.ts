import axios, { refreshAccessToken } from './axios'
import type { ChatMessage, CopilotStep, PageContext } from '@/store/useCopilotStore'
import { tokenStorage } from '@/utils/tokenStorage'
import { getApiBaseUrl } from '@/config/api'
import { createSmoothStream } from './smoothStream'

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
  /** Restored from last_context.pending_action — null when no action is awaiting approval. */
  pending_tool_call: { name: string; args: Record<string, any>; id: string } | null
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
      onStep?: (step: CopilotStep) => void
      onApproval?: (approvalData: any) => void
      onDone?: () => void
      onError?: (err: any) => void
    }
  ) => {
    const apiHistory: ApiMessage[] = history.map(({ role, content }) => ({ role, content }))
    const BASE_URL = getApiBaseUrl()
    const body = JSON.stringify({
      message,
      history: apiHistory,
      page_context: page_context ?? null,
      conversation_id: conversation_id ?? null,
      approved_tool_call: approved_tool_call ?? null,
    })
    const send = (token: string | null) =>
      fetch(`${BASE_URL}/v1/copilot/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body,
        signal
      })

    try {
      let response = await send(tokenStorage.getAccessToken())

      // This is a plain fetch, so the axios auto-refresh never sees its 401:
      // refresh the expired access token here and retry once.
      if (response.status === 401) {
        try {
          response = await send(await refreshAccessToken())
        } catch {
          throw new Error('Your session has expired. Please log in again.')
        }
      }

      if (!response.ok) {
        throw new Error(
          response.status === 402 || response.status === 429
            ? 'AI credits or request limit reached. Please try again later.'
            : `Copilot couldn't respond (error ${response.status}). Please try again.`
        )
      }

      if (!response.body) throw new Error("No response body")

      const reader = response.body.getReader()
      const decoder = new TextDecoder("utf-8")
      let buffer = ""

      // Text is revealed at a steady typewriter pace; steps / approval / done
      // wait their turn behind it so the UI never runs ahead of the words.
      const smooth = createSmoothStream((text) => callbacks?.onChunk?.(text))
      signal?.addEventListener('abort', () => smooth.stop(), { once: true })

      const dispatch = (raw: string) => {
        if (!raw.trim()) return
        let data: any
        try {
          data = JSON.parse(raw)
        } catch (e) {
          console.error("Failed to parse SSE chunk", e)
          return
        }
        if (data.type === 'meta') callbacks?.onMeta?.(data)
        else if (data.type === 'chunk') smooth.text(data.content)
        else if (data.type === 'step') {
          const { type: _type, ...step } = data
          smooth.event(() => callbacks?.onStep?.(step as CopilotStep))
        }
        else if (data.type === 'approval') smooth.event(() => callbacks?.onApproval?.(data))
        else if (data.type === 'done') smooth.event(() => callbacks?.onDone?.())
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ""
        lines.forEach(dispatch)
      }
      dispatch(buffer)

      // Callers treat "chatStream resolved" as "reply finished on screen".
      await smooth.drain()
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
