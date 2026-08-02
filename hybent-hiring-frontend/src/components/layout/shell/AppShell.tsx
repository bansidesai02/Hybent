import { lazy, Suspense, useState, type ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import type { UserRole } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { useWebSocket } from '@/hooks/useWebSocket'
import { SkeletonStats, Skeleton } from '@/components/hb'
import { ImpersonationBanner } from '@/components/common/ImpersonationBanner'
import { HbSidebar } from './HbSidebar'
import { HbTopbar } from './HbTopbar'
import type { NavSection } from './navConfig'

type TopbarMenuItem = { label: string; icon: ReactNode; path: string }

const GlobalChatOverlay = lazy(() =>
  import('@/components/messaging/GlobalChatOverlay').then((m) => ({ default: m.GlobalChatOverlay }))
)
const CopilotWidget = lazy(() =>
  import('@/components/Copilot/CopilotWidget').then((m) => ({ default: m.CopilotWidget }))
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
  const { user } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const activeRole = (role ?? user?.role ?? 'recruiter') as UserRole
  const config = ROLE_CONFIG[activeRole] ?? FALLBACK

  return (
    <div className="hb-app flex h-screen overflow-hidden">
      {config.websocket && <RealtimeBridge />}

      <HbSidebar
        role={activeRole}
        sections={sections}
        footerSubtitle={footerSubtitle}
        mobileOpen={drawerOpen}
        onCloseMobile={() => setDrawerOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <ImpersonationBanner />
        <HbTopbar
          onToggleMenu={() => setDrawerOpen((o) => !o)}
          search={topbar?.search}
          messages={topbar?.messages}
          menuItems={topbar?.menuItems}
        />

        {/* The site's page gutter is `clamp(20px, 4vw, 48px)`. This was a flat
            24px on desktop — half the air — which is why the workspace read as
            denser and cheaper than the marketing pages even once the colours
            matched. Stepped rather than clamped so it stays on the spacing
            scale. */}
        <main className="flex-1 overflow-y-auto p-hb-5 md:p-hb-8 xl:p-hb-12">
          <div className="mx-auto w-full max-w-[1440px]">
            <Suspense fallback={<ContentFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

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
