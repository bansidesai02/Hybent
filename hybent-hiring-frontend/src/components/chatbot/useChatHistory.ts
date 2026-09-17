import { useState, useEffect, useCallback, useMemo } from 'react'
import type { ConversationItem, ChatMessageItem } from './types'

const STORAGE_KEY = 'hybent_ai_conversations_v1'

const INITIAL_WELCOME_MESSAGE: ChatMessageItem = {
  id: 'welcome-1',
  sender: 'ai',
  text: `👋 Welcome to Hybent.

I'm Hybent AI.

I can help you explore our products, services, hiring solutions, and answer any questions.`,
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
}

export function useChatHistory() {
  const [conversations, setConversations] = useState<ConversationItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
        }
      }
    } catch {
      // Storage unavailable fallback
    }

    // Default initial conversation
    const defaultConv: ConversationItem = {
      id: `conv-${Date.now()}`,
      title: 'Welcome to Hybent AI',
      messages: [INITIAL_WELCOME_MESSAGE],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    return [defaultConv]
  })

  const [activeId, setActiveId] = useState<string>(() => conversations[0]?.id || '')
  const [searchQuery, setSearchQuery] = useState('')

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations))
    } catch {
      // Ignore
    }
  }, [conversations])

  // Get active conversation
  const activeConversation = useMemo(() => {
    return conversations.find((c) => c.id === activeId) || conversations[0]
  }, [conversations, activeId])

  // Update active conversation's messages
  const updateActiveMessages = useCallback(
    (newMessages: ChatMessageItem[]) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === activeId) {
            // Auto generate title from first user message if title is default
            let newTitle = c.title
            const firstUserMsg = newMessages.find((m) => m.sender === 'user')
            if (firstUserMsg && c.title === 'Welcome to Hybent AI') {
              newTitle =
                firstUserMsg.text.length > 28
                  ? `${firstUserMsg.text.slice(0, 28)}...`
                  : firstUserMsg.text
            }

            const lastMsg = newMessages[newMessages.length - 1]
            const previewText = lastMsg ? lastMsg.text.slice(0, 60) : ''

            return {
              ...c,
              title: newTitle,
              messages: newMessages,
              updatedAt: Date.now(),
              previewText,
            }
          }
          return c
        })
      )
    },
    [activeId]
  )

  // Create new conversation
  const createNewConversation = useCallback(() => {
    const freshId = `conv-${Date.now()}`
    const newConv: ConversationItem = {
      id: freshId,
      title: 'New Conversation',
      messages: [
        {
          ...INITIAL_WELCOME_MESSAGE,
          id: `welcome-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    setConversations((prev) => [newConv, ...prev])
    setActiveId(freshId)
    return freshId
  }, [])

  // Switch conversation
  const switchConversation = useCallback((id: string) => {
    setActiveId(id)
  }, [])

  // Rename
  const renameConversation = useCallback((id: string, newTitle: string) => {
    const trimmed = newTitle.trim()
    if (!trimmed) return
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: trimmed } : c))
    )
  }, [])

  // Delete
  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => {
        const filtered = prev.filter((c) => c.id !== id)
        if (id === activeId && filtered.length > 0) {
          setActiveId(filtered[0].id)
        }
        return filtered
      })
    },
    [activeId]
  )

  // Duplicate
  const duplicateConversation = useCallback((id: string) => {
    setConversations((prev) => {
      const target = prev.find((c) => c.id === id)
      if (!target) return prev

      const dupId = `conv-${Date.now()}`
      const dupConv: ConversationItem = {
        ...target,
        id: dupId,
        title: `${target.title} (Copy)`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      return [dupConv, ...prev]
    })
  }, [])

  // Pin
  const togglePin = useCallback((id: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isPinned: !c.isPinned } : c))
    )
  }, [])

  // Archive
  const toggleArchive = useCallback((id: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isArchived: !c.isArchived } : c))
    )
  }, [])

  // Filtered & Grouped conversations for search
  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return conversations.filter((c) => !c.isArchived)

    return conversations.filter((c) => {
      const titleMatch = c.title.toLowerCase().includes(query)
      const messageMatch = c.messages.some((m) =>
        m.text.toLowerCase().includes(query)
      )
      return titleMatch || messageMatch
    })
  }, [conversations, searchQuery])

  // Time grouping: Today, Yesterday, Previous 7 Days, Older
  const groupedConversations = useMemo(() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000
    const sevenDaysStart = todayStart - 7 * 24 * 60 * 60 * 1000

    const pinned = filteredConversations.filter((c) => c.isPinned)
    const unpinned = filteredConversations.filter((c) => !c.isPinned)

    const today: ConversationItem[] = []
    const yesterday: ConversationItem[] = []
    const previous7Days: ConversationItem[] = []
    const older: ConversationItem[] = []

    unpinned.forEach((c) => {
      if (c.updatedAt >= todayStart) {
        today.push(c)
      } else if (c.updatedAt >= yesterdayStart) {
        yesterday.push(c)
      } else if (c.updatedAt >= sevenDaysStart) {
        previous7Days.push(c)
      } else {
        older.push(c)
      }
    })

    return { pinned, today, yesterday, previous7Days, older }
  }, [filteredConversations])

  return {
    conversations,
    activeConversation,
    activeId,
    searchQuery,
    setSearchQuery,
    groupedConversations,
    updateActiveMessages,
    createNewConversation,
    switchConversation,
    renameConversation,
    deleteConversation,
    duplicateConversation,
    togglePin,
    toggleArchive,
  }
}
