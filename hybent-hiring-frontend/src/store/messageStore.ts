import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ConversationSummary } from '@/api/messages'
import { useAuthStore } from './authStore'

interface MessageState {
  conversations: ConversationSummary[]
  unreadCount: number
  activeChatRecipient: {
    id: string
    full_name: string
    avatar_url?: string | null
  } | null
  
  setConversations: (conversations: ConversationSummary[]) => void
  setUnreadCount: (count: number) => void
  openChat: (recipient: { id: string; full_name: string; avatar_url?: string | null }) => void
  closeChat: () => void
  addOrUpdateConversation: (msg: any) => void
  markAsRead: (otherUserId: string) => void
}

export const useMessageStore = create<MessageState>()(
  persist(
    (set, get) => ({
      conversations: [],
      unreadCount: 0,
      activeChatRecipient: null,

      setConversations: (conversations) => set({ conversations }),
      setUnreadCount: (unreadCount) => set({ unreadCount }),
      
      openChat: (recipient) => {
        set({ activeChatRecipient: recipient })
        get().markAsRead(recipient.id)
      },
      closeChat: () => set({ activeChatRecipient: null }),

      markAsRead: (otherUserId) => {
        const { conversations, unreadCount } = get()
        const idx = conversations.findIndex(c => c.other_user_id === otherUserId)
        if (idx === -1) return

        const conversation = conversations[idx]
        if (conversation.unread_count === 0) return

        const newConversations = [...conversations]
        newConversations[idx] = { ...conversation, unread_count: 0 }
        
        set({ 
          conversations: newConversations,
          unreadCount: Math.max(0, unreadCount - conversation.unread_count)
        })
      },

      addOrUpdateConversation: (msg) => {
        const { conversations, unreadCount, activeChatRecipient } = get()
        const currentUser = useAuthStore.getState().user
        
        const isMeSender = msg.sender_id === currentUser?.id
        const otherUserId = isMeSender ? msg.receiver_id : msg.sender_id
        
        const isCurrentlyOpen = activeChatRecipient?.id === otherUserId
        
        const existingIdx = conversations.findIndex(c => c.other_user_id === otherUserId)
        
        let newConversations = [...conversations]
        let unreadDiff = 0

        if (existingIdx > -1) {
          const existing = newConversations[existingIdx]
          // Only increment unread if someone else sent it and chat isn't open
          const shouldIncrement = !isMeSender && !isCurrentlyOpen
          const newUnread = shouldIncrement ? existing.unread_count + 1 : (isCurrentlyOpen ? 0 : existing.unread_count)
          unreadDiff = shouldIncrement ? 1 : 0
          
          newConversations[existingIdx] = {
            ...existing,
            last_message: msg.content,
            last_message_at: msg.created_at,
            unread_count: newUnread
          }
        } else {
          const shouldIncrement = !isMeSender && !isCurrentlyOpen
          unreadDiff = shouldIncrement ? 1 : 0
          newConversations.unshift({
            other_user_id: otherUserId,
            other_user_full_name: isMeSender ? (msg.receiver_name || 'User') : msg.sender_name,
            other_user_avatar_url: isMeSender ? msg.receiver_avatar : msg.sender_avatar,
            last_message: msg.content,
            last_message_at: msg.created_at,
            unread_count: shouldIncrement ? 1 : 0
          })
        }
        
        // Sort by date
        newConversations.sort((a, b) => 
          new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
        )
        
        set({ 
          conversations: newConversations,
          unreadCount: Math.max(0, unreadCount + unreadDiff)
        })
      }
    }),
    {
      name: 'hybent-hiring-messages-storage',
      partialize: (state) => ({ unreadCount: state.unreadCount }), // only persist count for now
    }
  )
)
