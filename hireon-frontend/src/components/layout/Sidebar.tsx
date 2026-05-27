import React, { memo, useState, useMemo, useEffect, useCallback } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { clsx } from 'clsx'
import type { UserRole } from '@/types'
import { useNotificationStore } from '@/store/notificationStore'
import { useAuth } from '@/hooks/useAuth'
import { GlassIcon } from '@/components/common/GlassIcon'
import { TeamIcon } from '@/components/common/CustomIcons'
import { 
  Home, 
  Briefcase, 
  Users, 
  ClipboardList, 
  Upload, 
  FileText, 
  Database, 
  Kanban, 
  Calendar, 
  Send, 
  Brain, 
  BarChart, 
  LayoutGrid, 
  ClipboardCheck, 
  FileSearch, 
  Video, 
  ChevronRight,
  Building2
} from 'lucide-react'
import { prefetchRoute } from '@/utils/routePrefetch'

// ─── Custom Icons ─────────────────────────────────────────────────────────────
const PipelineIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="3" cy="8" r="2" />
    <circle cx="8" cy="8" r="2" />
    <circle cx="13" cy="8" r="2" />
  </svg>
)


// ─── Types ─────────────────────────────────────────────────────────────────────

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  badge?: number
  dot?: boolean         // animated green pulse dot (like Upload Resume in demo)
  customActivePath?: string  // override active detection (startsWith match)
}

interface NavGroup {
  type: 'group'
  label: string
  icon: React.ReactNode
  badge?: number
  subPaths: string[]    // used to auto-expand when any sub-route is active
  items: NavItem[]
}

type NavEntry = NavItem | NavGroup

interface NavSection {
  label: string
  items: NavEntry[]
}

// ─── Nav Config Utility ────────────────────────────────────────────────────────

const getCandidatesGroup = (basePath: string, role: UserRole, badgeCount?: number): NavGroup => ({
  type: 'group',
  label: 'Candidates',
  icon: <GlassIcon icon="Users" variant="violet" ghost size={24} iconSize={14} glow={false} />,
  badge: badgeCount,
  subPaths: [
    `${basePath}/candidates`,
    `${basePath}/upload`,
    `${basePath}/jobs/new`,
    `${basePath}/talent-pool`,
  ],
  items: [
    { to: `${basePath}/candidates`, label: role === 'admin' ? 'All Candidates' : 'My Candidates', icon: <GlassIcon icon="Users" variant="violet" ghost size={18} iconSize={12} glow={false} /> },
    { to: `${basePath}/upload`, label: 'Upload Resume', icon: <GlassIcon icon="Upload" variant="emerald" ghost size={18} iconSize={12} glow={false} /> },
    { to: `${basePath}/jobs/new`, label: 'Upload / Add JD', icon: <GlassIcon icon="FileText" variant="blue" ghost size={18} iconSize={12} glow={false} /> },
    { to: `${basePath}/talent-pool`, label: 'Talent DB', icon: <GlassIcon icon="Database" variant="amber" ghost size={18} iconSize={12} glow={false} /> },
  ],
})

const getSections = (role: UserRole, candidateBadge: number, scheduleBadge: number): NavSection[] => {
  const basePath = role === 'admin' ? '/admin' : '/recruiter'
  const candidatesGroup = getCandidatesGroup(basePath, role, candidateBadge)

  if (role === 'admin') {
    return [
      {
        label: 'MAIN',
        items: [
          { to: basePath, label: 'Overview', icon: <GlassIcon icon="LayoutGrid" variant="violet" ghost size={24} iconSize={14} glow={false} /> },
          { to: `${basePath}/jobs`, label: 'Open Positions', icon: <GlassIcon icon="BriefcaseMedical" variant="blue" ghost size={24} iconSize={14} glow={false} /> },
          candidatesGroup,
          { to: `${basePath}/pipeline`, label: 'Pipeline', icon: <GlassIcon icon={<PipelineIcon size={14} />} variant="pink" ghost size={24} iconSize={14} glow={false} /> },
          { to: `${basePath}/interviews`, label: 'Schedule', icon: <GlassIcon icon="Calendar" variant="violet" ghost size={24} iconSize={14} glow={false} /> },
          { to: `${basePath}/offers`, label: 'Offers', icon: <GlassIcon icon="Handshake" variant="teal" ghost size={24} iconSize={14} glow={false} /> },
        ],
      },
      {
        label: 'INTELLIGENCE',
        items: [
          { to: `${basePath}/analytics`, label: 'AI Insights', icon: <GlassIcon icon="Bot" variant="pink" ghost size={24} iconSize={14} glow={false} /> },
          { to: `${basePath}/reports`, label: 'Reports & Analytics', icon: <GlassIcon icon="TrendingUp" variant="teal" ghost size={24} iconSize={14} glow={false} /> },
        ],
      },
      {
        label: 'SETTINGS',
        items: [
          { to: '/admin/teams', label: 'Team', icon: <GlassIcon icon={<TeamIcon size={16} />} variant="blue" ghost size={24} iconSize={14} glow={false} /> },
          { to: '/admin/audit', label: 'Audit Logs', icon: <GlassIcon icon="ClipboardList" variant="amber" ghost size={24} iconSize={14} glow={false} /> },
        ],
      },
    ]
  }

  if (role === 'interviewer') {
    return [
      {
        label: '',
        items: [
          { to: '/interviewer', label: 'Dashboard', icon: <GlassIcon icon="LayoutGrid" variant="gray" ghost iconSize={14} /> },
          { to: '/interviewer/interviews', label: 'My Interviews', icon: <GlassIcon icon="Calendar" variant="gray" ghost iconSize={14} /> },
          { to: '/interviewer/scorecard-hub', label: 'Scoreboard', icon: <GlassIcon icon="ClipboardCheck" variant="gray" ghost iconSize={14} />, customActivePath: '/interviewer/scorecard' },
          { to: '/interviewer/prep-kit-hub', label: 'Prep Kit', icon: <GlassIcon icon="Brain" variant="gray" ghost iconSize={14} />, customActivePath: '/interviewer/prep-kit' },
          { to: '/interviewer/live-room-hub', label: 'Live Room', icon: <GlassIcon icon="Video" variant="gray" ghost iconSize={14} />, customActivePath: '/interviewer/live-room' },
        ],
      },
    ]
  }

  // Recruiter (Default)
  return [
    {
      label: 'MAIN',
      items: [
        { to: basePath, label: 'Overview', icon: <GlassIcon icon="LayoutGrid" variant="gray" ghost iconSize={14} /> },
        { to: `${basePath}/jobs`, label: 'Open Positions', icon: <GlassIcon icon="BriefcaseMedical" variant="gray" ghost iconSize={14} /> },
        candidatesGroup,
        { to: `${basePath}/pipeline`, label: 'Pipeline', icon: <GlassIcon icon={<PipelineIcon size={14} />} variant="gray" ghost iconSize={14} /> },
        { to: `${basePath}/interviews`, label: 'Schedule', icon: <GlassIcon icon="Calendar" variant="gray" ghost iconSize={14} /> },
        { to: `${basePath}/offers`, label: 'Offers', icon: <GlassIcon icon="Handshake" variant="gray" ghost iconSize={14} /> },
      ],
    },
    {
      label: 'INTELLIGENCE',
      items: [
        { to: `${basePath}/analytics`, label: 'AI Insights', icon: <GlassIcon icon="Bot" variant="gray" ghost iconSize={14} /> },
        { to: `${basePath}/reports`, label: 'Reports & Analytics', icon: <GlassIcon icon="TrendingUp" variant="gray" ghost iconSize={14} /> },
      ],
    },
    {
      label: 'SETTINGS',
      items: [
        { to: `${basePath}/teams`, label: 'Team', icon: <GlassIcon icon={<TeamIcon size={16} />} variant="blue" ghost size={24} iconSize={14} glow={false} /> },
      ],
    },
  ]
}

// ─── Sidebar Component ─────────────────────────────────────────────────────────

interface SidebarProps {
  role: UserRole
  collapsed?: boolean
  mobileOpen?: boolean
  setMobileOpen?: (open: boolean) => void
}

function SidebarComponent({ role, collapsed = false, mobileOpen = false, setMobileOpen }: SidebarProps) {
  const location = useLocation()
  const { notifications } = useNotificationStore()
  const { user } = useAuth()

  const initials = useMemo(() => {
    if (!user?.full_name) return role.charAt(0).toUpperCase()
    return user.full_name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }, [user?.full_name, role])

  // Track if we are on mobile to handle auto-closing
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024 && mobileOpen) {
        setMobileOpen?.(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [mobileOpen, setMobileOpen])

  // Close sidebar on route change on mobile
  useEffect(() => {
    if (mobileOpen) setMobileOpen?.(false)
  }, [location.pathname])

  // Calculate dynamic badges
  const candidateBadge = useMemo(() =>
    notifications.filter(n => !n.is_read && (n.type === 'application_received' || n.type === 'stage_changed')).length
    , [notifications])

  const scheduleBadge = useMemo(() =>
    notifications.filter(n => !n.is_read && (n.type === 'interview_scheduled' || n.type === 'interview_reminder')).length
    , [notifications])

  const sections = useMemo(() => getSections(role, candidateBadge, scheduleBadge), [role, candidateBadge, scheduleBadge])

  // Track which group labels are expanded. Auto-expand groups whose sub-paths are active.
  const getInitialExpanded = (): Set<string> => {
    const expanded = new Set<string>()
    for (const section of sections) {
      for (const entry of section.items) {
        if ('type' in entry && entry.type === 'group') {
          if (entry.subPaths.some((p) => location.pathname.startsWith(p))) {
            expanded.add(entry.label)
          }
        }
      }
    }
    return expanded
  }

  const [expanded, setExpanded] = useState<Set<string>>(getInitialExpanded)

  const toggleGroup = useCallback((label: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }, [])

  const isGroupActive = (group: NavGroup) =>
    group.subPaths.some((p) => location.pathname.startsWith(p))

  return (
    <aside
      className={clsx(
        'h-screen flex flex-col flex-shrink-0 transition-all duration-300 z-[70] lg:relative lg:z-[1200]',
        'bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)]',
        'fixed lg:static inset-y-0 left-0',
        collapsed ? 'w-16' : 'w-60',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}
    >
      {/* Logo Section */}
      <div className={clsx('sb-header', collapsed && 'flex justify-center px-0')}>
        <div className={clsx('logo-wrap', collapsed && 'justify-center gap-0')}>
          <div className="logo-orbit">
            <div className="logo-orbit-ring"></div>
            <div className="logo-box">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <rect x="2" y="3" width="4" height="16" rx="2" fill="white" opacity="0.95" />
                <rect x="16" y="3" width="4" height="16" rx="2" fill="white" opacity="0.95" />
                <rect x="2" y="9" width="18" height="4" rx="2" fill="white" opacity="0.95" />
              </svg>
            </div>
          </div>
          {!collapsed && (
            <span className="logo-wordmark lwl">
              Hireon
            </span>
          )}
        </div>
      </div>

      <div className="sb-divider" />

      {/* Nav sections */}
      <nav className="flex-1 px-[10px] py-2 overflow-y-auto space-y-0.5">
        {sections.map((section) => (
          <div key={section.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {!collapsed && section.label && (
              <p className="text-[10px] font-bold tracking-[1.5px] uppercase text-[var(--text)] dark:text-[var(--text-light)] px-3 pt-3 pb-1 opacity-60">
                {section.label}
              </p>
            )}

            {section.items.map((entry) => {
              // ── Expandable group (e.g. Candidates) ──────────────────────────
              if ('type' in entry && entry.type === 'group') {
                const isOpen = expanded.has(entry.label)
                const isActive = isGroupActive(entry)

                return (
                  <div key={entry.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {/* Parent row */}
                    <button
                      onClick={() => toggleGroup(entry.label)}
                      className={clsx(
                        'nav-item w-full text-left',
                        isActive && 'active',
                        collapsed && 'justify-center px-2'
                      )}
                    >
                      <span className="flex-shrink-0 w-[24px] flex items-center justify-center">
                        {React.isValidElement(entry.icon) && entry.icon.type === GlassIcon 
                          ? React.cloneElement(entry.icon as React.ReactElement, { variant: isActive ? 'violet' : 'gray', ghost: true })
                          : entry.icon
                        }
                      </span>
                      {!collapsed && (
                        <>
                          <span className="flex-1">{entry.label}</span>
                          {entry.badge != null && entry.badge > 0 && (
                            <span
                              className="text-[10px] font-bold text-white px-[7px] py-[1px] rounded-[10px] min-w-[18px] text-center mr-1"
                              style={{ background: 'linear-gradient(135deg, var(--violet), var(--brand2, #ff6bc6))' }}
                            >
                              {entry.badge}
                            </span>
                          )}
                          {/* chevron */}
                          <ChevronRight
                            size={14}
                            style={{
                              transition: 'transform 0.26s',
                              transform: isOpen ? 'rotate(90deg)' : 'none',
                              color: 'var(--text-lite)',
                              marginLeft: 4,
                            }}
                          />
                        </>
                      )}
                    </button>

                    {/* Sub-items */}
                    {!collapsed && (
                      <div
                        style={{
                          maxHeight: isOpen ? 500 : 0, // Increased maxHeight to be safe
                          overflow: 'hidden',
                          transition: 'max-height 0.32s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                        }}
                      >
                        {entry.items.map((sub) => {
                          const subActive = location.pathname === sub.to ||
                            (sub.to !== '/recruiter' && sub.to !== '/admin' && location.pathname.startsWith(sub.to))
                          return (
                            <NavLink
                              key={sub.to}
                              to={sub.to}
                              onMouseEnter={() => prefetchRoute(sub.to)}
                              onFocus={() => prefetchRoute(sub.to)}
                              className={clsx(
                                'flex items-center gap-2 rounded-[9px] text-[12px] font-[500] transition-all duration-150 cursor-pointer select-none',
                                'py-[7px] pr-3',
                                'pl-[28px]',  // indented
                                subActive
                                  ? 'bg-[var(--sb-active)] text-[var(--violet)] font-[700]'
                                  : 'text-[var(--text-mid)] hover:bg-[var(--sb-hover)] hover:text-[var(--violet)]'
                              )}
                            >
                              <span style={{ width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {React.isValidElement(sub.icon) && sub.icon.type === GlassIcon 
                                  ? React.cloneElement(sub.icon as React.ReactElement, { variant: subActive ? 'violet' : 'gray', ghost: true })
                                  : sub.icon
                                }
                              </span>
                              <span className="flex-1">{sub.label}</span>
                              {sub.dot && (
                                <span
                                  style={{
                                    width: 7,
                                    height: 7,
                                    borderRadius: '50%',
                                    background: '#10b981',
                                    flexShrink: 0,
                                    animation: 'pulse 2s infinite',
                                  }}
                                />
                              )}
                            </NavLink>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              }

              // ── Regular nav item ─────────────────────────────────────────────
              const item = entry as NavItem
              return (
                <NavLink
                  key={item.to + (item.customActivePath ?? '') + item.label}
                  to={item.to}
                  onMouseEnter={() => prefetchRoute(item.to)}
                  onFocus={() => prefetchRoute(item.to)}
                  end={item.to === '/recruiter' || item.to === '/admin' || item.to === '/interviewer' || !!item.customActivePath}
                  className={({ isActive }) => {
                    const active = item.customActivePath
                      ? location.pathname.startsWith(item.customActivePath)
                      : isActive
                    return clsx('nav-item', active && 'active', collapsed && 'justify-center px-2')
                  }}
                >
                  <span className="flex-shrink-0 w-[24px] flex items-center justify-center">
                    {React.isValidElement(item.icon) && item.icon.type === GlassIcon 
                      ? React.cloneElement(item.icon as React.ReactElement, { 
                          variant: (item.customActivePath ? location.pathname.startsWith(item.customActivePath) : location.pathname === item.to) ? 'violet' : 'gray',
                          ghost: true
                        })
                      : item.icon
                    }
                  </span>
                  {!collapsed && <span className="flex-1">{item.label}</span>}
                  {!collapsed && item.badge != null && item.badge > 0 && (
                    <span
                      className="text-[10px] font-bold text-white px-[7px] py-[2px] rounded-[10px] min-w-[20px] text-center"
                      style={{ background: 'linear-gradient(135deg, var(--violet), var(--brand2, #ff6bc6))' }}
                    >
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>

      {/* User Support / Role */}
      <div className="sb-footer" style={{ cursor: 'default' }}>
        <div
          className={clsx('sb-user-card', collapsed && 'justify-center px-0')}
          style={{ cursor: 'default' }}
        >
          <div className="sb-footer-av">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="avatar" className="sb-avatar-img-tiny" />
            ) : (
              initials
            )}
          </div>
          {!collapsed && (
            <div className="sb-footer-info">
              <div className="sb-footer-name" title={user?.full_name || role}>
                {user?.full_name || role}
              </div>
              <div className="sb-footer-role" title={user?.organization_name || 'AI Hiring Platform'}>
                {user?.organization_name || 'AI Hiring Platform'}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

export const Sidebar = memo(SidebarComponent)

// Replaced inline SVGs with Lucide React icons
