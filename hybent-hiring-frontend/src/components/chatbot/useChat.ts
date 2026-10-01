import { useState, useCallback, useRef } from 'react'
import type { ChatMessageItem } from './types'
import { assistantApi, type AssistantTurn } from '../../api/assistant'

const INITIAL_WELCOME_MESSAGE: ChatMessageItem = {
  id: 'welcome-1',
  sender: 'ai',
  text: `👋 Welcome to Hybent!

I am **Hybent AI**. Ask me anything about Hybent Hiring, our pricing, custom software services, or how to get in touch.`,
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  followups: [
    'What is Hybent Hiring?',
    'How much does it cost?',
    'Can you build custom software for us?',
    'How do I book a demo?',
  ],
}

const ERROR_REPLY =
  "Sorry, I couldn't reach the server just now. Please try again, or email **info@hybent.com**."

/** The conversation as the assistant API expects it (welcome message left out). */
function toTurns(messages: ChatMessageItem[]): AssistantTurn[] {
  return messages
    .filter((m) => m.id !== 'welcome-1' && m.text.trim() && (m.sender === 'user' || m.sender === 'ai'))
    .map((m) => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text.slice(0, 4000) }))
}

export function useChat(
  initialMessages?: ChatMessageItem[],
  onMessagesChange?: (messages: ChatMessageItem[]) => void
) {
  const [messages, setMessages] = useState<ChatMessageItem[]>(
    initialMessages || [INITIAL_WELCOME_MESSAGE]
  )
  const [isTyping, setIsTyping] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const activeStreamTimer = useRef<number | null>(null)

  const getTime = () =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const setAndSyncMessages = useCallback(
    (updater: (prev: ChatMessageItem[]) => ChatMessageItem[]) => {
      setMessages((prev) => {
        const next = updater(prev)
        if (onMessagesChange) onMessagesChange(next)
        return next
      })
    },
    [onMessagesChange]
  )

  // Bumped on every request, so a reply that lands after a newer question
  // (regenerate / edit mid-request) is dropped instead of shown.
  const requestSeq = useRef(0)

  /** Ask Hybent AI about the conversation `history` (ending with the visitor's
      message) and type the reply out word by word. */
  const respond = useCallback(
    async (history: ChatMessageItem[]) => {
      const seq = ++requestSeq.current
      setIsTyping(true)

      let reply = ERROR_REPLY
      let followups: string[] | undefined
      try {
        const res = await assistantApi.ask(toTurns(history).slice(-12))
        if (res?.reply) {
          reply = res.reply
          followups = res.followups?.length ? res.followups : undefined
        }
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status
        if (status === 429) reply = 'You are sending messages quickly. Please wait a minute and try again.'
      }
      if (seq !== requestSeq.current) return

      setIsTyping(false)
      setIsStreaming(true)

      const aiMessageId = `ai-${Date.now()}`
      setAndSyncMessages((prev) => [
        ...prev,
        { id: aiMessageId, sender: 'ai', text: '', timestamp: getTime(), isStreaming: true, followups },
      ])

      const words = reply.split(' ')
      let currentIndex = 0

      if (activeStreamTimer.current) {
        clearInterval(activeStreamTimer.current)
      }

      activeStreamTimer.current = window.setInterval(() => {
        if (currentIndex < words.length) {
          const nextText = words.slice(0, currentIndex + 1).join(' ')
          setAndSyncMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMessageId ? { ...msg, text: nextText } : msg
            )
          )
          currentIndex++
        } else {
          if (activeStreamTimer.current) {
            clearInterval(activeStreamTimer.current)
            activeStreamTimer.current = null
          }
          setAndSyncMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMessageId ? { ...msg, isStreaming: false } : msg
            )
          )
          setIsStreaming(false)
        }
      }, 30)
    },
    [setAndSyncMessages]
  )

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isStreaming || isTyping) return

      const userMsg: ChatMessageItem = {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: trimmed,
        timestamp: getTime(),
      }

      setAndSyncMessages((prev) => [...prev, userMsg])
      respond([...messages, userMsg])
    },
    [isStreaming, isTyping, messages, respond, setAndSyncMessages]
  )

  const regenerateResponse = useCallback(() => {
    if (isStreaming || messages.length === 0) return

    const lastUserIndex = [...messages].reverse().findIndex((m) => m.sender === 'user')
    if (lastUserIndex !== -1) {
      const actualIndex = messages.length - 1 - lastUserIndex
      const kept = messages.slice(0, actualIndex + 1)

      setAndSyncMessages(() => kept)
      respond(kept)
    }
  }, [isStreaming, messages, setAndSyncMessages, respond])

  const editAndResendMessage = useCallback(
    (oldMsgId: string, newText: string) => {
      const index = messages.findIndex((m) => m.id === oldMsgId)
      if (index === -1) return

      const updatedUserMsg: ChatMessageItem = {
        ...messages[index],
        text: newText,
        timestamp: getTime(),
      }
      const kept = [...messages.slice(0, index), updatedUserMsg]

      setAndSyncMessages(() => kept)
      respond(kept)
    },
    [messages, setAndSyncMessages, respond]
  )

  const toggleLike = useCallback(
    (msgId: string) => {
      setAndSyncMessages((prev) =>
        prev.map((m) =>
          m.id === msgId ? { ...m, liked: !m.liked, disliked: false } : m
        )
      )
    },
    [setAndSyncMessages]
  )

  const toggleDislike = useCallback(
    (msgId: string) => {
      setAndSyncMessages((prev) =>
        prev.map((m) =>
          m.id === msgId ? { ...m, disliked: !m.disliked, liked: false } : m
        )
      )
    },
    [setAndSyncMessages]
  )

  return {
    messages,
    setMessages,
    isTyping,
    isStreaming,
    sendMessage,
    regenerateResponse,
    editAndResendMessage,
    toggleLike,
    toggleDislike,
  }
}
