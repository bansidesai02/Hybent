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
import { Bell, Briefcase, CalendarDays, CheckCircle, FileText, Trophy, User } from 'lucide-react'
import { IconTile } from '@/components/hb'

/* One tile, one glyph. `GlassIcon` gave each of these seven types its own
   accent variant, which is a legend for something the toast already says in
   words. */
const getIcon = (type: string) => {
  const glyph =
    type === 'job' ? <Briefcase /> :
    type === 'candidate' ? <User /> :
    type === 'interview' ? <CalendarDays /> :
    type === 'application' ? <FileText /> :
    type === 'scorecard' ? <CheckCircle /> :
    type === 'offer' ? <Trophy /> :
    <Bell />
  return <IconTile size="sm">{glyph}</IconTile>
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
      className="max-w-sm w-full bg-hb-elevated/95 backdrop-blur-md shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-2xl pointer-events-auto flex ring-1 ring-black/5 border border-hb-border transition-all duration-300"
    >
      <div className="flex-1 w-0 p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0 pt-0.5">
            {getIcon(payload.resource_type)}
          </div>
          <div className="ml-4 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-hb-text flex items-center gap-2">
                Live Activity
                <span className="w-1.5 h-1.5 rounded-full bg-hb-success animate-pulse" />
              </p>
              <span className="font-mono text-hb-micro font-bold uppercase text-hb-dim">
                {payload.timestamp ? timeAgo(payload.timestamp) : 'Now'}
              </span>
            </div>
            <p className="mt-1 text-sm text-hb-muted leading-snug font-medium">
              {payload.message}
            </p>
          </div>
        </div>
      </div>
      <div className="flex border-l border-hb-border">
        <button
          onClick={() => toast.dismiss(t.id)}
          className="flex w-full items-center justify-center rounded-r-2xl border border-transparent px-4 font-mono text-hb-micro font-bold uppercase tracking-widest text-hb-cyan transition-all duration-hb hover:bg-hb-surface-2 hover:text-hb-text focus:outline-none"
        >
          View
        </button>
      </div>
    </motion.div>
  )
}
