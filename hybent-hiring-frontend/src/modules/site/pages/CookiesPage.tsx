import { useEffect, useState } from 'react'
import { SiteView } from '../components/SiteView'

const stickyCard = (index: number): React.CSSProperties => ({
  position: 'sticky',
  top: '108px',
  zIndex: index + 2,
  marginBottom: '16px',
})

const SECTIONS = [
  { id: 'introduction', title: '1. Introduction' },
  { id: 'what-are-cookies', title: '2. What Are Cookies' },
  { id: 'types-of-cookies', title: '3. Types of Cookies' },
  { id: 'why-we-use-cookies', title: '4. Why We Use Cookies' },
  { id: 'third-party-cookies', title: '5. Third-Party Cookies' },
  { id: 'managing-cookies', title: '6. Managing Cookies' },
  { id: 'changes-to-policy', title: '7. Changes to This Policy' },
  { id: 'contact-info', title: '8. Contact Information' },
]

export default function CookiesPage() {
  const [activeSection, setActiveSection] = useState('introduction')

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 140
      for (const section of SECTIONS) {
        const el = document.getElementById(section.id)
        if (el) {
          const top = el.offsetTop
          const height = el.offsetHeight
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(section.id)
            break
          }
        }
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      const y = el.getBoundingClientRect().top + window.pageYOffset - 90
      window.scrollTo({ top: y, behavior: 'smooth' })
      setActiveSection(id)
    }
  }

  const handleOpenBannerSettings = () => {
    window.dispatchEvent(new CustomEvent('hybent:open-cookie-settings'))
  }

  return (
    <SiteView route="cookies">
      {/* ── Hero Section ────────────────────────────────────────────── */}
      <section className="hero">
        <div className="hero__orb orb-a" data-para="0.02"></div>
        <div className="hero__orb orb-b" data-para="-0.03"></div>

        <div className="wrap">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <p className="eyebrow" data-rv="up" style={{ margin: 0 }}>
              <span className="bars"><i /><i /><i /></span>
              <span>Cookie Policy</span>
            </p>
            <span
              className="chip"
              style={{
                background: 'rgba(108, 71, 255, 0.1)',
                color: 'var(--violet, #6c47ff)',
                fontWeight: 600,
                fontSize: '0.78rem',
              }}
            >
              Last Updated: August 6, 2026
            </span>
          </div>

          <h1
            style={{ fontSize: 'clamp(2.2rem, 4.2vw, 3.4rem)', marginTop: '10px' }}
            data-rv="up"
            data-delay="80"
          >
            HYBENT Cookie Governance &amp; Transparency
          </h1>

          <p className="hero__sub" data-rv="up" data-delay="160">
            This Cookie Policy explains how HYBENT (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) uses cookies and similar tracking technologies across our enterprise software, AI recruitment platform (Hybent Hiring), candidate portal, and corporate website.
          </p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '24px' }}>
            <button
              type="button"
              onClick={handleOpenBannerSettings}
              className="btn btn-primary"
              style={{ borderRadius: '12px', cursor: 'pointer' }}
            >
              Manage Cookie Preferences
              <svg width="15" height="15" aria-hidden="true" style={{ marginLeft: '6px' }}>
                <use href="#i-arrow" />
              </svg>
            </button>
            <a href="#what-are-cookies" className="btn btn-ghost" style={{ borderRadius: '12px' }}>
              Read Full Policy
            </a>
          </div>
        </div>
      </section>

      {/* ── Main Policy Content ────────────────────────────────────── */}
      <section className="section" style={{ paddingTop: '20px' }}>
        <div className="wrap">
          <div className="privacy-layout" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '40px' }}>
            
            {/* ── Table of Contents Sidebar ── */}
            <aside style={{ position: 'sticky', top: '108px', alignSelf: 'start', height: 'fit-content' }}>
              <div
                className="card"
                style={{
                  padding: '24px',
                  borderRadius: '20px',
                  background: 'rgba(255, 255, 255, 0.92)',
                  border: '1px solid rgba(108, 71, 255, 0.12)',
                  boxShadow: '0 4px 20px rgba(108, 71, 255, 0.05)',
                }}
              >
                <h4
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '1.2px',
                    color: 'var(--text-light, #9689bb)',
                    marginBottom: '16px',
                  }}
                >
                  On This Page
                </h4>
                <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {SECTIONS.map((sec) => (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => scrollTo(sec.id)}
                      style={{
                        textAlign: 'left',
                        background: 'none',
                        border: 'none',
                        fontSize: '0.86rem',
                        fontWeight: activeSection === sec.id ? 700 : 500,
                        color: activeSection === sec.id ? 'var(--violet, #6c47ff)' : '#475569',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        backgroundColor: activeSection === sec.id ? 'rgba(108, 71, 255, 0.08)' : 'transparent',
                      }}
                    >
                      {sec.title}
                    </button>
                  ))}
                </nav>

                <hr style={{ margin: '20px 0', borderColor: 'rgba(226, 232, 240, 0.8)' }} />

                <button
                  type="button"
                  onClick={handleOpenBannerSettings}
                  className="btn btn-ghost"
                  style={{
                    width: '100%',
                    fontSize: '0.82rem',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  ⚙️ Consent Settings
                </button>
              </div>
            </aside>

            {/* ── Policy Sections Content ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Section 1: Introduction */}
              <article
                id="introduction"
                className="card stack-card"
                style={{ ...stickyCard(0), background: '#ffffff', padding: '36px', borderRadius: '24px', border: '1px solid rgba(108,71,255,0.1)' }}
              >
                <span className="icon-tile" style={{ marginBottom: '16px' }}>
                  <svg aria-hidden="true"><use href="#i-shield" /></svg>
                </span>
                <p className="mono" style={{ color: 'var(--cyan)', margin: '0 0 6px', fontSize: '0.85rem' }}>Section 01</p>
                <h2 className="h-sm" style={{ fontSize: '1.4rem', margin: 0 }}>1. Introduction</h2>
                <p className="small" style={{ marginTop: '16px', fontSize: '0.98rem', lineHeight: '1.7', color: '#334155' }}>
                  At HYBENT, we believe enterprise software should be transparent, secure, and privacy-respecting by design. This Cookie Policy explains what cookies are, how we deploy them across our applications and services, and how you can exercise full control over your cookie preferences.
                </p>
                <p className="small" style={{ marginTop: '12px', fontSize: '0.98rem', lineHeight: '1.7', color: '#334155' }}>
                  By accessing or using HYBENT products—including our flagship AI recruitment platform (Hybent Hiring), recruiter dashboards, and candidate portals—you acknowledge our data processing practices as described in this Policy and our <a href="/privacy" style={{ color: 'var(--violet, #6c47ff)', fontWeight: 600 }}>Privacy &amp; Terms Policy</a>.
                </p>
              </article>

              {/* Section 2: What Are Cookies */}
              <article
                id="what-are-cookies"
                className="card stack-card"
                style={{ ...stickyCard(1), background: '#ffffff', padding: '36px', borderRadius: '24px', border: '1px solid rgba(108,71,255,0.1)' }}
              >
                <span className="icon-tile" style={{ marginBottom: '16px' }}>
                  <svg aria-hidden="true"><use href="#i-layers" /></svg>
                </span>
                <p className="mono" style={{ color: 'var(--cyan)', margin: '0 0 6px', fontSize: '0.85rem' }}>Section 02</p>
                <h2 className="h-sm" style={{ fontSize: '1.4rem', margin: 0 }}>2. What Are Cookies</h2>
                <p className="small" style={{ marginTop: '16px', fontSize: '0.98rem', lineHeight: '1.7', color: '#334155' }}>
                  Cookies are small text files that are stored on your web browser or device memory when you visit a website or web application. They allow web platforms to recognize your device, remember session state, retain user preferences, and deliver seamless, authenticated experiences.
                </p>
                <p className="small" style={{ marginTop: '12px', fontSize: '0.98rem', lineHeight: '1.7', color: '#334155' }}>
                  In addition to cookies, HYBENT may utilize related browser storage technologies such as <strong>localStorage</strong>, <strong>sessionStorage</strong>, and secure HTTP-only cookies to handle authentication tokens, active workspace states, and feature configurations safely.
                </p>
              </article>

              {/* Section 3: Types of Cookies */}
              <article
                id="types-of-cookies"
                className="card stack-card"
                style={{ ...stickyCard(2), background: '#ffffff', padding: '36px', borderRadius: '24px', border: '1px solid rgba(108,71,255,0.1)' }}
              >
                <span className="icon-tile" style={{ marginBottom: '16px' }}>
                  <svg aria-hidden="true"><use href="#i-ai" /></svg>
                </span>
                <p className="mono" style={{ color: 'var(--cyan)', margin: '0 0 6px', fontSize: '0.85rem' }}>Section 03</p>
                <h2 className="h-sm" style={{ fontSize: '1.4rem', margin: 0 }}>3. Types of Cookies We Use</h2>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginTop: '20px' }}>
                  <div style={{ background: 'var(--surface-2, #f8fafc)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(226,232,240,0.8)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span className="chip" style={{ background: 'rgba(108,71,255,0.12)', color: 'var(--violet, #6c47ff)', fontWeight: 700 }}>Strictly Necessary</span>
                    </div>
                    <h4 style={{ margin: '4px 0 8px', fontSize: '1.02rem', fontWeight: 700 }}>Essential Cookies</h4>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569', lineHeight: '1.5' }}>
                      Required for basic platform security, user login authentication, workspace switching, candidate portal access, and CSRF protection. These cannot be switched off.
                    </p>
                  </div>

                  <div style={{ background: 'var(--surface-2, #f8fafc)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(226,232,240,0.8)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span className="chip" style={{ background: 'rgba(0,212,200,0.12)', color: 'var(--cyan, #06b6d4)', fontWeight: 700 }}>Performance</span>
                    </div>
                    <h4 style={{ margin: '4px 0 8px', fontSize: '1.02rem', fontWeight: 700 }}>Analytics &amp; Performance</h4>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569', lineHeight: '1.5' }}>
                      Collect aggregated, non-identifiable usage statistics to evaluate page load times, resume parsing performance speed, and feature engagement patterns.
                    </p>
                  </div>

                  <div style={{ background: 'var(--surface-2, #f8fafc)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(226,232,240,0.8)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span className="chip" style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1', fontWeight: 700 }}>Functionality</span>
                    </div>
                    <h4 style={{ margin: '4px 0 8px', fontSize: '1.02rem', fontWeight: 700 }}>Functional Cookies</h4>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569', lineHeight: '1.5' }}>
                      Remembers your personal UI settings, active organization workspace, copilot chat preferences, and custom filter configurations.
                    </p>
                  </div>

                  <div style={{ background: 'var(--surface-2, #f8fafc)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(226,232,240,0.8)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span className="chip" style={{ background: 'rgba(244,63,94,0.12)', color: '#f43f5e', fontWeight: 700 }}>Targeting</span>
                    </div>
                    <h4 style={{ margin: '4px 0 8px', fontSize: '1.02rem', fontWeight: 700 }}>Marketing &amp; Communication</h4>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569', lineHeight: '1.5' }}>
                      Enables targeted announcements regarding new product features, enterprise demo invites, and recruitment webinars tailored to your sector.
                    </p>
                  </div>
                </div>
              </article>

              {/* Section 4: Why We Use Cookies */}
              <article
                id="why-we-use-cookies"
                className="card stack-card"
                style={{ ...stickyCard(3), background: '#ffffff', padding: '36px', borderRadius: '24px', border: '1px solid rgba(108,71,255,0.1)' }}
              >
                <span className="icon-tile" style={{ marginBottom: '16px' }}>
                  <svg aria-hidden="true"><use href="#i-target" /></svg>
                </span>
                <p className="mono" style={{ color: 'var(--cyan)', margin: '0 0 6px', fontSize: '0.85rem' }}>Section 04</p>
                <h2 className="h-sm" style={{ fontSize: '1.4rem', margin: 0 }}>4. Why We Use Cookies</h2>
                <p className="small" style={{ marginTop: '16px', fontSize: '0.98rem', lineHeight: '1.7', color: '#334155' }}>
                  HYBENT utilizes cookies for specific technical and business operations aimed at delivering enterprise-grade reliability:
                </p>
                <ul className="feat-list" style={{ marginTop: '16px' }}>
                  <li>
                    <svg aria-hidden="true"><use href="#i-check" /></svg>
                    <span><strong>Authentication &amp; Session Security:</strong> Verifying logged-in recruiters, hiring managers, candidates, and system administrators securely across sessions.</span>
                  </li>
                  <li>
                    <svg aria-hidden="true"><use href="#i-check" /></svg>
                    <span><strong>Candidate Portal Continuity:</strong> Allowing candidates to check application status, schedule interviews, and upload documents without losing state.</span>
                  </li>
                  <li>
                    <svg aria-hidden="true"><use href="#i-check" /></svg>
                    <span><strong>AI Workflow Optimization:</strong> Tracking background resume parsing response rates and AI copilot query speeds to maintain sub-second performance.</span>
                  </li>
                  <li>
                    <svg aria-hidden="true"><use href="#i-check" /></svg>
                    <span><strong>User Preference Retention:</strong> Storing table views, filters, column visibility, and theme settings tailored to your active workflow.</span>
                  </li>
                </ul>
              </article>

              {/* Section 5: Third-Party Cookies */}
              <article
                id="third-party-cookies"
                className="card stack-card"
                style={{ ...stickyCard(4), background: '#ffffff', padding: '36px', borderRadius: '24px', border: '1px solid rgba(108,71,255,0.1)' }}
              >
                <span className="icon-tile" style={{ marginBottom: '16px' }}>
                  <svg aria-hidden="true"><use href="#i-plug" /></svg>
                </span>
                <p className="mono" style={{ color: 'var(--cyan)', margin: '0 0 6px', fontSize: '0.85rem' }}>Section 05</p>
                <h2 className="h-sm" style={{ fontSize: '1.4rem', margin: 0 }}>5. Third-Party Cookies &amp; Integrations</h2>
                <p className="small" style={{ marginTop: '16px', fontSize: '0.98rem', lineHeight: '1.7', color: '#334155' }}>
                  To deliver seamless enterprise integrations, HYBENT partners with vetted third-party service providers who may also issue cookies through our services:
                </p>
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ padding: '16px 20px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <strong style={{ color: '#0f172a' }}>Google Services (OAuth 2.0 &amp; Google Meet):</strong> Used for secure single sign-on (SSO) authentication and automated interview calendar scheduling.
                  </div>
                  <div style={{ padding: '16px 20px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <strong style={{ color: '#0f172a' }}>Infrastructure &amp; Security Providers:</strong> Employed to detect rate limits, DDoS threats, and ensure continuous application availability.
                  </div>
                </div>
              </article>

              {/* Section 6: Managing Cookies */}
              <article
                id="managing-cookies"
                className="card stack-card"
                style={{ ...stickyCard(5), background: '#ffffff', padding: '36px', borderRadius: '24px', border: '1px solid rgba(108,71,255,0.1)' }}
              >
                <span className="icon-tile" style={{ marginBottom: '16px' }}>
                  <svg aria-hidden="true"><use href="#i-build" /></svg>
                </span>
                <p className="mono" style={{ color: 'var(--cyan)', margin: '0 0 6px', fontSize: '0.85rem' }}>Section 06</p>
                <h2 className="h-sm" style={{ fontSize: '1.4rem', margin: 0 }}>6. Managing Your Cookie Preferences</h2>
                <p className="small" style={{ marginTop: '16px', fontSize: '0.98rem', lineHeight: '1.7', color: '#334155' }}>
                  You maintain full control over non-essential cookies. You can adjust your consent choices at any time directly through our website or via your web browser settings:
                </p>
                
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '20px' }}>
                  <button
                    type="button"
                    onClick={handleOpenBannerSettings}
                    className="btn btn-primary"
                    style={{ borderRadius: '12px', cursor: 'pointer' }}
                  >
                    Open Cookie Preferences Banner
                  </button>
                </div>

                <div style={{ marginTop: '24px' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 10px', color: '#0f172a' }}>Browser-Level Controls</h4>
                  <p className="small" style={{ fontSize: '0.92rem', lineHeight: '1.6', color: '#475569' }}>
                    Most modern web browsers allow you to block, manage, or delete cookies via browser settings. Refer to your browser documentation for instructions:
                  </p>
                  <ul style={{ margin: '10px 0 0 20px', fontSize: '0.9rem', color: '#475569', lineHeight: '1.6' }}>
                    <li>Google Chrome: Settings &gt; Privacy and Security &gt; Cookies and other site data</li>
                    <li>Mozilla Firefox: Options &gt; Privacy &amp; Security &gt; Cookies and Site Data</li>
                    <li>Apple Safari: Preferences &gt; Privacy &gt; Block all cookies</li>
                    <li>Microsoft Edge: Settings &gt; Cookies and site permissions</li>
                  </ul>
                </div>
              </article>

              {/* Section 7: Changes to Policy */}
              <article
                id="changes-to-policy"
                className="card stack-card"
                style={{ ...stickyCard(6), background: '#ffffff', padding: '36px', borderRadius: '24px', border: '1px solid rgba(108,71,255,0.1)' }}
              >
                <span className="icon-tile" style={{ marginBottom: '16px' }}>
                  <svg aria-hidden="true"><use href="#i-cal" /></svg>
                </span>
                <p className="mono" style={{ color: 'var(--cyan)', margin: '0 0 6px', fontSize: '0.85rem' }}>Section 07</p>
                <h2 className="h-sm" style={{ fontSize: '1.4rem', margin: 0 }}>7. Changes to This Cookie Policy</h2>
                <p className="small" style={{ marginTop: '16px', fontSize: '0.98rem', lineHeight: '1.7', color: '#334155' }}>
                  We may update this Cookie Policy periodically to reflect technological changes, new platform capabilities, or legal compliance mandates under GDPR, CCPA, and applicable data privacy frameworks.
                </p>
                <p className="small" style={{ marginTop: '12px', fontSize: '0.98rem', lineHeight: '1.7', color: '#334155' }}>
                  Any updates will be posted on this page with a revised &quot;Last Updated&quot; date at the top. We encourage users to check back periodically for updates.
                </p>
              </article>

              {/* Section 8: Contact Information */}
              <article
                id="contact-info"
                className="card stack-card"
                style={{ ...stickyCard(7), background: '#ffffff', padding: '36px', borderRadius: '24px', border: '1px solid rgba(108,71,255,0.1)' }}
              >
                <span className="icon-tile" style={{ marginBottom: '16px' }}>
                  <svg aria-hidden="true"><use href="#i-users" /></svg>
                </span>
                <p className="mono" style={{ color: 'var(--cyan)', margin: '0 0 6px', fontSize: '0.85rem' }}>Section 08</p>
                <h2 className="h-sm" style={{ fontSize: '1.4rem', margin: 0 }}>8. Contact Information</h2>
                <p className="small" style={{ marginTop: '16px', fontSize: '0.98rem', lineHeight: '1.7', color: '#334155' }}>
                  If you have questions, concerns, or requests regarding this Cookie Policy or our cookie governance practices, please reach out to our Data Protection team:
                </p>

                <div
                  style={{
                    marginTop: '20px',
                    padding: '24px',
                    borderRadius: '16px',
                    background: 'var(--surface-2, #f8fafc)',
                    border: '1px solid rgba(108,71,255,0.15)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ color: '#0f172a' }}>Organization:</strong> HYBENT Software Technologies Pvt. Ltd.
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ color: '#0f172a' }}>Headquarters:</strong> Ahmedabad, Gujarat, India
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ color: '#0f172a' }}>Data Protection Office Email:</strong>{' '}
                    <a href="mailto:privacy@hybent.com" style={{ color: 'var(--violet, #6c47ff)', fontWeight: 600 }}>
                      privacy@hybent.com
                    </a>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ color: '#0f172a' }}>General Contact:</strong>{' '}
                    <a href="/contact" style={{ color: 'var(--violet, #6c47ff)', fontWeight: 600 }}>
                      hybent.com/contact
                    </a>
                  </div>
                </div>
              </article>

            </div>
          </div>
        </div>
      </section>
    </SiteView>
  )
}
