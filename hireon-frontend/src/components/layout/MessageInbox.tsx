import { useState, useRef, useEffect } from 'react'
import { useMessageStore } from '@/store/messageStore'
import { messagesApi } from '@/api/messages'
import { Avatar } from '@/components/ui/Avatar'
import { timeAgo } from '@/utils/formatters'
import { motion, AnimatePresence } from 'framer-motion'

export function MessageInbox() {
  const [open, setOpen] = useState(false)
  const inboxRef = useRef<HTMLDivElement>(null)
  const { conversations, unreadCount, setConversations, setUnreadCount, openChat } = useMessageStore()

  // Fetch conversations on load and when opening
  useEffect(() => {
    loadConversations()
  }, [])

  const loadConversations = async () => {
    try {
      const res = await messagesApi.getConversations()
      setConversations(res.data)
      const totalUnread = res.data.reduce((acc, curr) => acc + curr.unread_count, 0)
      setUnreadCount(totalUnread)
    } catch (err) {
      console.error('Failed to load conversations', err)
    }
  }

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
  }, [open])

  return (
    <div className="relative" ref={inboxRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        title="Messages"
      >
        <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-violet-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold shadow-sm ring-2 ring-white dark:ring-gray-900">
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
            className="absolute right-0 top-12 w-80 bg-white dark:bg-gray-900 rounded-2x border border-gray-200 dark:border-gray-800 shadow-2xl z-50 overflow-hidden"
            style={{ borderRadius: '24px' }}
          >
            <div className="p-4 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/30">
              <h3 className="text-sm font-black text-gray-900 dark:text-white">Active Chats</h3>
              <span className="text-[10px] uppercase tracking-wider font-bold text-violet-500">Real-time</span>
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
              {conversations.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="text-xs text-gray-400">No active conversations</p>
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
                    className="w-full flex items-center gap-3 p-4 hover:bg-violet-50 dark:hover:bg-violet-900/10 transition-all text-left group"
                  >
                    <div className="relative flex-shrink-0">
                      <Avatar name={c.other_user_full_name} src={c.other_user_avatar_url || ''} size="md" />
                      {c.unread_count > 0 && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-violet-600 rounded-full border-2 border-white dark:border-gray-900" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-[13px] font-bold text-gray-900 dark:text-white truncate group-hover:text-violet-600 transition-colors">
                          {c.other_user_full_name}
                        </p>
                        <span className="text-[10px] text-gray-400">{timeAgo(c.last_message_at)}</span>
                      </div>
                      <p className={`text-xs truncate ${c.unread_count > 0 ? 'font-black text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>
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
