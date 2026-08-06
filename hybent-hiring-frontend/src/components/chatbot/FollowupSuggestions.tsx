import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'

interface FollowupSuggestionsProps {
  suggestions: string[]
  onSelectSuggestion: (text: string) => void
}

export function FollowupSuggestions({
  suggestions,
  onSelectSuggestion,
}: FollowupSuggestionsProps) {
  if (!suggestions || suggestions.length === 0) return null

  return (
    <div className="mt-3 pt-2 border-t border-violet-100/60 dark:border-violet-900/40">
      <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-400 mb-2">
        Suggested follow-ups:
      </p>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((item, idx) => (
          <motion.button
            key={idx}
            whileHover={{ scale: 1.04, y: -1 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => onSelectSuggestion(item)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-50/80 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200/80 dark:border-violet-800/60 hover:bg-violet-100 dark:hover:bg-violet-900/80 transition-all text-left"
          >
            <span>{item}</span>
            <ArrowUpRight className="w-3 h-3 text-violet-500 shrink-0" />
          </motion.button>
        ))}
      </div>
    </div>
  )
}
