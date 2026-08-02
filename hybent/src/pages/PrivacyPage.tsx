import { useState, useEffect } from 'react'

export default function PrivacyPage() {
  const [activeSection, setActiveSection] = useState('introduction')

  useEffect(() => {
    const handleScroll = () => {
      const sections = [
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
        'policy-updates',
        'contact-us',
      ]
      const scrollPosition = window.scrollY + 140

      for (const sectionId of sections) {
        const el = document.getElementById(sectionId)
        if (el) {
          const top = el.offsetTop
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
    const el = document.getElementById(id)
    if (el) {
      const y = el.getBoundingClientRect().top + window.pageYOffset - 90
      window.scrollTo({ top: y, behavior: 'smooth' })
      setActiveSection(id)
    }
  }

  const tocItems = [
    { id: 'introduction', label: '1. Introduction' },
    { id: 'information-we-collect', label: '2. Information We Collect' },
    { id: 'how-we-use-information', label: '3. How We Use Information' },
    { id: 'cookies', label: '4. Cookies & Tracking' },
    { id: 'information-sharing', label: '5. Information Sharing' },
    { id: 'data-security', label: '6. Data Security' },
    { id: 'data-retention', label: '7. Data Retention' },
    { id: 'your-privacy-rights', label: '8. Your Privacy Rights' },
    { id: 'third-party-services', label: '9. Third-Party Services' },
    { id: 'ai-recruitment-data', label: '10. AI & Recruitment Data' },
    { id: 'childrens-privacy', label: '11. Children\'s Privacy' },
    { id: 'policy-updates', label: '12. Updates to Policy' },
    { id: 'contact-us', label: '13. Contact Us' },
  ]

  return (
    <div className="route route--on" data-route="privacy">
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
            Hybent Privacy Policy
          </h1>
          <p className="hero__sub" data-rv="up" data-delay="160" style={{ maxWidth: '680px' }}>
            Transparent, enterprise-grade protection for your data across all Hybent products, custom software, and IT services.
          </p>

          <div
            data-rv="up"
            data-delay="220"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '16px',
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
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 260px) minmax(0, 1fr)', gap: '48px', alignItems: 'start' }}>
            
            {/* Table of Contents - Sticky sidebar */}
            <aside
              style={{
                position: 'sticky',
                top: '100px',
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

            {/* Document Content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

              {/* Section 1: Introduction */}
              <article
                id="introduction"
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--border, #e5e7eb)',
                  borderRadius: '16px',
                  padding: '36px',
                  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.02)',
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
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--border, #e5e7eb)',
                  borderRadius: '16px',
                  padding: '36px',
                  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.02)',
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
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--border, #e5e7eb)',
                  borderRadius: '16px',
                  padding: '36px',
                  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.02)',
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
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--border, #e5e7eb)',
                  borderRadius: '16px',
                  padding: '36px',
                  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.02)',
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
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--border, #e5e7eb)',
                  borderRadius: '16px',
                  padding: '36px',
                  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.02)',
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
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--border, #e5e7eb)',
                  borderRadius: '16px',
                  padding: '36px',
                  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.02)',
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
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--border, #e5e7eb)',
                  borderRadius: '16px',
                  padding: '36px',
                  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.02)',
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
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--border, #e5e7eb)',
                  borderRadius: '16px',
                  padding: '36px',
                  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.02)',
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
                  To exercise any of these rights, please email us at <a href="mailto:privacy@hybent.com" style={{ color: '#4C6FFF', textDecoration: 'underline' }}>privacy@hybent.com</a>. Requests are verified and fulfilled promptly without charge.
                </p>
              </article>

              {/* Section 9: Third-Party Services */}
              <article
                id="third-party-services"
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--border, #e5e7eb)',
                  borderRadius: '16px',
                  padding: '36px',
                  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.02)',
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
                  <li style={{ marginBottom: '8px' }}><strong>Cloud Infrastructure Providers:</strong> Secure multi-region hosting and CDN delivery (e.g. AWS, Cloudflare).</li>
                  <li style={{ marginBottom: '8px' }}><strong>Analytics Services:</strong> Website performance monitoring and aggregated usage analytics.</li>
                  <li style={{ marginBottom: '8px' }}><strong>Email &amp; Communication Delivery:</strong> Enterprise email API routing for system notifications and support responses.</li>
                  <li style={{ marginBottom: '8px' }}><strong>Authentication &amp; Identity:</strong> Secure identity management services (where implemented).</li>
                  <li><strong>Payment Processing:</strong> PCI-DSS compliant payment gateways (if implemented in future expansions).</li>
                </ul>
              </article>

              {/* Section 10: AI & Recruitment Data */}
              <article
                id="ai-recruitment-data"
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--border, #e5e7eb)',
                  borderRadius: '16px',
                  padding: '36px',
                  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.02)',
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
                      <strong>No Unauthorized AI Model Training:</strong> Your organization’s data, candidate resumes, and evaluation notes are <strong>never used to train public or unauthorized AI models</strong> shared across customers.
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

              {/* Section 11: Children's Privacy */}
              <article
                id="childrens-privacy"
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--border, #e5e7eb)',
                  borderRadius: '16px',
                  padding: '36px',
                  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.02)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <span className="icon-tile" style={{ width: '40px', height: '40px', borderRadius: '10px' }}>
                    <svg aria-hidden="true" style={{ width: '20px', height: '20px' }}><use href="#i-heart" /></svg>
                  </span>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>11. Children's Privacy</h2>
                </div>

                <p style={{ color: 'var(--text, #374151)', lineHeight: 1.7, margin: 0 }}>
                  Hybent services, software products, and website are intended exclusively for business enterprises, working professionals, and individuals aged 18 and older. We do not knowingly collect, solicit, or maintain personal information from individuals under the age of 18. If we become aware that a child under 18 has submitted personal data, we will take immediate steps to delete such records from our servers.
                </p>
              </article>

              {/* Section 12: Updates to Policy */}
              <article
                id="policy-updates"
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--border, #e5e7eb)',
                  borderRadius: '16px',
                  padding: '36px',
                  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.02)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <span className="icon-tile" style={{ width: '40px', height: '40px', borderRadius: '10px' }}>
                    <svg aria-hidden="true" style={{ width: '20px', height: '20px' }}><use href="#i-build" /></svg>
                  </span>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>12. Updates to this Privacy Policy</h2>
                </div>

                <p style={{ color: 'var(--text, #374151)', lineHeight: 1.7, margin: 0 }}>
                  We may update this Privacy Policy periodically to reflect enhancements to our products, technological advancements, or updates in global privacy legislation. When changes are published, we will revise the "Last Updated" date at the top of this page. We encourage users to review this page periodically to remain informed about how Hybent protects personal data.
                </p>
              </article>

              {/* Section 13: Contact Us */}
              <article
                id="contact-us"
                style={{
                  background: 'linear-gradient(135deg, #1a1040 0%, #0f0926 100%)',
                  borderRadius: '20px',
                  padding: '40px',
                  color: '#ffffff',
                  boxShadow: '0 12px 40px rgba(26, 16, 64, 0.2)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                  <span
                    className="icon-tile"
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '12px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      color: '#22CFFF',
                    }}
                  >
                    <svg aria-hidden="true" style={{ width: '22px', height: '22px' }}><use href="#i-mail" /></svg>
                  </span>
                  <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>13. Contact Us</h2>
                    <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>
                      Have questions or privacy concerns? Reach out directly to our team.
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '24px',
                    marginTop: '28px',
                    paddingTop: '24px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.15)',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '4px' }}>
                      Entity Name
                    </span>
                    <strong style={{ fontSize: '1.1rem', color: '#ffffff' }}>Hybent</strong>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '4px' }}>
                      Headquarters Location
                    </span>
                    <strong style={{ fontSize: '1.05rem', color: '#ffffff' }}>Ahmedabad, Gujarat, India</strong>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '4px' }}>
                      Official Email
                    </span>
                    <a href="mailto:privacy@hybent.com" style={{ color: '#22CFFF', fontWeight: 600, textDecoration: 'none' }}>
                      privacy@hybent.com
                    </a>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '4px' }}>
                      Official Website
                    </span>
                    <a href="https://www.hybent.com" style={{ color: '#22CFFF', fontWeight: 600, textDecoration: 'none' }}>
                      www.hybent.com
                    </a>
                  </div>
                </div>
              </article>

            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
