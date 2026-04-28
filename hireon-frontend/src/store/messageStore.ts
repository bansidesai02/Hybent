import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ConversationSummary } from '@/api/messages'

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
}

export const useMessageStore = create<MessageState>()(
  persist(
    (set, get) => ({
      conversations: [],
      unreadCount: 0,
      activeChatRecipient: null,

      setConversations: (conversations) => set({ conversations }),
      setUnreadCount: (unreadCount) => set({ unreadCount }),
      
      openChat: (recipient) => set({ activeChatRecipient: recipient }),
      closeChat: () => set({ activeChatRecipient: null }),

      addOrUpdateConversation: (msg) => {
        const { conversations } = get()
        const existingIdx = conversations.findIndex(c => c.other_user_id === msg.sender_id)
        
        const newConversations = [...conversations]
        if (existingIdx > -1) {
          const existing = newConversations[existingIdx]
          newConversations[existingIdx] = {
            ...existing,
            last_message: msg.content,
            last_message_at: msg.created_at,
            unread_count: existing.unread_count + 1
          }
        } else {
          newConversations.unshift({
            other_user_id: msg.sender_id,
            other_user_full_name: msg.sender_name,
            other_user_avatar_url: msg.sender_avatar,
            last_message: msg.content,
            last_message_at: msg.created_at,
            unread_count: 1
          })
        }
        
        // Sort by date
        newConversations.sort((a, b) => 
          new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
        )
        
        set({ 
          conversations: newConversations,
          unreadCount: get().unreadCount + 1
        })
      }
    }),
    {
      name: 'hireon-messages-storage',
      partialize: (state) => ({ unreadCount: state.unreadCount }), // only persist count for now
    }
  )
)
