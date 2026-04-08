import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '@/api/notifications'
import { useNotificationStore } from '@/store/notificationStore'
import { timeAgo } from '@/utils/formatters'
import { motion, AnimatePresence } from 'framer-motion'
import type { Notification, NotificationType } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'unread' | 'interviews' | 'applications' | 'offers'

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'interviews', label: 'Interviews' },
  { key: 'applications', label: 'Applications' },
  { key: 'offers', label: 'Offers' },
]

interface NotifMeta {
  icon: string
  gradient: string
  border: string
  label: string
}

function getNotifMeta(type: NotificationType): NotifMeta {
  switch (type) {
    case 'shortlisted':
      return { icon: '🎯', gradient: 'from-violet-500/15 to-purple-500/5', border: 'border-violet-200/60', label: 'Shortlisted' }
    case 'interview_scheduled':
    case 'interview_updated':
      return { icon: '📅', gradient: 'from-blue-500/15 to-sky-500/5', border: 'border-blue-200/60', label: 'Interview' }
    case 'interview_cancelled':
    case 'interview_reminder':
      return { icon: '⚠️', gradient: 'from-amber-500/15 to-yellow-500/5', border: 'border-amber-200/60', label: 'Interview' }
    case 'offer_sent':
    case 'offer_received':
    case 'offer_accepted':
      return { icon: '🎉', gradient: 'from-emerald-500/15 to-green-500/5', border: 'border-emerald-200/60', label: 'Offer' }
    case 'offer_declined':
      return { icon: '📋', gradient: 'from-red-500/10 to-rose-500/5', border: 'border-red-200/60', label: 'Offer' }
    case 'profile_viewed':
      return { icon: '👁️', gradient: 'from-indigo-500/15 to-blue-500/5', border: 'border-indigo-200/60', label: 'Profile' }
    case 'stage_updated':
    case 'stage_changed':
      return { icon: '🔄', gradient: 'from-cyan-500/15 to-teal-500/5', border: 'border-cyan-200/60', label: 'Status' }
    case 'message_received':
      return { icon: '💬', gradient: 'from-sky-500/15 to-blue-500/5', border: 'border-sky-200/60', label: 'Message' }
    case 'application_received':
      return { icon: '📝', gradient: 'from-rose-500/15 to-pink-500/5', border: 'border-rose-200/60', label: 'Application' }
    case 'feedback_reminder':
      return { icon: '✅', gradient: 'from-teal-500/15 to-green-500/5', border: 'border-teal-200/60', label: 'Feedback' }
    default:
      return { icon: '🔔', gradient: 'from-gray-500/10 to-slate-500/5', border: 'border-gray-200/60', label: 'System' }
  }
}

function matchesFilter(n: Notification, tab: FilterTab): boolean {
  if (tab === 'all') return true
  if (tab === 'unread') return !n.is_read
  if (tab === 'interviews') return ['interview_scheduled', 'interview_updated', 'interview_cancelled', 'interview_reminder', 'feedback_reminder'].includes(n.type)
  if (tab === 'applications') return ['application_received', 'shortlisted', 'stage_updated', 'stage_changed', 'profile_viewed'].includes(n.type)
  if (tab === 'offers') return ['offer_sent', 'offer_received', 'offer_accepted', 'offer_declined'].includes(n.type)
  return true
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function NotifSkeleton() {
  return (
    <div className="flex items-start gap-4 p-5 rounded-2xl border border-[var(--border)] animate-pulse" style={{ background: 'var(--card)' }}>
      <div className="w-12 h-12 rounded-2xl bg-[var(--border)] flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-[var(--border)] rounded-full w-2/5" />
        <div className="h-3 bg-[var(--border)] rounded-full w-3/4" />
        <div className="h-2.5 bg-[var(--border)] rounded-full w-1/4" />
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PortalNotifications() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const { markRead, markAllRead, notifications: storeNotifs } = useNotificationStore()

  // Fetch from server (source of truth)
  const { data: serverNotifs, isLoading } = useQuery({
    queryKey: ['portal', 'notifications'],
    queryFn: async () => {
      const { data } = await notificationsApi.list()
      return data as Notification[]
    },
    staleTime: 30_000,
  })

  // Merge: server is source of truth, but include any WS-pushed items from store
  // that may not yet be in the server response
  const allNotifications: Notification[] = serverNotifs ?? []

  // Mark single as read
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

  // Mark all as read
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

  // Delete a notification
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

  const handleCardClick = (n: Notification) => {
    if (!n.is_read) markReadMutation.mutate(n.id)
  }

  return (
    <div className="page active" id="page-notif">
      {/* ── Header ── */}
      <div className="ph">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div className="pt" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              Notifications
              {unreadCount > 0 && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 20,
                  padding: '2px 10px',
                  letterSpacing: 0.3,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a78bfa', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="ps">Stay updated on your application status, interviews, and offers.</div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {unreadCount > 0 && (
              <button
                className="btn btn-outline btn-sm"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
              >
                {markAllReadMutation.isPending ? 'Marking...' : '✓ Mark All Read'}
              </button>
            )}
          </div>
        </div>

        {/* ── Filter Tabs ── */}
        <div style={{
          display: 'flex',
          gap: 6,
          marginTop: 20,
          flexWrap: 'wrap',
        }}>
          {FILTER_TABS.map((tab) => {
            const tabCount = tab.key === 'unread'
              ? unreadCount
              : tab.key === 'all'
              ? sorted.length
              : sorted.filter((n) => matchesFilter(n, tab.key)).length

            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 12,
                  border: '1.5px solid',
                  borderColor: activeTab === tab.key ? 'var(--accent)' : 'var(--border)',
                  background: activeTab === tab.key
                    ? 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(79,70,229,0.08))'
                    : 'transparent',
                  color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-lite)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {tab.label}
                {tabCount > 0 && (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 8,
                    background: activeTab === tab.key ? 'rgba(124,58,237,0.2)' : 'var(--border)',
                    color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-lite)',
                  }}>
                    {tabCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Notification List ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <NotifSkeleton key={i} />)
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ textAlign: 'center', padding: '60px 20px' }}
          >
            <div style={{ fontSize: 52, marginBottom: 16 }}>
              {activeTab === 'unread' ? '✅' : '📭'}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
              {activeTab === 'unread' ? 'All caught up!' : 'No notifications here'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-lite)' }}>
              {activeTab === 'unread'
                ? "You've read everything. Check back later for updates."
                : `No ${activeTab === 'all' ? '' : activeTab + ' '}notifications yet.`}
            </div>
          </motion.div>
        ) : (
          <AnimatePresence initial={false}>
            {filtered.map((n, idx) => {
              const meta = getNotifMeta(n.type)
              return (
                <motion.div
                  key={n.id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 30, scale: 0.96 }}
                  transition={{ duration: 0.2, delay: idx < 5 ? idx * 0.04 : 0 }}
                  onClick={() => handleCardClick(n)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 14,
                    padding: '16px 18px',
                    borderRadius: 18,
                    border: `1.5px solid`,
                    borderColor: !n.is_read ? 'rgba(124,58,237,0.25)' : 'var(--border)',
                    background: !n.is_read
                      ? 'linear-gradient(135deg, rgba(124,58,237,0.06), rgba(79,70,229,0.03))'
                      : 'var(--card)',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'box-shadow 0.2s, transform 0.15s',
                    boxShadow: !n.is_read ? '0 2px 12px rgba(124,58,237,0.08)' : '0 1px 4px rgba(0,0,0,0.04)',
                  }}
                  className="notif-row-hover"
                >
                  {/* Unread indicator */}
                  {!n.is_read && (
                    <span style={{
                      position: 'absolute',
                      top: 18,
                      right: 18,
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                      boxShadow: '0 0 6px rgba(124,58,237,0.5)',
                    }} />
                  )}

                  {/* Icon */}
                  <div style={{
                    width: 46,
                    height: 46,
                    borderRadius: 14,
                    background: `linear-gradient(135deg, ${meta.gradient.replace('from-', '').replace(' to-', ', ')})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    flexShrink: 0,
                    border: `1px solid`,
                    borderColor: meta.border,
                  }}>
                    {meta.icon}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: 1,
                        color: 'var(--accent)',
                        padding: '1px 7px',
                        borderRadius: 6,
                        background: 'rgba(124,58,237,0.08)',
                      }}>
                        {meta.label}
                      </span>
                    </div>
                    <div style={{
                      fontSize: 14,
                      fontWeight: !n.is_read ? 700 : 600,
                      color: 'var(--text)',
                      marginBottom: 4,
                      lineHeight: 1.35,
                    }}>
                      {n.title}
                    </div>
                    <div style={{
                      fontSize: 12.5,
                      color: 'var(--text-lite)',
                      lineHeight: 1.45,
                      marginBottom: 6,
                    }}>
                      {n.message}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-lite)', opacity: 0.7 }}>
                      {timeAgo(n.created_at)}
                    </div>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteMutation.mutate(n.id)
                    }}
                    title="Dismiss"
                    style={{
                      flexShrink: 0,
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'transparent',
                      color: 'var(--text-lite)',
                      fontSize: 13,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0.5,
                      transition: 'opacity 0.15s, background 0.15s',
                      marginRight: !n.is_read ? 14 : 0,
                    }}
                    onMouseEnter={(e) => { (e.target as HTMLElement).style.opacity = '1'; (e.target as HTMLElement).style.background = 'rgba(239,68,68,0.08)' }}
                    onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = '0.5'; (e.target as HTMLElement).style.background = 'transparent' }}
                  >
                    ✕
                  </button>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
      </div>

      <style>{`
        .notif-row-hover:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 20px rgba(0,0,0,0.08) !important;
        }
      `}</style>
    </div>
  )
}
