import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'

interface ExitConfirmationModalProps {
  isOpen: boolean
  onClose: () => void // Continue chat
  onConfirmEnd: () => void // End conversation
}

export function ExitConfirmationModal({
  isOpen,
  onClose,
  onConfirmEnd,
}: ExitConfirmationModalProps) {
  // Listen for ESC key to close modal
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
      {/* Blurred Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-[#0c081e]/60 backdrop-blur-md rounded-[20px]"
      />

      {/* Glassmorphism Dialog Pane */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 10 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className="relative z-10 w-full max-w-[340px] p-6 rounded-[22px] bg-white/95 border border-white/60 shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl text-center"
      >
        {/* Top Dismiss Button */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Warning Icon Badge */}
        <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 text-red-500 flex items-center justify-center mx-auto mb-4 shadow-sm">
          <AlertTriangle className="w-6 h-6" />
        </div>

        {/* Title & Description */}
        <h3 className="text-lg font-bold text-[#1a1040] mb-2">
          End Conversation?
        </h3>
        <p className="text-xs text-slate-500 leading-relaxed mb-6">
          Leaving this conversation will end your current AI session. You can start a new session anytime.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5">
          {/* Danger End Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={onConfirmEnd}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-semibold shadow-md shadow-red-500/20 transition-all duration-200"
          >
            End Conversation
          </motion.button>

          {/* Secondary Continue Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#1a1040] text-xs font-semibold border border-slate-200 transition-all duration-200"
          >
            Continue Chat
          </motion.button>
        </div>
      </motion.div>
    </div>
  )
}
