import { useState, memo } from 'react'
import { motion } from 'framer-motion'
import { User, Check, X } from 'lucide-react'
import { MarkdownRenderer } from './MarkdownRenderer'
import { RichResponseCard } from './RichResponseCard'
import { FollowupSuggestions } from './FollowupSuggestions'
import { ChatMessageActions } from './ChatMessageActions'
import type { ChatMessageItem } from './types'

interface ChatMessageProps {
  message: ChatMessageItem
  showTimestamps?: boolean
  density?: 'comfortable' | 'compact'
  showSuggestions?: boolean
  onRegenerate?: () => void
  onToggleLike?: () => void
  onToggleDislike?: () => void
  onShare?: () => void
  onEditUserMessage?: (oldMsgId: string, newText: string) => void
  onSelectFollowup?: (text: string) => void
  onShowToast?: (msg: string) => void
}

function ChatMessageComponent({
  message,
  showTimestamps = true,
  density = 'comfortable',
  showSuggestions = true,
  onRegenerate,
  onToggleLike,
  onToggleDislike,
  onShare,
  onEditUserMessage,
  onSelectFollowup,
  onShowToast,
}: ChatMessageProps) {
  const isAi = message.sender === 'ai'
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(message.text)
  const [imgError, setImgError] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.text)
      if (onShowToast) onShowToast('Copied markdown to clipboard!')
    } catch {
      // Fallback
    }
  }

  const handleSaveEdit = () => {
    if (editText.trim() && onEditUserMessage) {
      onEditUserMessage(message.id, editText.trim())
      setIsEditing(false)
    }
  }

  const isCompact = density === 'compact'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={`group relative flex items-start gap-3 ${
        isCompact ? 'my-2' : 'my-3.5'
      } ${isAi ? 'flex-row' : 'flex-row-reverse'}`}
    >
      {/* Avatar */}
      <div className="shrink-0 mt-0.5">
        {isAi ? (
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 via-violet-500 to-pink-500 p-[1.5px] shadow-sm flex items-center justify-center">
            <div className="w-full h-full bg-[#1e143b] rounded-[10px] flex items-center justify-center overflow-hidden">
              {imgError ? (
                <span className="text-white text-xs font-bold">H</span>
              ) : (
                <img
                  src="/hybent/hybent-mark.png"
                  alt="Hybent AI"
                  width={20}
                  height={20}
                  loading="lazy"
                  decoding="async"
                  className="w-5 h-5 object-contain"
                  onError={() => setImgError(true)}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white flex items-center justify-center shadow-sm">
            <User className="w-4 h-4" />
          </div>
        )}
      </div>

      {/* Message Content Area */}
      <div
        className={`max-w-[85%] sm:max-w-[82%] flex flex-col ${
          isAi ? 'items-start' : 'items-end'
        }`}
      >
        {/* Header Metadata */}
        {showTimestamps && (
          <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-slate-400">
            <span className="font-semibold text-slate-600">
              {isAi ? 'Hybent AI' : 'You'}
            </span>
            <span>•</span>
            <span>{message.timestamp}</span>
          </div>
        )}

        {/* Message Bubble */}
        <div
          className={`relative ${
            isCompact ? 'px-3.5 py-2 text-xs' : 'px-4 py-3 text-sm'
          } rounded-2xl leading-relaxed ${
            isAi
              ? 'bg-white text-slate-800 border border-slate-200 rounded-tl-sm shadow-xs'
              : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-tr-sm shadow-xs'
          }`}
        >
          {isEditing ? (
            <div className="flex flex-col gap-2 min-w-[240px]">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={2}
                className="w-full p-2 text-xs text-slate-900 bg-white border border-violet-400 rounded-lg focus:outline-none resize-none"
              />
              <div className="flex items-center justify-end gap-1.5">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold bg-white/20 hover:bg-white/30 text-white flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold bg-white text-violet-700 hover:bg-slate-100 flex items-center gap-1 shadow-sm"
                >
                  <Check className="w-3 h-3" />
                  Save & Resend
                </button>
              </div>
            </div>
          ) : isAi ? (
            <div>
              <MarkdownRenderer content={message.text} />

              {/* Rich Card payload if available */}
              {message.richCard && <RichResponseCard card={message.richCard} />}

              {/* Streaming Cursor Indicator */}
              {message.isStreaming && (
                <span className="inline-block w-2 h-4 ml-1 bg-violet-500 animate-pulse rounded-xs align-middle" />
              )}

              {/* Followup suggestions */}
              {showSuggestions && message.followups && onSelectFollowup && (
                <FollowupSuggestions
                  suggestions={message.followups}
                  onSelectSuggestion={onSelectFollowup}
                />
              )}
            </div>
          ) : (
            <div className="whitespace-pre-wrap break-words">{message.text}</div>
          )}
        </div>

        {/* Hover Action Bar */}
        {!message.isStreaming && !isEditing && (
          <ChatMessageActions
            isAi={isAi}
            text={message.text}
            liked={message.liked}
            disliked={message.disliked}
            onCopy={handleCopy}
            onRegenerate={onRegenerate}
            onToggleLike={onToggleLike}
            onToggleDislike={onToggleDislike}
            onShare={onShare}
            onEditUserMsg={() => setIsEditing(true)}
          />
        )}
      </div>
    </motion.div>
  )
}

export const ChatMessage = memo(ChatMessageComponent, (prevProps, nextProps) => {
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.text === nextProps.message.text &&
    prevProps.message.isStreaming === nextProps.message.isStreaming &&
    prevProps.message.liked === nextProps.message.liked &&
    prevProps.message.disliked === nextProps.message.disliked &&
    prevProps.density === nextProps.density &&
    prevProps.showTimestamps === nextProps.showTimestamps
  )
})
