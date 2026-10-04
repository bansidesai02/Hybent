import type { ComponentType } from 'react'
import {
  Activity, Brain, BriefcaseBusiness, Building2, CalendarDays, ChartColumn, ClipboardCheck,
  Coins, CreditCard, Database, FileText, Handshake, Inbox, LayoutDashboard, Lightbulb, ScrollText,
  Settings, Sparkle, SquareKanban, ToggleLeft, TrendingUp, Upload, Users, UsersRound, Video,
} from 'lucide-react'
import type { UserRole } from '@/types'

/**
 * The workspace navigation, as data.
 *
 * Previously this lived inside Sidebar.tsx as JSX, with every item holding a
 * pre-built `<GlassIcon variant="violet" …>` element. Active state was then
 * applied by walking the tree with `React.cloneElement` to swap `variant` from
 * `gray` to `violet` — three separate call sites doing it slightly differently.
 *
 * Icons are now component *references*, so the active treatment is CSS on the
 * link, where it belongs. That single change is what lets the whole five-colour
 * GlassIcon palette leave the sidebar.
 */

type Icon = ComponentType<{ size?: number | string; className?: string }>

export interface NavItem {
  to: string
  label: string
  icon: Icon
  /** Live count. Rendered only when > 0. */
  badge?: number
  /** Matched with startsWith instead of exact — for hub pages with detail routes. */
  customActivePath?: string
  /** Exact match only. Set on workspace index routes so they do not stay lit. */
  end?: boolean
}

export interface NavGroup {
  type: 'group'
  label: string
  icon: Icon
  badge?: number
  /** Any of these being active auto-expands the group. */
  subPaths: string[]
  items: NavItem[]
}

export type NavEntry = NavItem | NavGroup

export interface NavSection {
  /** Identifies the section. Not rendered — the sidebar is one flat list. */
  label: string
  items: NavEntry[]
  /** Pin to the bottom of the sidebar — for account-level destinations. */
  pinned?: boolean
}

export function isGroup(entry: NavEntry): entry is NavGroup {
  return 'type' in entry && entry.type === 'group'
}

/* The Candidates group is shared by the recruiter and admin navs, which differ
   only in the first item's label. */
function candidatesGroup(basePath: string, role: UserRole, badge?: number): NavGroup {
  return {
    type: 'group',
    label: 'Candidates',
    icon: Users,
    badge,
    subPaths: [
      `${basePath}/candidates`,
      `${basePath}/upload`,
      `${basePath}/jobs/new`,
      `${basePath}/talent-pool`,
    ],
    items: [
      { to: `${basePath}/candidates`, label: role === 'admin' ? 'All Candidates' : 'My Candidates', icon: Users },
      { to: `${basePath}/upload`, label: 'Upload Resume', icon: Upload },
      { to: `${basePath}/jobs/new`, label: 'Upload / Add JD', icon: FileText },
      { to: `${basePath}/talent-pool`, label: 'Talent DB', icon: Database },
    ],
  }
}

export function getNavSections(
  role: UserRole,
  candidateBadge: number,
  _scheduleBadge: number
): NavSection[] {
  const basePath = role === 'admin' ? '/hiring/admin' : '/hiring/recruiter'

  if (role === 'super_admin') {
    return [
      {
        label: 'Overview',
        items: [
          { to: '/hiring/super-admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
          { to: '/hiring/super-admin/inbox', label: 'Gmail Inbox', icon: Inbox },
          { to: '/hiring/super-admin/analytics', label: 'Analytics', icon: TrendingUp },
        ],
      },
      {
        label: 'Clients',
        items: [
          { to: '/hiring/super-admin/clients', label: 'All clients', icon: Building2 },
          { to: '/hiring/super-admin/billing', label: 'Billing & plans', icon: CreditCard },
          { to: '/hiring/super-admin/ai-credits', label: 'AI credits', icon: Coins },
        ],
      },
      {
        label: 'Platform',
        items: [
          { to: '/hiring/super-admin/users', label: 'All users', icon: Users },
          { to: '/hiring/super-admin/flags', label: 'Feature flags', icon: ToggleLeft },
          { to: '/hiring/super-admin/audit', label: 'Audit logs', icon: ScrollText },
          { to: '/hiring/super-admin/health', label: 'Health monitor', icon: Activity },
        ],
      },
      {
        label: 'Settings',
        pinned: true,
        items: [{ to: '/hiring/super-admin/settings', label: 'Global settings', icon: Settings }],
      },
    ]
  }

  if (role === 'interviewer') {
    return [
      {
        label: '',
        items: [
          { to: '/hiring/interviewer', label: 'Dashboard', icon: LayoutDashboard, end: true },
          { to: '/hiring/interviewer/interviews', label: 'My Interviews', icon: CalendarDays },
          {
            to: '/hiring/interviewer/scorecard-hub',
            label: 'Scoreboard',
            icon: ClipboardCheck,
            customActivePath: '/hiring/interviewer/scorecard',
          },
          {
            to: '/hiring/interviewer/prep-kit-hub',
            label: 'Prep Kit',
            icon: Brain,
            customActivePath: '/hiring/interviewer/prep-kit',
          },
          {
            to: '/hiring/interviewer/live-room-hub',
            label: 'Live Room',
            icon: Video,
            customActivePath: '/hiring/interviewer/live-room',
          },
        ],
      },
    ]
  }

  /* Recruiter and admin share a shape; only the Workspace section and the
     Candidates labels differ. */
  const adminWorkspace: NavItem[] = [
    { to: '/hiring/admin/teams', label: 'Team', icon: UsersRound },
    { to: '/hiring/admin/audit', label: 'Audit Logs', icon: ScrollText },
    { to: '/hiring/admin/ai-credits', label: 'AI Credits', icon: Coins },
    { to: '/hiring/admin/billing', label: 'Billing', icon: CreditCard },
  ]

  const recruiterWorkspace: NavItem[] = [
    { to: `${basePath}/teams`, label: 'Team', icon: UsersRound },
    { to: `${basePath}/ai-credits`, label: 'AI Credits', icon: Coins },
  ]

  return [
    {
      label: 'Main',
      items: [
        { to: basePath, label: 'Overview', icon: LayoutDashboard, end: true },
        { to: `${basePath}/copilot`, label: 'Recruiter Copilot', icon: Sparkle, customActivePath: `${basePath}/copilot` },
        { to: `${basePath}/inbox`, label: 'Gmail Inbox', icon: Inbox },
        { to: `${basePath}/jobs`, label: 'Open Positions', icon: BriefcaseBusiness },
        candidatesGroup(basePath, role, candidateBadge),
        { to: `${basePath}/pipeline`, label: 'Pipeline', icon: SquareKanban },
        { to: `${basePath}/interviews`, label: 'Schedule', icon: CalendarDays },
        { to: `${basePath}/offers`, label: 'Offers', icon: Handshake },
      ],
    },
    {
      label: 'Intelligence',
      items: [
        { to: `${basePath}/analytics`, label: 'AI Insights', icon: Lightbulb },
        { to: `${basePath}/reports`, label: 'Reports & Analytics', icon: ChartColumn },
      ],
    },
    {
      label: 'Workspace',
      items: role === 'admin' ? adminWorkspace : recruiterWorkspace,
    },
    {
      label: 'Settings',
      pinned: true,
      items: [{ to: `${basePath}/settings`, label: 'Settings', icon: Settings }],
    },
  ]
}

/* ── Mobile ─────────────────────────────────────────────────────────────────
   Below lg the workspace is a phone app: a bottom tab bar with the role's
   four everyday destinations plus "More" (the full menu, as a drawer). The
   tabs are picked from the role's own nav by path, so they can never point
   somewhere the sidebar doesn't — and a role whose nav lacks one of them
   (e.g. a custom portal nav) just falls back to its first items. */

const MOBILE_TAB_PATHS: Partial<Record<UserRole, (base: string) => string[]>> = {
  recruiter: (b) => [b, `${b}/candidates`, `${b}/pipeline`, `${b}/copilot`],
  admin: (b) => [b, `${b}/candidates`, `${b}/pipeline`, `${b}/copilot`],
  interviewer: () => [
    '/hiring/interviewer',
    '/hiring/interviewer/interviews',
    '/hiring/interviewer/scorecard-hub',
    '/hiring/interviewer/prep-kit-hub',
  ],
  super_admin: () => [
    '/hiring/super-admin',
    '/hiring/super-admin/clients',
    '/hiring/super-admin/users',
    '/hiring/super-admin/analytics',
  ],
}

/** Shorter labels for the tab bar, where ~70px is all a label gets. */
const MOBILE_TAB_LABELS: Record<string, string> = {
  'My Candidates': 'Candidates',
  'All Candidates': 'Candidates',
  'Recruiter Copilot': 'Copilot',
  'My Interviews': 'Interviews',
  'All clients': 'Clients',
  'All users': 'Users',
  'Application Journey': 'Journey',
  'Job Openings': 'Jobs',
  'Preparation Hub': 'Prep',
  'Offers & Documents': 'Offers',
}

export function flattenNav(sections: NavSection[]): NavItem[] {
  return sections.flatMap((s) => s.items.flatMap((e) => (isGroup(e) ? e.items : [e])))
}

export function getMobileTabs(role: UserRole, basePath: string, sections: NavSection[]): NavItem[] {
  const items = flattenNav(sections.filter((s) => !s.pinned))
  const wanted = MOBILE_TAB_PATHS[role]?.(basePath) ?? []
  const picked = wanted
    .map((path) => items.find((i) => i.to === path))
    .filter((i): i is NavItem => Boolean(i))
  const tabs = picked.length === 4 ? picked : items.slice(0, 4)
  return tabs.map((t) => ({ ...t, label: MOBILE_TAB_LABELS[t.label] ?? t.label }))
}

/** The nav label for the current route — the mobile top bar's title. */
export function activeNavLabel(sections: NavSection[], pathname: string): string | undefined {
  const items = flattenNav(sections)
  const exact = items.find((i) => i.to === pathname)
  if (exact) return exact.label
  // Deepest prefix match, ignoring workspace index routes (they'd match everything).
  return items
    .filter((i) => !i.end && pathname.startsWith(i.customActivePath ?? i.to))
    .sort((a, b) => b.to.length - a.to.length)[0]?.label
}
