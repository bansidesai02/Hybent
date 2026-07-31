import { useEffect } from 'react'

/**
 * Pins the Hybent company site — and its auth pages — to the light view.
 *
 * The site has no theme switch: light is the brand. The Hybent Hiring product
 * dashboards keep their own dark mode, which Topbar owns through the `.dark`
 * class and the `hybent_hiring_theme` key.
 *
 * That split is why this hook strips `.dark` but never writes to storage. A
 * visitor who turned dark mode on inside the product and then browsed to the
 * marketing site should see the site in light, and still find their dashboard
 * dark when they go back — Topbar re-applies it from the preference this hook
 * deliberately leaves alone.
 */
export function useLightTheme() {
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', 'classic')
    root.classList.remove('dark')
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#FBFCFE')
  }, [])
}
