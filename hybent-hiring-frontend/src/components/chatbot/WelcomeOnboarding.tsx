import { motion } from 'framer-motion'
import {
  Rocket,
  Globe,
  Smartphone,
  Bot,
  Users,
  Calendar,
  Sparkles,
} from 'lucide-react'

interface WelcomeOnboardingProps {
  onSelectPrompt: (promptText: string) => void
}

const ONBOARDING_CARDS = [
  {
    id: '1',
    title: 'Build an AI Product',
    prompt: 'How can Hybent help me design and build an AI product from scratch?',
    icon: Rocket,
    color: 'from-violet-500 to-purple-600',
  },
  {
    id: '2',
    title: 'Custom Software Development',
    prompt: 'Tell me about your custom web and software engineering services.',
    icon: Globe,
    color: 'from-teal-500 to-emerald-600',
  },
  {
    id: '3',
    title: 'Mobile App Development',
    prompt: 'Do you build native and cross-platform mobile applications?',
    icon: Smartphone,
    color: 'from-indigo-500 to-blue-600',
  },
  {
    id: '4',
    title: 'AI Automation',
    prompt: 'How can AI automation streamline our enterprise business operations?',
    icon: Bot,
    color: 'from-pink-500 to-rose-600',
  },
  {
    id: '5',
    title: 'Hire Dedicated Developers',
    prompt: 'How does hiring software engineering talent through Hybent work?',
    icon: Users,
    color: 'from-amber-500 to-orange-600',
  },
  {
    id: '6',
    title: 'Book a Free Consultation',
    prompt: 'I would like to schedule a free technical consultation with your team.',
    icon: Calendar,
    color: 'from-violet-600 to-pink-500',
  },
]

export function WelcomeOnboarding({ onSelectPrompt }: WelcomeOnboardingProps) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-5 py-6 space-y-6 scrollbar-thin scrollbar-thumb-violet-200">
      {/* Onboarding Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-3"
      >
        <div className="relative inline-flex items-center justify-center w-14 h-14 overflow-hidden">
          <img
            src="/hybent/hybent-mark.png"
            alt="Hybent AI"
            className="w-full h-full object-contain"
          />
        </div>

        <div className="space-y-1">
          <h2 className="text-xl font-extrabold text-[#1a1040] tracking-tight flex items-center justify-center gap-1.5">
            <span>👋 Welcome to Hybent AI</span>
          </h2>
          <p className="text-xs font-medium text-slate-500">
            Your intelligent business assistant.
          </p>
        </div>

        {/* Capabilities Checklist */}
        <div className="p-3.5 rounded-2xl bg-violet-50/70 border border-violet-100 text-left max-w-[340px] mx-auto text-xs text-slate-600 space-y-1">
          <p className="font-semibold text-violet-700 flex items-center gap-1 mb-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>I can help you:</span>
          </p>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
            <span>• Build software</span>
            <span>• Hire Talent</span>
            <span>• Explore products</span>
            <span>• Book meetings</span>
            <span>• Learn services</span>
            <span>• Technical Q&A</span>
          </div>
        </div>
      </motion.div>

      {/* 6 Premium Prompt Cards */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-slate-400 px-1 uppercase tracking-wider">
          Get Started
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {ONBOARDING_CARDS.map((card) => {
            const Icon = card.icon
            return (
              <motion.button
                key={card.id}
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelectPrompt(card.prompt)}
                className="group p-2.5 rounded-xl bg-white border border-slate-200 hover:border-violet-400 hover:bg-violet-50/50 shadow-xs text-left flex items-center gap-2.5 transition-all duration-200"
              >
                <div
                  className={`w-8 h-8 rounded-lg bg-gradient-to-br ${card.color} text-white flex items-center justify-center shrink-0 shadow-xs`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-semibold text-slate-800 group-hover:text-violet-700 transition-colors leading-snug">
                  {card.title}
                </span>
              </motion.button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
