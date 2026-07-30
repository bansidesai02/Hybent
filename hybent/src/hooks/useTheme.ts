import { useCallback, useEffect, useState } from 'react'

export type Theme = 'classic' | 'signature'

const STORAGE_KEY = 'hybent-theme'

/* The stylesheet keys every light-mode rule off [data-theme="classic"] on the
   root element — `[data-theme="classic"] body::before` and friends only match
   when the attribute lives on <html>, so it must be set there and nowhere
   else. Signature (dark) is the absence of the attribute. */
function readInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'classic'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'classic' || stored === 'signature') return stored
  return 'classic'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readInitialTheme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'classic') root.setAttribute('data-theme', 'classic')
    else root.removeAttribute('data-theme')

    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'classic' ? '#FBFCFE' : '#05060B')

    try {
      window.localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* private mode — the attribute above is still applied */
    }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'classic' ? 'signature' : 'classic'))
  }, [])

  return { theme, toggleTheme }
}
