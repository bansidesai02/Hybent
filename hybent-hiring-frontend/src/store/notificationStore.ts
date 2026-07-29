import { create } from 'zustand'
import type { Notification } from '@/types'

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  setNotifications: (n: Notification[]) => void
  addNotification: (n: Notification) => void
  setUnreadCount: (count: number) => void
  markRead: (id: string) => void
  markAllRead: () => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,

  setNotifications: (notifications) => set({ notifications }),

  addNotification: (notification) =>
    set((state) => {
      const exists = state.notifications.some((n) => n.id === notification.id)
      let newList
      let unreadDelta = 0

      if (exists) {
        newList = state.notifications.map((n) =>
          n.id === notification.id ? notification : n
        )
      } else {
        newList = [notification, ...state.notifications]
        unreadDelta = notification.is_read ? 0 : 1
      }

      newList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      return {
        notifications: newList,
        unreadCount: state.unreadCount + unreadDelta,
      }
    }),

  setUnreadCount: (unreadCount) => set({ unreadCount }),

  markRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, is_read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),

  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    })),
}))
