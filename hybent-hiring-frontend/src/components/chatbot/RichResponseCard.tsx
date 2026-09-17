import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Layers,
  Users,
  Zap,
  DollarSign,
  ChevronDown,
  Clock,
  Table,
  Calendar,
  Briefcase,
  FileText,
} from 'lucide-react'
import type { RichCardData } from './types'

interface RichResponseCardProps {
  card: RichCardData
}

export function RichResponseCard({ card }: RichResponseCardProps) {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0)

  const getCardIcon = () => {
    switch (card.type) {
      case 'product':
        return <Users className="w-5 h-5 text-violet-600" />
      case 'service':
        return <Layers className="w-5 h-5 text-teal-600" />
      case 'pricing':
        return <DollarSign className="w-5 h-5 text-amber-600" />
      case 'timeline':
        return <Clock className="w-5 h-5 text-indigo-600" />
      case 'comparison_table':
        return <Table className="w-5 h-5 text-purple-600" />
      case 'cta_actions':
        return <Calendar className="w-5 h-5 text-emerald-600" />
      default:
        return <Zap className="w-5 h-5 text-pink-600" />
    }
  }

  // FAQ Accordion Card
  if (card.type === 'faq_accordion' && card.items) {
    return (
      <div className="my-3 p-4 rounded-2xl bg-white border border-violet-200/80 shadow-md">
        <h4 className="text-sm font-bold text-[#1a1040] mb-3 flex items-center gap-2">
          {getCardIcon()}
          <span>{card.title}</span>
        </h4>
        <div className="space-y-2">
          {card.items.map((item, idx) => {
            const isOpen = openFaqIndex === idx
            return (
              <div
                key={idx}
                className="rounded-xl border border-violet-100 overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  className="w-full px-3 py-2.5 bg-violet-50/50 flex items-center justify-between text-left text-xs font-semibold text-slate-800"
                >
                  <span>{item.label}</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-violet-600' : 'text-slate-400'
                    }`}
                  />
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-3 py-2 text-xs text-slate-600 bg-white"
                    >
                      {item.value}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Development Timeline Card
  if (card.type === 'timeline' && card.items) {
    return (
      <div className="my-3 p-4 rounded-2xl bg-white border border-violet-200/80 shadow-md">
        <h4 className="text-sm font-bold text-[#1a1040] mb-3 flex items-center gap-2">
          {getCardIcon()}
          <span>{card.title}</span>
        </h4>
        <div className="relative pl-4 space-y-3 border-l-2 border-violet-300">
          {card.items.map((step, idx) => (
            <div key={idx} className="relative">
              <div className="absolute -left-[21px] top-1 w-3.5 h-3.5 rounded-full bg-violet-600 border-2 border-white" />
              <div className="text-xs font-bold text-slate-800">
                {step.label}
              </div>
              <div className="text-[11px] text-slate-500">
                {step.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Comparison Table Card
  if (card.type === 'comparison_table' && card.tableHeaders && card.tableRows) {
    return (
      <div className="my-3 p-4 rounded-2xl bg-white border border-violet-200/80 shadow-md overflow-x-auto">
        <h4 className="text-sm font-bold text-[#1a1040] mb-3 flex items-center gap-2">
          {getCardIcon()}
          <span>{card.title}</span>
        </h4>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-violet-100">
              {card.tableHeaders.map((h, idx) => (
                <th key={idx} className="pb-2 font-bold text-violet-700">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {card.tableRows.map((row, rIdx) => (
              <tr key={rIdx} className="border-b border-slate-100">
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="py-2 text-slate-600">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // Contextual CTA Actions Buttons Card
  if (card.type === 'cta_actions' && card.actions) {
    return (
      <div className="my-3 p-4 rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-700 text-white shadow-lg">
        <h4 className="text-sm font-bold mb-1">{card.title}</h4>
        <p className="text-xs text-violet-100 mb-3.5 leading-relaxed">{card.description}</p>
        <div className="flex flex-wrap gap-2">
          {card.actions.map((act, idx) => (
            <a
              key={idx}
              href={act.link}
              target="_blank"
              rel="noopener noreferrer"
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                act.isPrimary
                  ? 'bg-white text-violet-700 shadow-md hover:bg-slate-100'
                  : 'bg-white/20 hover:bg-white/30 text-white'
              }`}
            >
              <span>{act.label}</span>
              <ArrowRight className="w-3 h-3" />
            </a>
          ))}
        </div>
      </div>
    )
  }

  // Default Standard Rich Card (Product, Service, Pricing)
  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.01 }}
      className="my-3 p-4 rounded-2xl bg-gradient-to-br from-white via-violet-50/40 to-white border border-violet-200/80 shadow-[0_8px_24px_rgba(108,71,255,0.10)] relative overflow-hidden group"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-xl bg-violet-100 border border-violet-200/60 flex items-center justify-center shadow-xs">
          {getCardIcon()}
        </div>

        {card.badge && (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-gradient-to-r from-violet-600 to-pink-500 text-white shadow-xs">
            {card.badge}
          </span>
        )}
      </div>

      <h4 className="text-sm font-bold text-[#1a1040] mb-1 leading-snug">
        {card.title}
      </h4>
      <p className="text-xs text-slate-600 leading-relaxed mb-4">
        {card.description}
      </p>

      {card.ctaText && card.ctaLink && (
        <a
          href={card.ctaLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-600/25 transition-all duration-200 group-hover:gap-2.5"
        >
          <span>{card.ctaText}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      )}
    </motion.div>
  )
}
