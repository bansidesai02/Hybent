import { SiteView } from '../components/SiteView'

export default function AboutPage() {
  return (
    <SiteView route="about">
      <section className="hero">
        <div className="hero__orb orb-a" data-para="0.02"></div>
        <div className="hero__orb orb-b" data-para="-0.03"></div>

        <div className="wrap">
          <p className="eyebrow" data-rv="up"><span className="bars"><i></i><i></i><i></i></span><span>Company</span></p>
          <h1 style={{ fontSize: "clamp(2.35rem,4.6vw,3.6rem)", marginTop: "14px" }} data-rv="up" data-delay="80">An enterprise software company at the start of a long build</h1>
          <p className="hero__sub" data-rv="up" data-delay="160">What we are trying to do, the principles we hold to while doing it, and an honest account of how far along we actually are.</p>
        </div>
      </section>

      <section className="section section--tight-pt-none">
        <div className="wrap">
          <div className="grid g2" style={{ gap: "clamp(16px,2vw,24px)", marginBottom: "24px" }}>
            <article className="card" data-rv="left" style={{ padding: "clamp(28px,3.4vw,44px)" }}>
              <div className="card__glow" style={{ top: "-60px", left: "-40px" }}></div>
              <p className="eyebrow"><span className="icon-tile" style={{ width: "32px", height: "32px", borderRadius: "9px" }}><svg style={{ width: "15px", height: "15px" }} aria-hidden="true"><use href="#i-target" /></svg></span><span>Our mission</span></p>
              <h3 className="h-md">Build intelligent software products that simplify business operations using AI.</h3>
              <p className="lead" style={{ marginTop: "18px", fontSize: "1rem" }}>Not automation for its own sake. We look for the work people repeat, the decisions that should be consistent and the handoffs that lose information — and we build the software that removes them.</p>
            </article>
            <article className="card" data-rv="right" style={{ padding: "clamp(28px,3.4vw,44px)" }}>
              <div className="card__glow" style={{ top: "-60px", right: "-40px" }}></div>
              <p className="eyebrow"><span className="icon-tile" style={{ width: "32px", height: "32px", borderRadius: "9px" }}><svg style={{ width: "15px", height: "15px" }} aria-hidden="true"><use href="#i-eye" /></svg></span><span>Our vision</span></p>
              <h3 className="h-md">Build a global multi-product technology company.</h3>
              <p className="lead" style={{ marginTop: "18px", fontSize: "1rem" }}>One platform, many products, one standard of engineering. We intend to earn that position one release at a time, and we will never claim a product exists before it does.</p>
            </article>
          </div>
            <div className="figrow" data-rv="up">
              <div className="figpanel">
                <svg className="fig" viewBox="0 0 880 200" role="img" aria-label="From one live product today to a multi-product ecosystem: Hybent Hiring runs on a shared platform that every future product will inherit">
                  <path d="M120 100h620" stroke="var(--border)" strokeWidth="1.6" />
                  <g>
                    <rect x="60" y="70" width="128" height="60" rx="15" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="1.6" />
                    <circle cx="88" cy="100" r="6" fill="var(--success)" />
                    <text x="106" y="96" fontFamily="Sora" fontSize="13" fontWeight="600" fill="var(--text)">Hybent</text>
                    <text x="106" y="112" fontFamily="Sora" fontSize="13" fontWeight="600" fill="var(--text)">Hiring</text>
                    <text x="124" y="150" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9" letterSpacing="1.3" fill="var(--dim)">LIVE TODAY</text>
                  </g>
                  <g>
                    <rect x="330" y="74" width="220" height="52" rx="14" fill="url(#hbgh)" opacity=".16" stroke="var(--border-strong)" strokeWidth="1.6" />
                    <text x="440" y="105" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="10.5" letterSpacing="1.6" fill="var(--text)">SHARED PLATFORM</text>
                    <text x="440" y="150" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9" letterSpacing="1.3" fill="var(--dim)">IDENTITY · DATA · WORKFLOW · AUDIT</text>
                  </g>
                  <g stroke="var(--border-strong)" strokeWidth="1.5" fill="none" opacity=".8">
                    <path d="M700 100l52-32M700 100h52M700 100l52 32" />
                  </g>
                  <g fill="var(--surface)" stroke="var(--border)" strokeWidth="1.6" strokeDasharray="5 5">
                    <rect x="752" y="50" width="82" height="34" rx="11" /><rect x="752" y="83" width="82" height="34" rx="11" /><rect x="752" y="116" width="82" height="34" rx="11" />
                  </g>
                  <g fontFamily="Sora" fontSize="11.5" fill="var(--dim)" textAnchor="middle">
                    <text x="793" y="105">Hybent Hiring</text>
                  </g>
                  <text x="793" y="170" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9" letterSpacing="1.3" fill="var(--dim)">PRODUCT</text>
                </svg>
              </div>
            </div>

          <div className="section-head" data-rv="up" style={{ marginTop: "clamp(48px,6vw,80px)" }}>
            <p className="eyebrow" style={{ justifyContent: "center" }}><span className="bars"><i></i><i></i><i></i></span><span>Core values</span></p>
            <h2 className="h-lg">Six principles that survive contact with a deadline</h2>
          </div>
          <div className="grid g3">
            <article className="card" data-rv="up"><h3 className="h-sm">Ship the unglamorous half</h3><p className="small" style={{ marginTop: "10px" }}>The demo is the easy part. Migration, permissions and edge cases are where the product actually lives.</p></article>
            <article className="card" data-rv="up" data-delay="70"><h3 className="h-sm">Say what is true</h3><p className="small" style={{ marginTop: "10px" }}>Shipped is shipped, planned is planned. We would rather look smaller than sound bigger than we are.</p></article>
            <article className="card" data-rv="up" data-delay="140"><h3 className="h-sm">The data belongs to the customer</h3><p className="small" style={{ marginTop: "10px" }}>We hold it, we protect it, and we hand it back on request without friction or fine print.</p></article>
            <article className="card" data-rv="up" data-delay="210"><h3 className="h-sm">Design once, use everywhere</h3><p className="small" style={{ marginTop: "10px" }}>A pattern learned in one product works in the next. Consistency is a feature with compounding returns.</p></article>
            <article className="card" data-rv="up" data-delay="280"><h3 className="h-sm">Automate, then explain</h3><p className="small" style={{ marginTop: "10px" }}>Every AI-assisted decision shows its inputs and its evidence. If we cannot explain it, we do not ship it.</p></article>
            <article className="card" data-rv="up" data-delay="350"><h3 className="h-sm">Hire for the decade</h3><p className="small" style={{ marginTop: "10px" }}>We build deliberately, and we keep the people who care how the work ages.</p></article>
          </div>
        </div>
      </section>

      {/* ── Founder's Note ─────────────────────────────────────────────────── */}
      <section className="section" id="founder">
        <div className="wrap">
          <div className="split" style={{ alignItems: "center" }}>
            <div data-rv="left">
              <p className="eyebrow"><span className="bars"><i></i><i></i><i></i></span><span>Founder&rsquo;s Note</span></p>
              <h2 className="h-lg">Built with empathy for the recruiter&rsquo;s craft</h2>
              <p className="lead" style={{ marginTop: "20px" }}>
                Technology should amplify human intuition, not bury it in administrative noise.
              </p>
              <p className="small" style={{ marginTop: "14px" }}>
                Every hiring decision shapes an organization&rsquo;s destiny. Yet recruiters spend up to 70% of their day sorting resumes, coordinating schedules, and updating spreadsheets instead of having meaningful conversations with exceptional talent.
              </p>
              <p className="small" style={{ marginTop: "14px" }}>
                Hybent was born from that exact frustration. We set out to build an AI-first co-pilot that handles the repetitive, heavy lifting with surgical precision &mdash; giving recruiters back their time to build authentic connections and make confident hiring decisions.
              </p>
            </div>

            <div data-rv="right">
              <div className="card card--flat quote" style={{ padding: "clamp(28px, 3.4vw, 44px)", position: "relative" }}>
                <div className="card__glow" style={{ top: "-50px", right: "-30px" }}></div>
                <span className="quote__mark" aria-hidden="true">&ldquo;</span>
                <p style={{ fontSize: "1.05rem", lineHeight: "1.75" }}>
                  I didn&rsquo;t want to build just another HR tool. I wanted to build the thing I
                  wish existed &mdash; a recruiter&rsquo;s co-pilot that handles the boring parts so
                  humans can focus on the human parts.
                </p>
                <footer>
                  <span className="avatar" aria-hidden="true" style={{ background: "linear-gradient(135deg, var(--cyan), var(--violet))", width: "42px", height: "42px", borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: 700, fontSize: "0.95rem", color: "#fff" }}>HH</span>
                  <div>
                    <b>Founder &amp; CEO</b>
                    <span>Hybent Technologies</span>
                  </div>
                </footer>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section section--tight-pt-none" id="timeline">
        <div className="wrap split" style={{ alignItems: "start" }}>
          <div data-rv="left">
            <p className="eyebrow"><span className="bars"><i></i><i></i><i></i></span><span>Our story</span></p>
            <h2 className="h-lg">We built the unglamorous half first</h2>
            <p className="lead" style={{ marginTop: "22px" }}>HYBENT began with a simple observation: good candidates were being lost to slow, manual process. Everything since has been an argument for building the platform layer before the product that sits on it.</p>
            <a className="btn btn-ghost" href="/careers" style={{ marginTop: "28px" }}>Join our team</a>
          </div>
          <ol className="tl" data-rv="right">
            <li className="tl__item"><p className="tl__yr">Start</p><h4>HYBENT is founded</h4><p className="small">An enterprise software company built around one idea: simplify how businesses operate, using AI.</p></li>
            <li className="tl__item"><p className="tl__yr">Foundation</p><h4>Platform before product</h4><p className="small">Identity, permissions, workflow and audit built first — the layer every future product would depend on.</p></li>
            <li className="tl__item"><p className="tl__yr">Build</p><h4>Hybent Hiring takes shape</h4><p className="small">Resume parsing, AI screening and interview management designed alongside recruiters, and rewritten until it held up.</p></li>
            <li className="tl__item"><p className="tl__yr">Launch</p><h4>Hybent Hiring goes live</h4><p className="small">Our first product ships as an AI recruitment platform for teams that hire continuously.</p></li>
            <li className="tl__item" data-now=""><p className="tl__yr">Now</p><h4>Growing with our first customers</h4><p className="small">Onboarding early customers, shipping weekly, and enhancing the recruiter experience.</p></li>
            <li className="tl__item"><p className="tl__yr">Next</p><h4>Continuous Innovation</h4><p className="small">Enhancing Hybent Hiring with deeper AI screening, recruiter copilot features, and enterprise capabilities.</p></li>
          </ol>
        </div>
      </section>

      <section className="section section--tight-pt-none">
        <div className="wrap">
          <div className="split" style={{ alignItems: "start" }}>
            <div data-rv="left">
              <p className="eyebrow"><span className="bars"><i></i><i></i><i></i></span><span>Where we are</span></p>
              <h2 className="h-md">Company milestones</h2>
              <p className="small" style={{ marginTop: "14px", maxWidth: "44ch" }}>We would rather show progress than badges. This space will hold recognition when it has actually been earned.</p>
              <div className="grid" style={{ gap: "12px", marginTop: "26px" }}>
                <article className="card" style={{ display: "flex", gap: "16px", alignItems: "center", padding: "20px 22px" }}>
                  <span className="icon-tile"><svg aria-hidden="true"><use href="#i-award" /></svg></span>
                  <span><h3 className="h-sm">First product live</h3><p className="small">Hybent Hiring is in production with our earliest customers</p></span></article>
                <article className="card" style={{ display: "flex", gap: "16px", alignItems: "center", padding: "20px 22px" }}>
                  <span className="icon-tile"><svg aria-hidden="true"><use href="#i-zap" /></svg></span>
                  <span><h3 className="h-sm">AI-first development</h3><p className="small">Every product built on the same AI and platform foundation</p></span></article>
                <article className="card" style={{ display: "flex", gap: "16px", alignItems: "center", padding: "20px 22px" }}>
                  <span className="icon-tile"><svg aria-hidden="true"><use href="#i-heart" /></svg></span>
                  <span><h3 className="h-sm">Growing team, growing ecosystem</h3><p className="small">Hiring engineers and designers to build what comes after Hybent Hiring</p></span></article>
              </div>
            </div>

            <div data-rv="right">
              <p className="eyebrow"><span className="bars"><i></i><i></i><i></i></span><span>Our base</span></p>
              <h2 className="h-md">Built in India, for teams anywhere</h2>
              <div className="globe" style={{ marginTop: "22px" }}>
                <svg viewBox="0 0 420 200" role="img" aria-label="Illustrative world map">
                  <g fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="1">
                    <path d="M40 70 L70 52 L110 60 L128 84 L104 120 L70 130 L44 104Z" />
                    <path d="M112 128 L138 122 L150 150 L136 182 L118 168Z" />
                    <path d="M186 44 L232 38 L246 58 L224 74 L192 68Z" />
                    <path d="M196 84 L232 78 L248 108 L232 154 L206 148 L192 116Z" />
                    <path d="M258 52 L300 46 L332 62 L322 96 L286 104 L262 82Z" />
                    <path d="M330 130 L372 124 L384 152 L356 170 L332 156Z" />
                  </g>
                  <g>
                    <circle className="pin" cx="272" cy="92" r="3.4" /><circle className="pin-ring" cx="272" cy="92" r="3" />
                    <circle className="pin" cx="204" cy="56" r="3" /><circle className="pin-ring" cx="204" cy="56" r="3" style={{ animationDelay: ".8s" }} />
                    <circle className="pin" cx="78" cy="78" r="3" /><circle className="pin-ring" cx="78" cy="78" r="3" style={{ animationDelay: "1.6s" }} />
                    <circle className="pin" cx="356" cy="146" r="3" /><circle className="pin-ring" cx="356" cy="146" r="3" style={{ animationDelay: "2.4s" }} />
                  </g>
                </svg>
              </div>
              <div style={{ marginTop: "20px" }}>
                <div className="region"><b>Ahmedabad, India</b><span>Headquarters · engineering, product &amp; design</span></div>
                <div className="region"><b>India</b><span>Our primary market today</span></div>
                <div className="region"><b>Remote</b><span>Distributed team on IST core hours</span></div>
                <div className="region"><b>Worldwide</b><span>Hybent Hiring is available to teams in any region</span></div>
                <div className="region"><b>Expansion</b><span>EMEA and Americas presence — planned</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </SiteView>
  )
}
