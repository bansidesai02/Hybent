import { useState, useEffect, useCallback } from 'react'
import type { ChatSettings } from './types'

const SETTINGS_STORAGE_KEY = 'hybent_ai_settings_v1'

const DEFAULT_SETTINGS: ChatSettings = {
  theme: 'system',
  soundEnabled: true,
  streamSpeed: 'medium',
  density: 'comfortable',
  showTimestamps: true,
  showTypingIndicator: true,
  showSuggestions: true,
  autoScroll: true,
  onboarded: true,
}

export function useChatSettings() {
  const [settings, setSettings] = useState<ChatSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY)
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }
      }
    } catch {
      // Fallback
    }
    return DEFAULT_SETTINGS
  })

  // Persist to localStorage & apply theme class
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // Ignore
    }

    // Apply dark class to document if theme is dark or system dark
    const root = document.documentElement
    if (settings.theme === 'dark') {
      root.classList.add('dark')
    } else if (settings.theme === 'light') {
      root.classList.remove('dark')
    } else if (settings.theme === 'system') {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }
  }, [settings])

  const updateSetting = useCallback(<K extends keyof ChatSettings>(key: K, value: ChatSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }, [])

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS)
    try {
      localStorage.removeItem(SETTINGS_STORAGE_KEY)
    } catch {
      // Ignore
    }
  }, [])

  return {
    settings,
    updateSetting,
    resetSettings,
  }
}
