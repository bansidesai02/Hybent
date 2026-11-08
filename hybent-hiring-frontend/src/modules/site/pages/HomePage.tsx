import { SiteView } from '../components/SiteView'
import { AskAiSection } from '../components/AskAiSection'
import { SHOW_SERVICES } from '@/app/paths'
import HeroRibbons from '../components/HeroRibbons'
import CandidateJourney from '../components/CandidateJourney'
import HomeScrollFx from '../components/HomeScrollFx'
import CopilotScroll from '../components/CopilotScroll'
import HeroFilm from '../components/HeroFilm'

export default function HomePage() {
  return (
    <SiteView route="index">
      <HomeScrollFx />
      <section className="hero" id="top">
        <div className="hero__orb orb-a" data-para="0.02"></div>
        <div className="hero__orb orb-b" data-para="-0.03"></div>
        <div className="hero__orb orb-c" data-para="0.015"></div>
        <HeroRibbons />

        <div className="wrap hero__grid">
          <div>

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

            {SHOW_SERVICES ? (
              <p className="hero__sub" data-rv="up" data-delay="160">HYBENT builds intelligent products and delivers technology services that help businesses innovate, grow, and scale. Hybent Hiring, our flagship AI recruitment platform, is the first step in a long-term ecosystem of innovative business software designed to help organizations hire, scale, and succeed.</p>
            ) : (
              <p className="hero__sub" data-rv="up" data-delay="160">HYBENT builds intelligent products that help businesses innovate, grow, and scale. Hybent Hiring, our flagship AI recruitment platform, is the first step in a long-term ecosystem of innovative business software designed to help organizations hire, scale, and succeed.</p>
            )}

            <div className="hero__actions" data-rv="up" data-delay="240">
              <a className="btn btn-primary btn-lg" href="/hybent-hiring">Explore Hybent Hiring <svg className="arw" width="17" height="17" aria-hidden="true"><use href="#i-arrow" /></svg></a>
            </div>
          </div>

          <HeroFilm />
        </div>
      </section>

      <section className="section section--tight section--tight-pt-none" aria-label="Hybent Hiring capabilities">
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
          <div className="product-stack" style={{ maxWidth: '880px', margin: '0 auto' }}>
            {/* Recruiter Copilot, played out as you scroll. */}
            <CopilotScroll />

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

          <CandidateJourney />
        </div>
      </section>

      <section className="section section--tight">
        <div className="wrap">
          <div className="section-head" data-rv="up">
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
              <p className="small">Guided import, sensible defaults and ready-made rubrics by role type. Hybent Hiring is designed to run a live requisition without a services project.</p>
              <div className="mini" aria-hidden="true">
                <div className="mini__row"><span className="mini__file">candidates.csv</span><span className="mini__ok">Imported</span></div>
                <div className="mini__bar"><i style={{ width: '100%' }} /></div>
                <div className="mini__row mini__row--dim"><span>Rubric · Backend Engineer</span><span className="mini__ok">Ready</span></div>
              </div></article>
            <article className="card" data-rv="up" data-delay="90"><span className="icon-tile"><svg viewBox="0 0 96 96" aria-hidden="true">
      
            <rect x="30" y="30" width="36" height="36" rx="9" fill="none" stroke="url(#hbgh)" strokeWidth="3" />
            <rect x="41" y="41" width="14" height="14" rx="4" fill="url(#hbgh)" />
            <g stroke="url(#hbgh)" strokeWidth="2.6" strokeLinecap="round">
              <path d="M40 22v8M56 22v8M40 66v8M56 66v8M22 40h8M22 56h8M66 40h8M66 56h8" /></g>
          </svg></span>
              <h3 className="h-sm" style={{ margin: "18px 0 9px" }}>AI-first, not AI-added</h3>
              <p className="small">Parsing, screening and ranking are the product, not a feature we bolted onto a legacy workflow after the fact.</p>
              <div className="mini" aria-hidden="true">
                <div className="mini__cand"><span className="mini__av" />A. Raman<span className="mini__score">94</span></div>
                <div className="mini__cand"><span className="mini__av mini__av--b" />J. Okafor<span className="mini__score">88</span></div>
                <div className="mini__cand"><span className="mini__av mini__av--c" />M. Alvarez<span className="mini__score mini__score--mid">71</span></div>
              </div></article>
            <article className="card" data-rv="up" data-delay="180"><span className="icon-tile"><svg viewBox="0 0 96 96" aria-hidden="true">
      
            <path d="M28 42v24a3 3 0 003 3h34a3 3 0 003-3V42" fill="none" stroke="url(#hbgh)" strokeWidth="3" strokeLinecap="round" />
            <path d="M48 58V26M38 36l10-10 10 10" fill="none" stroke="url(#hbgh)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg></span>
              <h3 className="h-sm" style={{ margin: "18px 0 9px" }}>Your data, portable</h3>
              <p className="small">Full export in open formats, whenever you ask. Staying with us should be a choice you keep making.</p>
              <div className="mini" aria-hidden="true">
                <div className="mini__chips"><span>XLSX</span><span>CSV</span><span>PDF</span></div>
                <div className="mini__row mini__row--dim"><span>Full workspace export</span><span className="mini__ok">Ready</span></div>
              </div></article>
            <article className="card" data-rv="up" data-delay="270"><span className="icon-tile"><svg viewBox="0 0 96 96" aria-hidden="true">
      
            <rect x="24" y="30" width="48" height="34" rx="9" fill="none" stroke="url(#hbgh)" strokeWidth="3" />
            <path d="M38 64l-4 10 12-10" fill="none" stroke="url(#hbgh)" strokeWidth="3" strokeLinejoin="round" />
            <g stroke="url(#hbgh)" strokeWidth="2.8" strokeLinecap="round"><path d="M36 44h6M52 44h8M36 53h20" /></g>
          </svg></span>
              <h3 className="h-sm" style={{ margin: "18px 0 9px" }}>Access to the builders</h3>
              <p className="small">You talk to the people writing the code. Early customers shape what we ship next, and we say so publicly.</p>
              <div className="mini" aria-hidden="true">
                <div className="mini__msg">Can we get Slack alerts for new applicants?</div>
                <div className="mini__msg mini__msg--team"><b>Hybent team</b>On it. Shipping this Friday.</div>
              </div></article>
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
                <text y="4" textAnchor="middle" fontFamily="Figtree" fontSize="13" fontWeight="600" fill="var(--text)">94</text>
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
            <g fontFamily="Geist Mono" fontSize="8" letterSpacing="1.3" fill="var(--dim)" textAnchor="middle">
              <text x="60" y="142">APPLY</text><text x="182" y="142">PARSE</text><text x="304" y="142">SCREEN</text>
              <text x="426" y="142">SHORTLIST</text><text x="548" y="142">INTERVIEW</text><text x="655" y="142">OFFER</text>
            </g>
            <g fontFamily="Geist Mono" fontSize="7.5" letterSpacing="1" fill="var(--cyan)" textAnchor="middle">
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
              <a className="btn btn-ghost" href="/hybent-hiring">See how Hybent Hiring works</a>
              <a className="link-arrow" href="/about/story" style={{ alignSelf: "center", marginLeft: "6px" }}>Our story <svg width="15" height="15" aria-hidden="true"><use href="#i-arrow" /></svg></a>
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

      <AskAiSection />

      <section className="section">
        <div className="wrap">
          <div className="cta-band" data-rv="scale">
            <div className="split">
              <div data-rv="left">
                <div className="shot-float">
                  <img className="shot shot--team" src="/hybent/shot-team.webp" width="1024" height="687" alt="A recruiter and her hiring team reviewing candidates together on Hybent Hiring" loading="lazy" decoding="async" />
                  {/* Small product moments floating over the photo. */}
                  <div className="float-card float-card--a" aria-hidden="true">
                    <span className="float-card__icon float-card__icon--ok">&#10003;</span>
                    <span><b>48 resumes screened</b><small>Senior Backend Engineer</small></span>
                  </div>
                  <div className="float-card float-card--b" aria-hidden="true">
                    <span className="float-card__icon">&#9719;</span>
                    <span><b>Interview booked</b><small>Today · 11:00</small></span>
                  </div>
                  <div className="float-card float-card--c" aria-hidden="true">
                    <span className="float-card__score">94</span>
                    <span><b>Top match</b><small>A. Raman · AI score</small></span>
                  </div>
                </div>
              </div>
              <div data-rv="right">
                <p className="eyebrow"><span className="bars"><i></i><i></i><i></i></span><span>Get started</span></p>
                <h2 className="h-lg">See what Hybent Hiring does to your pipeline</h2>
                <p className="lead" style={{ marginTop: "18px" }}>Try it on your own roles, not a slide deck. Start a 7-day free trial with your team: no card required.</p>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "30px" }}>
                  <a className="btn btn-primary btn-lg" href="/free-trial">Start 7-day free trial <svg className="arw" width="17" height="17" aria-hidden="true"><use href="#i-arrow" /></svg></a>
                  <a className="btn btn-ghost btn-lg" href="/hybent-hiring">Explore Hybent Hiring</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </SiteView>
  )
}
