import { useEffect, useLayoutEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useSiteBehaviours } from '../hooks/useSiteBehaviours'
import { recordSiteVisit } from '../attribution'

type SiteViewProps = {
  /** Matches the view name the design system uses for per-view styling hooks. */
  route: string
  children: ReactNode
}

/**
 * Wrapper for every Hybent company-site view.
 *
 * `hb-site` hosts the site design tokens and typography; `hb-surface` paints the
 * page background and the two ambient gradient layers. Both are scoped classes,
 * so nothing here reaches the Hybent Hiring product styles rendered on other
 * routes under the same shell.
 *
 * Mounting the site's progressive enhancements here — rather than in AppLayout —
 * means they attach only while a site view is on screen, and tear down the
 * moment the router moves to a product view.
 */
export function SiteView({ route, children }: SiteViewProps) {
  // The build's static snapshot of this page (scripts/prerender.mjs) stays on
  // screen until React's own page is ready, then hands over. Layout effect so
  // it's gone before useSiteBehaviours queries the DOM by id.
  useLayoutEffect(() => {
    document.getElementById('hb-prerender')?.remove()
  }, [])
  useSiteBehaviours(route)

  const { pathname, search } = useLocation()
  useEffect(() => {
    recordSiteVisit(pathname, search)
  }, [pathname, search])

  return (
    <div className="hb-site hb-surface route route--on" data-route={route}>
      {children}
    </div>
  )
}
