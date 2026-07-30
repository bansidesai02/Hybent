import type { ReactNode } from 'react'
import { useSiteBehaviours } from '../hooks/useSiteBehaviours'

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
  useSiteBehaviours(route)

  return (
    <div className="hb-site hb-surface route route--on" data-route={route}>
      {children}
    </div>
  )
}
