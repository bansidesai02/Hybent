import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { useNotificationStore } from '@/store/notificationStore'
import { useActivityStore } from '@/store/activityStore'
import { useMessageStore } from '@/store/messageStore'
import toast from 'react-hot-toast'
import { ActivityToast } from '@/components/notifications/ActivityToast'

const getWsBase = () => {
  const { protocol, host } = window.location
  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:'
  const baseUrl = import.meta.env.VITE_API_BASE_URL || `${wsProtocol}//${host}`
  return baseUrl.startsWith('http') ? baseUrl.replace('http', 'ws') : baseUrl
}

const WS_BASE = getWsBase()

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>()
  const { accessToken, isAuthenticated } = useAuthStore()
  const { addNotification, setUnreadCount } = useNotificationStore()
  const { addActivity } = useActivityStore()
  const queryClient = useQueryClient()

  const connect = useCallback(() => {
    if (!accessToken || !isAuthenticated) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(`${WS_BASE}/ws/?token=${accessToken}`)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[WS] Connected')
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'event') {
          if (msg.event === 'notification' && msg.data) {
            addNotification(msg.data)
            
            // Trigger WhatsApp-style popup (in-app)
            toast.custom((t) => (
              <ActivityToast 
                t={t} 
                payload={{
                  action: msg.data.type || 'notification',
                  resource_type: 'notification',
                  message: msg.data.message || 'New notification',
                  timestamp: new Date().toISOString()
                }} 
              />
            ), { id: `ws-notif-${msg.data.id || Date.now()}`, duration: 5000 })

            // Trigger Native browser popup (visible when in another app)
            if (Notification.permission === 'granted') {
              new Notification(msg.data.title || 'HireOn Notification', {
                body: msg.data.message || '',
                icon: '/favicon.svg',
              })
            }
          }
          if (msg.event === 'unread_count') {
            setUnreadCount(msg.data.count)
          }
          if (msg.event === 'activity_created' && msg.data) {
            addActivity(msg.data)
            
            // Trigger WhatsApp-style popup (in-app)
            toast.custom((t) => (
              <ActivityToast t={t} payload={msg.data} />
            ), { id: `activity-${msg.data.id || Date.now()}`, duration: 5000 })

            // Trigger Native browser popup (visible when in another app)
            if (Notification.permission === 'granted') {
              new Notification('New Activity', {
                body: msg.data.message || 'A new activity occurred',
                icon: '/favicon.svg',
              })
            }
            
            // Invalidate queries based on resource type
            const resourceType = msg.data.resource_type
            if (resourceType === 'candidate') {
              queryClient.invalidateQueries({ queryKey: ['candidates'] })
              queryClient.invalidateQueries({ queryKey: ['candidates_pipeline'] })
              queryClient.invalidateQueries({ queryKey: ['talent-pool'] })
              queryClient.invalidateQueries({ queryKey: ['talent-pool-stats'] })
              queryClient.invalidateQueries({ queryKey: ['talent-pool-suggestions'] })
            } else if (resourceType === 'job') {
              queryClient.invalidateQueries({ queryKey: ['jobs'] })
              queryClient.invalidateQueries({ queryKey: ['active-jobs'] })
            } else if (resourceType === 'application') {
              queryClient.invalidateQueries({ queryKey: ['candidates'] })
              queryClient.invalidateQueries({ queryKey: ['candidates_pipeline'] })
              queryClient.invalidateQueries({ queryKey: ['talent-pool-stats'] })
              queryClient.invalidateQueries({ queryKey: ['overview-stats'] })
            } else if (resourceType === 'interview') {
              queryClient.invalidateQueries({ queryKey: ['interviews'] })
              queryClient.invalidateQueries({ queryKey: ['recent-interviews'] })
              queryClient.invalidateQueries({ queryKey: ['interviewer-interviews'] })
            } else if (resourceType === 'offer') {
              queryClient.invalidateQueries({ queryKey: ['offers'] })
            } else if (resourceType === 'notification') {
              queryClient.invalidateQueries({ queryKey: ['notifications'] })
              queryClient.invalidateQueries({ queryKey: ['unread_notifications_count'] })
            }
            
            // Always refresh recent activities
            queryClient.invalidateQueries({ queryKey: ['recent-activities'] })
          }

          if (msg.event === 'new_message' && msg.data) {
            // Update global message store
            useMessageStore.getState().addOrUpdateConversation(msg.data)
            
            // Dispatch custom event for ChatPanel (if it's already open for this user)
            window.dispatchEvent(new CustomEvent('ws:new_message', { detail: msg.data }))
            
            // Show interactive toast
            toast.success(
              (t) => (
                <div 
                  className="flex flex-col cursor-pointer"
                  onClick={() => {
                    toast.dismiss(t.id)
                    useMessageStore.getState().openChat({
                      id: msg.data.sender_id,
                      full_name: msg.data.sender_name,
                      avatar_url: msg.data.sender_avatar
                    })
                  }}
                >
                  <span className="font-bold">New message from {msg.data.sender_name}</span>
                  <span className="text-xs truncate max-w-[200px]">{msg.data.content}</span>
                </div>
              ),
              {
                id: `msg-notif-${msg.data.id || Date.now()}`,
                icon: '💬',
                duration: 5000,
              }
            )
          }
        }
      } catch (_) { /* ignore */ }
    }

    ws.onclose = (e) => {
      if (e.code === 4001) {
        console.warn('[WS] Authentication failed (Expired or Invalid Token). Stopping reconnection.')
        return
      }
      console.log('[WS] Disconnected, reconnecting in 3s...', e.reason)
      reconnectTimeout.current = setTimeout(connect, 3000)
    }

    ws.onerror = () => {
      ws.close()
    }

    // Keep-alive ping every 30s
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send('ping')
    }, 30000)

    ws.addEventListener('close', () => clearInterval(pingInterval))
  }, [accessToken, isAuthenticated, addNotification, setUnreadCount, addActivity, queryClient])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimeout.current)
      wsRef.current?.close()
    }
  }, [connect])
}
