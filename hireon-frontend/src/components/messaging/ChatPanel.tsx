import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { messagesApi, type Message } from '@/api/messages'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { X, MessageSquare, Check, SendHorizontal } from 'lucide-react'

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
      setMessages((prev) => [...prev, res.data])
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
      if (msg.sender_id === recipient.id) {
        setMessages((prev) => [...prev, msg])
      }
    }
    window.addEventListener('ws:new_message', handleNewMessage)
    return () => window.removeEventListener('ws:new_message', handleNewMessage)
  }, [recipient.id])

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
            className="fixed top-0 right-0 bottom-0 z-[70] w-full max-w-[420px] bg-white dark:bg-[var(--card-bg)] shadow-[-20px_0_50px_rgba(0,0,0,0.2)] flex flex-col border-l border-gray-100 dark:border-[var(--card-border)]"
          >
            {/* Header */}
            <div className="p-5 border-b border-gray-100 dark:border-[var(--card-border)] flex items-center justify-between bg-gray-50 dark:bg-[var(--bg2)] sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar name={recipient.full_name} src={recipient.avatar_url || ''} size="md" className="border-2 border-white dark:border-[var(--card-border)] shadow-sm" />
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full animate-pulse" />
                </div>
                <div>
                  <h3 className="text-[15px] font-extrabold text-gray-900 dark:text-[var(--text)] tracking-tight">{recipient.full_name}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <p className="text-[10px] text-gray-500 dark:text-[var(--text-mid)] font-bold uppercase tracking-wider">Active Now</p>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-all active:scale-90"
              >
                <X className="w-5 h-5" strokeWidth={2.5} />
              </button>
            </div>

            {/* Messages Area */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth scrollbar-none"
              style={{
                backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(108,71,255,0.03) 1px, transparent 0)',
                backgroundSize: '24px 24px'
              }}
            >


              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="relative w-10 h-10">
                    <div className="absolute inset-0 border-4 border-[var(--violet)]/20 rounded-full" />
                    <div className="absolute inset-0 border-4 border-t-[var(--violet)] rounded-full animate-spin" />
                  </div>
                  <p className="text-xs font-bold text-gray-400 animate-pulse">Loading conversation...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-10">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[var(--violet)]/5 to-indigo-50 dark:from-[var(--violet)]/10 dark:to-indigo-950/20 flex items-center justify-center mb-6 shadow-sm rotate-3">
                    <MessageSquare className="w-10 h-10 text-[var(--violet)]/50" strokeWidth={1.5} />
                  </div>
                  <h4 className="text-base font-black text-gray-900 dark:text-[var(--text)]">Say hello!</h4>
                  <p className="text-xs text-gray-500 mt-2 leading-relaxed">
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
                                  ? `bg-gradient-to-br from-[var(--violet)] to-indigo-600 text-white font-medium text-right ${
                                      isFirst ? 'rounded-t-2xl rounded-bl-2xl' : ''
                                    } ${
                                      isLast ? 'rounded-b-2xl rounded-bl-2xl' : ''
                                    } ${!isFirst && !isLast ? 'rounded-l-2xl' : ''}`
                                  : `bg-white dark:bg-[#25213d] text-gray-800 dark:text-gray-100 border border-gray-100 dark:border-[#2e2855] ${
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
                            <span className="text-[9px] font-bold text-gray-400 uppercase">
                              {format(new Date(group.timestamp), 'hh:mm a')}
                            </span>
                            {isMe && (
                              <Check className="w-3 h-3 text-[var(--violet)]" strokeWidth={3} />
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
            <div className="p-6 bg-gray-50 dark:bg-[var(--bg2)]">
              <form 
                onSubmit={handleSendMessage} 
                className="relative flex items-center bg-white dark:bg-[#1e1a35] rounded-2xl shadow-[0_10px_30px_rgba(108,71,255,0.08)] dark:shadow-none p-1.5 border border-gray-100 dark:border-[#2e2855] group focus-within:ring-2 focus-within:ring-[var(--violet)]/20 transition-all font-sans"
              >
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Message..."
                  className="flex-1 bg-transparent border-none px-4 py-3 text-[14px] outline-none dark:text-[var(--text)] placeholder:text-gray-400 font-medium"
                />
                
                 <button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all ${
                    newMessage.trim() 
                      ? 'bg-[var(--violet)] text-white shadow-lg shadow-violet-200 dark:shadow-none hover:scale-105 active:scale-95' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-400 opacity-50'
                  }`}
                >
                  <SendHorizontal className="w-5 h-5" />
                </button>
              </form>
              <p className="text-[9px] text-center text-gray-400 mt-3 font-bold uppercase tracking-widest opacity-60">
                Press Enter to Send
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
