export default function CareersPage() {
  return (
    <div className="route route--on" data-route="careers">
      <section className="hero">
        <div className="hero__orb orb-a" data-para="0.02"></div>
        <div className="hero__orb orb-b" data-para="-0.03"></div>

        <div className="wrap">
          <p className="eyebrow" data-rv="up"><span className="bars"><i></i><i></i><i></i></span><span>Careers</span></p>
          <h1 style={{ fontSize: "clamp(2.35rem,4.6vw,3.6rem)", marginTop: "14px" }} data-rv="up" data-delay="80">Join early enough to shape what we build</h1>
          <p className="hero__sub" data-rv="up" data-delay="160">Every product that comes after Hybent Hiring depends on decisions we are making in the platform right now. If that sounds like the interesting problem rather than the tedious one, we should talk.</p>
        </div>
      </section>

      <section className="section section--tight-pt-none" id="careers">
        <div className="wrap">    <div style={{ marginBottom: "clamp(28px,4vw,48px)" }} data-rv="up"><img className="shot shot--art" src="/assets/shot-art.webp" width="760" height="1013" alt="Illustration of an AI-assisted software workspace with analytics, tasks and team members" loading="lazy" decoding="async" /></div>
          <div className="grid" style={{ gap: "12px" }} data-rv="up">
            <a className="role" href="/contact"><span><h4>Full-Stack Engineer, Hybent Hiring</h4><p className="mono">Ahmedabad · Hybrid · Engineering</p></span><svg className="arw" width="18" height="18" aria-hidden="true"><use href="#i-arrow" /></svg></a>
            <a className="role" href="/contact"><span><h4>AI/ML Engineer, Screening &amp; Parsing</h4><p className="mono">Ahmedabad or Remote · Engineering</p></span><svg className="arw" width="18" height="18" aria-hidden="true"><use href="#i-arrow" /></svg></a>
            <a className="role" href="/contact"><span><h4>Product Designer</h4><p className="mono">Ahmedabad or Remote · Design</p></span><svg className="arw" width="18" height="18" aria-hidden="true"><use href="#i-arrow" /></svg></a>
            <a className="role" href="/contact"><span><h4>Founding Account Executive</h4><p className="mono">Ahmedabad · Hybrid · Sales</p></span><svg className="arw" width="18" height="18" aria-hidden="true"><use href="#i-arrow" /></svg></a>
            <a className="role" href="/contact"><span><h4>Customer Success Manager</h4><p className="mono">Ahmedabad or Remote · Customer</p></span><svg className="arw" width="18" height="18" aria-hidden="true"><use href="#i-arrow" /></svg></a>
            <a className="role" href="/contact"><span><h4>QA &amp; Release Engineer</h4><p className="mono">Ahmedabad · Hybrid · Engineering</p></span><svg className="arw" width="18" height="18" aria-hidden="true"><use href="#i-arrow" /></svg></a>
          </div>
          <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", marginTop: "26px" }} data-rv="up">
            <a className="btn btn-primary" href="/contact">See all open roles <svg className="arw" width="16" height="16" aria-hidden="true"><use href="#i-arrow" /></svg></a>
            <a className="btn btn-ghost" href="/contact">Join our talent network</a>
          </div>
        </div>
      </section>

      <section className="section section--tight section--tight-pt-none">
        <div className="wrap">
          <div className="section-head" data-rv="up">
            <p className="eyebrow" style={{ justifyContent: "center" }}><span className="bars"><i></i><i></i><i></i></span><span>Culture</span></p>
            <h2 className="h-md">How we work</h2>
          </div>
          <div className="figrow" data-rv="up"><div className="figpanel"><svg className="fig" role="img" aria-label="Decisions written down with the rejected options kept on the record, reviewed by the team" viewBox="0 0 420 240" width="420" height="240">
            <rect x="120" y="24" width="180" height="196" rx="14" fill="var(--surface)" stroke="var(--border-strong)" />
            <rect x="104" y="36" width="180" height="196" rx="14" fill="var(--surface)" stroke="var(--border-strong)" />
            <rect x="88" y="48" width="180" height="184" rx="14" fill="var(--surface)" stroke="var(--border-strong)" />
            <g>
              <rect x="108" y="70" width="88" height="8" rx="4" fill="url(#hbgh)" />
              <rect x="108" y="92" width="140" height="5" rx="2.5" fill="var(--border-strong)" />
              <rect x="108" y="106" width="118" height="5" rx="2.5" fill="var(--border)" />
              <rect x="108" y="120" width="132" height="5" rx="2.5" fill="var(--border)" />
              <rect x="108" y="146" width="60" height="14" rx="7" fill="var(--success)" opacity=".16" />
              <path d="M117 153l3 3 6-7" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" />
              <text x="132" y="157" fontFamily="IBM Plex Mono" fontSize="7" letterSpacing=".8" fill="var(--success)">CHOSEN</text>
              <rect x="108" y="168" width="76" height="14" rx="7" fill="var(--border)" />
              <text x="116" y="179" fontFamily="IBM Plex Mono" fontSize="7" letterSpacing=".8" fill="var(--dim)">REJECTED ×2</text>
              <rect x="108" y="196" width="104" height="5" rx="2.5" fill="var(--border)" />
            </g>
            <g transform="translate(296,120)">
              <circle cx="24" cy="24" r="24" fill="var(--surface)" stroke="var(--border-strong)" />
              <circle cx="24" cy="18" r="8" fill="url(#hbg)" opacity=".8" />
              <path d="M11 37a13 13 0 0126 0" fill="url(#hbg)" opacity=".5" />
            </g>
            <g transform="translate(316,60)">
              <circle cx="20" cy="20" r="20" fill="var(--surface)" stroke="var(--border-strong)" />
              <circle cx="20" cy="15" r="6.6" fill="url(#hbg)" opacity=".55" />
              <path d="M9 31a11 11 0 0122 0" fill="url(#hbg)" opacity=".34" />
            </g>
            <g transform="translate(300,182)">
              <circle cx="18" cy="18" r="18" fill="var(--surface)" stroke="var(--border-strong)" />
              <circle cx="18" cy="14" r="6" fill="url(#hbg)" opacity=".42" />
              <path d="M8 29a10 10 0 0120 0" fill="url(#hbg)" opacity=".26" />
            </g>
          </svg></div></div>
          <div className="culture">
            <article className="card" data-rv="up"><span className="icon-tile"><svg aria-hidden="true"><use href="#i-doc" /></svg></span><h4>Written first</h4><p className="small">Decisions land in a document, along with the options we rejected. Meetings are for disagreement, not status updates.</p></article>
            <article className="card" data-rv="up" data-delay="70"><span className="icon-tile"><svg aria-hidden="true"><use href="#i-globe" /></svg></span><h4>Core hours, then focus</h4><p className="small">A shared window for the conversations that need everyone. The rest of the day is yours to actually build in.</p></article>
            <article className="card" data-rv="up" data-delay="140"><span className="icon-tile"><svg aria-hidden="true"><use href="#i-shield" /></svg></span><h4>Blameless by default</h4><p className="small">Incidents get a written timeline and an owner for the fix. Nobody earns a reputation for reporting one.</p></article>
            <article className="card" data-rv="up" data-delay="210"><span className="icon-tile"><svg aria-hidden="true"><use href="#i-users" /></svg></span><h4>Everyone talks to customers</h4><p className="small">Engineers join customer calls. The roadmap is built from what we heard, not from what we assumed.</p></article>
            <article className="card" data-rv="up" data-delay="280"><span className="icon-tile"><svg aria-hidden="true"><use href="#i-cal" /></svg></span><h4>Leave that gets taken</h4><p className="small">Time off you are expected to use, and a manager whose job includes making sure you do.</p></article>
            <article className="card" data-rv="up" data-delay="350"><span className="icon-tile"><svg aria-hidden="true"><use href="#i-heart" /></svg></span><h4>Ownership for everyone</h4><p className="small">Every employee holds equity, with the terms and the arithmetic explained on day one, not at exit.</p></article>
          </div>
        </div>
      </section>
    </div>
  )
}
