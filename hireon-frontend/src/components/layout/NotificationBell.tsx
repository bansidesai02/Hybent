import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '@/hooks/useNotifications'
import { useNotificationStore } from '@/store/notificationStore'
import { timeAgo } from '@/utils/formatters'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Bell, 
  Target, 
  Calendar, 
  AlertTriangle, 
  Trophy, 
  Eye, 
  RefreshCw, 
  MessageCircle, 
  FileText, 
  CheckCircle 
} from 'lucide-react'
import { GlassIcon } from '@/components/common/GlassIcon'
import type { NotificationType } from '@/types'

function getNotifIcon(type: NotificationType): React.ReactNode {
  switch (type) {
    case 'shortlisted':          return <GlassIcon icon="Target" variant="violet" size={24} iconSize={12} ghost glow={false} />
    case 'interview_scheduled':
    case 'interview_updated':    return <GlassIcon icon="Calendar" variant="blue" size={24} iconSize={12} ghost glow={false} />
    case 'interview_cancelled':
    case 'interview_reminder':   return <GlassIcon icon="AlertTriangle" variant="amber" size={24} iconSize={12} ghost glow={false} />
    case 'offer_sent':
    case 'offer_received':
    case 'offer_accepted':       return <GlassIcon icon="Trophy" variant="pink" size={24} iconSize={12} ghost glow={false} />
    case 'profile_viewed':       return <GlassIcon icon="Eye" variant="indigo" size={24} iconSize={12} ghost glow={false} />
    case 'stage_updated':
    case 'stage_changed':        return <GlassIcon icon="RefreshCw" variant="emerald" size={24} iconSize={12} ghost glow={false} />
    case 'message_received':     return <GlassIcon icon="MessageCircle" variant="violet" size={24} iconSize={12} ghost glow={false} />
    case 'application_received': return <GlassIcon icon="FileText" variant="blue" size={24} iconSize={12} ghost glow={false} />
    case 'feedback_reminder':    return <GlassIcon icon="CheckCircle" variant="emerald" size={24} iconSize={12} ghost glow={false} />
    default:                     return <GlassIcon icon="Bell" variant="gray" size={24} iconSize={12} ghost glow={false} />
  }
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { markRead, markAllRead } = useNotifications()
  const { notifications } = useNotificationStore()

  // Only show the latest 5 notifications and calculate unread count from them
  const displayNotifications = notifications.slice(0, 5)
  const displayUnreadCount = displayNotifications.filter(n => !n.is_read).length

  // Handle click outside to close
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
        className="relative p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-gray-600 dark:text-[#b0a8d8]" strokeWidth={2} />

        {/* Badge with pulse ring */}
        {displayUnreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center">
            {/* Pulse ring */}
            <span
              className="absolute inline-flex rounded-full opacity-75"
              style={{
                width: 18,
                height: 18,
                background: '#7c3aed',
                animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
              }}
            />
            {/* Count badge */}
            <span
              className="relative inline-flex rounded-full text-white"
              style={{
                width: 18,
                height: 18,
                fontSize: 10,
                fontWeight: 800,
                background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                alignItems: 'center',
                justifyContent: 'center',
                display: 'flex',
                boxShadow: '0 2px 6px rgba(124,58,237,0.4)',
              }}
            >
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
            className="fixed sm:absolute left-4 right-4 sm:left-auto sm:right-0 top-16 sm:top-12 w-[calc(100vw-32px)] sm:w-80 bg-white dark:bg-[#1a1730] rounded-2xl shadow-xl border border-gray-200 dark:border-[#2a2550] z-40 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-[#2a2550]">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900 dark:text-[#ede9ff] text-sm">Notifications</h3>
                {displayUnreadCount > 0 && (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(79,70,229,0.1))',
                    color: '#7c3aed',
                  }}>
                    {displayUnreadCount} new
                  </span>
                )}
              </div>
              {displayUnreadCount > 0 && (
                <button
                  onClick={() => markAllRead()}
                  className="text-xs text-violet-600 hover:text-violet-700 font-medium transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Notification list */}
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
              {!notifications?.length ? (
                <div className="py-10 text-center">
                  <Bell className="mx-auto mb-2 opacity-20" size={32} />
                  <p className="text-sm text-gray-400">No notifications yet</p>
                </div>
              ) : (
                displayNotifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => { if (!n.is_read) markRead(n.id) }}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${!n.is_read ? 'bg-violet-50/50 dark:bg-violet-900/10' : ''}`}
                  >
                    <div className="flex gap-3 items-start">
                      {/* Type icon */}
                      <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>
                        {getNotifIcon(n.type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-1.5">
                          {!n.is_read && (
                            <div
                              className="flex-shrink-0 mt-1.5"
                              style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c3aed', boxShadow: '0 0 4px rgba(124,58,237,0.5)' }}
                            />
                          )}
                          <p className={`text-xs font-semibold text-gray-800 dark:text-[#ede9ff] ${!n.is_read ? '' : ''}`}>
                            {n.title}
                          </p>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-[#b0a8d8] mt-0.5 leading-snug">
                          {n.message}
                        </p>
                        <p className="text-[10px] text-gray-400 dark:text-[#6b6393] mt-1">
                          {timeAgo(n.created_at)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>


          </motion.div>
        )}
      </AnimatePresence>

      {/* Keyframe for ping animation (injected locally) */}
      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(1.8); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
