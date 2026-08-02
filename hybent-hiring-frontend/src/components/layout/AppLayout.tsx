import { useCallback, useEffect, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { GlobalNav } from './GlobalNav'
import { GlobalFooter } from './GlobalFooter'
import { SiteSvgDefs } from './SiteSvgDefs'
import { ROUTE_META } from '@/app/routeMeta'
import '@/styles/hybent-site.css'

/**
 * The single shell every public surface renders inside — the Hybent company
 * site today, Hybent Hiring today, and any future product tomorrow.
 *
 *   AppLayout
 *     ├── GlobalNav      (one header for the whole ecosystem)
 *     ├── <main>         (the only part that changes between products)
 *     └── GlobalFooter
 *
 * Authenticated workspaces mount outside this shell: they carry their own
 * sidebar/topbar chrome and must not sit under a marketing header.
 */
export default function AppLayout() {
  /* No theme call here by design. Every public surface is light-only — light is
     the brand — and ThemeProvider enforces that from the URL, so the site
     cannot inherit a dark preference set inside a workspace. */
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const [, segment = '', fragment = ''] = location.pathname.split('/')
  const viewKey = location.pathname === '/' ? 'index' : segment
  const metaKey = location.pathname === '/products/hiring' ? 'hiring' : viewKey

  const closeDrawer = useCallback(() => setDrawerOpen(false), [])
  const toggleDrawer = useCallback(() => setDrawerOpen((open) => !open), [])

  /* Body scroll lock while the mobile drawer is open. */
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  /* Per-view title and description, plus aria-current on the owning nav link. */
  useEffect(() => {
    const meta = ROUTE_META[metaKey]
    if (meta) {
      document.title = meta.title
      document.querySelector('meta[name="description"]')?.setAttribute('content', meta.description)
    }
    document.querySelectorAll<HTMLElement>('[data-nav]').forEach((link) => {
      const owns = ` ${link.getAttribute('data-nav')} `.includes(` ${metaKey} `)
      if (owns) link.setAttribute('aria-current', 'page')
      else link.removeAttribute('aria-current')
    })
  }, [metaKey])

  /* Land on the top of the view, or on a deep-linked section (/about/timeline). */
  useEffect(() => {
    const root = document.documentElement
    const previous = root.style.scrollBehavior
    root.style.scrollBehavior = 'auto'
    const target = fragment ? document.getElementById(fragment) : null
    if (target) window.scrollTo(0, target.getBoundingClientRect().top + window.pageYOffset - 92)
    else window.scrollTo(0, 0)
    root.style.scrollBehavior = previous
  }, [location.pathname, fragment])

  /**
   * The site markup uses plain `<a href>` so it stays portable, but navigation
   * must not reload the SPA. One delegated handler upgrades every internal
   * anchor to a client-side transition — no per-link wiring, no duplication.
   */
  const onClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const anchor = (e.target as HTMLElement).closest?.('a')
    if (!anchor) return
    const href = anchor.getAttribute('href')
    if (!href || !href.startsWith('/')) return
    if (anchor.hasAttribute('target') || anchor.hasAttribute('download')) return
    e.preventDefault()
    navigate(href)
  }

  return (
    <div onClick={onClick}>
      <a className="hb-site skip" href="#main">Skip to content</a>
      <SiteSvgDefs />
      <GlobalNav
        route={viewKey}
        drawerOpen={drawerOpen}
        onToggleDrawer={toggleDrawer}
        onCloseDrawer={closeDrawer}
      />
      <main id="main">
        <Outlet />
      </main>
      <GlobalFooter />
    </div>
  )
}
