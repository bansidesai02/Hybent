import { useState, type ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  Check,
  CheckCircle,
  ClipboardList,
  Eye,
  FileText,
  Inbox,
  Loader2,
  MessageSquare,
  RefreshCw,
  Target,
  Trophy,
  X,
} from 'lucide-react'

import { notificationsApi } from '@/api/notifications'
import { useNotificationStore } from '@/store/notificationStore'
import { timeAgo } from '@/utils/formatters'
import type { Notification, NotificationType } from '@/types'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FilterChips,
  IconTile,
  PageHeader,
  Skeleton,
} from '@/components/hb'

/**
 * The candidate's notification inbox.
 *
 * Rebuilt on the design system in phase 7. The old page mapped every
 * notification type to its own gradient + border tint — eleven colourways for
 * what is one kind of thing, a message. The type is named in the kicker; the
 * only state that earns emphasis is unread, which gets the brand-tinted border
 * and dot. Also gone: a `<style>` tag injected per render for the hover
 * shadow, and `element.style` writes from the dismiss button's mouse events.
 */

type FilterTab = 'unread' | 'interviews' | 'applications' | 'offers'

const FILTERS: Array<{ value: FilterTab; label: string }> = [
  { value: 'unread', label: 'Unread' },
  { value: 'interviews', label: 'Interviews' },
  { value: 'applications', label: 'Applications' },
  { value: 'offers', label: 'Offers' },
]

function notifMeta(type: NotificationType): { icon: ReactNode; label: string } {
  switch (type) {
    case 'shortlisted':
      return { icon: <Target />, label: 'Shortlisted' }
    case 'interview_scheduled':
    case 'interview_updated':
      return { icon: <CalendarDays />, label: 'Interview' }
    case 'interview_cancelled':
    case 'interview_reminder':
      return { icon: <AlertTriangle />, label: 'Interview' }
    case 'offer_sent':
    case 'offer_received':
    case 'offer_accepted':
      return { icon: <Trophy />, label: 'Offer' }
    case 'offer_declined':
      return { icon: <ClipboardList />, label: 'Offer' }
    case 'profile_viewed':
      return { icon: <Eye />, label: 'Profile' }
    case 'stage_updated':
    case 'stage_changed':
      return { icon: <RefreshCw />, label: 'Status' }
    case 'message_received':
      return { icon: <MessageSquare />, label: 'Message' }
    case 'application_received':
      return { icon: <FileText />, label: 'Application' }
    case 'feedback_reminder':
      return { icon: <CheckCircle />, label: 'Feedback' }
    default:
      return { icon: <Bell />, label: 'System' }
  }
}

function matchesFilter(n: Notification, tab: FilterTab | null): boolean {
  if (tab === null) return true
  if (tab === 'unread') return !n.is_read
  if (tab === 'interviews')
    return ['interview_scheduled', 'interview_updated', 'interview_cancelled', 'interview_reminder', 'feedback_reminder'].includes(n.type)
  if (tab === 'applications')
    return ['application_received', 'shortlisted', 'stage_updated', 'stage_changed', 'profile_viewed'].includes(n.type)
  if (tab === 'offers')
    return ['offer_sent', 'offer_received', 'offer_accepted', 'offer_declined'].includes(n.type)
  return true
}

export default function PortalNotifications() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<FilterTab | null>(null)
  const { markRead, markAllRead } = useNotificationStore()

  // Fetch from server (source of truth)
  const { data: serverNotifs, isLoading } = useQuery({
    queryKey: ['portal', 'notifications'],
    queryFn: async () => {
      const { data } = await notificationsApi.list()
      return data as Notification[]
    },
    staleTime: 30_000,
  })

  const allNotifications: Notification[] = serverNotifs ?? []

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onMutate: (id) => {
      markRead(id)
      queryClient.setQueryData<Notification[]>(['portal', 'notifications'], (old) =>
        old ? old.map((n) => (n.id === id ? { ...n, is_read: true } : n)) : old
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications', 'count'] })
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onMutate: () => {
      markAllRead()
      queryClient.setQueryData<Notification[]>(['portal', 'notifications'], (old) =>
        old ? old.map((n) => ({ ...n, is_read: true })) : old
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications', 'count'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.delete(id),
    onMutate: (id) => {
      queryClient.setQueryData<Notification[]>(['portal', 'notifications'], (old) =>
        old ? old.filter((n) => n.id !== id) : old
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications', 'count'] })
    },
  })

  const sorted = [...allNotifications].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  const filtered = sorted.filter((n) => matchesFilter(n, activeTab))
  const unreadCount = sorted.filter((n) => !n.is_read).length

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Candidate portal"
        title="Notifications"
        description="Stay updated on your application status, interviews and offers."
        actions={
          <>
            {unreadCount > 0 && (
              <Badge tone="brand" dot="pulse">
                {unreadCount} new
              </Badge>
            )}
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                icon={<Check size={14} />}
                onClick={() => {
                  if (!markAllReadMutation.isPending) markAllReadMutation.mutate()
                }}
                loading={markAllReadMutation.isPending}
                disabled={markAllReadMutation.isPending}
              >
                Mark all read
              </Button>
            )}
          </>
        }
      />

      <FilterChips
        options={FILTERS.map((f) => ({
          value: f.value,
          label: f.label,
          count:
            f.value === 'unread'
              ? unreadCount
              : sorted.filter((n) => matchesFilter(n, f.value)).length,
        }))}
        value={activeTab}
        onChange={setActiveTab}
        allLabel={`All (${sorted.length})`}
        className="mb-hb-4"
      />

      <div className="space-y-2.5">
        {isLoading ? (
          Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full" rounded="md" />
          ))
        ) : filtered.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={activeTab === 'unread' ? <CheckCircle /> : <Inbox />}
              title={activeTab === 'unread' ? 'All caught up!' : 'No notifications here'}
              description={
                activeTab === 'unread'
                  ? "You've read everything. Check back later for updates."
                  : `No ${activeTab ?? ''} notifications yet.`
              }
              size="page"
            />
          </Card>
        ) : (
          <AnimatePresence initial={false}>
            {filtered.map((n, idx) => {
              const meta = notifMeta(n.type)
              const isMarkingRead = markReadMutation.isPending && markReadMutation.variables === n.id
              const isDeleting = deleteMutation.isPending && deleteMutation.variables === n.id
              return (
                <motion.div
                  key={n.id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 30, scale: 0.96 }}
                  transition={{ duration: 0.2, delay: idx < 5 ? idx * 0.04 : 0 }}
                >
                  <button
                    type="button"
                    disabled={isMarkingRead}
                    aria-busy={isMarkingRead || undefined}
                    onClick={() => {
                      if (!n.is_read && !isMarkingRead) markReadMutation.mutate(n.id)
                    }}
                    className={`group relative flex w-full items-start gap-3.5 rounded-hb-md border p-4 text-left transition-all duration-hb ease-hb hover:-translate-y-px hover:shadow-hb-card-hover focus-visible:outline-none focus-visible:shadow-hb-ring disabled:cursor-wait ${
                      n.is_read
                        ? 'border-hb-border bg-hb-surface'
                        : 'border-hb-blue/35 bg-hb-blue/[0.05]'
                    }`}
                  >
                    {!n.is_read && (
                      <span
                        aria-hidden
                        className="absolute right-4 top-4 h-2 w-2 rounded-full bg-hb-grad"
                      />
                    )}

                    <IconTile size="sm">{meta.icon}</IconTile>

                    <span className="min-w-0 flex-1">
                      <span className="mb-1 block font-mono text-hb-micro uppercase tracking-[.14em] text-hb-cyan">
                        {meta.label}
                        <span className="sr-only">{n.is_read ? '' : ', unread'}</span>
                      </span>
                      <span
                        className={`block text-hb-sm leading-snug text-hb-text ${
                          n.is_read ? 'font-semibold' : 'font-bold'
                        }`}
                      >
                        {n.title}
                      </span>
                      <span className="mt-1 block text-hb-xs leading-relaxed text-hb-muted">
                        {n.message}
                      </span>
                      <span className="mt-1.5 block text-hb-micro text-hb-dim">
                        {timeAgo(n.created_at)}
                      </span>
                    </span>

                    <span
                      role="button"
                      tabIndex={isDeleting ? -1 : 0}
                      aria-label="Dismiss notification"
                      aria-disabled={isDeleting || undefined}
                      aria-busy={isDeleting || undefined}
                      title="Dismiss"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!isDeleting) deleteMutation.mutate(n.id)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          e.stopPropagation()
                          if (!isDeleting) deleteMutation.mutate(n.id)
                        }
                      }}
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-hb-sm border border-hb-border text-hb-dim opacity-60 transition-all duration-hb hover:border-hb-error/30 hover:bg-hb-error/8 hover:text-hb-error hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:shadow-hb-ring ${
                        isDeleting ? 'cursor-wait opacity-100' : ''
                      } ${!n.is_read ? 'mr-4' : ''}`}
                    >
                      {isDeleting ? (
                        <Loader2 size={13} className="animate-spin" aria-hidden />
                      ) : (
                        <X size={13} aria-hidden />
                      )}
                    </span>
                  </button>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
