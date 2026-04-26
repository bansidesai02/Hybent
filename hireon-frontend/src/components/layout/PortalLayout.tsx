import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { portalApi } from '@/api/portal'
import { NotificationBell } from './NotificationBell'
import { motion, AnimatePresence } from 'framer-motion'
import { useWebSocket } from '@/hooks/useWebSocket'
import { Search, Moon, Sun, User, LogOut, Map, Calendar, Bell, Target, Building2, FileText, Brain, Menu, X } from 'lucide-react'
import { GlassIcon } from '@/components/common/GlassIcon'

const NAV_ITEMS = [
  { to: '/portal', label: 'Application Journey', icon: 'Map', end: true },
  { to: '/portal/interviews', label: 'My Interviews', icon: 'Calendar', end: false },
  { to: '/portal/profile', label: 'My Profile & Resume', icon: 'User', end: false },
  { to: '/portal/prep', label: 'Interview Prep Hub', icon: 'Target', end: false },
  { to: '/portal/openings', label: 'Current Openings', icon: 'Building2', end: false },
  { to: '/portal/offers', label: 'Offer & Documents', icon: 'FileText', end: false },
]

export function PortalLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const location = useLocation()

  // Establish WebSocket connection for real-time notifications in candidate portal
  useWebSocket()

  // Handle click outside to close menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  const { data: applications } = useQuery({
    queryKey: ['portal', 'applications'],
    queryFn: () => portalApi.myApplications().then((r: any) => r.data),
  })

  // Stages that unlock the Offers & Documents section
  const OFFER_ELIGIBLE_STAGES = [
    'hr_round_selected',
    'offered',
    'offer',
    'hired',
    'hired_joined',
    'offered_back_out',
    'offer_withdrawn',
  ]

  // Show Offer & Docs tab only when HR round is completed
  const offersUnlocked = applications?.some(
    (a: any) => OFFER_ELIGIBLE_STAGES.includes(a.stage) || OFFER_ELIGIBLE_STAGES.includes(a.candidate?.pipeline_stage)
  ) ?? false


  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'C'

  const toggleTheme = () => {
    setTheme(t => t === 'light' ? 'dark' : 'light')
  }


  return (
    <div className={`portal-root ${theme}`} data-theme={theme} style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Poppins', sans-serif" }}>
      <div className="dot-grid"></div>

      <div className="app flex flex-row h-full z-10 relative">
        {/* Sidebar Overlay for mobile */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] lg:hidden"
            />
          )}
        </AnimatePresence>

        {/* SIDEBAR */}
        <div className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
          <div className="sb-header">
            <div className="logo-wrap">
              <div className="logo-orbit">
                <div className="logo-orbit-ring"></div>
                <div className="logo-box">
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <rect x="2" y="3" width="4" height="16" rx="2" fill="white" opacity="0.95"/>
                    <rect x="16" y="3" width="4" height="16" rx="2" fill="white" opacity="0.95"/>
                    <rect x="2" y="9" width="18" height="4" rx="2" fill="white" opacity="0.95"/>
                  </svg>
                </div>
              </div>
              <span className="logo-wordmark lwl">Hireon</span>
            </div>
          </div>
          <div className="sb-divider" />

          <div className="sb-categories">
            {/* MAIN */}
            <div className="sb-cat">
              <div className="sb-cat-title">Main</div>
              <NavLink to="/portal" end className={({ isActive }) => `sb-item ${isActive ? 'active' : ''}`}>
                {({ isActive }) => (
                  <>
                    <GlassIcon icon="Map" variant={isActive ? 'violet' : 'gray'} size={24} iconSize={14} ghost glow={false} /> Application Journey
                  </>
                )}
              </NavLink>
              <NavLink to="/portal/interviews" className={({ isActive }) => `sb-item ${isActive ? 'active' : ''}`}>
                {({ isActive }) => (
                  <>
                    <GlassIcon icon="Calendar" variant={isActive ? 'violet' : 'gray'} size={24} iconSize={14} ghost glow={false} /> My Interviews
                  </>
                )}
              </NavLink>
              <NavLink to="/portal/openings" className={({ isActive }) => `sb-item ${isActive ? 'active' : ''}`}>
                {({ isActive }) => (
                  <>
                    <GlassIcon icon="Briefcase" variant={isActive ? 'violet' : 'gray'} size={24} iconSize={14} ghost glow={false} /> Job Openings
                  </>
                )}
              </NavLink>
            </div>

            {/* INTELLIGENCE */}
            <div className="sb-cat">
              <div className="sb-cat-title">Intelligence</div>
              <NavLink to="/portal/prep" className={({ isActive }) => `sb-item ${isActive ? 'active' : ''}`}>
                {({ isActive }) => (
                  <>
                    <GlassIcon icon="FileSearch" variant={isActive ? 'violet' : 'gray'} size={24} iconSize={14} ghost glow={false} /> Preparation Hub
                  </>
                )}
              </NavLink>
            </div>

            {/* RESOURCES */}
            {offersUnlocked && (
              <div className="sb-cat">
                <div className="sb-cat-title">Resources</div>
                <NavLink to="/portal/offers" className={({ isActive }) => `sb-item ${isActive ? 'active' : ''}`}>
                  {({ isActive }) => (
                    <>
                      <GlassIcon icon="FileText" variant={isActive ? 'violet' : 'gray'} size={24} iconSize={14} ghost glow={false} /> Offers &amp; Documents
                      <span className="sb-badge new">New</span>
                    </>
                  )}
                </NavLink>
              </div>
            )}
          </div>

          {/* Personalized Footer */}
          <div className="sb-footer">
            <div className="sb-user-card" style={{ cursor: 'default' }}>
              <div className="sb-footer-av">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="avatar" className="sb-avatar-img-tiny" />
                ) : (
                  initials
                )}
              </div>
              <div className="sb-footer-info">
                <div className="sb-footer-name" title={user?.full_name || 'Candidate'}>
                  {user?.full_name || 'Candidate'}
                </div>
                <div className="sb-footer-role">AI Hiring Platform</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* TOPBAR (Now inside the right column) */}
          <div className="topbar">
            {/* Mobile Toggle */}
            <button 
              className="lg:hidden flex items-center justify-center w-9 h-9 rounded-xl bg-white dark:bg-[var(--card-bg)] border border-gray-100 dark:border-[var(--card-border)] shadow-sm mr-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu size={18} className="text-[var(--text)]" />
            </button>

            {/* Search bar */}
            <div className="topbar-search-wrap">
              <div className={`topbar-search ${searchFocused ? 'focused' : ''}`}>
                <Search size={14} style={{ opacity: 0.6, color: 'var(--violet)' }} />
                <input
                  type="text"
                  placeholder="Search openings, prep topics, jobs..."
                  className="topbar-search-input"
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                />
              </div>
            </div>
            
            <div className="topbar-right">
              <button className="tb-toggle" onClick={toggleTheme} title="Toggle Dark/Light Mode">
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              </button>

              <div className="cand-notif">
                <NotificationBell />
              </div>

              <div className="relative" ref={menuRef}>
                <button 
                  className="cand-av-btn" 
                  onClick={() => setMenuOpen(!menuOpen)}
                  title="Account Settings"
                >
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt="avatar" className="cand-avatar-img" />
                  ) : (
                    initials
                  )}
                </button>

                <AnimatePresence>
                  {menuOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="portal-menu"
                    >
                      <div className="menu-header">
                        <p className="menu-name">{user?.full_name}</p>
                        <p className="menu-email">{user?.email}</p>
                      </div>
                      <button className="menu-item" onClick={() => { setMenuOpen(false); navigate('/portal/profile') }}>
                        <User size={14} /> My Profile
                      </button>
                      <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)', marginTop: 4, paddingTop: 4 }}>
                        <button className="menu-item red" onClick={() => { setMenuOpen(false); logout() }}>
                          <LogOut size={14} /> Sign Out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <div className="main flex-1 overflow-y-auto w-full relative p-4 md:p-6 lg:p-[28px_30px]">
            <div className="main-content-container">
              <Outlet />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
