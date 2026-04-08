import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '@/api/notifications'
import { useNotificationStore } from '@/store/notificationStore'
import { useEffect } from 'react'
import toast from 'react-hot-toast'
import { ActivityToast } from '@/components/notifications/ActivityToast'
import {
  requestNotificationPermission,
  onForegroundMessage,
  type MessagePayload,
} from '@/hooks/firebase'

export function useNotifications() {
  const { setNotifications, setUnreadCount, markRead, markAllRead, addNotification } =
    useNotificationStore()
  const queryClient = useQueryClient()

  // ── Firebase Cloud Messaging ──────────────────────────────────────────────
  useEffect(() => {
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined

    // Request permission and register the FCM token
    requestNotificationPermission(vapidKey ?? '').then(async (token: string | null) => {
      if (token) {
        console.log('[FCM] Registration token:', token)
        // Register token with the backend so it can send OS push notifications
        try {
          await import('@/api/axios').then(({ default: api }) =>
            api.post('/v1/notifications/fcm-token', { token })
          )
          console.log('[FCM] Token registered with backend.')
        } catch (err) {
          console.warn('[FCM] Failed to register token with backend:', err)
        }
      }
    })

    // Listen for foreground messages and push them into the notification bell
    const unsubscribe = onForegroundMessage((payload: MessagePayload) => {
      console.log('[FCM] Foreground message:', payload)
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

      // Removed: In-app toast.custom trigger was completely deleted since WebSockets (which are ultra-low-latency) 
      // already generate in-app toasts natively on connection. Foreground FCM pushing duplicates was causing the 
      // user to see a barrage of stale "queued" push toasts rendering on app load.

      // Trigger Native browser popup (visible when in another app)
      if (Notification.permission === 'granted') {
        new Notification(title ?? 'Hireon Notification', {
          body: body ?? '',
          icon: '/favicon.svg',
        })
      }

      // Also refresh the server-side list so unread count stays in sync
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    })

    return () => unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // ─────────────────────────────────────────────────────────────────────────

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
