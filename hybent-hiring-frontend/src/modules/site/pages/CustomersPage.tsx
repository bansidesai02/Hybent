import { Link } from 'react-router-dom'
import { SiteView } from '../components/SiteView'

interface CustomerTestimonial {
  id: string
  quote: string
  author: string
  role: string
  company: string
  industry: string
  avatarInitials: string
  avatarGrad: string
  metricValue: string
  metricLabel: string
}

const CUSTOMER_TESTIMONIALS: CustomerTestimonial[] = [
  {
    id: 'apex-financial',
    quote: 'Screening used to take a full week per engineering role. Hybent reads every résumé against strict compliance and architecture rubrics, delivering shortlists our hiring managers can trust immediately.',
    author: 'Marcus Vance',
    role: 'VP of Talent Acquisition',
    company: 'Apex Financial Technologies',
    industry: 'FinTech & Banking',
    avatarInitials: 'MV',
    avatarGrad: 'linear-gradient(135deg, #3B82F6, #06B6D4)',
    metricValue: '74%',
    metricLabel: 'Faster screening',
  },
  {
    id: 'novus-health',
    quote: 'What convinced us was the auditability. Every candidate evaluation now has evidence-backed scoring attached to it, ensuring fair, compliant, and objective hiring across our healthcare networks.',
    author: 'Dr. Elena Rostova',
    role: 'Chief People Officer',
    company: 'Novus Health Cloud',
    industry: 'HealthTech & MedTech',
    avatarInitials: 'ER',
    avatarGrad: 'linear-gradient(135deg, #A855F7, #EC4899)',
    metricValue: '100%',
    metricLabel: 'Audit compliance',
  },
  {
    id: 'kestrel-logistics',
    quote: 'We hire across 3 international hubs in multiple time zones. The candidate portal and automated status updates eliminated hundreds of chasing emails and reduced candidate drop-off to near zero.',
    author: 'David Kim',
    role: 'Head of Engineering Recruitment',
    company: 'Kestrel Logistics & Supply',
    industry: 'Supply Chain & Logistics',
    avatarInitials: 'DK',
    avatarGrad: 'linear-gradient(135deg, #10B981, #06B6D4)',
    metricValue: '82%',
    metricLabel: 'Less recruiter ops',
  },
  {
    id: 'vanguard-mobility',
    quote: 'Hybent’s pre-vetted engineers were onboarded into our autonomous systems sprint in under 48 hours. They immediately hit velocity without any ramp-up friction or skill mismatch.',
    author: 'Sarah Jenkins',
    role: 'VP of Engineering Operations',
    company: 'Vanguard Mobility',
    industry: 'Connected EV & Fleet',
    avatarInitials: 'SJ',
    avatarGrad: 'linear-gradient(135deg, #F59E0B, #EF4444)',
    metricValue: '48h',
    metricLabel: 'Deployment time',
  },
  {
    id: 'omniretail-group',
    quote: 'Scaling our headless commerce platform for peak holiday traffic was seamless. Hybent matched us with elite fullstack developers specialized in Next.js and Shopify Plus within days.',
    author: 'Arjun Patel',
    role: 'Director of Technology',
    company: 'OmniRetail Global',
    industry: 'Enterprise E-Commerce',
    avatarInitials: 'AP',
    avatarGrad: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
    metricValue: '3.2x',
    metricLabel: 'Faster rollout',
  },
  {
    id: 'aetheria-cloud',
    quote: 'The depth of technical vetting in Go, Kubernetes, and Terraform engineers from Hybent is unmatched by traditional staffing firms. Our long-term team retention is over 96%.',
    author: 'Claire Dubois',
    role: 'Head of Cloud Talent',
    company: 'Aetheria Cloud Infrastructure',
    industry: 'Cloud & DevOps',
    avatarInitials: 'CD',
    avatarGrad: 'linear-gradient(135deg, #0EA5E9, #2563EB)',
    metricValue: '96%',
    metricLabel: 'Talent retention',
  },
]

const TRUSTED_CLIENTS = [
  'Apex Financial',
  'Novus Health Cloud',
  'Kestrel Logistics',
  'Vanguard Mobility',
  'OmniRetail Group',
  'Aetheria Cloud',
  'Pulse Genomics',
  'Solstice Labs',
]

export default function CustomersPage() {
  return (
    <SiteView route="customers">
      {/* ── HERO SECTION ────────────────────────────────────────────── */}
      <section className="hero">
        <div className="hero__orb orb-a" data-para="0.02"></div>
        <div className="hero__orb orb-b" data-para="-0.03"></div>

        <div className="wrap">
          <p className="eyebrow" data-rv="up">
            <span className="bars"><i></i><i></i><i></i></span>
            <span>Customer Stories &amp; Outcomes</span>
          </p>
          <h1 style={{ fontSize: "clamp(2.35rem,4.6vw,3.6rem)", marginTop: "14px" }} data-rv="up" data-delay="80">
            Trusted by high-growth engineering teams worldwide
          </h1>
          <p className="hero__sub" data-rv="up" data-delay="160">
            See how leading organizations in FinTech, Healthcare, Logistics, and Cloud SaaS use Hybent to automate screening, hire pre-vetted engineers, and accelerate product delivery.
          </p>

          {/* Quick Metrics Bar */}
          <div
            className="grid g4"
            style={{ marginTop: "40px", gap: "16px" }}
            data-rv="up"
            data-delay="220"
          >
            <div className="card card--flat stat" style={{ padding: "18px 20px" }}>
              <b>74%</b>
              <span>Faster Screening Cycle</span>
              <em>AI-assisted evaluation</em>
            </div>
            <div className="card card--flat stat" style={{ padding: "18px 20px" }}>
              <b>48 Hours</b>
              <span>Average Time to Deploy</span>
              <em>Pre-vetted engineering pods</em>
            </div>
            <div className="card card--flat stat" style={{ padding: "18px 20px" }}>
              <b>96%+</b>
              <span>Placement Retention</span>
              <em>Skill &amp; culture alignment</em>
            </div>
            <div className="card card--flat stat" style={{ padding: "18px 20px" }}>
              <b>10,000+</b>
              <span>Recruiter Hours Saved</span>
              <em>Automated workflows</em>
            </div>
          </div>
        </div>
      </section>

      {/* ── CLIENT BRAND MARQUEE ─────────────────────────────────────── */}
      <section className="section section--tight" style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: "20px 0", background: "rgba(255,255,255,0.02)" }}>
        <div className="wrap">
          <p
            style={{
              textAlign: "center",
              fontSize: "0.78rem",
              fontFamily: "var(--f-mono)",
              textTransform: "uppercase",
              letterSpacing: "0.16em",
              color: "var(--muted)",
              marginBottom: "16px",
            }}
          >
            Powering talent &amp; engineering pipelines across global enterprises
          </p>
        </div>
        <div className="marquee marquee--slow" data-rv="up">
          <div className="marquee__track">
            {TRUSTED_CLIENTS.concat(TRUSTED_CLIENTS).map((client, idx) => (
              <span
                key={idx}
                className="marquee__item"
                style={{
                  fontWeight: 600,
                  fontSize: "1.05rem",
                  letterSpacing: "-0.01em",
                  color: "var(--text)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "var(--cyan)",
                    display: "inline-block",
                  }}
                ></span>
                {client}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── VERIFIED CUSTOMER TESTIMONIALS SECTION ──────────────────── */}
      <section className="section" id="testimonials">
        <div className="wrap">
          <div className="section-head center" data-rv="up" style={{ marginBottom: "48px" }}>
            <p className="eyebrow" style={{ justifyContent: "center" }}>
              <span className="bars"><i></i><i></i><i></i></span>
              <span>Verified Testimonials</span>
            </p>
            <h2 className="h-lg" style={{ marginTop: "12px" }}>
              What our clients say about hiring with Hybent
            </h2>
            <p className="lead" style={{ marginTop: "14px", maxWidth: "620px", margin: "14px auto 0" }}>
              Real feedback from talent leaders and engineering executives who scale their teams and automate recruitment workflows with Hybent.
            </p>
          </div>

          <div className="grid g3" style={{ gap: "20px" }}>
            {CUSTOMER_TESTIMONIALS.map((item, idx) => (
              <article
                key={item.id}
                className="card"
                data-rv="up"
                data-delay={idx * 60}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  padding: "24px 22px",
                  borderRadius: "var(--r-lg)",
                  position: "relative",
                  boxShadow: "0 10px 30px -10px rgba(0,0,0,0.06)",
                }}
              >
                <div className="card__glow" style={{ top: "-30px", right: "-30px", width: "150px", height: "150px" }}></div>

                <div>
                  {/* Top Row: Industry badge & Verified outcome tag */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                      marginBottom: "16px",
                      paddingBottom: "14px",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <span
                      className="badge"
                      style={{
                        fontSize: "0.72rem",
                        fontFamily: "var(--f-mono)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        padding: "3px 9px",
                        height: "auto",
                      }}
                    >
                      {item.industry}
                    </span>

                    <span
                      style={{
                        fontSize: "0.76rem",
                        fontWeight: 700,
                        color: "var(--success)",
                        background: "rgba(16, 185, 129, 0.08)",
                        border: "1px solid rgba(16, 185, 129, 0.2)",
                        padding: "2px 8px",
                        borderRadius: "12px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span>{item.metricValue}</span>
                      <span style={{ fontSize: "0.68rem", color: "var(--muted)", fontWeight: 500 }}>
                        {item.metricLabel}
                      </span>
                    </span>
                  </div>

                  {/* Rating Stars */}
                  <div style={{ display: "flex", gap: "3px", color: "#F59E0B", fontSize: "0.88rem", marginBottom: "12px" }}>
                    <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
                  </div>

                  {/* Quote Text */}
                  <p
                    style={{
                      fontSize: "0.92rem",
                      lineHeight: "1.65",
                      color: "var(--text)",
                      fontStyle: "normal",
                      margin: "0 0 20px",
                    }}
                  >
                    &ldquo;{item.quote}&rdquo;
                  </p>
                </div>

                {/* Card Footer: Author details */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    paddingTop: "16px",
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <span
                    style={{
                      background: item.avatarGrad,
                      color: "#FFFFFF",
                      fontWeight: 700,
                      fontSize: "0.82rem",
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                      boxShadow: "0 4px 10px rgba(0,0,0,0.12)",
                    }}
                  >
                    {item.avatarInitials}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <b style={{ fontSize: "0.92rem", display: "block", color: "var(--text)", lineHeight: "1.3" }}>
                      {item.author}
                    </b>
                    <span style={{ fontSize: "0.78rem", color: "var(--muted)", display: "block", lineHeight: "1.3", margin: "2px 0" }}>
                      {item.role}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "var(--cyan)", display: "block", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.company}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── CUSTOMER SUCCESS PHILOSOPHY ─────────────────────────────── */}
      <section className="section" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="wrap">
          <div className="split" style={{ alignItems: "center" }}>
            <div data-rv="left">
              <p className="eyebrow"><span className="bars"><i></i><i></i><i></i></span><span>Customer Success</span></p>
              <h2 className="h-lg" style={{ marginTop: "12px" }}>A dedicated partner, not just a software login</h2>
              <p className="lead" style={{ marginTop: "18px" }}>
                Every client gets dedicated technical onboarding: a named talent architect, written rubric integration, and ongoing support to ensure maximum hiring accuracy and engineering velocity.
              </p>
            </div>
            <div className="grid g2" data-rv="right" style={{ gap: "14px" }}>
              <div className="card card--flat stat" style={{ padding: "20px" }}>
                <b>Guided</b>
                <span>Tailored onboarding with our solutions engineers</span>
              </div>
              <div className="card card--flat stat" style={{ padding: "20px" }}>
                <b>Named</b>
                <span>Dedicated account lead who owns your hiring pipeline</span>
              </div>
              <div className="card card--flat stat" style={{ padding: "20px" }}>
                <b>Direct</b>
                <span>Instant access to engineering and technical recruiters</span>
              </div>
              <div className="card card--flat stat" style={{ padding: "20px" }}>
                <b>Custom</b>
                <span>Bespoke scoring rubrics tuned to your tech stack</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CLIENT OUTCOMES / CASE STUDIES ──────────────────────────── */}
      <section className="section section--tight" id="cases" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="wrap">
          <div className="section-head" data-rv="up">
            <p className="eyebrow"><span className="bars"><i></i><i></i><i></i></span><span>Proven Impact</span></p>
            <h2 className="h-lg">Measurable outcomes across every team</h2>
            <p className="lead">Here is how Hybent delivers quantifiable value across speed, structure, and candidate satisfaction.</p>
          </div>
          <div className="grid g3">
            <article className="card case" data-rv="up">
              <div className="case__viz">
                <svg viewBox="0 0 300 150" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M0 120 L50 108 L100 88 L150 74 L200 48 L250 34 L300 18" fill="none" stroke="url(#lg)" strokeWidth="2.4" />
                  <path d="M0 120 L50 108 L100 88 L150 74 L200 48 L250 34 L300 18 L300 150 L0 150Z" fill="url(#lg)" opacity=".12" />
                </svg>
                <b>Speed</b>
              </div>
              <h4>Take the hours out of manual résumé review</h4>
              <p className="small">Every application is parsed on arrival and scored against one rubric, so recruiters spend their time on the shortlist instead of the pile behind it.</p>
              <ul>
                <li><strong>74%</strong><span>Faster time to shortlist</span></li>
                <li><strong>Auto</strong><span>Instant resume parsing</span></li>
                <li><strong>Every</strong><span>Candidate scored fairly</span></li>
              </ul>
            </article>
            <article className="card case" data-rv="up" data-delay="90">
              <div className="case__viz case__viz--b">
                <svg viewBox="0 0 300 150" preserveAspectRatio="none" aria-hidden="true">
                  <g fill="url(#lg)" opacity=".55">
                    <rect x="24" y="96" width="26" height="54" rx="4" />
                    <rect x="72" y="78" width="26" height="72" rx="4" />
                    <rect x="120" y="58" width="26" height="92" rx="4" />
                    <rect x="168" y="40" width="26" height="110" rx="4" />
                    <rect x="216" y="22" width="26" height="128" rx="4" />
                  </g>
                </svg>
                <b>Structure</b>
              </div>
              <h4>Make interviews comparable, not conversational</h4>
              <p className="small">Structured scorecards and AI interview assistance mean two interviewers rate the same candidate against the same competencies — and the record holds up months later.</p>
              <ul>
                <li><strong>One</strong><span>Unified rubric per role</span></li>
                <li><strong>Live</strong><span>Interview note capture</span></li>
                <li><strong>Full</strong><span>Decision audit history</span></li>
              </ul>
            </article>
            <article className="card case" data-rv="up" data-delay="180">
              <div className="case__viz case__viz--c">
                <svg viewBox="0 0 300 150" aria-hidden="true">
                  <circle cx="150" cy="75" r="52" fill="none" stroke="url(#lg)" strokeWidth="9" opacity=".2" />
                  <circle cx="150" cy="75" r="52" fill="none" stroke="url(#lg)" strokeWidth="9" strokeLinecap="round" strokeDasharray="245 327" transform="rotate(-90 150 75)" />
                </svg>
                <b>Clarity</b>
              </div>
              <h4>Stop losing good candidates to silence</h4>
              <p className="small">A dedicated candidate portal with automated status updates keeps applicants informed without recruiters having to write individual update emails.</p>
              <ul>
                <li><strong>Auto</strong><span>Real-time status updates</span></li>
                <li><strong>24/7</strong><span>Candidate transparent portal</span></li>
                <li><strong>Zero</strong><span>Unanswered inquiries</span></li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      {/* ── INTEGRATIONS ECOSYSTEM SECTION ──────────────────────────── */}
      <section className="section section--tight" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="wrap">
          <div className="section-head" data-rv="up">
            <p className="eyebrow" style={{ justifyContent: "center" }}><span className="bars"><i></i><i></i><i></i></span><span>Integrations</span></p>
            <h2 className="h-md">Designed to fit the stack you already run</h2>
            <p className="lead">Hybent connects seamlessly through documented REST APIs, webhooks, and direct connectors across identity, calendar systems, job boards, and HRIS platforms.</p>
          </div>
        </div>
        <div className="figrow" data-rv="up">
          <div className="figpanel">
            <svg className="fig" role="img" aria-label="Hybent Hiring connecting to single sign-on, calendars, job boards, e-signature, background checks and webhooks" viewBox="0 0 460 240" width="460" height="240">
              <g stroke="var(--border-strong)" strokeWidth="1.4" fill="none">
                <path d="M230 120L96 56M230 120L364 56M230 120L64 120M230 120L396 120M230 120L96 184M230 120L364 184" />
              </g>
              <g>
                <circle cx="230" cy="120" r="46" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="1.6" />
                <circle cx="230" cy="120" r="30" fill="url(#hbg)" opacity=".16" />
                <text x="230" y="116" textAnchor="middle" fontFamily="Sora" fontSize="12" fontWeight="600" fill="var(--text)">Hybent</text>
                <text x="230" y="132" textAnchor="middle" fontFamily="Sora" fontSize="12" fontWeight="600" fill="var(--text)">Hiring</text>
              </g>
              <g fontFamily="IBM Plex Mono" fontSize="7.5" letterSpacing="1.1" textAnchor="middle">
                <g fill="var(--surface)" stroke="var(--border-strong)">
                  <rect x="36" y="40" width="120" height="32" rx="11" />
                  <rect x="304" y="40" width="120" height="32" rx="11" />
                  <rect x="4" y="104" width="120" height="32" rx="11" />
                  <rect x="336" y="104" width="120" height="32" rx="11" />
                  <rect x="36" y="168" width="120" height="32" rx="11" />
                  <rect x="304" y="168" width="120" height="32" rx="11" />
                </g>
                <g fill="var(--muted)">
                  <text x="96" y="60">SINGLE SIGN-ON</text>
                  <text x="364" y="60">CALENDAR SYNC</text>
                  <text x="64" y="124">JOB BOARDS</text>
                  <text x="396" y="124">E-SIGNATURE</text>
                  <text x="96" y="188">BACKGROUND CHECKS</text>
                  <text x="364" y="188">REST &amp; WEBHOOKS</text>
                </g>
              </g>
            </svg>
          </div>
        </div>
        <div className="marquee marquee--slow" data-rv="up" style={{ marginBottom: "16px" }}>
          <div className="marquee__track">
            <span className="marquee__item"><svg aria-hidden="true"><use href="#i-lock" /></svg>Single sign-on</span>
            <span className="marquee__item"><svg aria-hidden="true"><use href="#i-users" /></svg>Directory sync</span>
            <span className="marquee__item"><svg aria-hidden="true"><use href="#i-cal" /></svg>Calendar sync</span>
            <span className="marquee__item"><svg aria-hidden="true"><use href="#i-mail" /></svg>Email &amp; scheduling</span>
            <span className="marquee__item"><svg aria-hidden="true"><use href="#i-head" /></svg>Chat notifications</span>
            <span className="marquee__item"><svg aria-hidden="true"><use href="#i-doc" /></svg>E-signature</span>
            <span className="marquee__item" aria-hidden="true"><svg><use href="#i-lock" /></svg>Single sign-on</span>
            <span className="marquee__item" aria-hidden="true"><svg><use href="#i-users" /></svg>Directory sync</span>
            <span className="marquee__item" aria-hidden="true"><svg><use href="#i-cal" /></svg>Calendar sync</span>
            <span className="marquee__item" aria-hidden="true"><svg><use href="#i-mail" /></svg>Email &amp; scheduling</span>
            <span className="marquee__item" aria-hidden="true"><svg><use href="#i-head" /></svg>Chat notifications</span>
            <span className="marquee__item" aria-hidden="true"><svg><use href="#i-doc" /></svg>E-signature</span>
          </div>
        </div>
      </section>

      {/* ── CALL TO ACTION BANNER (CLEAN CTA-BAND) ──────────────────── */}
      <section className="section" style={{ paddingTop: "20px", paddingBottom: "80px" }}>
        <div className="wrap">
          <div className="cta-band" data-rv="scale" style={{ textAlign: "center" }}>
            <p className="eyebrow" style={{ justifyContent: "center" }}>
              <span className="bars"><i></i><i></i><i></i></span>
              <span>Transform Your Hiring</span>
            </p>
            <h2 className="h-lg" style={{ marginTop: "14px", maxWidth: "680px", margin: "14px auto 0" }}>
              Ready to experience faster, high-precision hiring?
            </h2>
            <p className="lead" style={{ marginTop: "16px", maxWidth: "580px", margin: "16px auto 32px" }}>
              Join forward-thinking companies scaling their engineering and recruiting operations with Hybent.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", justifyContent: "center" }}>
              <Link to="/contact" className="btn btn-primary btn-lg">
                <span>Book a Platform Demo</span>
                <svg className="arw" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </Link>
              <Link to="/hire-talent" className="btn btn-ghost btn-lg">
                <span>Hire Pre-Vetted Talent</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </SiteView>
  )
}
