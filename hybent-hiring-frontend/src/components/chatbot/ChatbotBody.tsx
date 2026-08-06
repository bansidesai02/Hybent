import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { SuggestionChips } from './SuggestionChips'
import { ChatMessage } from './ChatMessage'
import type { ChatMessageItem, SuggestionChip, ChatSettings } from './types'

interface ChatbotBodyProps {
  messages: ChatMessageItem[]
  isTyping: boolean
  onSelectChip: (chip: SuggestionChip) => void
  showChips: boolean
  settings?: ChatSettings
  onRegenerate?: () => void
  onToggleLike?: (msgId: string) => void
  onToggleDislike?: (msgId: string) => void
  onShare?: (msgId: string) => void
  onEditUserMessage?: (oldMsgId: string, newText: string) => void
  onSelectFollowup?: (text: string) => void
  onShowToast?: (msg: string) => void
}

export function ChatbotBody({
  messages,
  isTyping,
  onSelectChip,
  showChips,
  settings,
  onRegenerate,
  onToggleLike,
  onToggleDislike,
  onShare,
  onEditUserMessage,
  onSelectFollowup,
  onShowToast,
}: ChatbotBodyProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  const autoScroll = settings?.autoScroll ?? true
  const showTypingIndicator = settings?.showTypingIndicator ?? true

  // Auto scroll to bottom when messages or typing state update
  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isTyping, autoScroll])

  return (
    <div
      role="log"
      aria-live="polite"
      aria-relevant="additions text"
      className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-white scrollbar-thin scrollbar-thumb-slate-200"
    >
      {/* Message List */}
      {messages.map((message) => (
        <ChatMessage
          key={message.id}
          message={message}
          showTimestamps={settings?.showTimestamps}
          density={settings?.density}
          showSuggestions={settings?.showSuggestions}
          onRegenerate={onRegenerate}
          onToggleLike={() => onToggleLike && onToggleLike(message.id)}
          onToggleDislike={() => onToggleDislike && onToggleDislike(message.id)}
          onShare={() => onShare && onShare(message.id)}
          onEditUserMessage={onEditUserMessage}
          onSelectFollowup={onSelectFollowup}
          onShowToast={onShowToast}
        />
      ))}

      {/* Typing Indicator Loading State */}
      {isTyping && showTypingIndicator && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="flex items-start gap-3 my-3"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 via-violet-500 to-pink-500 p-[1.5px] shadow-sm flex items-center justify-center shrink-0">
            <div className="w-full h-full bg-[#1e143b] rounded-[10px] flex items-center justify-center overflow-hidden">
              <img
                src="/hybent/hybent-mark.png"
                alt="Hybent AI"
                className="w-5 h-5 object-contain"
                onError={(e) => {
                  const target = e.currentTarget
                  target.style.display = 'none'
                }}
              />
            </div>
          </div>

          <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white/95 dark:bg-[#1a1433]/90 border border-violet-100 dark:border-violet-800/40 text-slate-500 dark:text-slate-300 text-xs flex items-center gap-2 shadow-[0_4px_16px_rgba(108,71,255,0.06)]">
            <span className="font-medium">Hybent AI is thinking</span>
            <div className="flex items-center gap-1">
              <motion.span
                animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }}
                transition={{ repeat: Infinity, duration: 0.9, delay: 0 }}
                className="w-1.5 h-1.5 rounded-full bg-violet-600 dark:bg-violet-400"
              />
              <motion.span
                animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }}
                transition={{ repeat: Infinity, duration: 0.9, delay: 0.2 }}
                className="w-1.5 h-1.5 rounded-full bg-violet-600 dark:bg-violet-400"
              />
              <motion.span
                animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }}
                transition={{ repeat: Infinity, duration: 0.9, delay: 0.4 }}
                className="w-1.5 h-1.5 rounded-full bg-violet-600 dark:bg-violet-400"
              />
            </div>
          </div>
        </motion.div>
      )}

      {/* Suggestion Chips */}
      {showChips && (settings?.showSuggestions ?? true) && (
        <div className="ml-11 mt-1 mb-2">
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-400 mb-2">
            Suggested topics
          </p>
          <SuggestionChips onSelectChip={onSelectChip} />
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
