import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

const NAV_ITEMS = [
  { to: '/portal', label: 'Application Journey', icon: '🗺️', end: true },
  { to: '/portal/interviews', label: 'My Interviews', icon: '🎤', end: false },
  { to: '/portal/applications', label: 'My Applications', icon: '📄', end: false },
  { to: '/portal/offers', label: 'Offer & Documents', icon: '🎁', end: false },
  { to: '/portal/profile', label: 'My Profile', icon: '👤', end: false },
]

export function PortalLayout() {
  const { user, logout } = useAuth()

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'C'

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--p-bg)',
        fontFamily: "'DM Sans', sans-serif",
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Ambient background blobs */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: 640,
            height: 640,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(124,58,237,0.18), rgba(168,85,247,0.07))',
            filter: 'blur(90px)',
            top: -200,
            right: -150,
            animation: 'portal-blob-drift-a 14s ease-in-out infinite alternate',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: 520,
            height: 520,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(6,182,212,0.14), rgba(34,211,238,0.05))',
            filter: 'blur(80px)',
            bottom: -120,
            left: -160,
            animation: 'portal-blob-drift-b 18s ease-in-out infinite alternate',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: 380,
            height: 380,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(236,72,153,0.10), transparent)',
            filter: 'blur(70px)',
            top: '40%',
            left: '30%',
            animation: 'portal-blob-drift-c 12s ease-in-out infinite alternate',
          }}
        />
      </div>

      {/* Topbar */}
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          height: 62,
          background: 'rgba(255,255,255,0.80)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderBottom: '1px solid var(--p-border)',
          boxShadow: 'var(--p-shadow)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 28px',
          justifyContent: 'space-between',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Hireon H-mark logo — matches HTML demos */}
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #6c47ff, #ff6bc6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(108,71,255,0.35)',
              flexShrink: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
              <rect x="2" y="3" width="4" height="16" rx="2" fill="white" opacity="0.95" />
              <rect x="16" y="3" width="4" height="16" rx="2" fill="white" opacity="0.95" />
              <rect x="2" y="9" width="18" height="4" rx="2" fill="white" opacity="0.95" />
            </svg>
          </div>
          <span
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 20,
              fontWeight: 800,
              background: 'linear-gradient(135deg, #6c47ff, #ff6bc6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '-0.5px',
            }}
          >
            Hireon
          </span>
          {/* Teal pill */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              borderRadius: 20,
              background: 'rgba(0,212,200,0.10)',
              border: '1px solid rgba(0,212,200,0.25)',
              fontSize: 11,
              fontWeight: 600,
              color: '#00b5aa',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#00d4c8',
                animation: 'portal-pulse-dot 1.5s ease-in-out infinite',
              }}
            />
            Candidate Portal
          </div>
        </div>

        {/* Right: avatar + sign out */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 14px 6px 6px',
              borderRadius: 24,
              background: 'rgba(124,58,237,0.07)',
              border: '1px solid rgba(124,58,237,0.12)',
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: 'linear-gradient(135deg,#7c3aed,#a855f7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                color: '#fff',
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              {initials}
            </div>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--p-text)',
              }}
            >
              {user?.full_name?.split(' ')[0] ?? 'Candidate'}
            </span>
          </div>
          <button
            onClick={logout}
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--p-text-lite)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: "'Space Grotesk', sans-serif",
              padding: '6px 10px',
              borderRadius: 8,
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--p-text-lite)' }}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Layout body */}
      <div
        style={{
          display: 'flex',
          paddingTop: 62,
          minHeight: '100vh',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Sidebar */}
        <aside
          style={{
            width: 230,
            flexShrink: 0,
            padding: '24px 14px',
            borderRight: '1px solid var(--p-border)',
            background: 'rgba(255,255,255,0.70)',
            backdropFilter: 'blur(16px)',
            position: 'sticky',
            top: 62,
            height: 'calc(100vh - 62px)',
            overflowY: 'auto',
          }}
        >
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--p-text-lite)',
              fontFamily: "'Space Grotesk', sans-serif",
              padding: '0 10px',
              marginBottom: 10,
            }}
          >
            My Application
          </p>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#6c47ff' : 'var(--p-text-mid)',
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(108,71,255,0.10), rgba(255,107,198,0.07))'
                    : 'transparent',
                  textDecoration: 'none',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  transition: 'all 0.18s',
                  borderLeft: isActive ? '3px solid #6c47ff' : '3px solid transparent',
                })}
              >
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>


        </aside>

        {/* Main content */}
        <main
          style={{
            flex: 1,
            padding: '32px 36px',
            maxWidth: 1100,
            overflowY: 'auto',
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
