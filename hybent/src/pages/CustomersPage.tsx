export default function CustomersPage() {
  return (
    <div className="route route--on" data-route="customers">
      <section className="hero">
        <div className="hero__orb orb-a" data-para="0.02"></div>
        <div className="hero__orb orb-b" data-para="-0.03"></div>

        <div className="wrap">
          <p className="eyebrow" data-rv="up"><span className="bars"><i></i><i></i><i></i></span><span>Customers</span></p>
          <h1 style={{ fontSize: "clamp(2.35rem,4.6vw,3.6rem)", marginTop: "14px" }} data-rv="up" data-delay="80">What changes, who helps, and what it connects to</h1>
          <p className="hero__sub" data-rv="up" data-delay="160">The outcomes Hybent Hiring is built to produce, the support you get while we are still small, and the systems it plugs into on the way in and out.</p>
        </div>
      </section>

      <section className="section section--tight-pt-none">
        <div className="wrap">
          <div className="split" style={{ marginBottom: "clamp(40px,5vw,64px)" }}>
            <div data-rv="left">
              <p className="eyebrow"><span className="bars"><i></i><i></i><i></i></span><span>Customer success</span></p>
              <h2 className="h-lg">A launch plan, not just a login</h2>
              <p className="lead" style={{ marginTop: "22px" }}>While we are early, that is an advantage for you. Every customer works directly with the team building Hybent Hiring: a named contact through go-live, a written rollout plan, and a review against the goals you set at kickoff.</p>
            </div>
            <div className="grid g2" data-rv="right">
              <div className="card card--flat stat"><b>Guided</b><span>Onboarding run with our team, not a help article</span></div>
              <div className="card card--flat stat"><b>Named</b><span>One contact who owns your rollout</span></div>
              <div className="card card--flat stat"><b>Direct</b><span>Access to the people writing the code</span></div>
              <div className="card card--flat stat"><b>Open</b><span>Early customers shape what ships next</span></div>
            </div>
          </div>

          <div className="grid g3">
            <blockquote className="card quote" data-rv="up">
              <p className="quote__mark">&ldquo;</p>
              <p>Screening used to take a full week per role. Hybent Hiring reads every résumé against the same rubric and hands us a shortlist we can defend to the hiring manager.</p>
              <footer><span className="avatar">S1</span><span><b>Sample testimonial</b><span>Placeholder — awaiting our first customer quote</span></span></footer>
            </blockquote>
            <blockquote className="card quote" data-rv="up" data-delay="90">
              <p className="quote__mark">&ldquo;</p>
              <p>What convinced us was not the AI. It was that every rejection now has a written reason attached to it, and we can show that reason to anyone who asks.</p>
              <footer><span className="avatar">S2</span><span><b>Sample testimonial</b><span>Placeholder — awaiting our first customer quote</span></span></footer>
            </blockquote>
            <blockquote className="card quote" data-rv="up" data-delay="180">
              <p className="quote__mark">&ldquo;</p>
              <p>We hire across two locations in three languages. The candidate portal alone ended most of the “where am I in the process” emails our recruiters were answering by hand.</p>
              <footer><span className="avatar">S3</span><span><b>Sample testimonial</b><span>Placeholder — awaiting our first customer quote</span></span></footer>
            </blockquote>
          </div>
        </div>
      </section>

      <section className="section section--tight section--tight-pt-none" id="cases">
        <div className="wrap">
          <div className="section-head" data-rv="up">
            <p className="eyebrow"><span className="bars"><i></i><i></i><i></i></span><span>Illustrative outcomes</span></p>
            <h2 className="h-lg">What Hybent Hiring is built to change</h2>
          </div>
          <div className="grid g3">
            <article className="card case" data-rv="up">
              <div className="case__viz">
                <svg viewBox="0 0 300 150" preserveAspectRatio="none" aria-hidden="true"><path d="M0 120 L50 108 L100 88 L150 74 L200 48 L250 34 L300 18" fill="none" stroke="url(#lg)" strokeWidth="2.4" /><path d="M0 120 L50 108 L100 88 L150 74 L200 48 L250 34 L300 18 L300 150 L0 150Z" fill="url(#lg)" opacity=".12" /></svg>
                <b>Speed</b>
              </div>
              <h4>Take the hours out of manual résumé review</h4>
              <p className="small">Every application is parsed on arrival and scored against one rubric, so recruiters spend their time on the shortlist instead of the pile behind it.</p>
              <ul><li><strong>One</strong><span>Rubric per role</span></li><li><strong>Auto</strong><span>Resume parsing</span></li><li><strong>Every</strong><span>Score evidenced</span></li></ul>
            </article>
            <article className="card case" data-rv="up" data-delay="90">
              <div className="case__viz case__viz--b">
                <svg viewBox="0 0 300 150" preserveAspectRatio="none" aria-hidden="true"><g fill="url(#lg)" opacity=".55"><rect x="24" y="96" width="26" height="54" rx="4" /><rect x="72" y="78" width="26" height="72" rx="4" /><rect x="120" y="58" width="26" height="92" rx="4" /><rect x="168" y="40" width="26" height="110" rx="4" /><rect x="216" y="22" width="26" height="128" rx="4" /></g></svg>
                <b>Structure</b>
              </div>
              <h4>Make interviews comparable, not conversational</h4>
              <p className="small">Structured scorecards and AI interview assistance mean two interviewers rate the same candidate against the same competencies — and the record holds up months later.</p>
              <ul><li><strong>One</strong><span>Shared scorecard</span></li><li><strong>Live</strong><span>Note capture</span></li><li><strong>Full</strong><span>Decision history</span></li></ul>
            </article>
            <article className="card case" data-rv="up" data-delay="180">
              <div className="case__viz case__viz--c">
                <svg viewBox="0 0 300 150" aria-hidden="true"><circle cx="150" cy="75" r="52" fill="none" stroke="url(#lg)" strokeWidth="9" opacity=".2" /><circle cx="150" cy="75" r="52" fill="none" stroke="url(#lg)" strokeWidth="9" strokeLinecap="round" strokeDasharray="245 327" transform="rotate(-90 150 75)" /></svg>
                <b>Clarity</b>
              </div>
              <h4>Stop losing good candidates to silence</h4>
              <p className="small">A candidate portal with automatic status updates keeps applicants informed without a recruiter writing another individual email.</p>
              <ul><li><strong>Auto</strong><span>Status updates</span></li><li><strong>24/7</strong><span>Candidate portal</span></li><li><strong>Zero</strong><span>Chasing emails</span></li></ul>
            </article>
          </div>
        </div>
      </section>

      <section className="section section--tight section--tight-pt-none">
        <div className="wrap">
          <div className="section-head" data-rv="up">
            <p className="eyebrow" style={{ justifyContent: "center" }}><span className="bars"><i></i><i></i><i></i></span><span>Integrations</span></p>
            <h2 className="h-md">Designed to fit the stack you already run</h2>
            <p className="lead">Hybent Hiring connects through documented APIs and webhooks, with connectors rolling out across identity, calendars, job boards and e-signature. Tell us what you use and we will tell you honestly where it sits on the list.</p>
          </div>
        </div>
        <div className="figrow" data-rv="up"><div className="figpanel"><svg className="fig" role="img" aria-label="Hybent Hiring connecting to single sign-on, calendars, job boards, e-signature, background checks and webhooks" viewBox="0 0 460 240" width="460" height="240">
            <g stroke="var(--border-strong)" strokeWidth="1.4" fill="none">
              <path d="M230 120L96 56M230 120L364 56M230 120L64 120M230 120L396 120M230 120L96 184M230 120L364 184" /></g>
            <g>
              <circle cx="230" cy="120" r="46" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="1.6" />
              <circle cx="230" cy="120" r="30" fill="url(#hbg)" opacity=".16" />
              <text x="230" y="116" textAnchor="middle" fontFamily="Sora" fontSize="12" fontWeight="600" fill="var(--text)">Hybent</text>
              <text x="230" y="132" textAnchor="middle" fontFamily="Sora" fontSize="12" fontWeight="600" fill="var(--text)">Hiring</text>
            </g>
            <g fontFamily="IBM Plex Mono" fontSize="7.5" letterSpacing="1.1" textAnchor="middle">
              <g fill="var(--surface)" stroke="var(--border-strong)">
                <rect x="36" y="40" width="120" height="32" rx="11" /><rect x="304" y="40" width="120" height="32" rx="11" />
                <rect x="4" y="104" width="120" height="32" rx="11" /><rect x="336" y="104" width="120" height="32" rx="11" />
                <rect x="36" y="168" width="120" height="32" rx="11" /><rect x="304" y="168" width="120" height="32" rx="11" />
              </g>
              <g fill="var(--muted)">
                <text x="96" y="60">SINGLE SIGN-ON</text><text x="364" y="60">CALENDAR SYNC</text>
                <text x="64" y="124">JOB BOARDS</text><text x="396" y="124">E-SIGNATURE</text>
                <text x="96" y="188">BACKGROUND CHECKS</text><text x="364" y="188">REST &amp; WEBHOOKS</text>
              </g>
            </g>
          </svg></div></div>
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
        <div className="marquee marquee--slow marquee--rev" data-rv="up">
          <div className="marquee__track">
            <span className="marquee__item"><svg aria-hidden="true"><use href="#i-brief" /></svg>Job boards</span>
            <span className="marquee__item"><svg aria-hidden="true"><use href="#i-target" /></svg>Careers page</span>
            <span className="marquee__item"><svg aria-hidden="true"><use href="#i-shield" /></svg>Background checks</span>
            <span className="marquee__item"><svg aria-hidden="true"><use href="#i-wallet" /></svg>Payroll handoff</span>
            <span className="marquee__item"><svg aria-hidden="true"><use href="#i-db" /></svg>Data export</span>
            <span className="marquee__item"><svg aria-hidden="true"><use href="#i-plug" /></svg>REST &amp; webhooks</span>
            <span className="marquee__item" aria-hidden="true"><svg><use href="#i-brief" /></svg>Job boards</span>
            <span className="marquee__item" aria-hidden="true"><svg><use href="#i-target" /></svg>Careers page</span>
            <span className="marquee__item" aria-hidden="true"><svg><use href="#i-shield" /></svg>Background checks</span>
            <span className="marquee__item" aria-hidden="true"><svg><use href="#i-wallet" /></svg>Payroll handoff</span>
            <span className="marquee__item" aria-hidden="true"><svg><use href="#i-db" /></svg>Data export</span>
            <span className="marquee__item" aria-hidden="true"><svg><use href="#i-plug" /></svg>REST &amp; webhooks</span>
          </div>
        </div>
      </section>
    </div>
  )
}
