import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { clsx } from 'clsx'
import { ChevronRight } from 'lucide-react'
import type { UserRole } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { useNotificationStore } from '@/store/notificationStore'
import { prefetchRoute } from '@/utils/routePrefetch'
import { useOverlay } from '@/components/hb/useOverlay'
import { getNavSections, isGroup, type NavGroup, type NavItem, type NavSection } from './navConfig'

/**
 * The workspace sidebar, on the Hybent design system.
 *
 * What changed beyond colour:
 *
 * · Active state is a gradient rail on the leading edge, not a violet pill.
 *   The rail is the site's own motif — the three gradient bars of the "E" in
 *   the wordmark, which `hybent-site.css` uses for eyebrows and dividers. It
 *   reads as Hybent in a way a tinted background never could.
 *
 * · Icons are plain lucide glyphs that inherit `currentColor`, replacing
 *   `GlassIcon` and its five-colour palette. The old code swapped icon colour
 *   by cloning the element and overriding a `variant` prop in three places;
 *   colour is now inherited from the link's own state.
 *
 * · The mobile drawer traps focus, closes on Escape and locks the page behind
 *   it. Previously it was a translated `<aside>` that Tab walked straight out
 *   of, leaving keyboard and screen-reader users in the page underneath.
 */

interface HbSidebarProps {
  role: UserRole
  mobileOpen: boolean
  onCloseMobile: () => void
  /**
   * Overrides the role-derived navigation. The candidate portal supplies its
   * own because one of its sections appears only once an offer stage is
   * reached, which is a server answer rather than a property of the role.
   */
  sections?: NavSection[]
  /** Second line of the footer card. Defaults to the user's organisation. */
  footerSubtitle?: string
}

const RAIL =
  'before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-[18px] before:w-[3px] before:rounded-r-full before:bg-hb-grad before:content-[""]'

function HbSidebarComponent({
  role,
  mobileOpen,
  onCloseMobile,
  sections: sectionsOverride,
  footerSubtitle,
}: HbSidebarProps) {
  const location = useLocation()
  const { notifications } = useNotificationStore()
  const { user } = useAuth()

  /* Focus trap + scroll lock, but only while the drawer is actually open —
     which on desktop is never, because the resize handler below closes it. */
  const panelRef = useOverlay({ open: mobileOpen, onClose: onCloseMobile })

  const initials = useMemo(() => {
    if (!user?.full_name) return role.charAt(0).toUpperCase()
    return user.full_name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }, [user?.full_name, role])

  /* Above lg the drawer is irrelevant; make sure it cannot stay "open" and
     hold the body scroll lock after someone rotates or resizes. */
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024 && mobileOpen) onCloseMobile()
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [mobileOpen, onCloseMobile])

  /* Navigating from inside the drawer should close it.
     Held in a ref so the effect depends on the pathname alone — the callback
     is an inline arrow from AppShell and would otherwise change identity every
     render, re-running this on each one. */
  const closeRef = useRef(onCloseMobile)
  closeRef.current = onCloseMobile

  useEffect(() => {
    closeRef.current()
  }, [location.pathname])

  const candidateBadge = useMemo(
    () =>
      notifications.filter(
        (n) => !n.is_read && (n.type === 'application_received' || n.type === 'stage_changed')
      ).length,
    [notifications]
  )

  const scheduleBadge = useMemo(
    () =>
      notifications.filter(
        (n) => !n.is_read && (n.type === 'interview_scheduled' || n.type === 'interview_reminder')
      ).length,
    [notifications]
  )

  const sections = useMemo(
    () => sectionsOverride ?? getNavSections(role, candidateBadge, scheduleBadge),
    [sectionsOverride, role, candidateBadge, scheduleBadge]
  )

  const isGroupActive = useCallback(
    (group: NavGroup) => group.subPaths.some((p) => location.pathname.startsWith(p)),
    [location.pathname]
  )

  /* Groups whose sub-routes are active start open. Recomputed on navigation so
     landing on a deep link from outside opens the right group, while a manual
     toggle still wins until the route changes. */
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev)
      for (const section of sections) {
        for (const entry of section.items) {
          if (isGroup(entry) && isGroupActive(entry)) next.add(entry.label)
        }
      }
      return next
    })
  }, [sections, isGroupActive])

  const toggleGroup = useCallback((label: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }, [])

  const itemActive = (item: NavItem, routerActive: boolean) =>
    item.customActivePath ? location.pathname.startsWith(item.customActivePath) : routerActive

  const overviewPath = useMemo(() => {
    switch (role) {
      case 'admin':
        return '/hiring/admin'
      case 'recruiter':
        return '/hiring/recruiter'
      case 'super_admin':
        return '/hiring/super-admin'
      case 'interviewer':
        return '/hiring/interviewer'
      case 'candidate':
        return '/hiring/portal'
      default:
        return '/hiring/admin'
    }
  }, [role])

  return (
    <>
      {/* Scrim. Only below lg, where the sidebar is a drawer. */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[60] bg-[rgb(5_6_11_/_0.5)] lg:hidden"
          onClick={onCloseMobile}
          aria-hidden
        />
      )}

      <aside
        ref={panelRef}
        tabIndex={-1}
        {...(mobileOpen ? { role: 'dialog', 'aria-modal': true, 'aria-label': 'Navigation' } : {})}
        className={clsx(
          'fixed lg:static inset-y-0 left-0 z-[70] lg:z-auto',
          'flex h-screen w-[248px] flex-none flex-col',
          'border-r border-hb-border bg-hb-surface',
          'transition-transform duration-hb-slow ease-hb focus:outline-none',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* ── Brand ─────────────────────────────────────────────────────── */}
        <div className="flex h-hb-topbar flex-none items-center px-hb-5">
          <Link
            to={overviewPath}
            className="flex items-center gap-2.5 rounded-hb-sm focus-visible:outline-none focus-visible:shadow-hb-ring"
            aria-label="Hybent Overview"
          >
            <img src="/hybent/hybent-mark.png" alt="" className="h-7 w-7 object-contain" />
            {/* One wordmark: the product is light-only since phase 10, so the
                `dark:hidden` / `dark:block` pair swapped between an image that
                always showed and one that never did. */}
            <img
              src="/hybent/hybent-wordmark-light.png"
              alt="HYBENT"
              className="h-[17px] object-contain"
            />
          </Link>
        </div>

        <hr className="mx-hb-5 h-px flex-none border-0 bg-hb-border" />

        {/* ── Navigation ────────────────────────────────────────────────── */}
        <nav aria-label="Workspace" className="flex-1 overflow-y-auto px-3 py-hb-4">
          {sections.map((section, si) => (
            <div key={section.label || `section-${si}`} className={clsx(si > 0 && 'mt-hb-5')}>
              {section.label && (
                <h2 className="px-3 pb-2 font-mono text-hb-label uppercase text-hb-dim">
                  {section.label}
                </h2>
              )}

              <ul className="flex flex-col gap-0.5">
                {section.items.map((entry) => {
                  /* ── Expandable group ──────────────────────────────── */
                  if (isGroup(entry)) {
                    const open = expanded.has(entry.label)
                    const active = isGroupActive(entry)
                    const GroupIcon = entry.icon
                    const panelId = `nav-group-${entry.label.toLowerCase().replace(/\s+/g, '-')}`

                    return (
                      <li key={entry.label}>
                        <button
                          type="button"
                          onClick={() => toggleGroup(entry.label)}
                          aria-expanded={open}
                          aria-controls={panelId}
                          className={clsx(
                            'relative flex w-full items-center gap-2.5 rounded-hb-sm py-2.5 pl-3 pr-2.5',
                            'text-left font-body text-hb-sm font-semibold',
                            'transition-colors duration-hb ease-hb',
                            'focus-visible:outline-none focus-visible:shadow-hb-ring',
                            active
                              ? clsx('bg-hb-blue/8 text-hb-text', RAIL)
                              : 'text-hb-muted hover:bg-hb-muted/8 hover:text-hb-text'
                          )}
                        >
                          <GroupIcon
                            size={16}
                            className={clsx('flex-none', active ? 'text-hb-blue' : 'text-hb-dim')}
                          />
                          <span className="flex-1 truncate">{entry.label}</span>
                          {entry.badge != null && entry.badge > 0 && <CountPill value={entry.badge} />}
                          <ChevronRight
                            size={14}
                            aria-hidden
                            className={clsx(
                              'flex-none text-hb-dim transition-transform duration-hb ease-hb',
                              open && 'rotate-90'
                            )}
                          />
                        </button>

                        {/* `hidden` rather than a max-height transition: an
                            animated container that is merely clipped keeps its
                            links focusable while collapsed.

                            The `display` must be toggled by class, not left to
                            the `hidden` attribute alone. `hidden` only carries
                            the UA rule `[hidden]{display:none}`, which a utility
                            class like `flex` overrides on specificity — so the
                            group rendered permanently open while the chevron
                            correctly showed it closed. The attribute stays for
                            the accessibility tree; the class does the hiding. */}
                        <ul
                          id={panelId}
                          hidden={!open}
                          className={clsx('mt-0.5 flex-col gap-0.5', open ? 'flex' : 'hidden')}
                        >
                          {entry.items.map((sub) => {
                            const SubIcon = sub.icon
                            return (
                              <li key={sub.to}>
                                <NavLink
                                  to={sub.to}
                                  onMouseEnter={() => prefetchRoute(sub.to)}
                                  onFocus={() => prefetchRoute(sub.to)}
                                  className={({ isActive }) =>
                                    clsx(
                                      'relative flex items-center gap-2 rounded-hb-sm py-2 pl-9 pr-3',
                                      'font-body text-hb-xs font-medium',
                                      'transition-colors duration-hb ease-hb',
                                      'focus-visible:outline-none focus-visible:shadow-hb-ring',
                                      isActive
                                        ? 'bg-hb-blue/8 font-semibold text-hb-text'
                                        : 'text-hb-muted hover:bg-hb-muted/8 hover:text-hb-text'
                                    )
                                  }
                                >
                                  {({ isActive }) => (
                                    <>
                                      <SubIcon
                                        size={14}
                                        className={clsx(
                                          'flex-none',
                                          isActive ? 'text-hb-blue' : 'text-hb-dim'
                                        )}
                                      />
                                      <span className="flex-1 truncate">{sub.label}</span>
                                    </>
                                  )}
                                </NavLink>
                              </li>
                            )
                          })}
                        </ul>
                      </li>
                    )
                  }

                  /* ── Plain item ────────────────────────────────────── */
                  const item = entry
                  const ItemIcon = item.icon

                  return (
                    <li key={item.to + item.label}>
                      <NavLink
                        to={item.to}
                        end={item.end || !!item.customActivePath}
                        onMouseEnter={() => prefetchRoute(item.to)}
                        onFocus={() => prefetchRoute(item.to)}
                        aria-current={undefined}
                        className={({ isActive }) =>
                          clsx(
                            'relative flex items-center gap-2.5 rounded-hb-sm py-2.5 pl-3 pr-2.5',
                            'font-body text-hb-sm font-semibold',
                            'transition-colors duration-hb ease-hb',
                            'focus-visible:outline-none focus-visible:shadow-hb-ring',
                            itemActive(item, isActive)
                              ? clsx('bg-hb-blue/8 text-hb-text', RAIL)
                              : 'text-hb-muted hover:bg-hb-muted/8 hover:text-hb-text'
                          )
                        }
                      >
                        {({ isActive }) => {
                          const active = itemActive(item, isActive)
                          return (
                            <>
                              <ItemIcon
                                size={16}
                                className={clsx('flex-none', active ? 'text-hb-blue' : 'text-hb-dim')}
                              />
                              <span className="flex-1 truncate">{item.label}</span>
                              {item.badge != null && item.badge > 0 && <CountPill value={item.badge} />}
                            </>
                          )
                        }}
                      </NavLink>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* ── Who you are ───────────────────────────────────────────────── */}
        <div className="flex-none border-t border-hb-border">
          <div className="flex items-center gap-3 px-hb-5 py-hb-4">
            <span className="grid h-9 w-9 flex-none place-items-center overflow-hidden rounded-full bg-hb-grad font-display text-hb-xs font-bold text-hb-on-brand">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-hb-sm font-semibold text-hb-text" title={user?.full_name || role}>
                {user?.full_name || role}
              </p>
              <p
                className="truncate font-mono text-hb-label uppercase text-hb-dim"
                title={footerSubtitle || user?.organization_name || 'AI Hiring Platform'}
              >
                {footerSubtitle || user?.organization_name || 'AI Hiring Platform'}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

/** Unread count. Solid rather than tinted — it is asking for attention. */
function CountPill({ value }: { value: number }) {
  return (
    <span className="inline-flex h-[18px] min-w-[18px] flex-none items-center justify-center rounded-hb-full bg-hb-blue px-1.5 font-mono text-hb-micro font-semibold text-white">
      {value > 99 ? '99+' : value}
    </span>
  )
}

export const HbSidebar = memo(HbSidebarComponent)
