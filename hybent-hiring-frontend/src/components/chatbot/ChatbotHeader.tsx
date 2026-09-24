import { motion } from 'framer-motion'
import { Minus, X, Sparkles, History, Plus, Settings } from 'lucide-react'

interface ChatbotHeaderProps {
  onToggleHistory: () => void
  onToggleSettings: () => void
  onNewConversation: () => void
  onMinimize: () => void
  onClose: () => void
}

export function ChatbotHeader({
  onToggleHistory,
  onToggleSettings,
  onNewConversation,
  onMinimize,
  onClose,
}: ChatbotHeaderProps) {
  return (
    <div className="relative px-4 sm:px-4.5 py-3 flex items-center justify-between border-b border-slate-200/80 bg-white/95 backdrop-blur-md rounded-t-[20px]">
      {/* Brand & Logo */}
      <div className="flex items-center gap-3">
        <div className="relative w-6 h-6 flex items-center justify-center overflow-hidden">
          <img
            src="/hybent/hybent-mark.png"
            alt="Hybent"
            className="w-full h-full object-contain"
          />
        </div>

        <div className="flex flex-col justify-center">
          <h3 className="font-bold text-base text-slate-900 tracking-tight leading-none">
            Hybent AI
          </h3>
        </div>
      </div>

      {/* Control Action Buttons */}
      <div className="flex items-center gap-1">
        {/* New Chat Button */}
        <motion.button
          whileHover={{ scale: 1.1, backgroundColor: 'rgba(108, 71, 255, 0.1)' }}
          whileTap={{ scale: 0.9 }}
          onClick={onNewConversation}
          className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 transition-colors"
          title="New Conversation"
          aria-label="New Conversation"
        >
          <Plus className="w-4 h-4" />
        </motion.button>

        {/* Minimize Button */}
        <motion.button
          whileHover={{ scale: 1.1, backgroundColor: 'rgba(108, 71, 255, 0.1)' }}
          whileTap={{ scale: 0.9 }}
          onClick={onMinimize}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
          title="Minimize"
          aria-label="Minimize chatbot"
        >
          <Minus className="w-4 h-4" />
        </motion.button>

        {/* Close Button */}
        <motion.button
          whileHover={{ scale: 1.1, backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
          title="Close"
          aria-label="Close chatbot"
        >
          <X className="w-4 h-4" />
        </motion.button>
      </div>
    </div>
  )
}
