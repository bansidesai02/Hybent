import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { messagesApi, chatApi, type Message, type ChatGroupDetail } from '@/api/messages'
import { Avatar } from '@/components/hb'
import { useAuthStore } from '@/store/authStore'
import { useMessageStore } from '@/store/messageStore'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { X, MessageSquare, Check, CheckCheck, Clock, Users, ChevronRight } from 'lucide-react'
import { ChatComposer } from './ChatComposer'
import { MessageAttachments } from './MessageAttachments'
import { GroupMembersSheet } from './GroupMembersSheet'

export type ChatThread =
  | { kind: 'dm'; recipient: { id: string; full_name: string; avatar_url?: string | null } }
  | { kind: 'group'; group: { id: string; name: string } }

interface ChatPanelProps {
  open: boolean
  onClose: () => void
  thread: ChatThread
}

const errorDetail = (err: any, fallback: string) =>
  err?.response?.data?.detail || err?.response?.data?.message || fallback

export function ChatPanel({ open, onClose, thread }: ChatPanelProps) {
  const { user: currentUser } = useAuthStore()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [group, setGroup] = useState<ChatGroupDetail | null>(null)
  const [membersOpen, setMembersOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const isGroup = thread.kind === 'group'
  const threadId = isGroup ? thread.group.id : thread.recipient.id
  const title = isGroup ? group?.name ?? thread.group.name : thread.recipient.full_name

  const loadGroup = useCallback(async () => {
    if (thread.kind !== 'group') return
    try {
      const res = await chatApi.getGroup(thread.group.id)
      setGroup(res.data)
    } catch (err: any) {
      if (err?.response?.status === 403 || err?.response?.status === 404) {
        toast.error('You are no longer a member of this group.')
        onClose()
      }
    }
  }, [thread, onClose])

  useEffect(() => {
    if (!open || !threadId) return
    setMessages([])
    setGroup(null)
    setMembersOpen(false)
    setLoading(true)
    const req =
      thread.kind === 'group'
        ? chatApi.getGroupMessages(thread.group.id).then((res) => {
            chatApi.markGroupRead(thread.group.id).catch(() => {})
            return res
          })
        : messagesApi.getMessages(thread.recipient.id)
    req
      .then((res) => setMessages(res.data))
      .catch(() => toast.error('Failed to load messages'))
      .finally(() => setLoading(false))
    loadGroup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, threadId])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  const appendUnique = (msg: Message) =>
    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))

  // Optimistic send: the message shows instantly as pending, then is swapped
  // for the server's copy (or dropped if the websocket echo got there first).
  const handleSend = async (content: string, attachmentIds: string[]) => {
    const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        sender_id: currentUser?.id ?? '',
        receiver_id: thread.kind === 'dm' ? thread.recipient.id : null,
        group_id: thread.kind === 'group' ? thread.group.id : null,
        content,
        is_read: false,
        created_at: new Date().toISOString(),
      },
    ])
    try {
      const res =
        thread.kind === 'group'
          ? await chatApi.sendGroupMessage(thread.group.id, { content, attachment_ids: attachmentIds })
          : await messagesApi.sendMessage({ receiver_id: thread.recipient.id, content, attachment_ids: attachmentIds })
      setMessages((prev) =>
        prev.some((m) => m.id === res.data.id)
          ? prev.filter((m) => m.id !== tempId)
          : prev.map((m) => (m.id === tempId ? res.data : m))
      )
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      toast.error(errorDetail(err, 'Failed to send message'))
      throw err
    }
  }

  // Real-time events (dispatched by useWebSocket)
  useEffect(() => {
    const onDirect = (event: any) => {
      if (thread.kind !== 'dm') return
      const msg = event.detail
      const rid = thread.recipient.id
      if (msg.sender_id === rid) {
        if (open) messagesApi.markAsRead(rid).catch(console.error)
        appendUnique(msg)
      } else if (msg.sender_id === currentUser?.id && msg.receiver_id === rid) {
        appendUnique(msg)
      }
    }
    const onRead = (event: any) => {
      if (thread.kind !== 'dm') return
      const { reader_id, message_ids } = event.detail
      if (reader_id === thread.recipient.id) {
        setMessages((prev) => prev.map((m) => (message_ids.includes(m.id) ? { ...m, is_read: true } : m)))
      }
    }
    const onGroupMessage = (event: any) => {
      if (thread.kind !== 'group' || event.detail.group_id !== thread.group.id) return
      appendUnique(event.detail)
      if (open && event.detail.sender_id !== currentUser?.id) chatApi.markGroupRead(thread.group.id).catch(() => {})
    }
    const onGroupUpdated = (event: any) => {
      if (thread.kind === 'group' && event.detail.group_id === thread.group.id) loadGroup()
    }

    window.addEventListener('ws:new_message', onDirect)
    window.addEventListener('ws:messages_read', onRead)
    window.addEventListener('ws:group_message', onGroupMessage)
    window.addEventListener('ws:group_updated', onGroupUpdated)
    return () => {
      window.removeEventListener('ws:new_message', onDirect)
      window.removeEventListener('ws:messages_read', onRead)
      window.removeEventListener('ws:group_message', onGroupMessage)
      window.removeEventListener('ws:group_updated', onGroupUpdated)
    }
  }, [thread, open, currentUser?.id, loadGroup])

  const senderOf = (msg: Message) => {
    if (!isGroup) return { name: thread.recipient.full_name, avatar: thread.recipient.avatar_url }
    const member = group?.members.find((m) => m.user_id === msg.sender_id)
    return {
      name: msg.sender_name || member?.full_name || 'Former member',
      avatar: msg.sender_avatar || member?.avatar_url,
    }
  }

  // Group consecutive messages from one sender within 2 minutes
  const grouped: { sender_id: string; messages: Message[]; timestamp: string }[] = []
  messages.forEach((msg, idx) => {
    const prev = messages[idx - 1]
    const diff = prev ? (new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime()) / 60000 : Infinity
    if (prev && prev.sender_id === msg.sender_id && diff < 2) {
      grouped[grouped.length - 1].messages.push(msg)
      grouped[grouped.length - 1].timestamp = msg.created_at
    } else {
      grouped.push({ sender_id: msg.sender_id, messages: [msg], timestamp: msg.created_at })
    }
  })

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-[2px]"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%', opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.5 }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="fixed inset-y-0 right-0 z-[70] flex h-[100dvh] w-full flex-col overflow-hidden border-l border-hb-border bg-hb-surface shadow-[-20px_0_50px_rgba(0,0,0,0.2)] sm:max-w-[440px]"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-hb-border bg-hb-surface-2 px-4 py-3 sm:px-5 sm:py-4">
              {isGroup ? (
                <button
                  type="button"
                  onClick={() => setMembersOpen(true)}
                  className="group/hd -ml-1.5 flex min-w-0 items-center gap-3 rounded-hb-sm p-1.5 text-left transition-colors hover:bg-hb-surface"
                  aria-label="View group members"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-hb-grad text-white shadow-hb-1">
                    <Users className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-hb-body font-semibold text-hb-text">{title}</span>
                    <span className="mt-0.5 flex items-center gap-1 font-mono text-hb-micro font-bold uppercase text-hb-muted">
                      {group ? `${group.member_count} members` : 'Group'}
                      <ChevronRight className="h-3 w-3 transition-transform group-hover/hd:translate-x-0.5" />
                    </span>
                  </span>
                </button>
              ) : (
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative shrink-0">
                    <Avatar name={title} src={thread.recipient.avatar_url || ''} size="md" className="shadow-hb-1" />
                    <span className="absolute bottom-0 right-0 h-3 w-3 animate-pulse rounded-full border-2 border-hb-surface bg-hb-success" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-hb-body font-semibold text-hb-text">{title}</h3>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-hb-success" />
                      <p className="font-mono text-hb-micro font-bold uppercase text-hb-muted">Active Now</p>
                    </div>
                  </div>
                </div>
              )}
              <button
                onClick={onClose}
                className="shrink-0 rounded-full p-2.5 text-hb-dim transition-all duration-hb hover:bg-hb-surface hover:text-hb-text active:scale-90"
                aria-label="Close chat"
              >
                <X className="h-5 w-5" strokeWidth={2.5} />
              </button>
            </div>

            {/* Messages Area */}
            <div
              ref={scrollRef}
              className="flex-1 space-y-5 overflow-y-auto scroll-smooth bg-[radial-gradient(circle_at_2px_2px,rgb(var(--hb-blue)/0.04)_1px,transparent_0)] bg-[length:24px_24px] p-4 scrollbar-none sm:p-6"
            >
              {loading ? (
                <div className="flex flex-col items-center justify-center gap-4 py-20">
                  <div className="relative h-10 w-10">
                    <div className="absolute inset-0 rounded-full border-4 border-[rgb(var(--hb-blue))]/20" />
                    <div className="absolute inset-0 animate-spin rounded-full border-4 border-t-[rgb(var(--hb-blue))]" />
                  </div>
                  <p className="animate-pulse text-xs font-bold text-hb-dim">Loading conversation...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-20 text-center sm:px-10">
                  <div className="mb-6 flex h-20 w-20 rotate-3 items-center justify-center rounded-3xl bg-gradient-to-br from-[rgb(var(--hb-blue))]/5 to-[rgb(var(--hb-blue))]/15 shadow-sm">
                    {isGroup ? (
                      <Users className="h-10 w-10 text-[rgb(var(--hb-blue))]/50" strokeWidth={1.5} />
                    ) : (
                      <MessageSquare className="h-10 w-10 text-[rgb(var(--hb-blue))]/50" strokeWidth={1.5} />
                    )}
                  </div>
                  <h4 className="text-base font-black text-hb-text">Say hello!</h4>
                  <p className="mt-2 text-xs leading-relaxed text-hb-muted">
                    {isGroup ? (
                      <>Start the conversation in <b>{title}</b>. Only group members can see these messages.</>
                    ) : (
                      <>Start your conversation with <b>{title}</b>. Messages are private to your organization.</>
                    )}
                  </p>
                </div>
              ) : (
                grouped.map((g, gIdx) => {
                  const isMe = g.sender_id === currentUser?.id
                  const sender = senderOf(g.messages[0])
                  const last = g.messages[g.messages.length - 1]
                  return (
                    <motion.div
                      key={`${g.messages[0].id}-${gIdx}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      {!isMe && (
                        <div className="mb-6 w-8 flex-shrink-0 self-end">
                          <Avatar name={sender.name} src={sender.avatar || ''} size="xs" />
                        </div>
                      )}

                      <div className={`flex min-w-0 max-w-[80%] flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                        {isGroup && !isMe && (
                          <span className="px-1 text-hb-xs font-semibold text-hb-muted">{sender.name}</span>
                        )}
                        {g.messages.map((m, mIdx) => {
                          const isFirst = mIdx === 0
                          const isLast = mIdx === g.messages.length - 1
                          const atts = m.attachments ?? []
                          return (
                            <div key={m.id} className={`flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                              {atts.length > 0 && <MessageAttachments attachments={atts} alignEnd={isMe} />}
                              {m.content && (
                                <div
                                  className={`whitespace-pre-wrap break-words px-4 py-2.5 text-[13px] leading-relaxed shadow-sm transition-all hover:shadow-md ${
                                    isMe
                                      ? `bg-hb-grad font-medium text-white ${isFirst ? 'rounded-t-2xl rounded-bl-2xl' : ''} ${
                                          isLast ? 'rounded-b-2xl rounded-bl-2xl' : ''
                                        } ${!isFirst && !isLast ? 'rounded-l-2xl' : ''}`
                                      : `border border-hb-border bg-hb-surface text-hb-text ${
                                          isFirst ? 'rounded-t-2xl rounded-br-2xl' : ''
                                        } ${isLast ? 'rounded-b-2xl rounded-br-2xl' : ''} ${
                                          !isFirst && !isLast ? 'rounded-r-2xl' : ''
                                        }`
                                  }`}
                                >
                                  {m.content}
                                </div>
                              )}
                            </div>
                          )
                        })}

                        <div className={`mt-1 flex items-center gap-1.5 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                          <span className="font-mono text-hb-micro font-bold uppercase text-hb-dim">
                            {format(new Date(g.timestamp), 'hh:mm a')}
                          </span>
                          {isMe && last.id.startsWith('pending-') ? (
                            <Clock className="h-3 w-3 text-hb-dim" strokeWidth={3} />
                          ) : isMe && !isGroup &&
                            (last.is_read ? (
                              <CheckCheck className="h-3.5 w-3.5 text-hb-cyan" strokeWidth={3} />
                            ) : (
                              <Check className="h-3 w-3 text-hb-dim" strokeWidth={3} />
                            ))}
                        </div>
                      </div>
                    </motion.div>
                  )
                })
              )}
            </div>

            <ChatComposer
              key={threadId}
              onSend={handleSend}
              disabled={isGroup && !!group?.is_archived}
              placeholder={isGroup ? `Message ${title}…` : 'Message…'}
            />

            {isGroup && group && (
              <GroupMembersSheet
                open={membersOpen}
                onClose={() => setMembersOpen(false)}
                group={group}
                onChanged={setGroup}
                onLeft={() => {
                  useMessageStore.getState().removeGroup(group.id)
                  onClose()
                }}
              />
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
