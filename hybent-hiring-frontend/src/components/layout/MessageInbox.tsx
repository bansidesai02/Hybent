import { memo, useState, useRef, useEffect, useCallback } from 'react'
import { useMessageStore } from '@/store/messageStore'
import { messagesApi } from '@/api/messages'
import { Avatar } from '@/components/hb'
import { timeAgo } from '@/utils/formatters'
import { motion, AnimatePresence } from 'framer-motion'

function MessageInboxComponent() {
  const [open, setOpen] = useState(false)
  const inboxRef = useRef<HTMLDivElement>(null)
  const { conversations, unreadCount, setConversations, setUnreadCount, openChat } = useMessageStore()

  const loadConversations = useCallback(async () => {
    try {
      const res = await messagesApi.getConversations()
      setConversations(res.data)
      const totalUnread = res.data.reduce((acc, curr) => acc + curr.unread_count, 0)
      setUnreadCount(totalUnread)
    } catch (err) {
      console.error('Failed to load conversations', err)
    }
  }, [setConversations, setUnreadCount])

  // Handle click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (inboxRef.current && !inboxRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      loadConversations() // refresh on open
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, loadConversations])

  return (
    <div className="relative" ref={inboxRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl hover:bg-hb-surface-2 transition-colors"
        title="Messages"
      >
        <svg className="w-5 h-5 text-hb-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-hb-grad font-mono text-hb-micro font-bold text-white ring-2 ring-hb-surface">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            className="fixed left-4 right-4 top-16 z-50 w-[calc(100vw-32px)] overflow-hidden rounded-hb-lg border border-hb-border bg-hb-elevated shadow-hb-2 sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-80"
          >
            <div className="p-4 border-b border-hb-border flex items-center justify-between bg-hb-surface-2">
              <h3 className="text-sm font-black text-hb-text">Active Chats</h3>
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-hb-border">
              {conversations.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="text-xs text-hb-dim">No active conversations</p>
                </div>
              ) : (
                conversations.map((c) => (
                  <button
                    key={c.other_user_id}
                    onClick={() => {
                      setOpen(false)
                      openChat({
                        id: c.other_user_id,
                        full_name: c.other_user_full_name,
                        avatar_url: c.other_user_avatar_url
                      })
                    }}
                    className="w-full flex items-center gap-3 p-4 hover:bg-[rgb(var(--hb-blue))]/5 transition-all text-left group"
                  >
                    <div className="relative flex-shrink-0">
                      <Avatar name={c.other_user_full_name} src={c.other_user_avatar_url || ''} size="md" />
                      {c.unread_count > 0 && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-[rgb(var(--hb-blue))] rounded-full border-2 border-hb-elevated" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="truncate text-hb-sm font-semibold text-hb-text transition-colors duration-hb group-hover:text-hb-blue">
                          {c.other_user_full_name}
                        </p>
                        <span className="text-hb-micro text-hb-dim">{timeAgo(c.last_message_at)}</span>
                      </div>
                      <p className={`text-xs truncate ${c.unread_count > 0 ? 'font-black text-hb-text' : 'text-hb-muted'}`}>
                        {c.last_message}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export const MessageInbox = memo(MessageInboxComponent)
