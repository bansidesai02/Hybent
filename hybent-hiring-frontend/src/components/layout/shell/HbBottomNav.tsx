import { memo } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { clsx } from 'clsx'
import { LayoutGrid } from 'lucide-react'
import { prefetchRoute } from '@/utils/routePrefetch'
import type { NavItem } from './navConfig'

/**
 * The phone tab bar (below lg) — the iOS / Android pattern: four everyday
 * destinations and "More", in thumb reach at the bottom of the screen.
 *
 * "More" opens the full workspace menu (the sidebar, as a drawer), so nothing
 * that lives in the sidebar is ever out of reach on a phone. The bar sits
 * above the home indicator via `env(safe-area-inset-bottom)`, and its height
 * is published as `--hb-mobile-nav` (tokens.css) so the page and the floating
 * Copilot button can clear it.
 */

interface HbBottomNavProps {
  tabs: NavItem[]
  onMore: () => void
  moreOpen: boolean
}

function HbBottomNavComponent({ tabs, onMore, moreOpen }: HbBottomNavProps) {
  const location = useLocation()

  const isActive = (tab: NavItem, routerActive: boolean) =>
    tab.customActivePath ? location.pathname.startsWith(tab.customActivePath) : routerActive

  // "More" is lit when the current page isn't one of the tabs.
  const onATab = tabs.some((t) =>
    t.end || !t.customActivePath
      ? location.pathname === t.to || (!t.end && location.pathname.startsWith(`${t.to}/`))
      : location.pathname.startsWith(t.customActivePath),
  )

  return (
    <nav
      aria-label="Primary"
      className={clsx(
        'fixed inset-x-0 bottom-0 z-50 lg:hidden',
        'border-t border-hb-border bg-hb-surface/95 backdrop-blur-md',
        'pb-[env(safe-area-inset-bottom)]',
      )}
    >
      <ul className="mx-auto grid h-16 max-w-xl grid-cols-5">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <li key={tab.to} className="contents">
              <NavLink
                to={tab.to}
                end={tab.end || !!tab.customActivePath}
                onTouchStart={() => prefetchRoute(tab.to)}
                className="group relative flex flex-col items-center justify-center gap-1 focus-visible:outline-none"
              >
                {({ isActive: routerActive }) => {
                  const active = isActive(tab, routerActive)
                  return (
                    <>
                      <span
                        className={clsx(
                          'relative grid h-8 w-14 place-items-center rounded-hb-full transition-colors duration-hb',
                          active ? 'bg-hb-blue/10 text-hb-blue' : 'text-hb-dim group-active:bg-hb-muted/10',
                          'group-focus-visible:shadow-hb-ring',
                        )}
                      >
                        <Icon size={20} aria-hidden />
                        {tab.badge != null && tab.badge > 0 && (
                          <span className="absolute right-2.5 top-0.5 min-w-[16px] rounded-hb-full bg-hb-grad px-1 text-center font-mono text-[9px] font-bold leading-4 text-hb-on-brand">
                            {tab.badge > 99 ? '99+' : tab.badge}
                          </span>
                        )}
                      </span>
                      <span
                        className={clsx(
                          'max-w-full truncate px-1 text-[11px] leading-none',
                          active ? 'font-semibold text-hb-text' : 'font-medium text-hb-muted',
                        )}
                      >
                        {tab.label}
                      </span>
                    </>
                  )
                }}
              </NavLink>
            </li>
          )
        })}
        <li className="contents">
          <button
            type="button"
            onClick={onMore}
            aria-expanded={moreOpen}
            aria-label="More — open the full menu"
            className="group flex flex-col items-center justify-center gap-1 focus-visible:outline-none"
          >
            <span
              className={clsx(
                'grid h-8 w-14 place-items-center rounded-hb-full transition-colors duration-hb',
                moreOpen || !onATab ? 'bg-hb-blue/10 text-hb-blue' : 'text-hb-dim group-active:bg-hb-muted/10',
                'group-focus-visible:shadow-hb-ring',
              )}
            >
              <LayoutGrid size={20} aria-hidden />
            </span>
            <span
              className={clsx(
                'text-[11px] leading-none',
                moreOpen || !onATab ? 'font-semibold text-hb-text' : 'font-medium text-hb-muted',
              )}
            >
              More
            </span>
          </button>
        </li>
      </ul>
    </nav>
  )
}

export const HbBottomNav = memo(HbBottomNavComponent)
