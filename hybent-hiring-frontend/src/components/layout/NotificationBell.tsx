import { memo, useState, useRef, useEffect, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle,
  Eye,
  FileText,
  Loader2,
  MessageCircle,
  RefreshCw,
  Target,
  Trophy,
} from 'lucide-react'

import { useNotifications } from '@/hooks/useNotifications'
import { useNotificationStore } from '@/store/notificationStore'
import { timeAgo } from '@/utils/formatters'
import type { NotificationType } from '@/types'

/**
 * The header bell and its five-most-recent dropdown.
 *
 * Rebuilt on the design system in phase 10. The old version mapped each
 * notification type to a differently-tinted `GlassIcon` (seven colourways for
 * one kind of thing), injected a `<style>` tag per render for its ping
 * animation, and painted the badge in `#7c3aed` — a violet that is not in the
 * palette. The type icon is now a plain glyph; unread is the only state that
 * carries colour.
 */

function notifIcon(type: NotificationType): ReactNode {
  switch (type) {
    case 'shortlisted': return <Target size={15} />
    case 'interview_scheduled':
    case 'interview_updated': return <CalendarDays size={15} />
    case 'interview_cancelled':
    case 'interview_reminder': return <AlertTriangle size={15} />
    case 'offer_sent':
    case 'offer_received':
    case 'offer_accepted': return <Trophy size={15} />
    case 'profile_viewed': return <Eye size={15} />
    case 'stage_updated':
    case 'stage_changed': return <RefreshCw size={15} />
    case 'message_received': return <MessageCircle size={15} />
    case 'application_received': return <FileText size={15} />
    case 'feedback_reminder': return <CheckCircle size={15} />
    default: return <Bell size={15} />
  }
}

function NotificationBellComponent() {
  const [open, setOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)
  const { markRead, markAllRead } = useNotifications({ enablePush: open })
  const { notifications } = useNotificationStore()

  // `markRead`/`markAllRead` are bare `mutation.mutate` functions (the hook
  // exposes no `isPending`), so the re-entry guard is hand-rolled here: a ref
  // checked synchronously before the mutation fires, reset via the mutate
  // call's own per-call `onSettled` option, plus local state to drive the
  // spinner/disabled visuals.
  const markingAllRef = useRef(false)
  const [markingAllRead, setMarkingAllRead] = useState(false)
  const markingIdsRef = useRef<Set<string>>(new Set())
  const [markingIds, setMarkingIds] = useState<Set<string>>(new Set())

  const handleMarkAllRead = () => {
    if (markingAllRef.current) return
    markingAllRef.current = true
    setMarkingAllRead(true)
    markAllRead(undefined, {
      onSettled: () => {
        markingAllRef.current = false
        setMarkingAllRead(false)
      },
    })
  }

  const handleMarkRead = (id: string) => {
    if (markingIdsRef.current.has(id)) return
    markingIdsRef.current.add(id)
    setMarkingIds(new Set(markingIdsRef.current))
    markRead(id, {
      onSettled: () => {
        markingIdsRef.current.delete(id)
        setMarkingIds(new Set(markingIdsRef.current))
      },
    })
  }

  // Only show the latest 5 notifications and count unread among them
  const displayNotifications = notifications.slice(0, 5)
  const displayUnreadCount = displayNotifications.filter((n) => !n.is_read).length

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="relative" ref={bellRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-hb-sm p-2 text-hb-muted transition-colors duration-hb hover:bg-hb-surface-2 hover:text-hb-text focus-visible:outline-none focus-visible:shadow-hb-ring"
        aria-label={
          displayUnreadCount > 0
            ? `Notifications, ${displayUnreadCount} unread`
            : 'Notifications'
        }
        aria-expanded={open}
      >
        <Bell size={20} aria-hidden strokeWidth={2} />

        {displayUnreadCount > 0 && (
          <span aria-hidden className="absolute -right-0.5 -top-0.5 grid place-items-center">
            <span className="absolute h-[18px] w-[18px] animate-ping rounded-full bg-hb-blue opacity-60" />
            <span className="relative grid h-[18px] w-[18px] place-items-center rounded-full bg-hb-grad font-mono text-hb-micro font-bold text-white">
              {displayUnreadCount > 9 ? '9+' : displayUnreadCount}
            </span>
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="fixed left-4 right-4 top-16 z-40 w-[calc(100vw-32px)] overflow-hidden rounded-hb-lg border border-hb-border bg-hb-elevated shadow-hb-2 sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-80"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-hb-border px-4 py-3">
              <div className="flex items-center gap-2">
                <h3 className="text-hb-sm font-semibold text-hb-text">Notifications</h3>
                {displayUnreadCount > 0 && (
                  <span className="rounded-hb-full bg-hb-blue/10 px-2 py-0.5 font-mono text-hb-micro font-bold text-hb-blue">
                    {displayUnreadCount} new
                  </span>
                )}
              </div>
              {displayUnreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={markingAllRead}
                  className="flex items-center gap-1 text-hb-xs font-semibold text-hb-cyan transition-colors duration-hb hover:text-hb-text disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {markingAllRead && <Loader2 size={11} className="animate-spin" aria-hidden />}
                  Mark all read
                </button>
              )}
            </div>

            {/* Notification list */}
            <div className="max-h-80 divide-y divide-hb-border overflow-y-auto">
              {!notifications?.length ? (
                <div className="py-10 text-center">
                  <Bell size={32} aria-hidden className="mx-auto mb-2 text-hb-dim opacity-40" />
                  <p className="text-hb-sm text-hb-muted">No notifications yet</p>
                </div>
              ) : (
                displayNotifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => { if (!n.is_read) handleMarkRead(n.id) }}
                    disabled={markingIds.has(n.id)}
                    className={`w-full px-4 py-3 text-left transition-colors duration-hb hover:bg-hb-surface-2 disabled:cursor-not-allowed disabled:opacity-70 ${
                      !n.is_read ? 'bg-hb-blue/[0.05]' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 shrink-0 text-hb-cyan">
                        {markingIds.has(n.id) ? (
                          <Loader2 size={15} className="animate-spin" aria-hidden />
                        ) : (
                          notifIcon(n.type)
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-1.5">
                          {!n.is_read && (
                            <span
                              aria-hidden
                              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-hb-blue"
                            />
                          )}
                          <p className="text-hb-xs font-semibold text-hb-text">
                            {n.title}
                            {!n.is_read && <span className="sr-only">, unread</span>}
                          </p>
                        </div>
                        <p className="mt-0.5 text-hb-xs leading-snug text-hb-muted">{n.message}</p>
                        <p className="mt-1 text-hb-micro text-hb-dim">{timeAgo(n.created_at)}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export const NotificationBell = memo(NotificationBellComponent)
