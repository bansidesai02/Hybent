import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  RotateCcw,
  X,
  Download,
  Copy,
  Check,
  FileText,
  FileCode,
  FileType,
} from 'lucide-react'
import type { ChatMessageItem, FeedbackScore } from './types'
import {
  exportAsPdf,
  exportAsTxt,
  exportAsMarkdown,
  copyTranscriptToClipboard,
} from './exportUtils'

interface EndSessionScreenProps {
  messages: ChatMessageItem[]
  onStartNewConversation: () => void
  onCloseChat: () => void
}

export function EndSessionScreen({
  messages,
  onStartNewConversation,
  onCloseChat,
}: EndSessionScreenProps) {
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackScore | null>(null)
  const [copied, setCopied] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)

  const handleSelectFeedback = (score: FeedbackScore) => {
    setSelectedFeedback(score)
  }

  const handleCopyTranscript = async () => {
    const success = await copyTranscriptToClipboard(messages)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="flex-1 flex flex-col justify-between p-4 bg-gradient-to-b from-white via-white to-violet-50/30 text-center overflow-y-auto">
      {/* Top Thank You & Rating Container */}
      <div className="my-auto space-y-3.5">
        {/* Animated Brand Header Badge */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="w-11 h-11 rounded-xl bg-gradient-to-tr from-violet-600 to-pink-500 p-0.5 shadow-md mx-auto"
        >
          <div className="w-full h-full bg-[#181035] rounded-[14px] flex items-center justify-center">
            <img
              src="/hybent/hybent-mark.png"
              alt="Hybent"
              className="w-8 h-8 object-contain"
              onError={(e) => {
                const target = e.currentTarget
                target.style.display = 'none'
              }}
            />
          </div>
        </motion.div>

        {/* Title */}
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-[#1a1040] dark:text-white">
            How was your experience with Hybent AI?
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Your feedback helps us continuously improve our AI assistants.
          </p>
        </div>

        {/* 3 Large Feedback Emoji Option Cards */}
        <div className="grid grid-cols-3 gap-3 max-w-[320px] mx-auto pt-2">
          {/* Excellent */}
          <motion.button
            whileHover={{ scale: 1.08, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleSelectFeedback('excellent')}
            className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all duration-200 ${
              selectedFeedback === 'excellent'
                ? 'bg-violet-50 border-violet-500 ring-2 ring-violet-500/30 shadow-sm'
                : 'bg-white border-slate-200 hover:border-violet-300'
            }`}
          >
            <span className="text-2xl select-none">😊</span>
            <span className="text-[11px] font-semibold text-slate-700">
              Excellent
            </span>
          </motion.button>

          {/* Good */}
          <motion.button
            whileHover={{ scale: 1.08, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleSelectFeedback('good')}
            className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all duration-200 ${
              selectedFeedback === 'good'
                ? 'bg-teal-50 border-teal-500 ring-2 ring-teal-500/30 shadow-sm'
                : 'bg-white border-slate-200 hover:border-teal-300'
            }`}
          >
            <span className="text-2xl select-none">😐</span>
            <span className="text-[11px] font-semibold text-slate-700">
              Good
            </span>
          </motion.button>

          {/* Needs Improvement */}
          <motion.button
            whileHover={{ scale: 1.08, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleSelectFeedback('needs_improvement')}
            className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all duration-200 ${
              selectedFeedback === 'needs_improvement'
                ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/30 shadow-sm'
                : 'bg-white border-slate-200 hover:border-amber-300'
            }`}
          >
            <span className="text-2xl select-none">☹</span>
            <span className="text-[11px] font-semibold text-slate-700">
              Improve
            </span>
          </motion.button>
        </div>

        {/* Feedback Submitted Animation Message */}
        {selectedFeedback && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-xs font-semibold text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1.5"
          >
            <Check className="w-4 h-4 text-emerald-500" />
            Thank you for rating your conversation!
          </motion.div>
        )}

        {/* Conversation Export Options */}
        <div className="pt-2">
          <div className="relative inline-block text-left w-full max-w-[280px]">
            <div className="flex gap-2">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowExportMenu((prev) => !prev)}
                className="flex-1 py-2 px-3 rounded-xl bg-white dark:bg-slate-800 border border-violet-200 dark:border-violet-700 text-xs font-medium text-slate-700 dark:text-slate-200 shadow-sm hover:border-violet-400 flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                <span>Export Chat</span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleCopyTranscript}
                className="py-2 px-3 rounded-xl bg-white dark:bg-slate-800 border border-violet-200 dark:border-violet-700 text-xs font-medium text-slate-700 dark:text-slate-200 shadow-sm hover:border-violet-400 flex items-center justify-center gap-1.5"
                title="Copy conversation transcript"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-500">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </motion.button>
            </div>

            {/* Dropdown Menu for PDF / TXT / Markdown */}
            {showExportMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="absolute left-0 right-0 bottom-12 z-20 p-1.5 rounded-xl bg-white dark:bg-[#1f173b] border border-violet-200 dark:border-violet-700 shadow-xl space-y-1"
              >
                <button
                  onClick={() => {
                    exportAsPdf(messages)
                    setShowExportMenu(false)
                  }}
                  className="w-full px-3 py-2 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/40 text-xs text-left font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2"
                >
                  <FileType className="w-3.5 h-3.5 text-red-500" />
                  <span>Download as PDF</span>
                </button>
                <button
                  onClick={() => {
                    exportAsTxt(messages)
                    setShowExportMenu(false)
                  }}
                  className="w-full px-3 py-2 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/40 text-xs text-left font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-500" />
                  <span>Download as TXT</span>
                </button>
                <button
                  onClick={() => {
                    exportAsMarkdown(messages)
                    setShowExportMenu(false)
                  }}
                  className="w-full px-3 py-2 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/40 text-xs text-left font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2"
                >
                  <FileCode className="w-3.5 h-3.5 text-purple-500" />
                  <span>Download as Markdown (.md)</span>
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Main Bottom Buttons */}
      <div className="pt-4 flex flex-col gap-2.5 max-w-[320px] mx-auto w-full">
        {/* Start New Conversation */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={onStartNewConversation}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-violet-600 via-violet-600 to-pink-500 text-white text-xs font-semibold shadow-md shadow-violet-500/25 flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Start New Conversation</span>
        </motion.button>

        {/* Close Chat */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={onCloseChat}
          className="w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700/60 flex items-center justify-center gap-2"
        >
          <X className="w-4 h-4" />
          <span>Close Chat</span>
        </motion.button>
      </div>
    </div>
  )
}
