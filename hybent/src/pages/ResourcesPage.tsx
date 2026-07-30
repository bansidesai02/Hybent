export default function ResourcesPage() {
  return (
    <div className="route route--on" data-route="resources">
      <section className="hero">
        <div className="hero__orb orb-a" data-para="0.02"></div>
        <div className="hero__orb orb-b" data-para="-0.03"></div>

        <div className="wrap">
          <p className="eyebrow" data-rv="up"><span className="bars"><i></i><i></i><i></i></span><span>Resources</span></p>
          <h1 style={{ fontSize: "clamp(2.35rem,4.6vw,3.6rem)", marginTop: "14px" }} data-rv="up" data-delay="80">Notes, research and straight answers</h1>
          <p className="hero__sub" data-rv="up" data-delay="160">What we are writing about while we build, and the questions buyers put to us before anything else.</p>
        </div>
      </section>

      <section className="section" id="blog">
        <div className="wrap">
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "24px", flexWrap: "wrap", marginBottom: "36px" }} data-rv="up">
            <div>
              <p className="eyebrow"><span className="bars"><i></i><i></i><i></i></span><span>Resources</span></p>
              <h2 className="h-lg">From the team building it</h2>
            </div>
            <a className="link-arrow" href="/contact">Resource centre — coming soon <svg width="15" height="15" aria-hidden="true"><use href="#i-arrow" /></svg></a>
          </div>
          <div className="grid g3">
            <article className="card post" data-rv="up">
              <div className="post__viz"><svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                <circle cx="252" cy="30" r="74" fill="url(#hbsoft)" /><circle cx="50" cy="158" r="56" fill="url(#hbsoft)" />
                <g transform="translate(58,90)">
                  <circle r="34" fill="none" stroke="var(--border-strong)" strokeWidth="11" />
                  <circle r="34" fill="none" stroke="url(#hbbp)" strokeWidth="11" strokeLinecap="round" strokeDasharray="160 214" transform="rotate(-90)" />
                  <circle r="13" fill="url(#hbcb)" opacity=".22" />
                </g>
                <g transform="translate(128,56)">
                  <rect width="116" height="13" rx="6.5" fill="url(#hbbp)" />
                  <rect y="26" width="84" height="13" rx="6.5" fill="url(#hbcb)" opacity=".62" />
                  <rect y="52" width="140" height="13" rx="6.5" fill="var(--border-strong)" />
                </g>
                <g transform="translate(252,122)">
                  <rect width="42" height="42" rx="13" fill="url(#hbbp)" opacity=".16" />
                  <path d="M12 21.5l6 6 12-13" fill="none" stroke="url(#hbbp)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                </g>
                <g fill="url(#hbcb)"><circle cx="150" cy="146" r="5.5" opacity=".55" /><circle cx="172" cy="146" r="5.5" opacity=".35" /><circle cx="194" cy="146" r="5.5" opacity=".18" /></g>
              </svg></div>
              <p className="mono">Research</p>
              <h4>How we test AI screening before it reaches a live pipeline</h4>
              <p className="small">What we measure, what blocks a release, and why an unexplainable score never makes it into the product.</p>
              <div className="meta"><span>Coming soon</span><span>·</span><span>Research note</span></div>
            </article>
            <article className="card post" data-rv="up" data-delay="90">
              <div className="post__viz"><svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                <circle cx="38" cy="24" r="68" fill="url(#hbsoft)" /><circle cx="288" cy="164" r="60" fill="url(#hbsoft)" />
                <g transform="translate(78,32)">
                  <rect width="46" height="26" rx="9" fill="url(#hbbp)" />
                  <rect x="60" width="46" height="26" rx="9" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="1.6" />
                  <rect x="120" width="46" height="26" rx="9" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="1.6" />
                </g>
                <g stroke="var(--border-strong)" strokeWidth="1.8" fill="none"><path d="M101 58v20M161 58v20M221 58v20" /></g>
                <g transform="translate(52,82)">
                  <rect width="216" height="22" rx="9" fill="url(#hbbp)" opacity=".85" />
                  <rect y="30" width="216" height="22" rx="9" fill="url(#hbcb)" opacity=".42" />
                  <rect y="60" width="216" height="22" rx="9" fill="var(--border-strong)" opacity=".5" />
                </g>
              </svg></div>
              <p className="mono">Engineering</p>
              <h4>Designing a permissions model many products can share</h4>
              <p className="small">The trade-offs behind building the platform layer first, and what it costs you to skip that work.</p>
              <div className="meta"><span>Coming soon</span><span>·</span><span>Engineering</span></div>
            </article>
            <article className="card post" data-rv="up" data-delay="180">
              <div className="post__viz"><svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                <circle cx="276" cy="36" r="64" fill="url(#hbsoft)" /><circle cx="30" cy="152" r="50" fill="url(#hbsoft)" />
                <g transform="translate(40,34)">
                  <path d="M0 0h150l-32 38v46l-86 22V38z" fill="url(#hbbp)" opacity=".2" />
                  <path d="M0 0h150l-32 38v46l-86 22V38z" fill="none" stroke="url(#hbbp)" strokeWidth="2.4" strokeLinejoin="round" />
                </g>
                <g fill="url(#hbcb)"><circle cx="212" cy="50" r="7" opacity=".7" /><circle cx="236" cy="72" r="5.5" opacity=".5" /><circle cx="256" cy="98" r="4.5" opacity=".32" /><circle cx="272" cy="122" r="3.5" opacity=".2" /></g>
                <path d="M196 142c26 0 34-14 48-30s28-22 48-22" fill="none" stroke="url(#hbbp)" strokeWidth="3.4" strokeLinecap="round" />
                <circle cx="294" cy="88" r="7" fill="url(#hbbp)" />
              </svg></div>
              <p className="mono">Product</p>
              <h4>Why candidates drop off, and what actually fixes it</h4>
              <p className="small">Candidates rarely abandon a long form. They abandon silence — which is a product problem, not a copywriting one.</p>
              <div className="meta"><span>Coming soon</span><span>·</span><span>Product</span></div>
            </article>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap" style={{ maxWidth: "900px" }}>
          <div className="section-head center" data-rv="up">
            <p className="eyebrow" style={{ justifyContent: "center" }}><span className="bars"><i></i><i></i><i></i></span><span>FAQ</span></p>
            <h2 className="h-lg">The questions we get asked first</h2>
          </div>
          <div className="faq" data-rv="up">
            <details open><summary>Is HYBENT only a hiring company?<span className="pm"></span></summary><div className="ans">Hybent Hiring is our first product, not our scope. HYBENT is an enterprise software company, and the platform underneath Hybent Hiring — identity, permissions, workflow, audit and a shared data model — was built to carry more than one product. Hiring is simply where we chose to prove it first.</div></details>
            <details><summary>How much of this site is actually available today?<span className="pm"></span></summary><div className="ans">Hybent Hiring is live and in production. Everything else — CRM, HRMS, ERP, Analytics and the rest of the ecosystem — is marked coming soon because it has not shipped. We would rather look smaller today than have you discover the gap after signing.</div></details>
            <details><summary>What happens to my data when the next product launches?<span className="pm"></span></summary><div className="ans">Nothing moves and nothing is re-imported. A candidate who becomes an employee is the same person record, gaining fields as new products switch on. That is precisely why we built the data foundation before shipping anything on top of it.</div></details>
            <details><summary>How is Hybent Hiring priced?<span className="pm"></span></summary><div className="ans">Hybent Hiring is priced per recruiter seat with volume tiers for high-hiring teams. As further products launch, a shared platform fee will cover identity, security and APIs — so your second product will cost meaningfully less than your first. Contact us for current pricing and early-customer terms.</div></details>
            <details><summary>Do you train AI models on our data?<span className="pm"></span></summary><div className="ans">No. Your candidate data is never used to train models shared with any other customer. Tuning specific to your account is opt-in, documented and reversible, and every AI feature explains the inputs behind what it produces.</div></details>
            <details><summary>Where is our data stored?<span className="pm"></span></summary><div className="ans">We will tell you exactly where your data sits and who processes it, and we publish our sub-processor list. Additional regions are added as we expand — if you have a specific residency requirement, ask us and we will give you a straight answer about whether we can meet it yet.</div></details>
            <details><summary>How do we get our data out if we leave?<span className="pm"></span></summary><div className="ans">Export in open formats from the admin console at any time, including attachments and decision history. No ticket, no fee, no notice period. We would rather you stay because leaving is easy and you chose not to.</div></details>
          </div>
        </div>
      </section>
    </div>
  )
}
