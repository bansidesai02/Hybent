import { useEffect, useState } from 'react'

export type CookiePreferences = {
  essential: boolean
  analytics: boolean
  marketing: boolean
  timestamp: number
}

const STORAGE_KEY = 'hybent_cookie_consent'

export function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false)
  const [showCustomizer, setShowCustomizer] = useState(false)
  const [analytics, setAnalytics] = useState(true)
  const [marketing, setMarketing] = useState(false)

  useEffect(() => {
    // Check if consent has already been recorded
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) {
      // Small delay for smooth entrance animation after initial render
      const timer = setTimeout(() => setIsVisible(true), 600)
      return () => clearTimeout(timer)
    }
  }, [])

  // Listen for custom event to re-open cookie settings from /cookies page
  useEffect(() => {
    const handleOpenSettings = () => {
      setIsVisible(true)
      setShowCustomizer(true)
    }
    window.addEventListener('hybent:open-cookie-settings', handleOpenSettings)
    return () => window.removeEventListener('hybent:open-cookie-settings', handleOpenSettings)
  }, [])

  const saveConsent = (prefs: Omit<CookiePreferences, 'timestamp'>) => {
    const data: CookiePreferences = {
      ...prefs,
      timestamp: Date.now(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    setIsVisible(false)
    setShowCustomizer(false)
  }

  const handleAcceptAll = () => {
    saveConsent({ essential: true, analytics: true, marketing: true })
  }

  const handleRejectNonEssential = () => {
    saveConsent({ essential: true, analytics: false, marketing: false })
  }

  const handleSavePreferences = () => {
    saveConsent({ essential: true, analytics, marketing })
  }

  if (!isVisible) return null

  return (
    <div className="hb-site">
      {/* Backdrop overlay when granular customizer is open */}
      {showCustomizer && (
        <div
          aria-hidden="true"
          onClick={() => setShowCustomizer(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(4px)',
            zIndex: 99990,
            animation: 'fadeIn 0.25s ease-out forwards',
          }}
        />
      )}

      {/* Main Cookie Consent Container */}
      <div
        role="dialog"
        aria-labelledby="cookie-banner-title"
        aria-describedby="cookie-banner-desc"
        style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 32px)',
          maxWidth: showCustomizer ? '680px' : '960px',
          background: 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(108, 71, 255, 0.18)',
          borderRadius: '24px',
          boxShadow: '0 20px 60px rgba(15, 23, 42, 0.16), 0 4px 16px rgba(108, 71, 255, 0.08)',
          padding: showCustomizer ? '28px 32px' : '22px 28px',
          zIndex: 99999,
          transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
      >
        {!showCustomizer ? (
          /* Default Banner View */
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '20px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: '1 1 420px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: 'rgba(108, 71, 255, 0.1)',
                    color: 'var(--violet, #6c47ff)',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
                    <path d="M8.5 8.5v.01" />
                    <path d="M16 15.5v.01" />
                    <path d="M12 12v.01" />
                    <path d="M11 17v.01" />
                    <path d="M7 14v.01" />
                  </svg>
                </span>
                <h3
                  id="cookie-banner-title"
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    margin: 0,
                    color: 'var(--text, #0f172a)',
                    fontFamily: 'Sora, sans-serif',
                  }}
                >
                  We Value Your Privacy &amp; Cookie Preferences
                </h3>
              </div>
              <p
                id="cookie-banner-desc"
                style={{
                  fontSize: '0.88rem',
                  lineHeight: '1.5',
                  color: 'var(--muted, #475569)',
                  margin: 0,
                }}
              >
                HYBENT uses essential cookies to ensure security, performance, and authentication across our AI recruitment platform. We also use optional analytics cookies to improve our services.{' '}
                <a
                  href="/cookies"
                  style={{
                    color: 'var(--violet, #6c47ff)',
                    fontWeight: 600,
                    textDecoration: 'underline',
                    textUnderlineOffset: '3px',
                  }}
                >
                  Learn More
                </a>
              </p>
            </div>

            {/* Action Buttons */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                onClick={() => setShowCustomizer(true)}
                className="btn btn-ghost"
                style={{
                  fontSize: '0.85rem',
                  padding: '9px 16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(148, 163, 184, 0.3)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Customize
              </button>
              <button
                type="button"
                onClick={handleRejectNonEssential}
                className="btn btn-ghost"
                style={{
                  fontSize: '0.85rem',
                  padding: '9px 16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(108, 71, 255, 0.25)',
                  color: 'var(--text, #0f172a)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Reject Non-Essential
              </button>
              <button
                type="button"
                onClick={handleAcceptAll}
                className="btn btn-primary"
                style={{
                  fontSize: '0.85rem',
                  padding: '9px 20px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  boxShadow: '0 4px 14px rgba(108, 71, 255, 0.35)',
                }}
              >
                Accept All
              </button>
            </div>
          </div>
        ) : (
          /* Granular Preferences View */
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
                paddingBottom: '14px',
                borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
              }}
            >
              <h3
                style={{
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  margin: 0,
                  fontFamily: 'Sora, sans-serif',
                  color: 'var(--text, #0f172a)',
                }}
              >
                Customize Cookie Preferences
              </h3>
              <button
                type="button"
                onClick={() => setShowCustomizer(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '4px 8px',
                }}
                aria-label="Close customizer"
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.86rem', color: '#475569', marginBottom: '20px', lineHeight: '1.5' }}>
              Manage how cookies are used on the HYBENT platform. Essential cookies are required to deliver secure authentication and workspace functionality.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              {/* Category 1: Essential */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '16px',
                  padding: '14px 18px',
                  borderRadius: '14px',
                  background: 'rgba(248, 250, 252, 0.9)',
                  border: '1px solid rgba(226, 232, 240, 0.8)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--text, #0f172a)' }}>
                      Strictly Necessary Cookies
                    </h4>
                    <span
                      className="chip"
                      style={{
                        background: 'rgba(108, 71, 255, 0.1)',
                        color: 'var(--violet, #6c47ff)',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                      }}
                    >
                      Always Active
                    </span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748b', lineHeight: '1.4' }}>
                    Essential for website security, session persistence, candidate portal access, and CSRF protection. Cannot be disabled.
                  </p>
                </div>
              </div>

              {/* Category 2: Analytics & Performance */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '16px',
                  padding: '14px 18px',
                  borderRadius: '14px',
                  background: 'rgba(248, 250, 252, 0.9)',
                  border: '1px solid rgba(226, 232, 240, 0.8)',
                }}
              >
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--text, #0f172a)' }}>
                    Analytics &amp; Performance Cookies
                  </h4>
                  <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748b', lineHeight: '1.4' }}>
                    Helps us understand platform usage trends, page performance, resume parsing speed, and improve user experience.
                  </p>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', flexShrink: 0, marginTop: '2px' }}>
                  <input
                    type="checkbox"
                    checked={analytics}
                    onChange={(e) => setAnalytics(e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      cursor: 'pointer',
                      inset: 0,
                      backgroundColor: analytics ? 'var(--violet, #6c47ff)' : '#cbd5e1',
                      borderRadius: '34px',
                      transition: '0.25s',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        content: '""',
                        height: '18px',
                        width: '18px',
                        left: analytics ? '23px' : '3px',
                        bottom: '3px',
                        backgroundColor: 'white',
                        borderRadius: '50%',
                        transition: '0.25s',
                      }}
                    />
                  </span>
                </label>
              </div>

              {/* Category 3: Marketing & Personalization */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '16px',
                  padding: '14px 18px',
                  borderRadius: '14px',
                  background: 'rgba(248, 250, 252, 0.9)',
                  border: '1px solid rgba(226, 232, 240, 0.8)',
                }}
              >
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--text, #0f172a)' }}>
                    Marketing &amp; Personalization Cookies
                  </h4>
                  <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748b', lineHeight: '1.4' }}>
                    Used to tailor communications, feature updates, demo invitations, and relevant recruitment insights.
                  </p>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', flexShrink: 0, marginTop: '2px' }}>
                  <input
                    type="checkbox"
                    checked={marketing}
                    onChange={(e) => setMarketing(e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      cursor: 'pointer',
                      inset: 0,
                      backgroundColor: marketing ? 'var(--violet, #6c47ff)' : '#cbd5e1',
                      borderRadius: '34px',
                      transition: '0.25s',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        content: '""',
                        height: '18px',
                        width: '18px',
                        left: marketing ? '23px' : '3px',
                        bottom: '3px',
                        backgroundColor: 'white',
                        borderRadius: '50%',
                        transition: '0.25s',
                      }}
                    />
                  </span>
                </label>
              </div>
            </div>

            {/* Customizer Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={handleRejectNonEssential}
                className="btn btn-ghost"
                style={{ fontSize: '0.85rem', padding: '9px 18px', borderRadius: '12px' }}
              >
                Reject Non-Essential
              </button>
              <button
                type="button"
                onClick={handleSavePreferences}
                className="btn btn-primary"
                style={{ fontSize: '0.85rem', padding: '9px 24px', borderRadius: '12px' }}
              >
                Save Preferences
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translate(-50%, 40px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
