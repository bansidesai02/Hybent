import React from 'react'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'

interface ActivityToastProps {
  t: any
  payload: {
    user_id?: string
    action: string
    resource_type: string
    message: string
    timestamp: string
  }
}

const getEmoji = (type: string) => {
  switch (type) {
    case 'job': return '💼'
    case 'candidate': return '👤'
    case 'interview': return '📅'
    case 'application': return '📝'
    case 'scorecard': return '✅'
    case 'offer': return '🎉'
    default: return '🔔'
  }
}

export const ActivityToast: React.FC<ActivityToastProps> = ({ t, payload }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      key={t.id}
      className="max-w-sm w-full bg-white/95 backdrop-blur-md shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-2xl pointer-events-auto flex ring-1 ring-black/5 border border-white/20 transition-all duration-300"
    >
      <div className="flex-1 w-0 p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0 pt-0.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-transparent flex items-center justify-center border border-indigo-100/50 text-2xl shadow-inner">
              {getEmoji(payload.resource_type)}
            </div>
          </div>
          <div className="ml-4 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
                Live Activity
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              </p>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                Now
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-600 leading-snug font-medium">
              {payload.message}
            </p>
          </div>
        </div>
      </div>
      <div className="flex border-l border-gray-100/50">
        <button
          onClick={() => toast.dismiss(t.id)}
          className="w-full border border-transparent rounded-none rounded-r-2xl px-4 flex items-center justify-center text-[10px] font-black text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50/30 transition-all uppercase tracking-widest focus:outline-none"
        >
          View
        </button>
      </div>
    </motion.div>
  )
}
