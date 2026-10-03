/**
 * useCopilotChat
 * Shared streaming chat hook used by both CopilotWidget (popup) and CopilotPage (full page).
 *
 * Responsibilities:
 *   - Send a message via SSE stream
 *   - Handle streaming callbacks (meta, chunk, approval, done, error)
 *   - Track pendingApproval state
 *   - Invalidate React Query caches after approvals
 */
import { useCallback, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { copilotApi } from '@/api/copilot'
import { useCopilotStore } from '@/store/useCopilotStore'
import { CONVERSATIONS_QUERY_KEY } from './useCopilotConversations'

interface UseCopilotChatOptions {
  /** Called after each turn on a brand-new conversation so the list refetches for the AI title. */
  onNewConversation?: () => void
}

export function useCopilotChat(options?: UseCopilotChatOptions) {
  const queryClient = useQueryClient()
  const {
    isThinking,
    setThinking,
    addMessage,
    pageContext,
    conversationId,
    setConversationId,
  } = useCopilotStore()

  const [pendingApproval, setPendingApproval] = useState<any>(null)
  const abortRef = useRef<AbortController | null>(null)

  const handleSend = useCallback(
    async (
      msg: string,
      history: { id: string; role: 'user' | 'assistant'; content: string }[],
      approvedToolCall?: any,
    ) => {
      const isApproval = !!approvedToolCall
      const text = msg.trim()
      if (!text && !isApproval) return
      if (isThinking) return

      const activeConvId = useCopilotStore.getState().conversationId
      const wasNew = !activeConvId

      addMessage({ role: 'user', content: isApproval ? '👍 Action Approved' : text })

      setThinking(true)
      setPendingApproval(null)

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      try {
        let messageAdded = false

        await copilotApi.chatStream(
          isApproval ? 'User approved the action. Please proceed.' : text,
          history.slice(-10),
          pageContext ?? undefined,
          activeConvId,
          approvedToolCall,
          controller.signal,
          {
            onMeta: (data) => {
              if (data.conversation_id) {
                setConversationId(data.conversation_id)
                if (wasNew && options?.onNewConversation) {
                  options.onNewConversation()
                }
              }
            },
            onChunk: (content) => {
              if (!messageAdded) {
                messageAdded = true
                setThinking(false)
                addMessage({ role: 'assistant', content: '' })
              }
              useCopilotStore.getState().updateLastMessageContent(content)
            },
            onStep: (step) => {
              if (!messageAdded) {
                messageAdded = true
                setThinking(false)
                addMessage({ role: 'assistant', content: '' })
              }
              useCopilotStore.getState().upsertLastMessageStep(step)
            },
            onApproval: (data) => {
              if (!messageAdded) {
                messageAdded = true
                setThinking(false)
                addMessage({ role: 'assistant', content: data.reply || 'I need your approval to proceed.' })
              }
              if (data.pending_tool_call) {
                setPendingApproval(data.pending_tool_call)
              }
            },
            onDone: () => {
              if (!messageAdded) setThinking(false)
              if (isApproval) {
                queryClient.invalidateQueries({ queryKey: ['candidates_pipeline'] })
                queryClient.invalidateQueries({ queryKey: ['candidates'] })
                queryClient.invalidateQueries({ queryKey: ['interviews'] })
                queryClient.invalidateQueries({ queryKey: ['recent-activities'] })
                queryClient.invalidateQueries({ queryKey: ['analytics-overview'] })
                queryClient.invalidateQueries({ queryKey: ['candidates-for-schedule'] })
              }
              // Refresh conversation list so titles and update timestamps are current
              queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY })
            },
            onError: (err) => {
              if (controller.signal.aborted) return
              const errMsg = err?.message || 'Sorry, I encountered an error. Please try again.'
              if (!messageAdded) {
                messageAdded = true
                setThinking(false)
                addMessage({ role: 'assistant', content: `⚠️ ${errMsg}` })
              } else {
                useCopilotStore.getState().updateLastMessageContent(`\n\n⚠️ ${errMsg}`)
              }
            },
          },
        )
      } finally {
        setThinking(false)
        useCopilotStore.getState().finishLastMessageSteps()
      }
    },
    [isThinking, pageContext, addMessage, setThinking, setConversationId, queryClient, options],
  )

  return { handleSend, pendingApproval, setPendingApproval, abortRef }
}
