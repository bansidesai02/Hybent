import { motion } from 'framer-motion'
import {
  X,
  Sun,
  Moon,
  Monitor,
  Volume2,
  VolumeX,
  Gauge,
  Sliders,
  Keyboard,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Check,
} from 'lucide-react'
import type { ChatSettings, ThemeMode, StreamSpeed, MessageDensity } from './types'

interface SettingsDrawerProps {
  isOpen: boolean
  onClose: () => void
  settings: ChatSettings
  onUpdateSetting: <K extends keyof ChatSettings>(key: K, value: ChatSettings[K]) => void
  onResetSettings: () => void
  onOpenShortcuts: () => void
}

export function SettingsDrawer({
  isOpen,
  onClose,
  settings,
  onUpdateSetting,
  onResetSettings,
  onOpenShortcuts,
}: SettingsDrawerProps) {
  if (!isOpen) return null

  return (
    <div className="absolute inset-0 z-40 flex justify-end">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-[#0a0718]/50 backdrop-blur-xs rounded-[20px]"
      />

      {/* Settings Slide-over Pane */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        className="relative z-10 w-[88%] sm:w-[340px] h-full bg-white/95 backdrop-blur-2xl border-l border-violet-100 rounded-r-[20px] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header Bar */}
        <div className="p-4 border-b border-violet-100/60 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#1a1040]">
            <Sliders className="w-4 h-4 text-violet-600" />
            <h3 className="font-bold text-sm">Settings & Preferences</h3>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Controls Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs scrollbar-thin scrollbar-thumb-violet-200">
          {/* Theme Selector */}
          <div className="space-y-2">
            <label className="font-bold text-slate-700 uppercase text-[10px] tracking-wider">
              Theme Mode
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200">
              {(['light', 'dark', 'system'] as ThemeMode[]).map((t) => (
                <button
                  key={t}
                  onClick={() => onUpdateSetting('theme', t)}
                  className={`py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center gap-1 transition-all ${
                    settings.theme === t
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-violet-600'
                  }`}
                >
                  {t === 'light' && <Sun className="w-3.5 h-3.5" />}
                  {t === 'dark' && <Moon className="w-3.5 h-3.5" />}
                  {t === 'system' && <Monitor className="w-3.5 h-3.5" />}
                  <span className="capitalize">{t}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sound Effects Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/60">
            <div className="flex items-center gap-2.5">
              {settings.soundEnabled ? (
                <Volume2 className="w-4 h-4 text-violet-600" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-400" />
              )}
              <div>
                <p className="font-semibold text-slate-800">Sound Effects</p>
                <p className="text-[10px] text-slate-400">Subtle audio feedback on messages</p>
              </div>
            </div>

            <button
              onClick={() => onUpdateSetting('soundEnabled', !settings.soundEnabled)}
              className={`w-10 h-6 rounded-full p-0.5 transition-colors ${
                settings.soundEnabled ? 'bg-violet-600' : 'bg-slate-300'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  settings.soundEnabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Streaming Speed */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-700 uppercase text-[10px] tracking-wider flex items-center gap-1">
                <Gauge className="w-3.5 h-3.5 text-violet-500" />
                <span>AI Response Speed</span>
              </label>
              <span className="capitalize font-semibold text-violet-600 text-[11px]">
                {settings.streamSpeed}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100">
              {(['fast', 'medium', 'relaxed'] as StreamSpeed[]).map((spd) => (
                <button
                  key={spd}
                  onClick={() => onUpdateSetting('streamSpeed', spd)}
                  className={`py-1.5 rounded-lg font-semibold capitalize transition-all ${
                    settings.streamSpeed === spd
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'text-slate-600'
                  }`}
                >
                  {spd}
                </button>
              ))}
            </div>
          </div>

          {/* Density Mode */}
          <div className="space-y-2">
            <label className="font-bold text-slate-700 uppercase text-[10px] tracking-wider">
              Message Density
            </label>
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100">
              {(['comfortable', 'compact'] as MessageDensity[]).map((den) => (
                <button
                  key={den}
                  onClick={() => onUpdateSetting('density', den)}
                  className={`py-1.5 rounded-lg font-semibold capitalize transition-all ${
                    settings.density === den
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'text-slate-600'
                  }`}
                >
                  {den}
                </button>
              ))}
            </div>
          </div>

          {/* Toggle Options List */}
          <div className="space-y-2.5 pt-1">
            <label className="font-bold text-slate-700 uppercase text-[10px] tracking-wider">
              Display Preferences
            </label>

            <div className="space-y-2">
              {[
                { key: 'showTimestamps', label: 'Show Message Timestamps' },
                { key: 'showTypingIndicator', label: 'Show AI Typing Indicator' },
                { key: 'showSuggestions', label: 'Show Follow-up Suggestions' },
                { key: 'autoScroll', label: 'Auto Scroll to Bottom' },
              ].map((item) => {
                const k = item.key as keyof ChatSettings
                const val = Boolean(settings[k])
                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100"
                  >
                    <span className="font-medium text-slate-700">
                      {item.label}
                    </span>
                    <button
                      onClick={() => onUpdateSetting(k, !val as any)}
                      className={`w-8 h-5 rounded-full p-0.5 transition-colors ${
                        val ? 'bg-violet-600' : 'bg-slate-300'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform ${
                          val ? 'translate-x-3' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Keyboard Shortcuts Helper Link */}
          <div className="pt-2">
            <button
              onClick={onOpenShortcuts}
              className="w-full py-2.5 px-3 rounded-xl bg-violet-50 border border-violet-200 text-violet-700 font-semibold flex items-center justify-center gap-2 hover:bg-violet-100 transition-colors"
            >
              <Keyboard className="w-4 h-4 text-violet-600" />
              <span>Keyboard Shortcuts (Ctrl+/)</span>
            </button>
          </div>

          {/* About Hybent AI */}
          <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-600 to-pink-500 text-white space-y-1 shadow-md">
            <div className="flex items-center gap-1.5 font-bold">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Hybent AI Assistant v2.5 Pro</span>
            </div>
            <p className="text-[11px] text-violet-100 leading-relaxed">
              Powered by Hybent Intelligence. Enterprise security & custom AI model architecture.
            </p>
          </div>

          {/* Reset Settings Button */}
          <div className="pt-1">
            <button
              onClick={onResetSettings}
              className="w-full py-2 text-red-500 hover:text-red-600 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Default Settings</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
