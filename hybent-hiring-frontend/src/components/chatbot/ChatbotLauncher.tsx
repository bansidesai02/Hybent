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
    <div className="relative inline-flex overflow-visible pt-0.5 pr-0.5">
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
      </motion.button>

      {/* Outside button — overflow-hidden on the button was clipping the badge */}
      {!isOpen && hasUnread && (
        <>
          <span
            className="pointer-events-none absolute top-1.5 right-1.5 z-10 h-5 w-5"
            aria-hidden="true"
          >
            <span className="absolute inset-0 animate-ping rounded-full bg-pink-400 opacity-75" />
          </span>
          <span
            className="pointer-events-none absolute top-1.5 right-1.5 z-20 box-border flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-white bg-pink-500 px-1 text-[11px] font-bold leading-none tabular-nums text-white shadow-sm"
            aria-hidden="true"
          >
            1
          </span>
        </>
      )}
    </div>
  )
}
