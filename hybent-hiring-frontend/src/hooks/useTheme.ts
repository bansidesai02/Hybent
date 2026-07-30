import { useCallback, useEffect, useState } from 'react'

export type Theme = 'classic' | 'signature'

const STORAGE_KEY = 'hybent-theme'
/** The product dashboards already keyed their dark tokens off this flag. */
const PRODUCT_THEME_KEY = 'hybent_hiring_theme'

/**
 * One control, two design systems.
 *
 * The company site keys light mode off `[data-theme="classic"]` on the root
 * element, while the Hybent Hiring product keys dark mode off a `.dark` class.
 * Driving both from a single hook is what makes the platform read as one
 * product rather than two sites stitched together — and it keeps the product's
 * own Topbar toggle in sync, since they share the same storage key.
 */
function readInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'classic'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'classic' || stored === 'signature') return stored
  // Respect a dark preference the user already set inside the product.
  if (window.localStorage.getItem(PRODUCT_THEME_KEY) === 'dark') return 'signature'
  return 'classic'
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  const dark = theme === 'signature'

  if (dark) root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', 'classic')

  root.classList.toggle('dark', dark)

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#05060B' : '#FBFCFE')

  try {
    window.localStorage.setItem(STORAGE_KEY, theme)
    window.localStorage.setItem(PRODUCT_THEME_KEY, dark ? 'dark' : 'light')
  } catch {
    /* private mode — the DOM changes above still applied */
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readInitialTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'classic' ? 'signature' : 'classic'))
  }, [])

  return { theme, toggleTheme }
}
