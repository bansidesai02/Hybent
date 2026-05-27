import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '@/api/notifications'
import { useNotificationStore } from '@/store/notificationStore'
import { useEffect } from 'react'
import type { MessagePayload } from '@/hooks/firebase'

export function useNotifications({ enablePush = false }: { enablePush?: boolean } = {}) {
  const { setNotifications, setUnreadCount, markRead, markAllRead, addNotification } =
    useNotificationStore()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!enablePush) return

    let cancelled = false
    let unsubscribe: (() => void) | undefined
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined

    async function startPushNotifications() {
      const { requestNotificationPermission, onForegroundMessage } = await import('@/hooks/firebase')
      if (cancelled) return

      requestNotificationPermission(vapidKey ?? '').then(async (token: string | null) => {
        if (!token) return
        try {
          await import('@/api/axios').then(({ default: api }) =>
            api.post('/v1/notifications/fcm-token', { token })
          )
        } catch (err) {
          console.warn('[FCM] Failed to register token with backend:', err)
        }
      })

      unsubscribe = onForegroundMessage((payload: MessagePayload) => {
        const { title, body } = payload.notification ?? {}
        const data = payload.data ?? {}

        addNotification({
          id: data.id ?? crypto.randomUUID(),
          organization_id: data.organization_id ?? '',
          user_id: data.user_id ?? '',
          type: (data.type as import('@/types').NotificationType) ?? 'system',
          title: title ?? 'New Notification',
          message: body ?? '',
          data: null,
          is_read: false,
          read_at: null,
          created_at: new Date().toISOString(),
        })

        const isNoisy = (body ?? '').toLowerCase().includes('was view') || (title ?? '').toLowerCase().includes('was view')

        if (!isNoisy && Notification.permission === 'granted') {
          let avatarUrl = data.sender_avatar
          if (!avatarUrl) {
            const nameMatch = (title ?? '').match(/from\s+([^]+)/i) || (body ?? '').match(/from\s+([^]+)/i)
            const name = nameMatch ? nameMatch[1].trim() : 'User'
            avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6c47ff&color=fff&size=128`
          } else if (avatarUrl.startsWith('/')) {
            avatarUrl = window.location.origin + avatarUrl
          }

          new Notification(title ?? 'Hireon Notification', {
            body: body ?? '',
            icon: avatarUrl,
          })
        }

        queryClient.invalidateQueries({ queryKey: ['notifications'] })
      })
    }

    startPushNotifications()

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [addNotification, enablePush, queryClient])

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
