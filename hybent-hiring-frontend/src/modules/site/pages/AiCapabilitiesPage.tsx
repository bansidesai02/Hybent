import { SiteView } from '../components/SiteView'

export default function AiCapabilitiesPage() {
  return (
    <SiteView route="ai">
      <section className="hero">
        <div className="hero__orb orb-a" data-para="0.02"></div>
        <div className="hero__orb orb-b" data-para="-0.03"></div>

        <div className="wrap">
          <p className="eyebrow" data-rv="up"><span className="bars"><i></i><i></i><i></i></span><span>AI Capabilities</span></p>
          <h1 style={{ fontSize: "clamp(2.35rem,4.6vw,3.6rem)", marginTop: "14px" }} data-rv="up" data-delay="80">Built AI-first, not AI-added</h1>
          <p className="hero__sub" data-rv="up" data-delay="160">Screening, parsing and ranking are the product here, not a feature bolted onto a legacy workflow. This is how the models are built, tested and kept accountable.</p>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="cta-band cta-band--ai" data-rv="scale">
            <div className="split">
              <div>
                <p className="eyebrow"><span className="bars"><i></i><i></i><i></i></span><span>HYBENT AI</span></p>
                <h2 className="h-lg">AI that does the work, not the talking</h2>
                <p className="lead" style={{ marginTop: "22px" }}>Every HYBENT product is built AI-first. In Hybent Hiring that means parsing, screening, ranking and interview assistance happen inside the workflow — and every suggestion the system makes can be explained afterwards, in writing, to whoever asks.</p>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "30px" }}>
                  <a className="btn btn-primary" href="/contact">Talk to our AI team <svg className="arw" width="16" height="16" aria-hidden="true"><use href="#i-arrow" /></svg></a>
                  <a className="btn btn-ghost" href="/products">See it in Hybent Hiring</a>
                </div>
              </div>
              <div className="grid" style={{ gap: "12px" }}>
                <svg className="fig fig--thumb" role="img" aria-label="AI screening score of 94 broken down into the evidence behind it, with a human making the final call" viewBox="0 0 520 300" width="520" height="300">
            <rect x="1" y="1" width="518" height="298" rx="16" fill="var(--surface)" stroke="var(--border-strong)" />
            <g transform="translate(28,28)">
              <circle cx="34" cy="34" r="30" fill="none" stroke="var(--border)" strokeWidth="8" />
              <circle cx="34" cy="34" r="30" fill="none" stroke="url(#hbgh)" strokeWidth="8" strokeLinecap="round" strokeDasharray="177 189" transform="rotate(-90 34 34)" />
              <text x="34" y="40" textAnchor="middle" fontFamily="Sora" fontSize="19" fontWeight="600" fill="var(--text)">94</text>
              <rect x="84" y="14" width="130" height="9" rx="4.5" fill="var(--border-strong)" />
              <text x="84" y="48" fontFamily="IBM Plex Mono" fontSize="8" letterSpacing="1.4" fill="var(--dim)">SENIOR BACKEND ENGINEER</text>
            </g>
            <line x1="28" y1="110" x2="492" y2="110" stroke="var(--border)" />
            <text x="28" y="134" fontFamily="IBM Plex Mono" fontSize="8" letterSpacing="1.5" fill="var(--dim)">EVIDENCE BEHIND THIS SCORE</text>
            <g fontFamily="Manrope" fontSize="11" fill="var(--muted)">
              <text x="28" y="164">Distributed systems</text>
              <rect x="230" y="155" width="230" height="8" rx="4" fill="var(--border)" />
              <rect x="230" y="155" width="212" height="8" rx="4" fill="url(#hbgh)" />
              <text x="470" y="164" fontFamily="IBM Plex Mono" fontSize="9" fill="var(--text)">92</text>

              <text x="28" y="194">Language depth</text>
              <rect x="230" y="185" width="230" height="8" rx="4" fill="var(--border)" />
              <rect x="230" y="185" width="196" height="8" rx="4" fill="url(#hbgh)" />
              <text x="470" y="194" fontFamily="IBM Plex Mono" fontSize="9" fill="var(--text)">85</text>

              <text x="28" y="224">Scale of ownership</text>
              <rect x="230" y="215" width="230" height="8" rx="4" fill="var(--border)" />
              <rect x="230" y="215" width="152" height="8" rx="4" fill="url(#hbgh)" />
              <text x="470" y="224" fontFamily="IBM Plex Mono" fontSize="9" fill="var(--text)">66</text>

              <text x="28" y="254">Domain exposure</text>
              <rect x="230" y="245" width="230" height="8" rx="4" fill="var(--border)" />
              <rect x="230" y="245" width="118" height="8" rx="4" fill="url(#hbgh)" opacity=".55" />
              <text x="470" y="254" fontFamily="IBM Plex Mono" fontSize="9" fill="var(--muted)">51</text>
            </g>
            <rect x="28" y="268" width="180" height="18" rx="9" fill="var(--cyan)" opacity=".14" />
            <text x="40" y="281" fontFamily="IBM Plex Mono" fontSize="7.5" letterSpacing="1.1" fill="var(--cyan)">HUMAN MAKES THE CALL</text>
          </svg>
                <article className="card card--flat" style={{ padding: "20px 22px" }}><h3 className="h-sm">Grounded in your own data</h3><p className="small" style={{ marginTop: "8px" }}>Answers come from your candidates and your criteria, with a link back to the source record every time.</p></article>
                <article className="card card--flat" style={{ padding: "20px 22px" }}><h3 className="h-sm">Assistance, not autonomy</h3><p className="small" style={{ marginTop: "8px" }}>The recruiter copilot can only see what the person using it can see, and a human signs off on every hiring decision.</p></article>
                <article className="card card--flat" style={{ padding: "20px 22px" }}><h3 className="h-sm">Evaluated before release</h3><p className="small" style={{ marginTop: "8px" }}>Accuracy and consistency tests gate every model change before it reaches a live hiring pipeline.</p></article>
              </div>
            </div>
            <div style={{ marginTop: "clamp(34px,4.5vw,60px)" }} data-rv="up">
              <p className="mono" style={{ textAlign: "center", marginBottom: "18px", color: "var(--dim)" }}>The screening pipeline, end to end</p>
              <img className="shot shot--flow" src="/hybent/shot-flow.webp" width="1024" height="583" alt="How AI resume screening works: resume intake, parsing and normalisation, job requirement mapping, candidate ranking and shortlisting, then human review" loading="lazy" decoding="async" />
            </div>
          </div>
        </div>
      </section>
    </SiteView>
  )
}
