import { useState } from 'react'
import {
  Copy,
  Check,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  Share2,
  Volume2,
  VolumeX,
  Edit2,
} from 'lucide-react'

interface ChatMessageActionsProps {
  isAi: boolean
  text: string
  liked?: boolean
  disliked?: boolean
  onCopy: () => void
  onRegenerate?: () => void
  onToggleLike?: () => void
  onToggleDislike?: () => void
  onShare?: () => void
  onEditUserMsg?: () => void
}

export function ChatMessageActions({
  isAi,
  text,
  liked,
  disliked,
  onCopy,
  onRegenerate,
  onToggleLike,
  onToggleDislike,
  onShare,
  onEditUserMsg,
}: ChatMessageActionsProps) {
  const [copied, setCopied] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)

  const handleCopy = () => {
    onCopy()
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSpeech = () => {
    if ('speechSynthesis' in window) {
      if (isSpeaking) {
        window.speechSynthesis.cancel()
        setIsSpeaking(false)
      } else {
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(text.replace(/[*#_`]/g, ''))
        utterance.rate = 1.0
        utterance.onend = () => setIsSpeaking(false)
        utterance.onerror = () => setIsSpeaking(false)
        setIsSpeaking(true)
        window.speechSynthesis.speak(utterance)
      }
    }
  }

  if (isAi) {
    return (
      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1 mt-1.5 px-1">
        {/* Copy */}
        <button
          onClick={handleCopy}
          className="p-1 rounded-md text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors flex items-center gap-1 text-[11px]"
          title="Copy response"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-emerald-500 font-semibold">Copied</span>
            </>
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Regenerate */}
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            className="p-1 rounded-md text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
            title="Regenerate response"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Like */}
        {onToggleLike && (
          <button
            onClick={onToggleLike}
            className={`p-1 rounded-md transition-colors ${
              liked
                ? 'text-emerald-500 bg-emerald-50'
                : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50'
            }`}
            title="Good response"
          >
            <ThumbsUp className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Dislike */}
        {onToggleDislike && (
          <button
            onClick={onToggleDislike}
            className={`p-1 rounded-md transition-colors ${
              disliked
                ? 'text-red-500 bg-red-50'
                : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
            }`}
            title="Bad response"
          >
            <ThumbsDown className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Share */}
        {onShare && (
          <button
            onClick={onShare}
            className="p-1 rounded-md text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
            title="Share message"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Read Aloud */}
        <button
          onClick={handleSpeech}
          className={`p-1 rounded-md transition-colors ${
            isSpeaking
              ? 'text-violet-600 bg-violet-100 animate-pulse'
              : 'text-slate-400 hover:text-violet-600 hover:bg-violet-50'
          }`}
          title={isSpeaking ? 'Stop reading' : 'Read aloud'}
        >
          {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    )
  }

  // User Message Actions (Edit)
  return (
    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1 mt-1 px-1">
      {onEditUserMsg && (
        <button
          onClick={onEditUserMsg}
          className="p-1 rounded-md text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors flex items-center gap-1 text-[11px]"
          title="Edit message"
        >
          <Edit2 className="w-3.5 h-3.5" />
          <span>Edit</span>
        </button>
      )}
    </div>
  )
}
