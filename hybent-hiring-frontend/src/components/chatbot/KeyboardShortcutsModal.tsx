import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Command, X, Keyboard } from 'lucide-react'

interface KeyboardShortcutsModalProps {
  isOpen: boolean
  onClose: () => void
}

const SHORTCUTS = [
  { key: 'Ctrl + K', desc: 'Focus Search / History' },
  { key: 'Ctrl + N', desc: 'Start New Conversation' },
  { key: 'Ctrl + /', desc: 'Toggle Shortcuts Help' },
  { key: 'ESC', desc: 'Close Drawers & Modals' },
  { key: 'Enter', desc: 'Send Message' },
  { key: 'Shift + Enter', desc: 'Insert New Line' },
  { key: 'Arrow Up', desc: 'Edit Previous User Message' },
]

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
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
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-[#0c081e]/60 backdrop-blur-md rounded-[20px]"
      />

      {/* Pane */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 10 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className="relative z-10 w-full max-w-[340px] p-5 rounded-[22px] bg-white/95 dark:bg-[#1a1236]/95 border border-white/60 dark:border-violet-500/30 shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl"
      >
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          aria-label="Close shortcuts modal"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-4 text-[#1a1040] dark:text-white">
          <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400">
            <Keyboard className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm leading-tight">Keyboard Shortcuts</h3>
            <p className="text-[11px] text-slate-400">Boost your productivity</p>
          </div>
        </div>

        <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1 scrollbar-thin">
          {SHORTCUTS.map((s, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-slate-800 text-xs"
            >
              <span className="text-slate-600 dark:text-slate-300 font-medium text-[11px]">
                {s.desc}
              </span>
              <kbd className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-mono font-bold text-violet-700 dark:text-violet-300 shadow-xs">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="mt-4 text-center">
          <button
            onClick={onClose}
            className="w-full py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition-colors"
          >
            Got it
          </button>
        </div>
      </motion.div>
    </div>
  )
}
