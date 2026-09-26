import { useEffect, useRef, useState } from 'react'
import { SiteView } from '../components/SiteView'

// The card entering from below only reaches its own pinned `top` after
// scrolling roughly one viewport height, so a short card leaves a gap below
// its own bottom edge for that entire stretch — showing the incoming (or, an
// even earlier) card peeking through underneath. Sizing every card to (near)
// the full viewport means whichever one is pinned always fills the screen,
// so nothing behind it can ever show through.
const stickyCard = (index: number): React.CSSProperties => ({
  position: 'sticky',
  top: '108px',
  zIndex: index + 2,
  marginBottom: '16px',
  minHeight: 'calc(100vh - 160px)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
})

// Header height + breathing room. Keeps the TOC scroll target and the
// active-section tracker in agreement.
const NAV_OFFSET = 96

// Neither getBoundingClientRect() NOR offsetTop can be trusted on one of
// these `position: sticky` cards: once a card has ever been "stuck", Chromium
// keeps its own offsetTop (and rect.top) reporting the live, scroll-adjusted
// pinned position instead of its static flow position — so measuring a card
// via itself gives a value that silently drifts with scroll history. A
// card's rendered SIZE is never affected by being stuck though, only its
// position is — so we compute each card's true document top by walking the
// (non-sticky) container and summing preceding siblings' stable offsetHeight,
// never reading position off a sticky element itself.
function getSectionTops(ids: string[]): Record<string, number> {
  const tops: Record<string, number> = {}
  const container = document.getElementById(ids[0])?.parentElement
  if (!container) return tops
  let top = container.getBoundingClientRect().top + window.scrollY
  for (const id of ids) {
    tops[id] = top
    const el = document.getElementById(id)
    if (!el) continue
    const cs = window.getComputedStyle(el)
    top += el.offsetHeight + parseFloat(cs.marginTop || '0') + parseFloat(cs.marginBottom || '0')
  }
  return tops
}

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

const SECTION_IDS = SECTIONS.map((s) => s.id)

export default function CookiesPage() {
  const [activeSection, setActiveSection] = useState('introduction')
  const isProgrammaticScroll = useRef(false)
  const programmaticTimer = useRef<number>()

  useEffect(() => {
    const handleScroll = () => {
      if (isProgrammaticScroll.current) return
      const tops = getSectionTops(SECTION_IDS)
      const scrollPosition = window.scrollY + NAV_OFFSET
      for (const section of SECTIONS) {
        const el = document.getElementById(section.id)
        const top = tops[section.id]
        if (el && top !== undefined) {
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
    const tops = getSectionTops(SECTION_IDS)
    const top = tops[id]
    if (top === undefined) return
    isProgrammaticScroll.current = true
    window.clearTimeout(programmaticTimer.current)
    setActiveSection(id)
    window.scrollTo({ top: top - NAV_OFFSET, behavior: 'smooth' })
    programmaticTimer.current = window.setTimeout(() => {
      isProgrammaticScroll.current = false
    }, 700)
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
          <div className="privacy-layout">
            
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
                className="stack-card"
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

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginTop: '24px' }}>
                  <div style={{ padding: '18px', borderRadius: '12px', background: 'var(--surface-2, #f8fafc)', border: '1px solid rgba(226,232,240,0.8)' }}>
                    <h4 style={{ margin: '0 0 6px', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>Full Transparency</h4>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569', lineHeight: '1.5' }}>
                      Every cookie category we set is documented on this page, with what it does and why we use it.
                    </p>
                  </div>
                  <div style={{ padding: '18px', borderRadius: '12px', background: 'var(--surface-2, #f8fafc)', border: '1px solid rgba(226,232,240,0.8)' }}>
                    <h4 style={{ margin: '0 0 6px', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>Granular Control</h4>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569', lineHeight: '1.5' }}>
                      Accept, reject, or customize each non-essential category independently, any time you choose.
                    </p>
                  </div>
                  <div style={{ padding: '18px', borderRadius: '12px', background: 'var(--surface-2, #f8fafc)', border: '1px solid rgba(226,232,240,0.8)' }}>
                    <h4 style={{ margin: '0 0 6px', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>No Surprise Tracking</h4>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569', lineHeight: '1.5' }}>
                      Nothing beyond strictly essential cookies loads before you've made a consent choice.
                    </p>
                  </div>
                </div>
              </article>

              {/* Section 2: What Are Cookies */}
              <article
                id="what-are-cookies"
                className="stack-card"
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

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginTop: '24px' }}>
                  <div style={{ padding: '20px', borderRadius: '16px', background: 'var(--surface-2, #f8fafc)', border: '1px solid rgba(226,232,240,0.8)' }}>
                    <h4 style={{ margin: '0 0 8px', fontSize: '1.02rem', fontWeight: 700, color: '#0f172a' }}>First-Party Cookies</h4>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569', lineHeight: '1.5' }}>
                      Set directly by hybent.com and the Hybent Hiring platform to run the core features you're actively using — login sessions, workspace state, saved filters.
                    </p>
                  </div>
                  <div style={{ padding: '20px', borderRadius: '16px', background: 'var(--surface-2, #f8fafc)', border: '1px solid rgba(226,232,240,0.8)' }}>
                    <h4 style={{ margin: '0 0 8px', fontSize: '1.02rem', fontWeight: 700, color: '#0f172a' }}>Third-Party Cookies</h4>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569', lineHeight: '1.5' }}>
                      Set by vetted service providers we integrate with — embedded scheduling tools, analytics, and video calling. Covered in detail in Section 5.
                    </p>
                  </div>
                </div>

                <div style={{ marginTop: '20px', padding: '16px 20px', borderRadius: '12px', background: 'rgba(108,71,255,0.05)', border: '1px solid rgba(108,71,255,0.2)' }}>
                  <strong style={{ color: 'var(--violet, #6c47ff)' }}>Persistent vs. Session Cookies:</strong> Session cookies are deleted automatically once you close your browser; persistent cookies remain on your device for a set duration (or until you clear them) so preferences carry over between visits.
                </div>
              </article>

              {/* Section 3: Types of Cookies */}
              <article
                id="types-of-cookies"
                className="stack-card"
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
                className="stack-card"
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
                className="stack-card"
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
                <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                  <div style={{ padding: '16px 20px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <strong style={{ color: '#0f172a' }}>Google Services (OAuth 2.0 &amp; Google Meet):</strong> Used for secure single sign-on (SSO) authentication and automated interview calendar scheduling.
                  </div>
                  <div style={{ padding: '16px 20px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <strong style={{ color: '#0f172a' }}>Infrastructure &amp; Security Providers:</strong> Employed to detect rate limits, DDoS threats, and ensure continuous application availability.
                  </div>
                  <div style={{ padding: '16px 20px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <strong style={{ color: '#0f172a' }}>Product Analytics Platforms:</strong> Aggregated, non-identifiable usage data that helps us understand which features are working and which need improvement.
                  </div>
                  <div style={{ padding: '16px 20px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <strong style={{ color: '#0f172a' }}>Customer Support Tooling:</strong> Powers live chat and help-desk widgets so support conversations and ticket history persist across your session.
                  </div>
                </div>
                <p className="small" style={{ marginTop: '16px', fontSize: '0.9rem', lineHeight: '1.6', color: '#475569' }}>
                  Each provider is bound by a Data Processing Agreement (DPA) and is only permitted to use cookie data for the specific service it delivers to us — never for its own independent advertising purposes.
                </p>
              </article>

              {/* Section 6: Managing Cookies */}
              <article
                id="managing-cookies"
                className="stack-card"
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
                className="stack-card"
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

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginTop: '24px' }}>
                  <div style={{ padding: '18px', borderRadius: '12px', background: 'var(--surface-2, #f8fafc)', border: '1px solid rgba(226,232,240,0.8)' }}>
                    <h4 style={{ margin: '0 0 6px', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>Revised Date</h4>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569', lineHeight: '1.5' }}>
                      The &quot;Last Updated&quot; date at the top of this page always reflects the current version of this Policy.
                    </p>
                  </div>
                  <div style={{ padding: '18px', borderRadius: '12px', background: 'var(--surface-2, #f8fafc)', border: '1px solid rgba(226,232,240,0.8)' }}>
                    <h4 style={{ margin: '0 0 6px', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>Material Changes</h4>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569', lineHeight: '1.5' }}>
                      Significant changes to how we use cookies are highlighted with an on-site notice, not just a silent date change.
                    </p>
                  </div>
                  <div style={{ padding: '18px', borderRadius: '12px', background: 'var(--surface-2, #f8fafc)', border: '1px solid rgba(226,232,240,0.8)' }}>
                    <h4 style={{ margin: '0 0 6px', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>Your Consent Stays Yours</h4>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569', lineHeight: '1.5' }}>
                      A policy update never silently re-enables a category you've turned off — your saved preferences carry forward.
                    </p>
                  </div>
                </div>
              </article>

              {/* Section 8: Contact Information */}
              <article
                id="contact-info"
                className="stack-card"
                style={{
                  ...stickyCard(7),
                  background: '#ffffff',
                  padding: '36px',
                  borderRadius: '24px',
                  border: '1px solid rgba(108,71,255,0.1)',
                }}
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
                    <a href="mailto:info@hybent.com" style={{ color: 'var(--violet, #6c47ff)', fontWeight: 600 }}>
                      info@hybent.com
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

              {/*
                Scroll-runway spacer, not a visible section.
                The stacking cards above share one containing block (this flex
                column), so a sticky card can only stay pinned at `top` for as
                long as doing so keeps it inside that shared containing block.
                Being the very last child, "8. Contact Information" IS the
                bottom edge of that containing block — no amount of margin on
                itself can buy it room, since its own margin defines the
                boundary it's measured against. Without a real trailing
                sibling here, it has no hang time at all: it flies straight
                past `top` instead of staying pinned, uncovering the previous
                card behind it. This spacer becomes that trailing sibling,
                giving the last card (and the release threshold every earlier
                card shares) real room.
              */}
              <div aria-hidden="true" style={{ height: 'calc(100vh + 200px)' }} />

            </div>
          </div>
        </div>
      </section>
    </SiteView>
  )
}
