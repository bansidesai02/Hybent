import { memo, useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useMessageStore } from '@/store/messageStore'
import { useAuthStore } from '@/store/authStore'
import { messagesApi, chatApi } from '@/api/messages'
import { Avatar } from '@/components/hb'
import { timeAgo } from '@/utils/formatters'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, Users, MessageSquare } from 'lucide-react'
import { NewGroupDialog } from '@/components/messaging/NewGroupDialog'

type Tab = 'all' | 'direct' | 'groups'

type ThreadRow =
  | { kind: 'dm'; key: string; name: string; avatar: string | null; preview: string; at: string; unread: number; open: () => void }
  | { kind: 'group'; key: string; name: string; avatar: null; preview: string; at: string; unread: number; members: number; open: () => void }

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'direct', label: 'Direct' },
  { id: 'groups', label: 'Groups' },
]

function MessageInboxComponent() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('all')
  const [query, setQuery] = useState('')
  const [newGroupOpen, setNewGroupOpen] = useState(false)
  const inboxRef = useRef<HTMLDivElement>(null)
  const role = useAuthStore((s) => s.user?.role)
  const canCreateGroup = role === 'admin' || role === 'recruiter' || role === 'super_admin'
  const { conversations, groups, unreadCount, setConversations, setGroups, setUnreadCount, openChat, openGroup } =
    useMessageStore()

  const loadThreads = useCallback(async () => {
    const [dms, grps] = await Promise.allSettled([messagesApi.getConversations(), chatApi.listGroups()])
    const dmList = dms.status === 'fulfilled' ? dms.value.data : useMessageStore.getState().conversations
    const groupList = grps.status === 'fulfilled' ? grps.value.data : useMessageStore.getState().groups
    if (dms.status === 'fulfilled') setConversations(dmList)
    if (grps.status === 'fulfilled') setGroups(groupList)
    setUnreadCount(
      dmList.reduce((acc, c) => acc + c.unread_count, 0) + groupList.reduce((acc, g) => acc + g.unread_count, 0),
    )
  }, [setConversations, setGroups, setUnreadCount])

  // Load once so the badge counts group messages too, then refresh on open
  useEffect(() => {
    loadThreads()
  }, [loadThreads])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (newGroupOpen) return
      if (inboxRef.current && !inboxRef.current.contains(event.target as Node)) setOpen(false)
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      loadThreads()
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, newGroupOpen, loadThreads])

  const rows = useMemo<ThreadRow[]>(() => {
    const dmRows: ThreadRow[] = conversations.map((c) => ({
      kind: 'dm',
      key: `dm-${c.other_user_id}`,
      name: c.other_user_full_name,
      avatar: c.other_user_avatar_url,
      preview: c.last_message,
      at: c.last_message_at,
      unread: c.unread_count,
      open: () => openChat({ id: c.other_user_id, full_name: c.other_user_full_name, avatar_url: c.other_user_avatar_url }),
    }))
    const groupRows: ThreadRow[] = groups.map((g) => ({
      kind: 'group',
      key: `group-${g.id}`,
      name: g.name,
      avatar: null,
      preview: g.last_message
        ? `${g.last_message_sender_name ? `${g.last_message_sender_name.split(' ')[0]}: ` : ''}${g.last_message}`
        : 'No messages yet',
      at: g.last_message_at ?? g.created_at,
      unread: g.unread_count,
      members: g.member_count,
      open: () => openGroup({ id: g.id, name: g.name }),
    }))
    const q = query.trim().toLowerCase()
    return [...(tab !== 'groups' ? dmRows : []), ...(tab !== 'direct' ? groupRows : [])]
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  }, [conversations, groups, tab, query, openChat, openGroup])

  const tabUnread = (t: Tab) =>
    t === 'direct'
      ? conversations.reduce((a, c) => a + c.unread_count, 0)
      : t === 'groups'
        ? groups.reduce((a, g) => a + g.unread_count, 0)
        : 0

  return (
    <div className="relative" ref={inboxRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-xl p-2 transition-colors hover:bg-hb-surface-2"
        title="Messages"
        aria-label="Messages"
        aria-expanded={open}
      >
        <svg className="h-5 w-5 text-hb-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-hb-grad font-mono text-hb-micro font-bold text-white ring-2 ring-hb-surface">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            className="fixed left-4 right-4 top-16 z-50 flex max-h-[min(560px,calc(100dvh-5rem))] w-[calc(100vw-32px)] flex-col overflow-hidden rounded-hb-lg border border-hb-border bg-hb-elevated shadow-hb-2 sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-[380px]"
          >
            <div className="flex items-center justify-between gap-2 border-b border-hb-border bg-hb-surface-2 px-4 py-3">
              <h3 className="text-sm font-black text-hb-text">Active Chats</h3>
              {canCreateGroup && (
                <button
                  onClick={() => setNewGroupOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-hb-grad px-3 py-1.5 text-hb-xs font-semibold text-white shadow-hb-1 transition-[filter] hover:brightness-110"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                  New group
                </button>
              )}
            </div>

            <div className="space-y-2.5 border-b border-hb-border px-4 py-3">
              <label className="flex items-center gap-2 rounded-hb-sm border border-hb-border bg-hb-surface px-3 focus-within:border-hb-blue/50">
                <Search className="h-4 w-4 shrink-0 text-hb-dim" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search chats"
                  className="h-9 min-w-0 flex-1 border-0 bg-transparent text-hb-sm text-hb-text outline-none ring-0 placeholder:text-hb-dim focus:outline-none focus:ring-0"
                />
              </label>
              <div className="flex gap-1" role="tablist">
                {TABS.map((t) => {
                  const n = tabUnread(t.id)
                  return (
                    <button
                      key={t.id}
                      role="tab"
                      aria-selected={tab === t.id}
                      onClick={() => setTab(t.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-hb-xs font-semibold transition-colors ${
                        tab === t.id ? 'bg-hb-blue/10 text-hb-blue' : 'text-hb-muted hover:bg-hb-surface-2'
                      }`}
                    >
                      {t.label}
                      {n > 0 && (
                        <span className="rounded-full bg-hb-grad px-1.5 font-mono text-hb-micro leading-4 text-white">{n}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="min-h-0 flex-1 divide-y divide-hb-border overflow-y-auto">
              {rows.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                  {tab === 'groups' ? (
                    <Users className="h-8 w-8 text-hb-dim" strokeWidth={1.5} />
                  ) : (
                    <MessageSquare className="h-8 w-8 text-hb-dim" strokeWidth={1.5} />
                  )}
                  <p className="text-hb-sm font-semibold text-hb-text">
                    {query ? 'No chats match your search' : tab === 'groups' ? 'No groups yet' : 'No active conversations'}
                  </p>
                  {!query && (
                    <p className="text-hb-xs text-hb-dim">
                      {tab === 'groups' && canCreateGroup
                        ? 'Create a group to collaborate with your team.'
                        : 'Message a teammate from Team Management to get started.'}
                    </p>
                  )}
                </div>
              ) : (
                rows.map((r) => (
                  <button
                    key={r.key}
                    onClick={() => {
                      setOpen(false)
                      r.open()
                    }}
                    className="group flex w-full items-center gap-3 p-4 text-left transition-all hover:bg-[rgb(var(--hb-blue))]/5"
                  >
                    <div className="relative flex-shrink-0">
                      {r.kind === 'group' ? (
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-hb-grad text-white">
                          <Users className="h-5 w-5" />
                        </span>
                      ) : (
                        <Avatar name={r.name} src={r.avatar || ''} size="md" />
                      )}
                      {r.unread > 0 && (
                        <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-hb-elevated bg-[rgb(var(--hb-blue))]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex items-center justify-between gap-2">
                        <p className="flex min-w-0 items-center gap-1.5 text-hb-sm font-semibold text-hb-text transition-colors duration-hb group-hover:text-hb-blue">
                          <span className="truncate">{r.name}</span>
                          {r.kind === 'group' && (
                            <span className="shrink-0 font-mono text-hb-micro font-normal text-hb-dim">· {r.members}</span>
                          )}
                        </p>
                        <span className="shrink-0 text-hb-micro text-hb-dim">{timeAgo(r.at)}</span>
                      </div>
                      <p className={`truncate text-xs ${r.unread > 0 ? 'font-black text-hb-text' : 'text-hb-muted'}`}>
                        {r.preview}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <NewGroupDialog
        open={newGroupOpen}
        onClose={() => {
          setNewGroupOpen(false)
          setOpen(false)
        }}
      />
    </div>
  )
}

export const MessageInbox = memo(MessageInboxComponent)
