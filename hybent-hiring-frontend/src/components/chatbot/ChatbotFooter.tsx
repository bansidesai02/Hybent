import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Paperclip, Send, X, FileText } from 'lucide-react'
import { useRotatingPlaceholder } from './useRotatingPlaceholder'
import { playSentSound } from './soundUtils'

interface ChatbotFooterProps {
  onSendMessage: (text: string) => void
  disabled?: boolean
  soundEnabled?: boolean
}

export function ChatbotFooter({ onSendMessage, disabled, soundEnabled = true }: ChatbotFooterProps) {
  const [inputValue, setInputValue] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [attachedFile, setAttachedFile] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const rotatingPlaceholder = useRotatingPlaceholder(3500)

  // Auto resize textarea height based on scrollHeight
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        140
      )}px`
    }
  }, [inputValue])

  const handleSend = () => {
    if (disabled) return
    const trimmed = inputValue.trim()
    if (!trimmed && !attachedFile) return

    let finalMessage = trimmed
    if (attachedFile) {
      finalMessage = `[Attached File: \`${attachedFile}\`]\n\n${trimmed}`
    }

    if (soundEnabled) {
      playSentSound()
    }

    onSendMessage(finalMessage)
    setInputValue('')
    setAttachedFile(null)
    setIsListening(false)

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAttachedFile(file.name)
    }
  }

  const toggleListening = () => {
    setIsListening((prev) => !prev)
  }

  return (
    <div className="p-3.5 pt-2 border-t border-slate-200/80 bg-white rounded-b-[20px]">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        aria-label="Attach file"
      />

      {/* Attached file preview chip */}
      <AnimatePresence>
        {attachedFile && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: 6 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: 6 }}
            className="mb-2"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-50 border border-violet-200 text-xs text-violet-700">
              <FileText className="w-3.5 h-3.5" />
              <span className="truncate max-w-[200px] font-medium">
                {attachedFile}
              </span>
              <button
                onClick={() => setAttachedFile(null)}
                className="hover:text-red-500 transition-colors ml-1"
                aria-label="Remove attachment"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Box Container */}
      <div className="relative flex flex-col bg-white border border-slate-200 rounded-[18px] shadow-sm focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/20 transition-all duration-200 overflow-hidden">
        {/* Auto Growing Textarea with Rotating Placeholder */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={rotatingPlaceholder}
          disabled={disabled}
          className="w-full px-3.5 pt-3 pb-1.5 text-xs bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none resize-none min-h-[40px] max-h-[120px] leading-relaxed scrollbar-hide disabled:opacity-60 transition-all duration-300"
        />

        {/* Action Controls Row */}
        <div className="flex items-center justify-between px-3 pb-2.5 pt-1 bg-white">
          <div className="flex items-center gap-1">
            {/* Microphone Button */}

            {/* Microphone Button */}
            <motion.button
              whileHover={{ scale: 1.1, backgroundColor: 'rgba(108, 71, 255, 0.08)' }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleListening}
              disabled={disabled}
              className={`p-2 rounded-xl transition-colors disabled:opacity-50 ${
                isListening
                  ? 'text-red-500 bg-red-50 animate-pulse'
                  : 'text-slate-400 hover:text-violet-600'
              }`}
              title={isListening ? 'Listening...' : 'Use voice'}
              aria-label="Use voice input"
            >
              <Mic className="w-4 h-4" />
            </motion.button>
          </div>

          {/* Send Button with Hybent Logo Gradient */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            onClick={handleSend}
            disabled={disabled || (!inputValue.trim() && !attachedFile)}
            className={`p-2.5 rounded-xl flex items-center justify-center transition-all duration-200 ${
              (inputValue.trim() || attachedFile) && !disabled
                ? 'bg-gradient-to-r from-violet-600 via-indigo-600 to-pink-500 text-white shadow-md shadow-violet-500/30 cursor-pointer'
                : 'bg-gradient-to-r from-violet-500/80 via-indigo-500/80 to-pink-500/80 text-white opacity-80 cursor-pointer'
            }`}
            title="Send message (Enter)"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </div>
  )
}
