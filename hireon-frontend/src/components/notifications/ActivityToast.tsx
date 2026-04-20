import React from 'react'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { timeAgo } from '@/utils/formatters'

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
import { GlassIcon } from '@/components/common/GlassIcon'

const getIcon = (type: string) => {
  switch (type) {
    case 'job': return <GlassIcon icon="Briefcase" variant="violet" size={40} iconSize={18} glow={false} />
    case 'candidate': return <GlassIcon icon="User" variant="blue" size={40} iconSize={18} glow={false} />
    case 'interview': return <GlassIcon icon="Calendar" variant="indigo" size={40} iconSize={18} glow={false} />
    case 'application': return <GlassIcon icon="FileText" variant="indigo" size={40} iconSize={18} glow={false} />
    case 'scorecard': return <GlassIcon icon="CheckCircle" variant="emerald" size={40} iconSize={18} glow={false} />
    case 'offer': return <GlassIcon icon="PartyPopper" variant="amber" size={40} iconSize={18} glow={false} />
    default: return <GlassIcon icon="Bell" variant="violet" size={40} iconSize={18} glow={false} />
  }
}

export const ActivityToast: React.FC<ActivityToastProps> = ({ t, payload }) => {
  if (!payload || !payload.message || payload.message.trim() === '') {
    return null;
  }

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
            {getIcon(payload.resource_type)}
          </div>
          <div className="ml-4 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
                Live Activity
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              </p>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                {payload.timestamp ? timeAgo(payload.timestamp) : 'Now'}
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
