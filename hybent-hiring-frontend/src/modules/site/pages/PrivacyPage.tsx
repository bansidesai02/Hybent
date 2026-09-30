import { useEffect, useRef, useState } from 'react'
import { SiteView } from '../components/SiteView'

/* ─── sticky-stacking helper ─────────────────────────────────── */
// All cards share the same top so each new card fully covers the previous one.
// zIndex increases so later cards always sit on top. The card entering from
// below only reaches its own pinned `top` after scrolling roughly one
// viewport height, so a short card leaves a gap below its own bottom edge for
// that entire stretch — showing the incoming (or, depending on scroll
// history, an even earlier) card peeking through underneath. Sizing every
// card to (near) the full viewport means whichever one is pinned always
// fills the screen, so nothing behind it can ever show through.
const stickyCard = (index: number): React.CSSProperties => ({
  position: 'sticky',
  top: '108px',
  zIndex: index + 2,
  marginBottom: '12px',
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

const SECTION_IDS = [
  'introduction',
  'information-we-collect',
  'how-we-use-information',
  'cookies',
  'information-sharing',
  'data-security',
  'data-retention',
  'your-privacy-rights',
  'third-party-services',
  'ai-recruitment-data',
  'childrens-privacy',
  'contact-us',
]

export default function PrivacyPage() {
  const [activeSection, setActiveSection] = useState('introduction')
  const isProgrammaticScroll = useRef(false)
  const programmaticTimer = useRef<number>()

  /* ── Table-of-contents scroll tracker ──────────────────────── */
  useEffect(() => {
    const handleScroll = () => {
      if (isProgrammaticScroll.current) return
      const tops = getSectionTops(SECTION_IDS)
      const scrollPosition = window.scrollY + NAV_OFFSET

      for (const sectionId of SECTION_IDS) {
        const el = document.getElementById(sectionId)
        const top = tops[sectionId]
        if (el && top !== undefined) {
          const height = el.offsetHeight
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(sectionId)
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

  const tocItems = [
    { id: 'introduction',           label: '1. Introduction' },
    { id: 'information-we-collect', label: '2. Information We Collect' },
    { id: 'how-we-use-information', label: '3. How We Use Information' },
    { id: 'cookies',                label: '4. Cookies & Tracking' },
    { id: 'information-sharing',    label: '5. Information Sharing' },
    { id: 'data-security',          label: '6. Data Security' },
    { id: 'data-retention',         label: '7. Data Retention' },
    { id: 'your-privacy-rights',    label: '8. Your Privacy Rights' },
    { id: 'third-party-services',   label: '9. Third-Party Services' },
    { id: 'ai-recruitment-data',    label: '10. AI & Recruitment Data' },
    { id: 'childrens-privacy',      label: "11. Children's Privacy & Policy Updates" },
    { id: 'contact-us',             label: '12. Contact Us' },
  ]

  return (
    <SiteView route="privacy">
      {/* ── Hero Section ── */}
      <section className="hero" style={{ paddingBottom: '3rem' }}>
        <div className="hero__orb orb-a" data-para="0.02"></div>
        <div className="hero__orb orb-b" data-para="-0.03"></div>

        <div className="wrap">
          <p className="eyebrow" data-rv="up">
            <span className="bars"><i></i><i></i><i></i></span>
            <span>Legal &amp; Trust</span>
          </p>
          <h1 style={{ fontSize: 'clamp(2.35rem, 4.6vw, 3.6rem)', marginTop: '14px' }} data-rv="up" data-delay="80">
            Hybent Privacy &amp; Terms Policy
          </h1>
          <p className="hero__sub" data-rv="up" data-delay="160" style={{ maxWidth: '680px' }}>
            Transparent, enterprise-grade protection for your data across all Hybent products, custom software, and IT services.
          </p>

          <div
            data-rv="up"
            data-delay="220"
            style={{
              display: 'inline-flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '12px 16px',
              marginTop: '24px',
              padding: '8px 18px',
              background: 'var(--surface-2, rgba(255, 255, 255, 0.7))',
              border: '1px solid var(--border, rgba(0, 0, 0, 0.08))',
              borderRadius: '99px',
              fontSize: '0.85rem',
              color: 'var(--muted, #666)',
            }}
          >
            <span><strong>Last Updated:</strong> August 1, 2026</span>
            <span style={{ opacity: 0.3 }}>|</span>
            <span><strong>Effective Date:</strong> August 1, 2026</span>
            <span style={{ opacity: 0.3 }}>|</span>
            <span><strong>Scope:</strong> Products, Website &amp; IT Services</span>
          </div>
        </div>
      </section>

      {/* ── Main Content Area ── */}
      <section className="section" style={{ paddingTop: '1rem', paddingBottom: '5rem' }}>
        <div className="wrap" style={{ maxWidth: '1140px' }}>
          <div className="privacy-layout" style={{ alignItems: 'start' }}>

            {/* Table of Contents - Sticky sidebar */}
            <aside
              style={{
                position: 'sticky',
                top: '100px',
                zIndex: 1,
                background: '#ffffff',
                border: '1px solid var(--border, #e5e7eb)',
                borderRadius: '16px',
                padding: '20px 16px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
              }}
              aria-label="Table of contents"
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--dim, #888)', marginBottom: '14px', paddingLeft: '8px' }}>
                On this page
              </div>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {tocItems.map((item) => {
                  const isActive = activeSection === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => scrollTo(item.id)}
                      style={{
                        textAlign: 'left',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        fontWeight: isActive ? 600 : 400,
                        color: isActive ? '#4C6FFF' : 'var(--text, #333333)',
                        background: isActive ? 'rgba(76, 111, 255, 0.08)' : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {item.label}
                    </button>
                  )
                })}
              </nav>
            </aside>

            {/* Document Content — cards stack as you scroll */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>

              {/* Section 1: Introduction */}
              <article
                id="introduction"
                className="stack-card"
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--border, #e5e7eb)',
                  borderRadius: '16px',
                  padding: '36px',
                  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.02)',
                  ...stickyCard(0),
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <span className="icon-tile" style={{ width: '40px', height: '40px', borderRadius: '10px' }}>
                    <svg aria-hidden="true" style={{ width: '20px', height: '20px' }}><use href="#i-shield" /></svg>
                  </span>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>1. Introduction</h2>
                </div>

                <p style={{ color: 'var(--text, #374151)', lineHeight: 1.7, marginBottom: '16px' }}>
                  At <strong>Hybent</strong> ("we", "us", or "our"), privacy is a foundational design principle, not an afterthought. We are committed to safeguarding the personal information of everyone who interacts with our digital ecosystem — including our website visitors, enterprise software users, recruitment candidates, and IT service clients.
                </p>
                <p style={{ color: 'var(--text, #374151)', lineHeight: 1.7, marginBottom: '16px' }}>
                  Hybent is an AI-powered software products and IT services company headquartered in Ahmedabad, Gujarat, India. Our portfolio includes our flagship AI recruitment platform, <strong>Hybent Hiring</strong>, as well as enterprise IT Services, Custom Software Development, Hire Talent solutions, and Web &amp; Mobile App Development.
                </p>
                <p style={{ color: 'var(--text, #374151)', lineHeight: 1.7 }}>
                  This Privacy Policy outlines how we collect, use, disclose, and protect personal data across our official website (<a href="https://www.hybent.com" style={{ color: '#4C6FFF', textDecoration: 'underline' }}>www.hybent.com</a>), software platforms, APIs, client engagements, and related technical services. By using our website or engaging with Hybent products and services, you acknowledge the terms described in this policy.
                </p>
              </article>

              {/* Section 2: Information We Collect */}
              <article
                id="information-we-collect"
                className="stack-card"
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--border, #e5e7eb)',
                  borderRadius: '16px',
                  padding: '36px',
                  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.02)',
                  ...stickyCard(1),
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <span className="icon-tile" style={{ width: '40px', height: '40px', borderRadius: '10px' }}>
                    <svg aria-hidden="true" style={{ width: '20px', height: '20px' }}><use href="#i-folder" /></svg>
                  </span>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>2. Information We Collect</h2>
                </div>

                <p style={{ color: 'var(--text, #374151)', lineHeight: 1.7, marginBottom: '20px' }}>
                  We collect information to provide, secure, and improve our services, communicate effectively with clients, and deliver high-performance enterprise applications. The types of data we collect depend on how you interact with Hybent:
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                  <div style={{ padding: '20px', borderRadius: '12px', background: '#f9fafb', border: '1px solid #f3f4f6' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '10px', color: '#111827' }}>Directly Provided Data</h3>
                    <ul style={{ paddingLeft: '18px', margin: 0, color: '#4b5563', lineHeight: 1.6, fontSize: '0.9rem' }}>
                      <li>Full Name &amp; Contact Details</li>
                      <li>Work Email Address &amp; Phone Number</li>
                      <li>Company Name &amp; Job Title</li>
                      <li>Contact Form &amp; Demo Request details</li>
                      <li>Inquiry details &amp; business feedback</li>
                    </ul>
                  </div>

                  <div style={{ padding: '20px', borderRadius: '12px', background: '#f9fafb', border: '1px solid #f3f4f6' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '10px', color: '#111827' }}>Recruitment &amp; Candidate Data</h3>
                    <ul style={{ paddingLeft: '18px', margin: 0, color: '#4b5563', lineHeight: 1.6, fontSize: '0.9rem' }}>
                      <li>Resumes, CVs &amp; Cover Letters</li>
                      <li>Employment &amp; Education history</li>
                      <li>Skill tags &amp; portfolio links</li>
                      <li>Assessment responses &amp; interview notes</li>
                      <li>Voluntarily submitted applicant info</li>
                    </ul>
                  </div>

                  <div style={{ padding: '20px', borderRadius: '12px', background: '#f9fafb', border: '1px solid #f3f4f6' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '10px', color: '#111827' }}>Technical &amp; Usage Data</h3>
                    <ul style={{ paddingLeft: '18px', margin: 0, color: '#4b5563', lineHeight: 1.6, fontSize: '0.9rem' }}>
                      <li>IP Address &amp; Device Identifiers</li>
                      <li>Browser type, language &amp; version</li>
                      <li>Operating System &amp; resolution</li>
                      <li>Cookies &amp; session parameters</li>
                      <li>Website usage analytics &amp; page views</li>
                    </ul>
                  </div>
                </div>
              </article>

              {/* Section 3: How We Use Your Information */}
              <article
                id="how-we-use-information"
                className="stack-card"
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--border, #e5e7eb)',
                  borderRadius: '16px',
                  padding: '36px',
                  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.02)',
                  ...stickyCard(2),
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <span className="icon-tile" style={{ width: '40px', height: '40px', borderRadius: '10px' }}>
                    <svg aria-hidden="true" style={{ width: '20px', height: '20px' }}><use href="#i-zap" /></svg>
                  </span>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>3. How We Use Your Information</h2>
                </div>

                <p style={{ color: 'var(--text, #374151)', lineHeight: 1.7, marginBottom: '20px' }}>
                  Hybent uses collected information strictly for legitimate operational, business, and service delivery purposes, including:
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                  {[
                    { title: 'Inquiries & Demo Requests', desc: 'Responding to contact submissions, answering technical queries, and setting up Hybent product demonstrations.' },
                    { title: 'Product & Service Delivery', desc: 'Operating Hybent Hiring, delivering IT services, custom software engineering, and managing client contracts.' },
                    { title: 'Platform Optimization', desc: 'Analyzing website metrics to improve site navigation, optimize page load speeds, and refine UI experience.' },
                    { title: 'Customer Care & Support', desc: 'Providing timely technical assistance, diagnosing platform issues, and managing account preferences.' },
                    { title: 'Security & Integrity', desc: 'Monitoring infrastructure health, preventing fraudulent activity, and ensuring system compliance.' },
                    { title: 'Service Updates & News', desc: 'Sending important security alerts, product maintenance notices, and permitted marketing updates (opt-out available).' },
                  ].map((use, i) => (
                    <div key={i} style={{ padding: '18px', borderRadius: '12px', background: '#f9fafb', border: '1px solid #f3f4f6' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#111827', margin: '0 0 6px' }}>{use.title}</h4>
                      <p style={{ fontSize: '0.88rem', color: '#4b5563', margin: 0, lineHeight: 1.5 }}>{use.desc}</p>
                    </div>
                  ))}
                </div>
              </article>

              {/* Section 4: Cookies */}
              <article
                id="cookies"
                className="stack-card"
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--border, #e5e7eb)',
                  borderRadius: '16px',
                  padding: '36px',
                  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.02)',
                  ...stickyCard(3),
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <span className="icon-tile" style={{ width: '40px', height: '40px', borderRadius: '10px' }}>
                    <svg aria-hidden="true" style={{ width: '20px', height: '20px' }}><use href="#i-globe" /></svg>
                  </span>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>4. Cookies &amp; Tracking Technologies</h2>
                </div>

                <p style={{ color: 'var(--text, #374151)', lineHeight: 1.7, marginBottom: '20px' }}>
                  Cookies are small data files stored on your device when you visit websites. Hybent uses cookies and similar tracking technologies to ensure core functionality, understand website interaction, and remember user preferences.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ padding: '16px', borderRadius: '10px', background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                    <strong style={{ color: '#111827' }}>Essential Cookies:</strong> Critical for basic website operation, security authentication, and session handling. These cannot be disabled.
                  </div>
                  <div style={{ padding: '16px', borderRadius: '10px', background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                    <strong style={{ color: '#111827' }}>Analytics Cookies:</strong> Help us measure traffic patterns, popular content, and referral channels in an aggregated, non-personally identifiable manner.
                  </div>
                  <div style={{ padding: '16px', borderRadius: '10px', background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                    <strong style={{ color: '#111827' }}>Preference Cookies:</strong> Remember custom settings, chosen light/dark interface themes, and regional parameters.
                  </div>
                </div>

                <div style={{ marginTop: '20px', padding: '16px 20px', borderRadius: '12px', background: 'rgba(76, 111, 255, 0.05)', border: '1px solid rgba(76, 111, 255, 0.2)' }}>
                  <strong style={{ color: '#4C6FFF' }}>Cookie Management:</strong> You can modify your browser settings at any time to block or notify you about cookies. Note that restricting essential cookies may impact certain interactive features on our website.
                </div>
              </article>

              {/* Section 5: Information Sharing */}
              <article
                id="information-sharing"
                className="stack-card"
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--border, #e5e7eb)',
                  borderRadius: '16px',
                  padding: '36px',
                  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.02)',
                  ...stickyCard(4),
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <span className="icon-tile" style={{ width: '40px', height: '40px', borderRadius: '10px' }}>
                    <svg aria-hidden="true" style={{ width: '20px', height: '20px' }}><use href="#i-users" /></svg>
                  </span>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>5. Information Sharing &amp; Disclosure</h2>
                </div>

                <div style={{ padding: '20px', borderRadius: '12px', background: '#ecfdf5', border: '1px solid #a7f3d0', marginBottom: '20px' }}>
                  <strong style={{ color: '#047857', fontSize: '1.05rem', display: 'block', marginBottom: '4px' }}>
                    Strict Policy: We Never Sell Your Personal Information
                  </strong>
                  <span style={{ color: '#065f46', fontSize: '0.9rem', lineHeight: 1.6 }}>
                    Hybent does not sell, rent, monetize, or trade your personal data or candidate information to third parties for advertising or commercial purposes under any circumstances.
                  </span>
                </div>

                <p style={{ color: 'var(--text, #374151)', lineHeight: 1.7, marginBottom: '16px' }}>
                  Personal information is disclosed only under the following necessary circumstances:
                </p>

                <ul style={{ color: 'var(--text, #374151)', lineHeight: 1.7, paddingLeft: '20px' }}>
                  <li style={{ marginBottom: '10px' }}>
                    <strong>Trusted Vetted Service Providers:</strong> We share data with enterprise cloud hosts, security telemetry services, and communication APIs strictly necessary to operate our infrastructure, bound by robust confidentiality and Data Processing Agreements (DPAs).
                  </li>
                  <li style={{ marginBottom: '10px' }}>
                    <strong>Legal &amp; Regulatory Compliance:</strong> We may disclose information if required by applicable statutory laws, court orders, or lawful government demands by official regulatory authorities.
                  </li>
                  <li>
                    <strong>Business Reorganizations:</strong> In the event of a merger, acquisition, or asset reorganization, customer data remains protected under the existing privacy commitments outlined herein.
                  </li>
                </ul>
              </article>

              {/* Section 6: Data Security */}
              <article
                id="data-security"
                className="stack-card"
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--border, #e5e7eb)',
                  borderRadius: '16px',
                  padding: '36px',
                  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.02)',
                  ...stickyCard(5),
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <span className="icon-tile" style={{ width: '40px', height: '40px', borderRadius: '10px' }}>
                    <svg aria-hidden="true" style={{ width: '20px', height: '20px' }}><use href="#i-lock" /></svg>
                  </span>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>6. Data Security Practices</h2>
                </div>

                <p style={{ color: 'var(--text, #374151)', lineHeight: 1.7, marginBottom: '20px' }}>
                  Security is embedded into every layer of our platform architecture. We employ comprehensive administrative, technical, and physical safeguards designed to protect personal information against unauthorized access, loss, or alteration:
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  <div style={{ padding: '18px', borderRadius: '12px', background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                    <h4 style={{ margin: '0 0 6px', fontSize: '0.95rem', fontWeight: 600 }}>End-to-End Encryption</h4>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: '#4b5563', lineHeight: 1.5 }}>
                      TLS 1.3 encryption in transit and AES-256 standards for data at rest across database clusters.
                    </p>
                  </div>

                  <div style={{ padding: '18px', borderRadius: '12px', background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                    <h4 style={{ margin: '0 0 6px', fontSize: '0.95rem', fontWeight: 600 }}>Restricted Access (RBAC)</h4>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: '#4b5563', lineHeight: 1.5 }}>
                      Strict least-privilege employee access control, mandatory MFA, and immutable audit logs.
                    </p>
                  </div>

                  <div style={{ padding: '18px', borderRadius: '12px', background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                    <h4 style={{ margin: '0 0 6px', fontSize: '0.95rem', fontWeight: 600 }}>Continuous Monitoring</h4>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: '#4b5563', lineHeight: 1.5 }}>
                      Automated vulnerability scanning, patch deployment, and network intrusion detection.
                    </p>
                  </div>

                  <div style={{ padding: '18px', borderRadius: '12px', background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                    <h4 style={{ margin: '0 0 6px', fontSize: '0.95rem', fontWeight: 600 }}>Tenant Isolation</h4>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: '#4b5563', lineHeight: 1.5 }}>
                      Logical data separation ensuring customer workspace data is never commingled.
                    </p>
                  </div>
                </div>
              </article>

              {/* Section 7: Data Retention */}
              <article
                id="data-retention"
                className="stack-card"
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--border, #e5e7eb)',
                  borderRadius: '16px',
                  padding: '36px',
                  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.02)',
                  ...stickyCard(6),
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <span className="icon-tile" style={{ width: '40px', height: '40px', borderRadius: '10px' }}>
                    <svg aria-hidden="true" style={{ width: '20px', height: '20px' }}><use href="#i-cal" /></svg>
                  </span>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>7. Data Retention</h2>
                </div>

                <p style={{ color: 'var(--text, #374151)', lineHeight: 1.7, marginBottom: '16px' }}>
                  We retain personal information only for as long as required to fulfill the purposes described in this Privacy Policy, satisfy contractual obligations, or comply with statutory accounting and legal retention standards.
                </p>
                <p style={{ color: 'var(--text, #374151)', lineHeight: 1.7, marginBottom: '16px' }}>
                  When data is no longer necessary for operational or legal purposes, Hybent executes permanent, secure data sanitization and deletion procedures across production and backup systems.
                </p>
              </article>

              {/* Section 8: Your Privacy Rights */}
              <article
                id="your-privacy-rights"
                className="stack-card"
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--border, #e5e7eb)',
                  borderRadius: '16px',
                  padding: '36px',
                  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.02)',
                  ...stickyCard(7),
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <span className="icon-tile" style={{ width: '40px', height: '40px', borderRadius: '10px' }}>
                    <svg aria-hidden="true" style={{ width: '20px', height: '20px' }}><use href="#i-check" /></svg>
                  </span>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>8. Your Privacy Rights</h2>
                </div>

                <p style={{ color: 'var(--text, #374151)', lineHeight: 1.7, marginBottom: '20px' }}>
                  Depending on your jurisdiction (including rights aligned with India's DPDP Act and global standards like GDPR), you possess specific privacy rights regarding your personal data:
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  <div style={{ padding: '16px', borderRadius: '10px', background: '#f9fafb', border: '1px solid #f3f4f6' }}>
                    <strong style={{ color: '#111827', display: 'block', marginBottom: '4px' }}>Right to Access</strong>
                    <span style={{ fontSize: '0.88rem', color: '#4b5563' }}>Request confirmation and a copy of the personal data Hybent holds about you.</span>
                  </div>
                  <div style={{ padding: '16px', borderRadius: '10px', background: '#f9fafb', border: '1px solid #f3f4f6' }}>
                    <strong style={{ color: '#111827', display: 'block', marginBottom: '4px' }}>Right to Rectification</strong>
                    <span style={{ fontSize: '0.88rem', color: '#4b5563' }}>Request corrections to inaccurate or incomplete personal records.</span>
                  </div>
                  <div style={{ padding: '16px', borderRadius: '10px', background: '#f9fafb', border: '1px solid #f3f4f6' }}>
                    <strong style={{ color: '#111827', display: 'block', marginBottom: '4px' }}>Right to Erasure</strong>
                    <span style={{ fontSize: '0.88rem', color: '#4b5563' }}>Request permanent deletion of your personal data where legally permissible.</span>
                  </div>
                  <div style={{ padding: '16px', borderRadius: '10px', background: '#f9fafb', border: '1px solid #f3f4f6' }}>
                    <strong style={{ color: '#111827', display: 'block', marginBottom: '4px' }}>Right to Withdraw Consent</strong>
                    <span style={{ fontSize: '0.88rem', color: '#4b5563' }}>Revoke previously granted consent for marketing communications or data processing.</span>
                  </div>
                </div>

                <p style={{ marginTop: '20px', fontSize: '0.9rem', color: '#4b5563', lineHeight: 1.6 }}>
                  To exercise any of these rights, please email us at <a href="mailto:info@hybent.com" style={{ color: '#4C6FFF', textDecoration: 'underline' }}>info@hybent.com</a>. Requests are verified and fulfilled promptly without charge.
                </p>
              </article>

              {/* Section 9: Third-Party Services */}
              <article
                id="third-party-services"
                className="stack-card"
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--border, #e5e7eb)',
                  borderRadius: '16px',
                  padding: '36px',
                  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.02)',
                  ...stickyCard(8),
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <span className="icon-tile" style={{ width: '40px', height: '40px', borderRadius: '10px' }}>
                    <svg aria-hidden="true" style={{ width: '20px', height: '20px' }}><use href="#i-cloud" /></svg>
                  </span>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>9. Third-Party Services &amp; Infrastructure</h2>
                </div>

                <p style={{ color: 'var(--text, #374151)', lineHeight: 1.7, marginBottom: '16px' }}>
                  To deliver reliable enterprise services, Hybent integrates with select, industry-leading third-party service providers. Each provider undergoes strict security and privacy evaluations prior to integration:
                </p>

                <ul style={{ color: 'var(--text, #374151)', lineHeight: 1.7, paddingLeft: '20px' }}>
                  <li style={{ marginBottom: '8px' }}><strong>Cloud Infrastructure Providers:</strong> Application hosting (Render), managed PostgreSQL database (Supabase) and website hosting (Hostinger).</li>
                  <li style={{ marginBottom: '8px' }}><strong>AI Model Providers:</strong> Resume parsing and candidate evaluation are processed through third-party AI model APIs (Google Gemini, Groq and Mistral AI).</li>
                  <li style={{ marginBottom: '8px' }}><strong>Email &amp; Communication Delivery:</strong> Enterprise email API routing for system notifications and support responses.</li>
                  <li style={{ marginBottom: '8px' }}><strong>Authentication &amp; Identity:</strong> Google sign-in and Google Calendar, when you choose to connect them.</li>
                  <li><strong>Payment Processing:</strong> Subscription payments are processed by Stripe, a PCI-DSS compliant payment gateway. We do not store card details.</li>
                </ul>
              </article>

              {/* Section 10: AI & Recruitment Data */}
              <article
                id="ai-recruitment-data"
                className="stack-card"
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--border, #e5e7eb)',
                  borderRadius: '16px',
                  padding: '36px',
                  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.02)',
                  ...stickyCard(9),
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <span className="icon-tile" style={{ width: '40px', height: '40px', borderRadius: '10px' }}>
                    <svg aria-hidden="true" style={{ width: '20px', height: '20px' }}><use href="#i-ai" /></svg>
                  </span>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>10. AI &amp; Recruitment Data Handling</h2>
                </div>

                <p style={{ color: 'var(--text, #374151)', lineHeight: 1.7, marginBottom: '20px' }}>
                  Because <strong>Hybent Hiring</strong> is an AI-powered recruitment platform, we maintain strict ethical standards regarding how candidate information and recruitment data are processed by automated workflows:
                </p>

                <div style={{ padding: '24px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(76, 111, 255, 0.06), rgba(168, 85, 247, 0.06))', border: '1px solid rgba(76, 111, 255, 0.2)', marginBottom: '20px' }}>
                  <h4 style={{ margin: '0 0 10px', color: '#1a1040', fontSize: '1.05rem', fontWeight: 700 }}>
                    Responsible AI Commitment
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: '20px', color: '#374151', lineHeight: 1.6, fontSize: '0.92rem' }}>
                    <li style={{ marginBottom: '8px' }}>
                      <strong>No Unauthorized AI Model Training:</strong> Your organization's data, candidate resumes, and evaluation notes are <strong>never used to train public or unauthorized AI models</strong> shared across customers.
                    </li>
                    <li style={{ marginBottom: '8px' }}>
                      <strong>Explainable AI Assistance:</strong> AI screening scores, resume parsing summaries, and matching recommendations always expose their underlying evidence and rationale.
                    </li>
                    <li>
                      <strong>Human-in-the-Loop Control:</strong> AI tools assist and accelerate hiring workflows, but final hiring, rejection, and offer decisions remain entirely under human recruiter control.
                    </li>
                  </ul>
                </div>
              </article>

              {/* Section 11: Children's Privacy & Policy Updates */}
              <article
                id="childrens-privacy"
                className="stack-card"
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--border, #e5e7eb)',
                  borderRadius: '16px',
                  padding: '36px',
                  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.02)',
                  ...stickyCard(10),
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                  <span className="icon-tile" style={{ width: '40px', height: '40px', borderRadius: '10px' }}>
                    <svg aria-hidden="true" style={{ width: '20px', height: '20px' }}><use href="#i-heart" /></svg>
                  </span>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>11. Children's Privacy &amp; Policy Updates</h2>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
                  <div style={{ padding: '22px', borderRadius: '12px', background: '#f9fafb', border: '1px solid #f3f4f6' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: '0 0 10px', color: '#111827' }}>Children's Privacy</h3>
                    <p style={{ color: 'var(--text, #374151)', lineHeight: 1.7, margin: 0, fontSize: '0.92rem' }}>
                      Hybent services, software products, and website are intended exclusively for business enterprises, working professionals, and individuals aged 18 and older. We do not knowingly collect, solicit, or maintain personal information from individuals under the age of 18. If we become aware that a child under 18 has submitted personal data, we will take immediate steps to delete such records from our servers.
                    </p>
                  </div>

                  <div style={{ padding: '22px', borderRadius: '12px', background: '#f9fafb', border: '1px solid #f3f4f6' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: '0 0 10px', color: '#111827' }}>Updates to this Privacy Policy</h3>
                    <p style={{ color: 'var(--text, #374151)', lineHeight: 1.7, margin: 0, fontSize: '0.92rem' }}>
                      We may update this Privacy Policy periodically to reflect enhancements to our products, technological advancements, or updates in global privacy legislation. When changes are published, we will revise the "Last Updated" date at the top of this page. We encourage users to review this page periodically to remain informed about how Hybent protects personal data.
                    </p>
                  </div>
                </div>
              </article>

              {/* Section 12: Contact Us */}
              <article
                id="contact-us"
                className="stack-card"
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--border, #e5e7eb)',
                  borderRadius: '16px',
                  padding: '36px',
                  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.02)',
                  ...stickyCard(11),
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <span className="icon-tile" style={{ width: '40px', height: '40px', borderRadius: '10px' }}>
                    <svg aria-hidden="true" style={{ width: '20px', height: '20px' }}><use href="#i-mail" /></svg>
                  </span>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>12. Contact Us</h2>
                </div>

                <p style={{ color: '#374151', lineHeight: 1.7, margin: '0 0 24px', fontSize: '0.98rem' }}>
                  Have questions or privacy concerns? Reach our team directly. Requests are verified and fulfilled promptly, without charge.
                </p>

                <div className="policy-contact">
                  <div className="policy-contact__item">
                    <span className="mono">Entity</span>
                    <strong>Hybent</strong>
                  </div>
                  <div className="policy-contact__item">
                    <span className="mono">Headquarters</span>
                    <strong>Ahmedabad, Gujarat, India</strong>
                  </div>
                  <div className="policy-contact__item">
                    <span className="mono">Privacy email</span>
                    <a href="mailto:info@hybent.com">info@hybent.com</a>
                  </div>
                  <div className="policy-contact__item">
                    <span className="mono">Website</span>
                    <a href="https://www.hybent.com">www.hybent.com</a>
                  </div>
                </div>

                <div style={{ marginTop: '24px' }}>
                  <a className="btn btn-primary" href="mailto:info@hybent.com">
                    Email the privacy team
                    <svg className="arw" width="16" height="16" aria-hidden="true"><use href="#i-arrow" /></svg>
                  </a>
                </div>
              </article>

              {/*
                Scroll-runway spacer, not a visible section.
                The stacking cards above share one containing block (this flex
                column), so a sticky card can only stay pinned at `top` for as
                long as doing so keeps it inside that shared containing block.
                Being the very last child, "13. Contact Us" IS the bottom edge
                of that containing block — no amount of margin on itself can
                buy it room, since its own margin defines the boundary it's
                measured against. Without a real trailing sibling here, it has
                no hang time at all: it flies straight past `top` instead of
                staying pinned, uncovering the previous card behind it. This
                spacer becomes that trailing sibling, giving the last card (and
                the release threshold every earlier card shares) real room.
              */}
              <div aria-hidden="true" style={{ height: 'calc(100vh + 200px)' }} />

            </div>
          </div>
        </div>
      </section>
    </SiteView>
  )
}
