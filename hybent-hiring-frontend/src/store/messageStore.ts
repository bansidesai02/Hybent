import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ChatGroup, ConversationSummary } from '@/api/messages'
import { useAuthStore } from './authStore'

interface MessageState {
  conversations: ConversationSummary[]
  unreadCount: number
  activeChatRecipient: {
    id: string
    full_name: string
    avatar_url?: string | null
  } | null
  
  groups: ChatGroup[]
  /** Group open in the chat panel. Mutually exclusive with activeChatRecipient. */
  activeGroup: { id: string; name: string } | null

  setConversations: (conversations: ConversationSummary[]) => void
  setGroups: (groups: ChatGroup[]) => void
  upsertGroup: (group: ChatGroup) => void
  removeGroup: (groupId: string) => void
  openGroup: (group: { id: string; name: string }) => void
  /** Apply a realtime group_message event to the thread list and unread count. */
  applyGroupMessage: (msg: any) => void
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
      groups: [],
      activeGroup: null,

      setConversations: (conversations) => set({ conversations }),
      setGroups: (groups) => set({ groups }),
      upsertGroup: (group) => {
        const groups = get().groups.filter((g) => g.id !== group.id)
        set({ groups: [group, ...groups] })
      },
      removeGroup: (groupId) => {
        const { groups, unreadCount, activeGroup } = get()
        const gone = groups.find((g) => g.id === groupId)
        set({
          groups: groups.filter((g) => g.id !== groupId),
          unreadCount: Math.max(0, unreadCount - (gone?.unread_count ?? 0)),
          activeGroup: activeGroup?.id === groupId ? null : activeGroup,
        })
      },
      openGroup: (group) => {
        const { groups, unreadCount } = get()
        const g = groups.find((x) => x.id === group.id)
        set({
          activeGroup: group,
          activeChatRecipient: null,
          groups: groups.map((x) => (x.id === group.id ? { ...x, unread_count: 0 } : x)),
          unreadCount: Math.max(0, unreadCount - (g?.unread_count ?? 0)),
        })
      },
      applyGroupMessage: (msg) => {
        const { groups, unreadCount, activeGroup } = get()
        const currentUser = useAuthStore.getState().user
        const idx = groups.findIndex((g) => g.id === msg.group_id)
        if (idx === -1) return // unknown group: the caller refetches the list
        const isMine = msg.sender_id === currentUser?.id
        const isOpen = activeGroup?.id === msg.group_id
        const bump = !isMine && !isOpen
        const updated = {
          ...groups[idx],
          last_message: msg.preview ?? msg.content,
          last_message_at: msg.created_at,
          last_message_sender_name: msg.sender_name,
          unread_count: bump ? groups[idx].unread_count + 1 : isOpen ? 0 : groups[idx].unread_count,
        }
        set({
          groups: [updated, ...groups.filter((_, i) => i !== idx)],
          unreadCount: unreadCount + (bump ? 1 : 0),
        })
      },
      setUnreadCount: (unreadCount) => set({ unreadCount }),
      
      openChat: (recipient) => {
        set({ activeChatRecipient: recipient, activeGroup: null })
        get().markAsRead(recipient.id)
      },
      closeChat: () => set({ activeChatRecipient: null, activeGroup: null }),

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
        
        const newConversations = [...conversations]
        let unreadDiff = 0

        if (existingIdx > -1) {
          const existing = newConversations[existingIdx]
          // Only increment unread if someone else sent it and chat isn't open
          const shouldIncrement = !isMeSender && !isCurrentlyOpen
          const newUnread = shouldIncrement ? existing.unread_count + 1 : (isCurrentlyOpen ? 0 : existing.unread_count)
          unreadDiff = shouldIncrement ? 1 : 0
          
          newConversations[existingIdx] = {
            ...existing,
            last_message: msg.preview ?? msg.content,
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
            last_message: msg.preview ?? msg.content,
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
