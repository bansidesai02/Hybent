import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { useNotificationStore } from '@/store/notificationStore'
import { useActivityStore } from '@/store/activityStore'
import { useMessageStore } from '@/store/messageStore'
import toast from 'react-hot-toast'
import { ActivityToast } from '@/components/notifications/ActivityToast'

import { getApiBaseUrl } from '@/config/api'

const getWsBase = () => {
  const { protocol, host } = window.location
  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:'
  const apiBase = getApiBaseUrl()
  if (apiBase && apiBase.startsWith('http')) {
    return apiBase.replace(/^https/, 'wss').replace(/^http/, 'ws')
  }
  return `${wsProtocol}//${host}`
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
            // Notifications stay inside Hybent (this toast and the bell panel);
            // no browser/OS pop-ups.
          }
          if (msg.event === 'candidate_ingested' && msg.data) {
            // Sent by email ingestion after the candidate is committed, to
            // the whole org — including whoever connected the mailbox,
            // whom the generic activity broadcast skips as the "actor".
            if (window.location.pathname.startsWith('/portal')) return

            queryClient.invalidateQueries({ queryKey: ['candidates'] })
            queryClient.invalidateQueries({ queryKey: ['candidates_pipeline'] })
            queryClient.invalidateQueries({ queryKey: ['talent-pool'] })
            queryClient.invalidateQueries({ queryKey: ['talent-pool-stats'] })
            queryClient.invalidateQueries({ queryKey: ['overview-stats'] })
            queryClient.invalidateQueries({ queryKey: ['inbox'] })

            const name = msg.data.full_name || 'A new candidate'
            toast.custom((t) => (
              <ActivityToast
                t={t}
                payload={{
                  action: 'CREATE',
                  resource_type: 'candidate',
                  message: `${name} was added from email and is waiting for review`,
                  timestamp: new Date().toISOString(),
                }}
              />
            ), { id: `ingested-${msg.data.candidate_id}`, duration: 5000 })
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

            // Activity events only refresh data and the activity feed. They are
            // raw audit-log entries ("candidate resume_view", "candidate create"),
            // not notifications, so they never pop up; real notifications
            // arrive as the 'notification' event above and in the bell panel.

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
