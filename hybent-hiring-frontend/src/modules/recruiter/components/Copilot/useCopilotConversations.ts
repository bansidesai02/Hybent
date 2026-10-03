/**
 * useCopilotConversations
 * React Query-backed hook for the conversation list.
 * Shared by CopilotWidget (popup history panel) and CopilotPage (full sidebar).
 */
import { useCallback, useState } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { copilotApi } from '@/api/copilot'
import type { ConversationSummary, ConversationDetail } from '@/api/copilot'
import { useCopilotStore } from '@/store/useCopilotStore'
import { groupConversationsByDate } from './conversationUtils'

export const CONVERSATIONS_QUERY_KEY = ['copilot', 'conversations'] as const

export function useCopilotConversations() {
  const queryClient = useQueryClient()
  const { conversationId, setMessages, setConversationId, startNewConversation } = useCopilotStore()

  // ── Infinite list ─────────────────────────────────────────────────────────
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery({
    queryKey: CONVERSATIONS_QUERY_KEY,
    queryFn: ({ pageParam = 1 }) => copilotApi.getConversations(pageParam as number, 20).then((r) => r.data),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === 20 ? allPages.length + 1 : undefined,
    initialPageParam: 1,
    staleTime: 30_000,
  })

  const conversations: ConversationSummary[] = data?.pages.flat() ?? []
  const grouped = groupConversationsByDate(conversations)

  // ── Load a conversation into the store ────────────────────────────────────
  const [convLoading, setConvLoading] = useState(false)

  const loadConversation = useCallback(
    async (id: string): Promise<ConversationDetail | null> => {
      setConvLoading(true)
      try {
        const res = await copilotApi.getConversation(id)
        const detail = res.data
        const mapped = detail.messages.map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))
        setMessages(mapped)
        setConversationId(id)
        return detail
      } catch {
        return null
      } finally {
        setConvLoading(false)
      }
    },
    [setMessages, setConversationId],
  )

  // ── Delete one conversation ───────────────────────────────────────────────
  const [deletingConvId, setDeletingConvId] = useState<string | null>(null)

  const deleteMutation = useMutation({
    mutationFn: (id: string) => copilotApi.deleteConversation(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData(CONVERSATIONS_QUERY_KEY, (old: any) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((page: ConversationSummary[]) => page.filter((c) => c.id !== id)),
        }
      })
      if (conversationId === id) startNewConversation()
    },
    onSettled: () => setDeletingConvId(null),
  })

  const deleteConversation = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation()
      if (deletingConvId) return
      setDeletingConvId(id)
      deleteMutation.mutate(id)
    },
    [deletingConvId, deleteMutation],
  )

  // ── Delete all conversations ──────────────────────────────────────────────
  const [clearingAll, setClearingAll] = useState(false)

  const deleteAllMutation = useMutation({
    mutationFn: () => copilotApi.deleteAllConversations(),
    onSuccess: () => {
      queryClient.setQueryData(CONVERSATIONS_QUERY_KEY, { pages: [[]], pageParams: [1] })
      startNewConversation()
    },
    onSettled: () => setClearingAll(false),
  })

  const deleteAll = useCallback(async () => {
    if (clearingAll) return
    setClearingAll(true)
    deleteAllMutation.mutate()
  }, [clearingAll, deleteAllMutation])

  // ── Refetch list after a new conversation is created (for AI title) ───────
  const scheduleRefetchForNewTitle = useCallback(() => {
    // After ~3 s the background title task should have completed
    setTimeout(() => queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY }), 3000)
  }, [queryClient])

  return {
    conversations,
    grouped,
    isLoading,
    convLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    loadConversation,
    deleteConversation,
    deletingConvId,
    deleteAll,
    clearingAll,
    scheduleRefetchForNewTitle,
  }
}
