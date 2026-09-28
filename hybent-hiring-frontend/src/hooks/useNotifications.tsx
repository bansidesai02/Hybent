import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '@/api/notifications'
import { useNotificationStore } from '@/store/notificationStore'

/**
 * The in-app notification bell's data. Notifications are shown only inside
 * Hybent (the bell panel and in-app toasts): no browser permission prompt,
 * no Firebase push, no OS pop-ups.
 */
export function useNotifications() {
  const { setNotifications, setUnreadCount, markRead, markAllRead } = useNotificationStore()
  const queryClient = useQueryClient()

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await notificationsApi.list()
      setNotifications(data)
      return data
    },
  })

  const { data: countData } = useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: async () => {
      const { data } = await notificationsApi.unreadCount()
      setUnreadCount(data.count)
      return data
    },
  })

  const markReadMutation = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: (_, id) => {
      markRead(id)
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      markAllRead()
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  return {
    notifications,
    unreadCount: countData?.count ?? 0,
    markRead: markReadMutation.mutate,
    markAllRead: markAllReadMutation.mutate,
  }
}
