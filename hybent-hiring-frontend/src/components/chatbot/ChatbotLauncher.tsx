import { motion } from 'framer-motion'
import { ChevronDown, Sparkles } from 'lucide-react'

interface ChatbotLauncherProps {
  isOpen: boolean
  hasUnread: boolean
  onClick: () => void
}

export function ChatbotLauncher({
  isOpen,
  hasUnread,
  onClick,
}: ChatbotLauncherProps) {
  return (
    <div className="relative">
      {/* Outer Pulse Animation Ring */}
      {!isOpen && (
        <span className="absolute -inset-2 rounded-full bg-gradient-to-r from-violet-600 via-pink-500 to-teal-400 opacity-60 blur-md animate-pulse pointer-events-none" />
      )}

      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={onClick}
        className="relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-[#6c47ff] via-[#8b6bff] to-[#ff6bc6] text-white shadow-[0_8px_32px_rgba(108,71,255,0.45)] border border-white/30 cursor-pointer overflow-hidden group"
        aria-label={isOpen ? 'Close chat' : 'Open Hybent AI assistant'}
        title={isOpen ? 'Close chat' : 'Ask Hybent AI'}
      >
        {/* Shine hover effect */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />

        {/* Icons switch animation */}
        <motion.div
          initial={false}
          animate={{ rotate: isOpen ? 180 : 0, scale: isOpen ? 1.1 : 1 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="flex items-center justify-center"
        >
          {isOpen ? (
            <ChevronDown className="w-7 h-7 text-white" />
          ) : (
            <div className="relative flex items-center justify-center w-7 h-7">
              <img
                src="/hybent/hybent-mark.png"
                alt="Hybent AI"
                className="w-full h-full object-contain filter drop-shadow"
                onError={(e) => {
                  const target = e.currentTarget
                  target.style.display = 'none'
                }}
              />
              <Sparkles className="w-3.5 h-3.5 text-amber-300 absolute -top-1 -right-1 animate-pulse" />
            </div>
          )}
        </motion.div>

        {/* Unread Notification Pulse Badge */}
        {!isOpen && hasUnread && (
          <span className="absolute top-0 right-0 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-pink-500 border-2 border-white text-[9px] font-bold text-white items-center justify-center">
              1
            </span>
          </span>
        )}
      </motion.button>
    </div>
  )
}
