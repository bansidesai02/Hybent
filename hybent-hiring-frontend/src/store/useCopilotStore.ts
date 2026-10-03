import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ── Shared domain types — exported for API client and widget ──────────────────
export interface PageContext {
  candidate_id?: string
  candidate_name?: string
  job_id?: string
}

/** One live progress step streamed by the agent ("Searching candidates · python"). */
export interface CopilotStep {
  id: string
  label?: string
  state: 'running' | 'done' | 'error'
  detail?: string
  /** Set for tool steps; absent for the "thinking" steps between them. */
  tool?: string
}

export interface ChatMessage {
  id: string                    // stable local ID — used as React key
  role: 'user' | 'assistant'
  content: string
  steps?: CopilotStep[]
  startedAt?: number
  finishedAt?: number
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
  updateLastMessageContent: (content: string) => void
  /** Add or update a step on the last (assistant) message. */
  upsertLastMessageStep: (step: CopilotStep) => void
  /** Stream ended: stamp the finish time and close any step left running. */
  finishLastMessageSteps: () => void
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

      updateLastMessageContent: (content) =>
        set((s) => {
          if (s.messages.length === 0) return s
          const newMessages = [...s.messages]
          const lastIndex = newMessages.length - 1
          newMessages[lastIndex] = {
            ...newMessages[lastIndex],
            content: newMessages[lastIndex].content + content
          }
          return { messages: newMessages }
        }),

      upsertLastMessageStep: (step) =>
        set((s) => {
          const last = s.messages[s.messages.length - 1]
          if (!last || last.role !== 'assistant') return s
          const steps = [...(last.steps ?? [])]
          const i = steps.findIndex((st) => st.id === step.id)
          if (i === -1) steps.push(step)
          else steps[i] = { ...steps[i], ...Object.fromEntries(Object.entries(step).filter(([, v]) => v !== undefined)) }
          const messages = [...s.messages]
          messages[messages.length - 1] = { ...last, steps, startedAt: last.startedAt ?? Date.now() }
          return { messages }
        }),

      finishLastMessageSteps: () =>
        set((s) => {
          const last = s.messages[s.messages.length - 1]
          if (!last || last.role !== 'assistant' || !last.steps || last.finishedAt) return s
          const messages = [...s.messages]
          messages[messages.length - 1] = {
            ...last,
            finishedAt: Date.now(),
            steps: last.steps.map((st) => (st.state === 'running' ? { ...st, state: 'done' as const } : st)),
          }
          return { messages }
        }),

      // Used when loading a conversation from history (API response)
      setMessages: (msgs) => set({ messages: msgs }),

      setConversationId: (id) => set({ conversationId: id }),

      startNewConversation: () =>
        set({ messages: [], conversationId: null }),

      setPageContext: (ctx) => set({ pageContext: ctx }),
    }),
    {
      name: 'hybent_hiring_copilot',
      // Only persist UI state + conversationId — NOT messages (DB is source of truth)
      partialize: (s) => ({
        isOpen: s.isOpen,
        conversationId: s.conversationId,
      }),
    }
  )
)
