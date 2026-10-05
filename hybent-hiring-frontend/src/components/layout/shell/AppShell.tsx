import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import type { UserRole } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { useScreeningNav } from '@/hooks/useScreeningNav'
import { useNotificationStore } from '@/store/notificationStore'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useThemeStore } from '@/store/themeStore'
import { SkeletonStats, Skeleton } from '@/components/hb'
import { ImpersonationBanner } from '@/components/common/ImpersonationBanner'
import { HbSidebar } from './HbSidebar'
import { HbTopbar } from './HbTopbar'
import { HbBottomNav } from './HbBottomNav'
import { InstallAppCard } from './InstallAppCard'
import { activeNavLabel, getMobileTabs, getNavSections, type NavSection } from './navConfig'

type TopbarMenuItem = { label: string; icon: ReactNode; path: string }

const GlobalChatOverlay = lazy(() =>
  import('@/components/messaging/GlobalChatOverlay').then((m) => ({ default: m.GlobalChatOverlay }))
)
const CopilotWidget = lazy(() =>
  import('@/modules/recruiter/components/Copilot/CopilotWidget').then((m) => ({ default: m.CopilotWidget }))
)

/**
 * The one shell every authenticated workspace renders inside.
 *
 * Replaces RecruiterLayout, InterviewerLayout and SuperAdminLayout, which were
 * near-identical — they differed only in the role string, which overlays they
 * mounted, and whether the main padding was `p-3` or `p-4`. Each also hardcoded
 * `fontFamily: "'Poppins', sans-serif"` inline.
 *
 * Per-role behaviour is a table rather than three files, so adding a workspace
 * is a row. The table preserves today's behaviour exactly: super admin really
 * did not open a websocket, and the interviewer really did not get the copilot.
 */

interface RoleConfig {
  websocket: boolean
  chat: boolean
  copilot: boolean
}

const ROLE_CONFIG: Record<string, RoleConfig> = {
  recruiter:   { websocket: true,  chat: true,  copilot: true },
  admin:       { websocket: true,  chat: true,  copilot: true },
  interviewer: { websocket: true,  chat: true,  copilot: false },
  super_admin: { websocket: false, chat: false, copilot: false },
  candidate:   { websocket: true,  chat: false, copilot: false },
}

const FALLBACK: RoleConfig = { websocket: false, chat: false, copilot: false }

/**
 * Opens the realtime connection.
 *
 * A component rather than a call in AppShell because hooks cannot be
 * conditional, and super admin must keep *not* holding a socket open.
 */
function RealtimeBridge() {
  useWebSocket()
  return null
}

/**
 * Applies the user's stored theme to the document for as long as a workspace
 * is mounted, and clears it on the way out.
 *
 * This is the only place the product's dark theme is ever applied. The
 * marketing site and the auth pages never render `AppShell`, so they can
 * never inherit a dark preference set inside a workspace — leaving one (sign
 * out, or just navigating back to hybent.com) always lands back on light.
 */
function useWorkspaceTheme() {
  const theme = useThemeStore((s) => s.theme)
  const hasHydrated = useThemeStore((s) => s.hasHydrated)

  useEffect(() => {
    // Until the persisted preference has been read back, `theme` is just the
    // in-memory default ('light') — applying that would fight the pre-paint
    // script in index.html, which already got this right for a hard reload,
    // and flash a dark-mode user to light for a frame.
    if (!hasHydrated) return

    const root = document.documentElement
    // The installed app's status bar takes this colour; match the top bar.
    const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    const lightColor = themeMeta?.content ?? '#FBFCFE'
    if (theme === 'dark') {
      root.dataset.theme = 'dark'
      root.classList.add('dark')
      // --hb-surface is an "r g b" triple; read it after the theme switch.
      const surface = getComputedStyle(root).getPropertyValue('--hb-surface').trim()
      if (themeMeta && surface) themeMeta.content = `rgb(${surface.replace(/\s+/g, ',')})`
    } else {
      root.dataset.theme = 'classic'
      root.classList.remove('dark')
      if (themeMeta) themeMeta.content = lightColor
    }
    return () => {
      root.dataset.theme = 'classic'
      root.classList.remove('dark')
      if (themeMeta) themeMeta.content = lightColor
    }
  }, [theme, hasHydrated])
}

/**
 * iOS-style collapsing title: true once the page's own <h1> (its large title)
 * has scrolled out from under the top bar, so the bar can show the name
 * instead. Pages are lazy, so the h1 is looked for again as content arrives.
 */
function useTitleScrolledAway(mainRef: React.RefObject<HTMLElement>, routeKey: string) {
  const [away, setAway] = useState(false)
  // The h1's visible text ("Hybent" on a client page), so the bar shows the
  // page's own title rather than its menu section ("All clients").
  const [text, setText] = useState('')

  useEffect(() => {
    const main = mainRef.current
    if (!main) return
    setAway(false)
    setText('')
    let io: IntersectionObserver | null = null
    let watched: Element | null = null

    const attach = () => {
      const h1 = main.querySelector('h1')
      if (!h1 || h1 === watched) return
      io?.disconnect()
      watched = h1
      io = new IntersectionObserver(([entry]) => {
        setAway(!entry.isIntersecting)
        // innerText skips display:none parts (e.g. a desktop-only longer title).
        setText((h1 as HTMLElement).innerText.replace(/\s+/g, ' ').trim())
      }, {
        root: main,
        threshold: 0,
      })
      io.observe(h1)
    }

    attach()
    const mo = new MutationObserver(attach)
    mo.observe(main, { childList: true, subtree: true })
    return () => {
      mo.disconnect()
      io?.disconnect()
    }
  }, [mainRef, routeKey])

  return { away, text }
}

/** Mirrors a dashboard's shape — stat row then a wide panel — so the page does
    not reflow when the real content arrives. */
function ContentFallback() {
  return (
    <div className="space-y-hb-4">
      <Skeleton className="h-8 w-52" rounded="md" />
      <SkeletonStats count={4} />
      <Skeleton className="h-80 w-full" rounded="md" />
    </div>
  )
}

export interface AppShellProps {
  /** Omit to read the signed-in user's role. Pass to pin a workspace. */
  role?: UserRole
  /** Overrides the role-derived navigation. */
  sections?: NavSection[]
  footerSubtitle?: string
  /** Topbar feature switches. */
  topbar?: { search?: boolean; messages?: boolean; menuItems?: TopbarMenuItem[] }
}

export function AppShell({ role, sections, footerSubtitle, topbar }: AppShellProps) {
  const { user, basePath } = useAuth()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  useWorkspaceTheme()

  const activeRole = (role ?? user?.role ?? 'recruiter') as UserRole
  const config = ROLE_CONFIG[activeRole] ?? FALLBACK

  /* Phone chrome: the tab bar's destinations and the top bar's title come
     from the same nav the sidebar renders. */
  const notifications = useNotificationStore((s) => s.notifications)
  const candidateBadge = useMemo(
    () => notifications.filter((n) => !n.is_read && (n.type === 'application_received' || n.type === 'stage_changed')).length,
    [notifications],
  )
  const screening = useScreeningNav(activeRole)
  const navSections = useMemo(
    () => sections ?? getNavSections(activeRole, candidateBadge, 0, screening),
    [sections, activeRole, candidateBadge, screening],
  )
  const mobileTabs = useMemo(
    () => getMobileTabs(activeRole, basePath, navSections),
    [activeRole, basePath, navSections],
  )
  const { away: titleAway, text: h1Text } = useTitleScrolledAway(mainRef, location.pathname)
  const pageTitle = h1Text || activeNavLabel(navSections, location.pathname)

  return (
    /* Desktop: sidebar and main column are two matching floating panels on
       the app ground, separated by an even 8px gutter. */
    <div className="hb-app flex h-dvh h-screen overflow-hidden lg:gap-2 lg:p-2">
      {config.websocket && <RealtimeBridge />}

      <HbSidebar
        role={activeRole}
        sections={sections}
        footerSubtitle={footerSubtitle}
        mobileOpen={drawerOpen}
        onCloseMobile={() => setDrawerOpen(false)}
      />

      {/* No background of its own: the app ground, its glows and the grid
          (`.hb-app` / `.hb-app::before` in tokens.css) must show through —
          any fill here hides them. The panel is just its border and radius. */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden lg:rounded-hb-md lg:border lg:border-hb-border">
        <ImpersonationBanner />
        <HbTopbar
          onToggleMenu={() => setDrawerOpen((o) => !o)}
          mobileTitle={pageTitle}
          showMobileTitle={titleAway}
          search={topbar?.search}
          messages={topbar?.messages}
          menuItems={topbar?.menuItems}
        />

        {/* Page gutter: 16px on phones, scaling up to xl. Below lg the bottom
            padding also clears the tab bar (--hb-mobile-nav, tokens.css). */}
        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto overscroll-none px-4 pt-4 pb-[calc(var(--hb-mobile-nav)+1.5rem)] sm:px-hb-5 sm:pt-hb-5 md:px-hb-8 md:pt-hb-8 lg:p-hb-8 xl:p-hb-12"
        >
          {/* overflow-x-clip: a stray wide element can't make the whole page
              wobble sideways on a phone; wide content scrolls in its own box. */}
          <div className="mx-auto w-full max-w-[1440px] overflow-x-clip">
            <Suspense fallback={<ContentFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      <HbBottomNav tabs={mobileTabs} onMore={() => setDrawerOpen((o) => !o)} moreOpen={drawerOpen} />
      <InstallAppCard />

      {(config.chat || config.copilot) && (
        <Suspense fallback={null}>
          {config.chat && <GlobalChatOverlay />}
          {config.copilot && <CopilotWidget />}
        </Suspense>
      )}
    </div>
  )
}

/* Thin per-workspace wrappers, so a route file reads as one element.

   Recruiter and admin share `WorkspaceShell`, which reads the signed-in role —
   exactly what RecruiterLayout did for both, since AdminRoutes mounted it too.
   The interviewer and super-admin shells pin their role, as their layouts did. */
export const WorkspaceShell = () => <AppShell />
export const InterviewerShell = () => <AppShell role="interviewer" />
export const SuperAdminShell = () => <AppShell role="super_admin" />
