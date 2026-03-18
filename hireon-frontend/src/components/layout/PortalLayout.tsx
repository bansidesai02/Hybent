import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { portalApi } from '@/api/portal'
const NAV_ITEMS = [
  { to: '/portal', label: 'Application Journey', icon: '🗺️', end: true },
  { to: '/portal/interviews', label: 'My Interviews', icon: '📅', end: false },
  { to: '/portal/profile', label: 'My Profile & Resume', icon: '👤', end: false },
  { to: '/portal/notifications', label: 'Notifications', icon: '🔔', end: false },
  { to: '/portal/prep', label: 'Interview Prep Hub', icon: '🎯', end: false },
  { to: '/portal/openings', label: 'Current Openings', icon: '🏢', end: false },
  { to: '/portal/offers', label: 'Offer & Documents', icon: '📄', end: false },
]

export function PortalLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  const { data: applications } = useQuery({
    queryKey: ['portal', 'applications'],
    queryFn: () => portalApi.myApplications().then(r => r.data)
  })

  // Has offer if any application is in 'offer' or 'hired' stage
  const hasOffer = applications?.some((a: any) => ['offer', 'hired'].includes(a.stage))

  const [toastMsg, setToastMsg] = useState('')
  const [showToast, setShowToast] = useState(false)

  const handleLockedClick = () => {
    setToastMsg('Offer & Documents will be unlocked once you clear the Final Round.')
    setShowToast(true)
    setTimeout(() => setShowToast(false), 3000)
  }

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'C'

  const toggleTheme = () => {
    setTheme(t => t === 'light' ? 'dark' : 'light')
  }

  return (
    <div className={`portal-root ${theme}`} data-theme={theme} style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="ambient">
        <div className="amb-circle ac1"></div>
        <div className="amb-circle ac2"></div>
        <div className="amb-circle ac3"></div>
      </div>
      <div className="dot-grid"></div>

      <div className="app z-10 relative flex flex-col h-full">
        {/* TOPBAR */}
        <div className="topbar">
          <div className="logo-wrap">
            <div className="logo-orbit">
              <div className="logo-orbit-ring"></div>
              <div className="logo-box">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <rect x="2" y="3" width="4" height="16" rx="2" fill="white" opacity="0.95"/>
                  <rect x="16" y="3" width="4" height="16" rx="2" fill="white" opacity="0.95"/>
                  <rect x="2" y="9" width="18" height="4" rx="2" fill="white" opacity="0.95"/>
                  <path d="M16 5 L20 1 M18.2 1 L20 1 L20 2.8" stroke="rgba(0,212,200,1)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            <span className="logo-wordmark lwl">Hireon</span>
          </div>
          <div className="cand-pill"><span className="cand-dot"></span>Candidate Portal</div>
          
          <div className="topbar-right">
            <button className="tb-toggle" onClick={toggleTheme}>
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <div className="cand-av-wrap" onClick={logout} title="Click to Sign Out">
              <div className="cand-av">{initials}</div>
              <div>
                <div className="cand-avname">{user?.full_name || 'Candidate'}</div>
                <div className="cand-avsub">Sign out</div>
              </div>
            </div>
          </div>
        </div>

        {/* BODY */}
        <div className="body-wrap flex-1 flex overflow-hidden">
          {/* SIDEBAR */}
          <div className="sidebar">
            <div className="sb-sect">My Application</div>
            {NAV_ITEMS.map((item) => {
              if (item.to === '/portal/offers' && !hasOffer) {
                return (
                  <div
                    key={item.to}
                    className="sb-item"
                    title="Available after Final Round"
                    onClick={handleLockedClick}
                    style={{ opacity: 0.65, cursor: 'not-allowed' }}
                  >
                    <span className="sb-ico" style={{ opacity: 0.5 }}>{item.icon}</span>
                    {item.label}
                    <span style={{ marginLeft: 'auto', fontSize: '13px' }}>🔒</span>
                  </div>
                )
              }

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `sb-item ${isActive ? 'active' : ''}`}
                  style={{ textDecoration: 'none' }}
                >
                  <span className="sb-ico">{item.icon}</span>
                  {item.label}
                </NavLink>
              )
            })}


          </div>

          {/* MAIN */}
          <div className="main flex-1 overflow-y-auto w-full relative">
            <Outlet />
          </div>
        </div>

        {/* TOAST SYSTEM */}
        <div className={`toast ${showToast ? 'show' : ''}`}>
          <div className="toast-ico" style={{background: '#3b82f6', color: '#fff', borderRadius: '6px', fontSize: '13px', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>🔒</div>
          <div>{toastMsg}</div>
        </div>

      </div>
    </div>
  )
}
