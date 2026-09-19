import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { messagesApi, type Message } from '@/api/messages'
import { Avatar } from '@/components/hb'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { X, MessageSquare, Check, CheckCheck, SendHorizontal, Loader2 } from 'lucide-react'

interface ChatPanelProps {
  open: boolean
  onClose: () => void
  recipient: {
    id: string
    full_name: string
    avatar_url?: string | null
  }
}

export function ChatPanel({ open, onClose, recipient }: ChatPanelProps) {
  const { user: currentUser } = useAuthStore()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && recipient.id) {
      loadMessages()
    }
  }, [open, recipient.id])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const loadMessages = async () => {
    setLoading(true)
    try {
      const res = await messagesApi.getMessages(recipient.id)
      setMessages(res.data)
    } catch (err) {
      toast.error('Failed to load messages')
    } finally {
      setLoading(false)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || sending) return

    setSending(true)
    try {
      const res = await messagesApi.sendMessage({
        receiver_id: recipient.id,
        content: newMessage.trim(),
      })
      setMessages((prev) => {
        if (prev.some((m) => m.id === res.data.id)) return prev
        return [...prev, res.data]
      })
      setNewMessage('')
    } catch (err) {
      toast.error('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  // Listen for real-time messages via window event (dispatched by useWebSocket)
  useEffect(() => {
    const handleNewMessage = (event: any) => {
      const msg = event.detail
      
      setMessages((prev) => {
        // Prevent duplicates (e.g., from the tab that just sent the message via API)
        if (prev.some(m => m.id === msg.id)) return prev

        // Case 1: Message received from the person we are chatting with
        if (msg.sender_id === recipient.id) {
          // If chat panel is open, mark as read
          if (open) {
            messagesApi.markAsRead(recipient.id).catch(console.error)
          }
          return [...prev, msg]
        }
        
        // Case 2: Message sent by us (from another tab) to this recipient
        if (msg.sender_id === currentUser?.id && msg.receiver_id === recipient.id) {
          return [...prev, msg]
        }

        return prev
      })
    }
    
    const handleMessagesRead = (event: any) => {
      const { reader_id, message_ids } = event.detail
      if (reader_id === recipient.id) {
        setMessages((prev) => 
          prev.map(msg => 
            message_ids.includes(msg.id) ? { ...msg, is_read: true } : msg
          )
        )
      }
    }

    window.addEventListener('ws:new_message', handleNewMessage)
    window.addEventListener('ws:messages_read', handleMessagesRead)
    
    return () => {
      window.removeEventListener('ws:new_message', handleNewMessage)
      window.removeEventListener('ws:messages_read', handleMessagesRead)
    }
  }, [recipient.id, open])

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
            className="fixed top-0 right-0 bottom-0 z-[70] w-full max-w-[420px] bg-hb-surface shadow-[-20px_0_50px_rgba(0,0,0,0.2)] flex flex-col border-l border-hb-border"
          >
            {/* Header */}
            <div className="p-5 border-b border-hb-border flex items-center justify-between bg-hb-surface-2 sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar name={recipient.full_name} src={recipient.avatar_url || ''} size="md" className="shadow-hb-1" />
                  <span className="absolute bottom-0 right-0 h-3 w-3 animate-pulse rounded-full border-2 border-hb-surface bg-hb-success" />
                </div>
                <div>
                  <h3 className="text-hb-body font-semibold text-hb-text">{recipient.full_name}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-hb-success" />
                    <p className="font-mono text-hb-micro font-bold uppercase text-hb-muted">Active Now</p>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-2.5 text-hb-dim transition-all duration-hb hover:bg-hb-surface-2 hover:text-hb-text active:scale-90"
              >
                <X className="w-5 h-5" strokeWidth={2.5} />
              </button>
            </div>

            {/* Messages Area */}
            <div 
              ref={scrollRef}
              className="flex-1 space-y-6 overflow-y-auto scroll-smooth bg-[radial-gradient(circle_at_2px_2px,rgb(var(--hb-blue)/0.04)_1px,transparent_0)] bg-[length:24px_24px] p-6 scrollbar-none"
            >


              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="relative w-10 h-10">
                    <div className="absolute inset-0 border-4 border-[rgb(var(--hb-blue))]/20 rounded-full" />
                    <div className="absolute inset-0 border-4 border-t-[rgb(var(--hb-blue))] rounded-full animate-spin" />
                  </div>
                  <p className="text-xs font-bold text-hb-dim animate-pulse">Loading conversation...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-10">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[rgb(var(--hb-blue))]/5 to-[rgb(var(--hb-blue))]/15 flex items-center justify-center mb-6 shadow-sm rotate-3">
                    <MessageSquare className="w-10 h-10 text-[rgb(var(--hb-blue))]/50" strokeWidth={1.5} />
                  </div>
                  <h4 className="text-base font-black text-hb-text">Say hello!</h4>
                  <p className="text-xs text-hb-muted mt-2 leading-relaxed">
                    Start your conversation with <b>{recipient.full_name}</b>. Messages are private to your organization.
                  </p>
                </div>
              ) : (
                (() => {
                  const grouped: { sender_id: string; messages: Message[]; timestamp: string }[] = []
                  messages.forEach((msg, idx) => {
                    const prev = messages[idx - 1]
                    const diff = prev ? (new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime()) / 1000 / 60 : Infinity
                    
                    if (prev && prev.sender_id === msg.sender_id && diff < 2) {
                      grouped[grouped.length - 1].messages.push(msg)
                      grouped[grouped.length - 1].timestamp = msg.created_at
                    } else {
                      grouped.push({
                        sender_id: msg.sender_id,
                        messages: [msg],
                        timestamp: msg.created_at
                      })
                    }
                  })

                  return grouped.map((group, gIdx) => {
                    const isMe = group.sender_id === currentUser?.id
                    return (
                      <motion.div 
                        key={gIdx} 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                      >
                        {!isMe && (
                          <div className="w-8 flex-shrink-0 self-end mb-6">
                            <Avatar name={recipient.full_name} src={recipient.avatar_url || ''} size="xs" />
                          </div>
                        )}
                        
                        <div className={`max-w-[75%] flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                          {group.messages.map((m, mIdx) => {
                            const isFirst = mIdx === 0
                            const isLast = mIdx === group.messages.length - 1
                            
                            return (
                              <div key={m.id} className={`px-4 py-2.5 text-[13px] leading-relaxed shadow-sm transition-all hover:shadow-md ${
                                isMe 
                                  ? `bg-hb-grad text-white font-medium text-right ${
                                      isFirst ? 'rounded-t-2xl rounded-bl-2xl' : ''
                                    } ${
                                      isLast ? 'rounded-b-2xl rounded-bl-2xl' : ''
                                    } ${!isFirst && !isLast ? 'rounded-l-2xl' : ''}`
                                  : `border border-hb-border bg-hb-surface text-hb-text ${
                                      isFirst ? 'rounded-t-2xl rounded-br-2xl' : ''
                                    } ${
                                      isLast ? 'rounded-b-2xl rounded-br-2xl' : ''
                                    } ${!isFirst && !isLast ? 'rounded-r-2xl' : ''}`
                              }`}>
                                {m.content}
                              </div>
                            )
                          })}
                          
                          <div className={`flex items-center gap-1.5 mt-1 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                            <span className="font-mono text-hb-micro font-bold uppercase text-hb-dim">
                              {format(new Date(group.timestamp), 'hh:mm a')}
                            </span>
                            {isMe && (
                              group.messages[group.messages.length - 1].is_read ? (
                                <CheckCheck className="h-3.5 w-3.5 text-hb-cyan" strokeWidth={3} />
                              ) : (
                                <Check className="h-3 w-3 text-hb-dim" strokeWidth={3} />
                              )
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )
                  })
                })()
              )}
            </div>

            {/* Input Area */}
            <div className="bg-hb-surface-2 p-6">
              <form 
                onSubmit={handleSendMessage} 
                className="group relative flex items-center rounded-hb-md border border-hb-border bg-hb-surface p-1.5 shadow-hb-1 transition-all duration-hb focus-within:border-hb-blue/45"
              >
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Message..."
                  className="flex-1 border-none bg-transparent px-4 py-3 font-body text-hb-body text-hb-text outline-none placeholder:text-hb-dim"
                />
                
                 <button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  aria-busy={sending || undefined}
                  className={`flex h-10 w-10 items-center justify-center rounded-hb-sm transition-all duration-hb disabled:cursor-not-allowed ${
                    newMessage.trim()
                      ? 'bg-hb-grad text-white shadow-hb-2 hover:scale-105 active:scale-95'
                      : 'bg-hb-muted/15 text-hb-dim opacity-60'
                  }`}
                >
                  {sending ? (
                    <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
                  ) : (
                    <SendHorizontal className="w-5 h-5" />
                  )}
                </button>
              </form>
              <p className="mt-3 text-center font-mono text-hb-micro font-bold uppercase tracking-widest text-hb-dim">
                Press Enter to Send
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
