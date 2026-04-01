import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { messagesApi, type Message } from '@/api/messages'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

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
            className="fixed top-0 right-0 bottom-0 z-[70] w-full max-w-[420px] bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl shadow-[-20px_0_50px_rgba(0,0,0,0.1)] flex flex-col border-l border-white/20"
          >
            {/* Header */}
            <div className="p-5 border-b border-gray-100/50 dark:border-gray-800/50 flex items-center justify-between bg-white/40 dark:bg-gray-900/40 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar name={recipient.full_name} src={recipient.avatar_url || ''} size="md" className="border-2 border-white dark:border-gray-800 shadow-sm" />
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full animate-pulse" />
                </div>
                <div>
                  <h3 className="text-[15px] font-extrabold text-gray-900 dark:text-white tracking-tight">{recipient.full_name}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">Active Now</p>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-all active:scale-90"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
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
              <div className="flex justify-center mb-4">
                <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Secure End-to-End Encryption
                </span>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="relative w-10 h-10">
                    <div className="absolute inset-0 border-4 border-violet-500/20 rounded-full" />
                    <div className="absolute inset-0 border-4 border-t-violet-600 rounded-full animate-spin" />
                  </div>
                  <p className="text-xs font-bold text-gray-400 animate-pulse">Loading conversation...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-10">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/20 flex items-center justify-center mb-6 shadow-sm rotate-3">
                    <svg className="w-10 h-10 text-violet-500/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h4 className="text-base font-black text-gray-900 dark:text-white">Say hello!</h4>
                  <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                    Start your conversation with <b>{recipient.full_name}</b>. Messages are private to your organization.
                  </p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isMe = msg.sender_id === currentUser?.id
                  const showAvatar = index === 0 || messages[index-1]?.sender_id !== msg.sender_id
                  
                  return (
                    <motion.div 
                      key={msg.id} 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      {!isMe && (
                        <div className="w-8 flex-shrink-0 self-end mb-5">
                          {showAvatar && <Avatar name={recipient.full_name} src={recipient.avatar_url || ''} size="xs" />}
                        </div>
                      )}
                      
                      <div className={`max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <div className={`px-4 py-3 rounded-2xl text-[13.5px] leading-relaxed shadow-sm transition-all hover:shadow-md ${
                          isMe 
                            ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-br-none font-medium text-right' 
                            : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-bl-none border border-gray-100 dark:border-gray-700/50'
                        }`}>
                          {msg.content}
                        </div>
                        <div className={`flex items-center gap-1.5 mt-1.5 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                          <span className="text-[9px] font-bold text-gray-400/80 uppercase">
                            {format(new Date(msg.created_at), 'hh:mm a')}
                          </span>
                          {isMe && (
                            <svg className="w-3 h-3 text-violet-400" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293l-4 4a1 1 0 01-1.414 0l-2-2a1 1 0 111.414-1.414L9 10.586l3.293-3.293a1 1 0 111.414 1.414z" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )
                })
              )}
            </div>

            {/* Input Area */}
            <div className="p-6 bg-white/40 dark:bg-gray-900/40 backdrop-blur-md">
              <form 
                onSubmit={handleSendMessage} 
                className="relative flex items-center bg-white dark:bg-gray-800 rounded-2xl shadow-[0_10px_30px_rgba(108,71,255,0.08)] dark:shadow-none p-1.5 border border-gray-100 dark:border-gray-700 group focus-within:ring-2 focus-within:ring-violet-500/20 transition-all font-sans"
              >
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Message..."
                  className="flex-1 bg-transparent border-none px-4 py-3 text-[14px] outline-none dark:text-white placeholder:text-gray-400 font-medium"
                />
                
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all ${
                    newMessage.trim() 
                      ? 'bg-violet-600 text-white shadow-lg shadow-violet-200 dark:shadow-none hover:scale-105 active:scale-95' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-400 opacity-50'
                  }`}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                  </svg>
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
