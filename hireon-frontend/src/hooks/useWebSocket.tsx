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

    const ws = new WebSocket(`${WS_BASE}/v1/notifications/ws?token=${accessToken}`)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[WS] Connected')
      // Sync missed notifications during connection/reconnection
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications', 'count'] })
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'event') {
          if (msg.event === 'notification' && msg.data) {
            addNotification(msg.data)

            // Sync React Query state immediately
            queryClient.invalidateQueries({ queryKey: ['notifications'] })
            queryClient.invalidateQueries({ queryKey: ['notifications', 'count'] })

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
              new Notification(msg.data.title || 'Hireon Notification', {
                body: msg.data.message || '',
                icon: '/favicon.svg',
              })
            }
          }
          if (msg.event === 'unread_count') {
            setUnreadCount(msg.data.count)
          }
          if (msg.event === 'activity_created' && msg.data) {
            const { user } = useAuthStore.getState()
            const isPortal = window.location.pathname.startsWith('/portal')
            const isInterviewer = window.location.pathname.startsWith('/interviewer')

            // Relevance check for candidates
            const isRelevantToCandidate = isPortal && user?.candidate_id && msg.data.resource_id === user.candidate_id
            const isRelevantToInterviewer = isInterviewer && msg.data.user_id === user?.id
            const isRecruiterOrAdmin = !isPortal && !isInterviewer

            // Only proceed if it's a recruiter OR a relevant portal/interviewer event
            if (!isRecruiterOrAdmin && !isRelevantToCandidate && !isRelevantToInterviewer) {
              return
            }

            addActivity(msg.data)

            // Generate fallback text if activity 'message' is missing on the raw event
            let activityMessage = msg.data.message;
            if (!activityMessage) {
              const resType = msg.data.resource_type || 'Resource';
              const action = msg.data.action || 'updated';
              activityMessage = `${resType.charAt(0).toUpperCase() + resType.slice(1)} was ${action.toLowerCase()}`;
            }

            const enhancedPayload = { ...msg.data, message: activityMessage };

            // Skip noisy notifications like simply viewing a candidate profile
            const isViewAction =
              (msg.data.action && typeof msg.data.action === 'string' && ['view', 'viewed'].includes(msg.data.action.toLowerCase().trim())) ||
              (activityMessage && typeof activityMessage === 'string' && activityMessage.toLowerCase().includes('was view'));

            if (!isViewAction) {
              // Trigger WhatsApp-style popup (in-app)
              toast.custom((t) => (
                <ActivityToast t={t} payload={enhancedPayload} />
              ), { id: `activity-${msg.data.id || Date.now()}`, duration: 5000 })

              // Trigger Native browser popup (visible when in another app)
              if (Notification.permission === 'granted') {
                new Notification('New Activity', {
                  body: activityMessage,
                  icon: '/favicon.svg',
                })
              }
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
              queryClient.invalidateQueries({ queryKey: ['notifications', 'count'] })
            }

            // Always refresh recent activities
            queryClient.invalidateQueries({ queryKey: ['recent-activities'] })
          }

          if (msg.event === 'new_message' && msg.data) {
            // Update global message store
            useMessageStore.getState().addOrUpdateConversation(msg.data)

            // Dispatch custom event for ChatPanel (if it's already open for this user)
            window.dispatchEvent(new CustomEvent('ws:new_message', { detail: msg.data }))

            // Only show toast and notification if the message is from someone else
            const { user: currentUser } = useAuthStore.getState()
            if (msg.data.sender_id !== currentUser?.id) {
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

              // Trigger Native browser popup for chat specifically
              if (Notification.permission === 'granted' && document.hidden) {
                let avatarUrl = msg.data.sender_avatar;
                if (!avatarUrl) {
                  const encodedName = encodeURIComponent(msg.data.sender_name || 'User');
                  avatarUrl = `https://ui-avatars.com/api/?name=${encodedName}&background=6c47ff&color=fff&size=128`;
                } else if (avatarUrl.startsWith('/')) {
                  avatarUrl = window.location.origin + avatarUrl;
                }

                new Notification(`Message from ${msg.data.sender_name}`, {
                  body: msg.data.content,
                  icon: avatarUrl,
                })
              }
            }
          }

          if (msg.event === 'messages_read' && msg.data) {
            // Dispatch custom event for ChatPanel to update ticks to blue
            window.dispatchEvent(new CustomEvent('ws:messages_read', { detail: msg.data }))
          }
        }
      } catch (_) { /* ignore */ }
    }

    ws.onclose = (e) => {
      // 4001 is our custom code for "Authentication failed (Expired or Invalid Token)"
      if (e.code === 4001) {
        console.warn('[WS] Authentication failed. Retrying in 5s (waiting for background token refresh)...')
        reconnectTimeout.current = setTimeout(connect, 5000)
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
