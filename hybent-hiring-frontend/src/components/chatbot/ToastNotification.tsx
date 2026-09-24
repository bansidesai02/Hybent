import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Info, AlertCircle, RotateCcw, X } from 'lucide-react'
import type { ToastItem } from './types'

interface ToastNotificationProps {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
}

export function ToastNotification({ toasts, onDismiss }: ToastNotificationProps) {
  return (
    <div className="absolute top-16 left-4 right-4 z-40 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 450, damping: 30 }}
            className="pointer-events-auto flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-slate-900/95 text-white border border-slate-700 shadow-[0_8px_24px_rgba(0,0,0,0.25)] backdrop-blur-lg text-xs font-semibold"
          >
            <div className="flex items-center gap-2">
              {toast.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              ) : toast.type === 'warning' ? (
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <span>{toast.message}</span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {toast.onUndo && (
                <button
                  onClick={() => {
                    toast.onUndo?.()
                    onDismiss(toast.id)
                  }}
                  className="px-2 py-0.5 rounded-md bg-violet-600 text-white font-bold text-[10px] flex items-center gap-1 hover:bg-violet-700 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Undo</span>
                </button>
              )}

              <button
                onClick={() => onDismiss(toast.id)}
                className="p-0.5 rounded text-slate-400 hover:text-white transition-colors"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
