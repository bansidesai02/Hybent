import { motion } from 'framer-motion'
import {
  Sparkles,
  Layers,
  Briefcase,
  DollarSign,
  Calendar,
  UserPlus,
} from 'lucide-react'
import type { SuggestionChip } from './types'

export const DEFAULT_SUGGESTION_CHIPS: SuggestionChip[] = [
  { id: '1', label: 'Tell me about Hybent', query: 'Tell me about Hybent', iconName: 'Sparkles' },
  { id: '2', label: 'Services', query: 'What services does Hybent offer?', iconName: 'Layers' },
  { id: '3', label: 'Products', query: 'Tell me about Hybent products like Hybent Hiring', iconName: 'Briefcase' },
  { id: '4', label: 'Pricing', query: 'How does Hybent pricing work?', iconName: 'DollarSign' },
  { id: '5', label: 'Book a Meeting', query: 'How can I book a meeting or schedule a demo?', iconName: 'Calendar' },
  { id: '6', label: 'Careers', query: 'What career opportunities are available at Hybent?', iconName: 'UserPlus' },
]

interface SuggestionChipsProps {
  chips?: SuggestionChip[]
  onSelectChip: (chip: SuggestionChip) => void
}

const getChipIcon = (iconName?: string) => {
  switch (iconName) {
    case 'Sparkles':
      return <Sparkles className="w-3.5 h-3.5 text-violet-600 shrink-0" />
    case 'Layers':
      return <Layers className="w-3.5 h-3.5 text-teal-600 shrink-0" />
    case 'Briefcase':
      return <Briefcase className="w-3.5 h-3.5 text-purple-600 shrink-0" />
    case 'DollarSign':
      return <DollarSign className="w-3.5 h-3.5 text-amber-600 shrink-0" />
    case 'Calendar':
      return <Calendar className="w-3.5 h-3.5 text-pink-600 shrink-0" />
    case 'UserPlus':
      return <UserPlus className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
    default:
      return <Sparkles className="w-3.5 h-3.5 text-violet-600 shrink-0" />
  }
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 350, damping: 25 },
  },
}

export function SuggestionChips({
  chips = DEFAULT_SUGGESTION_CHIPS,
  onSelectChip,
}: SuggestionChipsProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-wrap gap-2 pt-2 pb-1"
    >
      {chips.map((chip) => (
        <motion.button
          key={chip.id}
          variants={itemVariants}
          whileHover={{
            scale: 1.04,
            y: -2,
            boxShadow: '0 8px 20px rgba(108, 71, 255, 0.15)',
          }}
          whileTap={{ scale: 0.96 }}
          onClick={() => onSelectChip(chip)}
          className="group flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white text-slate-800 hover:text-violet-700 hover:bg-violet-50/80 border border-slate-200 hover:border-violet-300 shadow-xs hover:shadow-sm transition-all duration-200 text-left cursor-pointer"
        >
          {getChipIcon(chip.iconName)}
          <span>{chip.label}</span>
        </motion.button>
      ))}
    </motion.div>
  )
}
