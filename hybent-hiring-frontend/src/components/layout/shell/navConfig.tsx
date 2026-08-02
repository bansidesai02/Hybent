import type { ComponentType } from 'react'
import {
  Activity, Bot, Brain, BriefcaseMedical, Building2, Calendar, ClipboardCheck,
  ClipboardList, Coins, CreditCard, Database, FileText, Handshake, LayoutGrid,
  Settings, ToggleLeft, TrendingUp, Upload, Users, UsersRound, Video,
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
  /** Empty string renders no heading — the interviewer nav is a flat list. */
  label: string
  items: NavEntry[]
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
          { to: '/hiring/super-admin', label: 'Dashboard', icon: LayoutGrid, end: true },
          { to: '/hiring/super-admin/analytics', label: 'Analytics', icon: TrendingUp },
        ],
      },
      {
        label: 'Clients',
        items: [
          { to: '/hiring/super-admin/clients', label: 'All clients', icon: Building2 },
          { to: '/hiring/super-admin/billing', label: 'Billing & plans', icon: CreditCard },
        ],
      },
      {
        label: 'Platform',
        items: [
          { to: '/hiring/super-admin/users', label: 'All users', icon: Users },
          { to: '/hiring/super-admin/flags', label: 'Feature flags', icon: ToggleLeft },
          { to: '/hiring/super-admin/audit', label: 'Audit logs', icon: ClipboardList },
          { to: '/hiring/super-admin/health', label: 'Health monitor', icon: Activity },
        ],
      },
      {
        label: 'Settings',
        items: [{ to: '/hiring/super-admin/settings', label: 'Global settings', icon: Settings }],
      },
    ]
  }

  if (role === 'interviewer') {
    return [
      {
        label: '',
        items: [
          { to: '/hiring/interviewer', label: 'Dashboard', icon: LayoutGrid, end: true },
          { to: '/hiring/interviewer/interviews', label: 'My Interviews', icon: Calendar },
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

  /* Recruiter and admin share a shape; only the Settings section and the
     Candidates labels differ. */
  const adminSettings: NavItem[] = [
    { to: '/hiring/admin/teams', label: 'Team', icon: UsersRound },
    { to: '/hiring/admin/audit', label: 'Audit Logs', icon: ClipboardList },
    { to: '/hiring/admin/ai-credits', label: 'AI Credits', icon: Coins },
  ]

  const recruiterSettings: NavItem[] = [
    { to: `${basePath}/teams`, label: 'Team', icon: UsersRound },
    { to: `${basePath}/ai-credits`, label: 'AI Credits', icon: Coins },
  ]

  return [
    {
      label: 'Main',
      items: [
        { to: basePath, label: 'Overview', icon: LayoutGrid, end: true },
        { to: `${basePath}/jobs`, label: 'Open Positions', icon: BriefcaseMedical },
        candidatesGroup(basePath, role, candidateBadge),
        { to: `${basePath}/pipeline`, label: 'Pipeline', icon: PipelineGlyph },
        { to: `${basePath}/interviews`, label: 'Schedule', icon: Calendar },
        { to: `${basePath}/offers`, label: 'Offers', icon: Handshake },
      ],
    },
    {
      label: 'Intelligence',
      items: [
        { to: `${basePath}/analytics`, label: 'AI Insights', icon: Bot },
        { to: `${basePath}/reports`, label: 'Reports & Analytics', icon: TrendingUp },
      ],
    },
    {
      label: 'Settings',
      items: role === 'admin' ? adminSettings : recruiterSettings,
    },
  ]
}

/** Three linked nodes — the pipeline. Kept from the old sidebar; lucide has no
    equivalent, and it draws with `currentColor` so it themes like the rest. */
export function PipelineGlyph({ size = 16, className }: { size?: number | string; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className={className}
      aria-hidden
    >
      <circle cx="3" cy="8" r="1.8" />
      <circle cx="8" cy="8" r="1.8" />
      <circle cx="13" cy="8" r="1.8" />
      <path d="M4.8 8h1.4M9.8 8h1.4" strokeLinecap="round" />
    </svg>
  )
}
