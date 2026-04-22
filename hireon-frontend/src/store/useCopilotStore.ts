import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ── Shared domain types — exported for API client and widget ──────────────────
export interface PageContext {
  candidate_id?: string
  candidate_name?: string
  job_id?: string
}

export interface ChatMessage {
  id: string                    // stable local ID — used as React key
  role: 'user' | 'assistant'
  content: string
}

// ── Simple ID generator ───────────────────────────────────────────────────────
function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

// ── Store shape ───────────────────────────────────────────────────────────────
interface CopilotState {
  isOpen: boolean
  isThinking: boolean
  messages: ChatMessage[]           // in-memory cache of the active conversation
  pageContext: PageContext | null
  conversationId: string | null     // which DB conversation is active

  open: () => void
  close: () => void
  toggle: () => void
  setThinking: (v: boolean) => void
  addMessage: (msg: Omit<ChatMessage, 'id'>) => void
  setMessages: (msgs: ChatMessage[]) => void
  setConversationId: (id: string | null) => void
  startNewConversation: () => void   // clears messages + conversationId
  setPageContext: (ctx: PageContext | null) => void
}

export const useCopilotStore = create<CopilotState>()(
  persist(
    (set) => ({
      isOpen: false,
      isThinking: false,
      messages: [],
      pageContext: null,
      conversationId: null,

      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
      setThinking: (v) => set({ isThinking: v }),

      addMessage: (msg) =>
        set((s) => ({
          messages: [...s.messages, { ...msg, id: genId() }],
        })),

      // Used when loading a conversation from history (API response)
      setMessages: (msgs) => set({ messages: msgs }),

      setConversationId: (id) => set({ conversationId: id }),

      startNewConversation: () =>
        set({ messages: [], conversationId: null }),

      setPageContext: (ctx) => set({ pageContext: ctx }),
    }),
    {
      name: 'hireon_copilot',
      // Only persist UI state + conversationId — NOT messages (DB is source of truth)
      partialize: (s) => ({
        isOpen: s.isOpen,
        conversationId: s.conversationId,
      }),
    }
  )
)
