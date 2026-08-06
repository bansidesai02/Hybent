import { SiteView } from '../components/SiteView'

export default function HomePage() {
  return (
    <SiteView route="index">
      <section className="hero" id="top">
        <div className="hero__orb orb-a" data-para="0.02"></div>
        <div className="hero__orb orb-b" data-para="-0.03"></div>
        <div className="hero__orb orb-c" data-para="0.015"></div>

        <div className="wrap hero__grid">
          <div>
            <p className="hero__pill" data-rv="up">
              <b>Live</b>
              <span>Hybent Hiring, our AI recruitment platform, is live</span>
              <svg aria-hidden="true"><use href="#i-arrow" /></svg>
            </p>

            {/* Each rotating item is a whole line, so the heading is exactly
                one line tall whichever word is on screen. Words stay short on
                purpose: the line has to fit the hero column without wrapping. */}
            <h1 data-rv="up" data-delay="80">
              Intelligent software for<br />
              <span className="rot" aria-live="polite">
                <span className="on">how you hire.</span>
                <span>how you grow.</span>
                <span>how you scale.</span>
                <span>how you work.</span>
                <span>how you innovate.</span>
              </span>
            </h1>

            <p className="hero__sub" data-rv="up" data-delay="160">HYBENT builds intelligent products and delivers technology services that help businesses innovate, grow, and scale. Hybent Hiring, our flagship AI recruitment platform, is the first step in a long-term ecosystem of innovative business software designed to help organizations hire, scale, and succeed.</p>

            <div className="hero__actions" data-rv="up" data-delay="240">
              <a className="btn btn-primary btn-lg" href="/products">Explore Hybent Hiring <svg className="arw" width="17" height="17" aria-hidden="true"><use href="#i-arrow" /></svg></a>
              <a className="btn btn-ghost btn-lg" href="/contact">Book a demo</a>
            </div>

            <div className="hero__meta" data-rv="up" data-delay="320">
              <div><strong>Live</strong><span>Hybent Hiring in production</span></div>
              <div><strong>AI-first</strong><span>How we build</span></div>
              <div><strong>Enterprise</strong><span>Security by default</span></div>
            </div>
          </div>

          <div data-rv="scale" data-delay="200">
            <div className="lattice" id="lattice">
              <div className="lattice__ring"></div><div className="lattice__ring"></div><div className="lattice__ring"></div>
              <svg viewBox="0 0 100 100" aria-hidden="true">
                <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#22CFFF" /><stop offset="50%" stopColor="#4C6FFF" /><stop offset="100%" stopColor="#E85CFF" />
                </linearGradient></defs>
                <path className="spark" d="M50 50 L18 26" /><path className="spark" d="M50 50 L84 30" />
                <path className="spark" d="M50 50 L14 62" /><path className="spark" d="M50 50 L88 68" />
                <path className="spark" d="M50 50 L46 92" />
              </svg>
              <div className="lattice__core"><img src="/hybent/hybent-mark.png" alt="HYBENT platform core" /></div>
              <a href="/products/hiring" className="node node--live" style={{ left: "18%", top: "26%", textDecoration: "none", cursor: "pointer" }}><i></i>Hybent Hiring</a>
              <div className="node" style={{ left: "84%", top: "30%" }}><i></i>IT Services</div>
              <div className="node" style={{ left: "88%", top: "68%" }}><i></i>Custom Software</div>
              <div className="node" style={{ left: "46%", top: "92%" }}><i></i>Hire Talent</div>
              <div className="node" style={{ left: "14%", top: "62%" }}><i></i>Web & Mobile Apps</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section section--tight" aria-label="Hybent Hiring capabilities">
        <div className="wrap">
          <p className="mono center" style={{ textAlign: "center", marginBottom: "32px" }} data-rv="up">What Hybent Hiring handles, end to end</p>
        </div>
        <div className="marquee" data-rv="up">
          <div className="marquee__track">
            <span className="marquee__item"><svg aria-hidden="true"><use href="#i-layers" /></svg>Resume parsing</span>
            <span className="marquee__item"><svg aria-hidden="true"><use href="#i-cpu" /></svg>AI screening</span>
            <span className="marquee__item"><svg aria-hidden="true"><use href="#i-globe" /></svg>Candidate management</span>
            <span className="marquee__item"><svg aria-hidden="true"><use href="#i-zap" /></svg>Interview management</span>
            <span className="marquee__item"><svg aria-hidden="true"><use href="#i-build" /></svg>Recruiter dashboard</span>
            <span className="marquee__item"><svg aria-hidden="true"><use href="#i-db" /></svg>Talent database</span>
            <span className="marquee__item"><svg aria-hidden="true"><use href="#i-cloud" /></svg>Candidate portal</span>
            <span className="marquee__item"><svg aria-hidden="true"><use href="#i-target" /></svg>Recruiter copilot</span>
            <span className="marquee__item" aria-hidden="true"><svg><use href="#i-layers" /></svg>Resume parsing</span>
            <span className="marquee__item" aria-hidden="true"><svg><use href="#i-cpu" /></svg>AI screening</span>
            <span className="marquee__item" aria-hidden="true"><svg><use href="#i-globe" /></svg>Candidate management</span>
            <span className="marquee__item" aria-hidden="true"><svg><use href="#i-zap" /></svg>Interview management</span>
            <span className="marquee__item" aria-hidden="true"><svg><use href="#i-build" /></svg>Recruiter dashboard</span>
            <span className="marquee__item" aria-hidden="true"><svg><use href="#i-db" /></svg>Talent database</span>
            <span className="marquee__item" aria-hidden="true"><svg><use href="#i-cloud" /></svg>Candidate portal</span>
            <span className="marquee__item" aria-hidden="true"><svg><use href="#i-target" /></svg>Recruiter copilot</span>
          </div>
        </div>
      </section>

      <section className="section section--tight">
        <div className="wrap">
          <div className="grid g3">
            <div className="card card--flat stat" data-rv="up"><b>Product</b><span>Hybent Hiring in production</span><em>AI recruitment platform</em></div>
            <div className="card card--flat stat" data-rv="up" data-delay="80"><b>AI-first</b><span>Built for real workflows</span><em>Models inside the product</em></div>
            <div className="card card--flat stat" data-rv="up" data-delay="160"><b>Enterprise</b><span>Security &amp; compliance</span><em>Built for scale</em></div>
          </div>
        </div>
      </section>


      {/* section--canvas carries the hero's own light and grid through this
          section, so the two read as one continuous surface. */}
      <section className="section section--canvas" id="products-overview">
        <div className="wrap">
          <div className="section-head" data-rv="up">
            <p className="eyebrow"><span className="bars"><i></i><i></i><i></i></span><span>Product</span></p>
            <h2 className="h-lg">Hybent Hiring. AI-Powered Recruitment Platform.</h2>
            <p className="lead">Hybent Hiring holds your entire recruitment pipeline in one place — resume parsing, AI screening, interview management, recruiter copilot, and candidate portal.</p>
          </div>
          <div className="grid g2">
            <article className="card" data-rv="up"><div className="card__glow" style={{ top: "-40px", left: "-40px" }}></div>
              <svg className="fig fig--thumb" role="img" aria-label="Candidate list with AI screening scores" viewBox="0 0 300 140" width="300" height="140">
            <rect x="1" y="1" width="298" height="138" rx="12" fill="var(--surface)" stroke="var(--border)" />
            <g>
              <rect x="18" y="20" width="264" height="32" rx="8" fill="var(--surface-2)" />
              <circle cx="38" cy="36" r="9" fill="url(#hbg)" />
              <rect x="56" y="28" width="70" height="6" rx="3" fill="var(--border-strong)" />
              <rect x="56" y="40" width="120" height="4" rx="2" fill="var(--border)" />
              <text x="258" y="40" fontFamily="Sora" fontSize="11" fontWeight="600" fill="var(--success)">94</text>
              <rect x="18" y="58" width="264" height="32" rx="8" fill="var(--surface-2)" />
              <circle cx="38" cy="74" r="9" fill="url(#hbg)" opacity=".8" />
              <rect x="56" y="66" width="58" height="6" rx="3" fill="var(--border-strong)" />
              <rect x="56" y="78" width="98" height="4" rx="2" fill="var(--border)" />
              <text x="258" y="78" fontFamily="Sora" fontSize="11" fontWeight="600" fill="var(--muted)">88</text>
              <rect x="18" y="96" width="264" height="32" rx="8" fill="var(--surface-2)" opacity=".6" />
              <circle cx="38" cy="112" r="9" fill="url(#hbg)" opacity=".45" />
              <rect x="56" y="104" width="64" height="6" rx="3" fill="var(--border)" />
              <rect x="56" y="116" width="86" height="4" rx="2" fill="var(--border)" />
            </g>
          </svg>
                <span className="icon-tile"><svg aria-hidden="true"><use href="#i-users" /></svg></span>
              <h3 className="h-sm" style={{ margin: "16px 0 8px" }}>Hybent Hiring <span className="badge badge--live"><i className="dot dot--pulse"></i>Live</span></h3>
              <p className="small">Our AI recruitment platform. Resume parsing, AI screening, interview management, recruiter copilot and a candidate portal in one pipeline.</p>
              <p style={{ marginTop: "18px" }}><a className="link-arrow" href="/products/hiring">Explore Hybent Hiring <svg width="15" height="15" aria-hidden="true"><use href="#i-arrow" /></svg></a></p>
            </article>
            <article className="card" data-rv="up" data-delay="90"><div className="card__glow" style={{ top: "-40px", right: "-40px" }}></div>
              <svg className="fig fig--thumb" role="img" aria-label="Platform layer stack: products, intelligence, services, data" viewBox="0 0 300 140" width="300" height="140">
            <rect x="1" y="1" width="298" height="138" rx="12" fill="var(--surface)" stroke="var(--border)" />
            <g>
              <rect x="30" y="20" width="240" height="24" rx="7" fill="url(#hbgh)" opacity=".85" />
              <text x="42" y="36" fontFamily="IBM Plex Mono" fontSize="8" letterSpacing="1.4" fill="#fff">PRODUCT LAYER</text>
              <rect x="30" y="50" width="240" height="24" rx="7" fill="var(--surface-2)" stroke="var(--border)" />
              <text x="42" y="66" fontFamily="IBM Plex Mono" fontSize="8" letterSpacing="1.4" fill="var(--muted)">INTELLIGENCE</text>
              <rect x="30" y="80" width="240" height="24" rx="7" fill="var(--surface-2)" stroke="var(--border)" />
              <text x="42" y="96" fontFamily="IBM Plex Mono" fontSize="8" letterSpacing="1.4" fill="var(--muted)">PLATFORM SERVICES</text>
              <rect x="30" y="110" width="240" height="24" rx="7" fill="var(--surface-2)" stroke="var(--border)" />
              <text x="42" y="126" fontFamily="IBM Plex Mono" fontSize="8" letterSpacing="1.4" fill="var(--muted)">DATA FOUNDATION</text>
            </g>
          </svg>
                <span className="icon-tile"><svg aria-hidden="true"><use href="#i-layers" /></svg></span>
              <h3 className="h-sm" style={{ margin: "16px 0 8px" }}>The Platform</h3>
              <p className="small">Identity, permissions, workflow, audit and a shared data model powering secure enterprise operations.</p>
              <p style={{ marginTop: "18px" }}><a className="link-arrow" href="/platform">See the platform <svg width="15" height="15" aria-hidden="true"><use href="#i-arrow" /></svg></a></p>
            </article>
          </div>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "32px" }} data-rv="up">
            <a className="btn btn-primary" href="/products/hiring">Explore Hybent Hiring <svg className="arw" width="16" height="16" aria-hidden="true"><use href="#i-arrow" /></svg></a>
            <a className="btn btn-ghost" href="/contact">Book a demo</a>
          </div>
        </div>
      </section>

      {/* ── How it works: 4-Card Resume Parsing & Pipeline Section ── */}
      <section className="section" id="how-it-works">
        <div className="wrap">
          <div className="section-head" data-rv="up">
            <p className="eyebrow"><span className="bars"><i></i><i></i><i></i></span><span>How Resume Parsing & AI Hiring Works</span></p>
            <h2 className="h-lg">Four phases, zero manual resume filtering</h2>
            <p className="lead">From the second a resume lands to the moment an offer is signed, the work that used to take weeks happens automatically with AI precision.</p>
          </div>

          <div className="grid g2">
            <article className="card" data-rv="up" data-delay="0">
              <div className="card__glow" style={{ top: "-40px", left: "-40px" }}></div>
              <span className="icon-tile"><svg aria-hidden="true"><use href="#i-ai" /></svg></span>
              <p className="mono" style={{ margin: '16px 0 6px', color: 'var(--cyan)' }}>Phase 01 — Intake</p>
              <h3 className="h-sm">AI Resume Intelligence &amp; Parsing</h3>
              <p className="small" style={{ marginTop: '10px' }}>The moment a candidate uploads a CV, our AI parses the document in under 10 seconds. It extracts explicit skills, infers hidden competencies from context, calculates experience years, and determines seniority level.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '18px' }}>
                <span className="chip">Skill extraction</span>
                <span className="chip">Experience calc</span>
                <span className="chip">Seniority detection</span>
                <span className="chip" style={{ background: 'rgba(34,207,255,0.12)', color: 'var(--cyan)' }}>~10 seconds</span>
              </div>
            </article>

            <article className="card" data-rv="up" data-delay="80">
              <div className="card__glow" style={{ top: "-40px", right: "-40px" }}></div>
              <span className="icon-tile"><svg aria-hidden="true"><use href="#i-target" /></svg></span>
              <p className="mono" style={{ margin: '16px 0 6px', color: 'var(--cyan)' }}>Phase 02 — Scoring</p>
              <h3 className="h-sm">Smart Auto-Shortlisting</h3>
              <p className="small" style={{ marginTop: '10px' }}>Candidate profiles are scored against job rubrics. When an applicant passes the threshold, they are automatically shortlisted, status is updated, HR is notified, and status emails trigger — with zero human lag.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '18px' }}>
                <span className="chip">Match scoring</span>
                <span className="chip">Auto-shortlist</span>
                <span className="chip">HR notification</span>
                <span className="chip" style={{ background: 'rgba(34,207,255,0.12)', color: 'var(--cyan)' }}>Fully automated</span>
              </div>
            </article>

            <article className="card" data-rv="up" data-delay="160">
              <div className="card__glow" style={{ bottom: "-40px", left: "-40px" }}></div>
              <span className="icon-tile"><svg aria-hidden="true"><use href="#i-zap" /></svg></span>
              <p className="mono" style={{ margin: '16px 0 6px', color: 'var(--cyan)' }}>Phase 03 — Scheduling</p>
              <h3 className="h-sm">Conflict-Free Scheduling</h3>
              <p className="small" style={{ marginTop: '10px' }}>One click cross-references candidate availability and interviewer calendars. It selects optimal slots, generates Google Meet links, and dispatches invites without endless back-and-forth emails.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '18px' }}>
                <span className="chip">Slot matching</span>
                <span className="chip">Conflict detection</span>
                <span className="chip">Google Meet link</span>
                <span className="chip" style={{ background: 'rgba(34,207,255,0.12)', color: 'var(--cyan)' }}>30 seconds</span>
              </div>
            </article>

            <article className="card" data-rv="up" data-delay="240">
              <div className="card__glow" style={{ bottom: "-40px", right: "-40px" }}></div>
              <span className="icon-tile"><svg aria-hidden="true"><use href="#i-build" /></svg></span>
              <p className="mono" style={{ margin: '16px 0 6px', color: 'var(--cyan)' }}>Phase 04 — Decision</p>
              <h3 className="h-sm">Interview Intelligence &amp; Hiring</h3>
              <p className="small" style={{ marginTop: '10px' }}>Post-interview feedback is analyzed by AI to surface hiring recommendations and update win probabilities. Profiles are index-saved into your permanent, searchable talent database.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '18px' }}>
                <span className="chip">Feedback analysis</span>
                <span className="chip">Hire probability</span>
                <span className="chip">Talent database</span>
                <span className="chip" style={{ background: 'rgba(34,207,255,0.12)', color: 'var(--cyan)' }}>AI recommendation</span>
              </div>
            </article>
          </div>

          <div className="mock" id="mock" style={{ marginTop: '40px' }} data-rv="up">
            <div className="mock__bar"><i></i><i></i><i></i><span>hybent hiring / pipeline / senior backend engineer simulator</span></div>
            <div className="mock__body">
              <div className="mock__row"><span className="mock__ava"></span><span className="mock__meta"><b>A. Raman</b><span>Screened · 4 competencies matched (React, Node, Postgres, Docker)</span><span className="mock__meter" style={{ "--w": "94%" } as React.CSSProperties}><i></i></span></span><span className="score">94</span></div>
              <div className="mock__row"><span className="mock__ava" style={{ background: "linear-gradient(140deg,#4C6FFF,#E85CFF)" }}></span><span className="mock__meta"><b>J. Okafor</b><span>Interview scheduled · Thu 14:00</span><span className="mock__meter" style={{ "--w": "88%" } as React.CSSProperties}><i></i></span></span><span className="score">88</span></div>
              <div className="mock__row"><span className="mock__ava" style={{ background: "linear-gradient(140deg,#22CFFF,#4C6FFF)" }}></span><span className="mock__meta"><b>M. Alvarez</b><span>Screened · needs system design review</span><span className="mock__meter" style={{ "--w": "71%" } as React.CSSProperties}><i></i></span></span><span className="score score--mid">71</span></div>
              <div className="mock__row"><span className="mock__ava" style={{ background: "linear-gradient(140deg,#A855F7,#22CFFF)" }}></span><span className="mock__meta"><b>S. Beck</b><span>Offer drafted · awaiting approval</span><span className="mock__meter" style={{ "--w": "91%" } as React.CSSProperties}><i></i></span></span><span className="score">91</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section section--tight">
        <div className="wrap">
          <div className="section-head center" data-rv="up">
            <p className="eyebrow" style={{ justifyContent: "center" }}><span className="bars"><i></i><i></i><i></i></span><span>Why HYBENT</span></p>
            <h2 className="h-lg">Built for the decade, not for the demo</h2>
            <p className="lead">Four commitments we hold ourselves to in every release, in every product, for every customer.</p>
          </div>
          <div className="grid g4">
            <article className="card" data-rv="up"><span className="icon-tile"><svg viewBox="0 0 96 96" aria-hidden="true">
      
            <path d="M30 62l14-16 10 9 14-20" fill="none" stroke="url(#hbgh)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="30" cy="62" r="4.5" fill="var(--surface)" stroke="url(#hbgh)" strokeWidth="2.6" />
            <circle cx="68" cy="35" r="4.5" fill="url(#hbgh)" />
          </svg></span>
              <h3 className="h-sm" style={{ margin: "18px 0 9px" }}>Fast to adopt</h3>
              <p className="small">Guided import, sensible defaults and ready-made rubrics by role type. Hybent Hiring is designed to run a live requisition without a services project.</p></article>
            <article className="card" data-rv="up" data-delay="90"><span className="icon-tile"><svg viewBox="0 0 96 96" aria-hidden="true">
      
            <rect x="30" y="30" width="36" height="36" rx="9" fill="none" stroke="url(#hbgh)" strokeWidth="3" />
            <rect x="41" y="41" width="14" height="14" rx="4" fill="url(#hbgh)" />
            <g stroke="url(#hbgh)" strokeWidth="2.6" strokeLinecap="round">
              <path d="M40 22v8M56 22v8M40 66v8M56 66v8M22 40h8M22 56h8M66 40h8M66 56h8" /></g>
          </svg></span>
              <h3 className="h-sm" style={{ margin: "18px 0 9px" }}>AI-first, not AI-added</h3>
              <p className="small">Parsing, screening and ranking are the product, not a feature we bolted onto a legacy workflow after the fact.</p></article>
            <article className="card" data-rv="up" data-delay="180"><span className="icon-tile"><svg viewBox="0 0 96 96" aria-hidden="true">
      
            <path d="M28 42v24a3 3 0 003 3h34a3 3 0 003-3V42" fill="none" stroke="url(#hbgh)" strokeWidth="3" strokeLinecap="round" />
            <path d="M48 58V26M38 36l10-10 10 10" fill="none" stroke="url(#hbgh)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg></span>
              <h3 className="h-sm" style={{ margin: "18px 0 9px" }}>Your data, portable</h3>
              <p className="small">Full export in open formats, whenever you ask. Staying with us should be a choice you keep making.</p></article>
            <article className="card" data-rv="up" data-delay="270"><span className="icon-tile"><svg viewBox="0 0 96 96" aria-hidden="true">
      
            <rect x="24" y="30" width="48" height="34" rx="9" fill="none" stroke="url(#hbgh)" strokeWidth="3" />
            <path d="M38 64l-4 10 12-10" fill="none" stroke="url(#hbgh)" strokeWidth="3" strokeLinejoin="round" />
            <g stroke="url(#hbgh)" strokeWidth="2.8" strokeLinecap="round"><path d="M36 44h6M52 44h8M36 53h20" /></g>
          </svg></span>
              <h3 className="h-sm" style={{ margin: "18px 0 9px" }}>Access to the builders</h3>
              <p className="small">You talk to the people writing the code. Early customers shape what we ship next, and we say so publicly.</p></article>
          </div>
        </div>
      </section>

      <section className="section" id="company">
        <div className="wrap figrow" data-rv="up">
            <div className="figpanel"><svg className="fig" role="img" aria-label="How Hybent Hiring processes an application: apply, parse, screen, shortlist, interview, offer" viewBox="0 0 700 190" width="700" height="190">
            <line x1="60" y1="86" x2="646" y2="86" stroke="var(--border)" strokeWidth="1.6" />
            <g>
        
              <rect x="18" y="52" width="84" height="68" rx="12" fill="var(--surface)" stroke="var(--border-strong)" />
              <rect x="42" y="66" width="36" height="42" rx="5" fill="var(--surface-2)" stroke="var(--border)" />
              <g fill="var(--border-strong)"><rect x="48" y="74" width="24" height="3.4" rx="1.7" /><rect x="48" y="82" width="18" height="3.4" rx="1.7" /><rect x="48" y="90" width="22" height="3.4" rx="1.7" /><rect x="48" y="98" width="14" height="3.4" rx="1.7" /></g>
        
              <rect x="140" y="52" width="84" height="68" rx="12" fill="var(--surface)" stroke="var(--border-strong)" />
              <g><rect x="156" y="66" width="52" height="9" rx="4.5" fill="url(#hbgh)" opacity=".85" />
                 <rect x="156" y="80" width="34" height="9" rx="4.5" fill="var(--border-strong)" />
                 <rect x="156" y="94" width="46" height="9" rx="4.5" fill="var(--border-strong)" /></g>
        
              <rect x="262" y="52" width="84" height="68" rx="12" fill="var(--surface)" stroke="var(--border-strong)" />
              <g transform="translate(304,86)">
                <circle r="22" fill="none" stroke="var(--border)" strokeWidth="6" />
                <circle r="22" fill="none" stroke="url(#hbgh)" strokeWidth="6" strokeLinecap="round" strokeDasharray="104 138" transform="rotate(-90)" />
                <text y="4" textAnchor="middle" fontFamily="Sora" fontSize="13" fontWeight="600" fill="var(--text)">94</text>
              </g>
        
              <rect x="384" y="52" width="84" height="68" rx="12" fill="var(--surface)" stroke="var(--border-strong)" />
              <g><rect x="400" y="64" width="52" height="14" rx="7" fill="var(--surface-2)" stroke="var(--border)" />
                 <circle cx="410" cy="71" r="4" fill="url(#hbg)" />
                 <rect x="400" y="82" width="52" height="14" rx="7" fill="var(--surface-2)" stroke="var(--border)" />
                 <circle cx="410" cy="89" r="4" fill="url(#hbg)" opacity=".7" />
                 <rect x="400" y="100" width="52" height="10" rx="5" fill="var(--surface-2)" opacity=".5" /></g>
        
              <rect x="506" y="52" width="84" height="68" rx="12" fill="var(--surface)" stroke="var(--border-strong)" />
              <rect x="524" y="66" width="48" height="40" rx="7" fill="var(--surface-2)" stroke="var(--border)" />
              <line x1="524" y1="78" x2="572" y2="78" stroke="var(--border)" />
              <rect x="530" y="84" width="12" height="12" rx="3" fill="url(#hbg)" opacity=".8" />
              <rect x="548" y="84" width="12" height="12" rx="3" fill="var(--border-strong)" />
        
              <rect x="628" y="52" width="54" height="68" rx="12" fill="url(#hbgh)" opacity=".14" stroke="var(--border-strong)" />
              <path d="M643 88l7 7 15-16" fill="none" stroke="url(#hbgh)" strokeWidth="3" strokeLinecap="round" />
            </g>
            <g fontFamily="IBM Plex Mono" fontSize="8" letterSpacing="1.3" fill="var(--dim)" textAnchor="middle">
              <text x="60" y="142">APPLY</text><text x="182" y="142">PARSE</text><text x="304" y="142">SCREEN</text>
              <text x="426" y="142">SHORTLIST</text><text x="548" y="142">INTERVIEW</text><text x="655" y="142">OFFER</text>
            </g>
            <g fontFamily="IBM Plex Mono" fontSize="7.5" letterSpacing="1" fill="var(--cyan)" textAnchor="middle">
              <text x="182" y="34">AI</text><text x="304" y="34">AI</text><text x="548" y="34">AI</text>
            </g>
          </svg></div>
        </div>
        <div className="wrap split">
          <div data-rv="left">
            <p className="eyebrow"><span className="bars"><i></i><i></i><i></i></span><span>Who we are</span></p>
            <h2 className="h-lg">Enterprise software should remove work, not quietly create more of it.</h2>
            <p className="lead" style={{ marginTop: "24px" }}>HYBENT is an enterprise software company with a single purpose: build intelligent products that simplify how businesses operate, using AI that sits inside the work rather than alongside it.</p>
            <p className="lead" style={{ marginTop: "16px" }}>We are at the beginning of a long build. Hybent Hiring, our AI recruitment platform, is live today. Everything that follows will share the same platform, the same data model and the same design language — so each product makes the one before it more useful. We started with hiring because it is where every company's next decade begins.</p>
            <div style={{ display: "flex", gap: "12px", marginTop: "32px", flexWrap: "wrap" }}>
              <a className="btn btn-ghost" href="/platform/ecosystem">How the platform works</a>
              <a className="link-arrow" href="/about/timeline" style={{ alignSelf: "center", marginLeft: "6px" }}>Our story <svg width="15" height="15" aria-hidden="true"><use href="#i-arrow" /></svg></a>
            </div>
          </div>
          <div className="grid g2" data-rv="right">
            <article className="card"><div className="card__glow" style={{ top: "-40px", left: "-40px" }}></div>
              <span className="icon-tile"><svg aria-hidden="true"><use href="#i-layers" /></svg></span>
              <h3 className="h-sm" style={{ margin: "16px 0 8px" }}>One data layer</h3>
              <p className="small">A candidate today is an employee tomorrow. Defined once, governed once, carried forward.</p>
            </article>
            <article className="card"><div className="card__glow" style={{ top: "-40px", right: "-40px" }}></div>
              <span className="icon-tile"><svg aria-hidden="true"><use href="#i-ai" /></svg></span>
              <h3 className="h-sm" style={{ margin: "16px 0 8px" }}>AI in the workflow</h3>
              <p className="small">Not a chat box bolted on the side. Models that parse, screen, rank and draft inside the work itself.</p>
            </article>
            <article className="card"><div className="card__glow" style={{ bottom: "-40px", left: "-40px" }}></div>
              <span className="icon-tile"><svg aria-hidden="true"><use href="#i-shield" /></svg></span>
              <h3 className="h-sm" style={{ margin: "16px 0 8px" }}>Enterprise from day one</h3>
              <p className="small">Role-based access, audit trails and data controls designed in from the first release, not retrofitted.</p>
            </article>
            <article className="card"><div className="card__glow" style={{ bottom: "-40px", right: "-40px" }}></div>
              <span className="icon-tile"><svg aria-hidden="true"><use href="#i-plug" /></svg></span>
              <h3 className="h-sm" style={{ margin: "16px 0 8px" }}>Open by design</h3>
              <p className="small">Documented APIs, webhooks and clean exports. Your stack stays yours, and so does your data.</p>
            </article>
          </div>
        </div>
      </section>


      <section className="section">
        <div className="wrap">
          <div className="cta-band" data-rv="scale">
            <div className="split">
              <div data-rv="left">
                <img className="shot shot--team" src="/hybent/shot-team.webp" width="672" height="384" alt="A hiring team reviewing candidates together around a shared dashboard" loading="lazy" decoding="async" />
              </div>
              <div data-rv="right">
                <p className="eyebrow"><span className="bars"><i></i><i></i><i></i></span><span>Get started</span></p>
                <h2 className="h-lg">See what Hybent Hiring does to your pipeline</h2>
                <p className="lead" style={{ marginTop: "18px" }}>A working demo on your own roles, not a slide deck. Tell us how you hire today and we will show you the difference in twenty minutes.</p>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "30px" }}>
                  <a className="btn btn-primary btn-lg" href="/contact">Book a demo <svg className="arw" width="17" height="17" aria-hidden="true"><use href="#i-arrow" /></svg></a>
                  <a className="btn btn-ghost btn-lg" href="/products">Explore Hybent Hiring</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </SiteView>
  )
}
