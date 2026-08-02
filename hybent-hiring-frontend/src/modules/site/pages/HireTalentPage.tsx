import { SiteView } from '../components/SiteView'

export default function HireTalentPage() {
  return (
    <SiteView route="hire-talent">
      <section className="hero">
        <div className="hero__orb orb-a" data-para="0.02"></div>
        <div className="hero__orb orb-b" data-para="-0.03"></div>

        <div className="wrap">
          <p className="eyebrow" data-rv="up"><span className="bars"><i></i><i></i><i></i></span><span>Hire Talent</span></p>
          <h1 style={{ fontSize: "clamp(2.35rem,4.6vw,3.6rem)", marginTop: "14px" }} data-rv="up" data-delay="80">Build your team with pre-vetted tech experts</h1>
          <p className="hero__sub" data-rv="up" data-delay="160">Scale your engineering organization instantly with top software developers, AI engineers, and technical leads matched specifically for your tech stack.</p>
        </div>
      </section>

      <section className="section" id="hire-talent">
        <div className="wrap">
          <div className="grid g3">
            <article className="card" data-rv="up">
              <span className="icon-tile">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M16 20v-1.6a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
                  <circle cx="9" cy="7.5" r="3.4" />
                  <path d="M22 20v-1.6a4 4 0 0 0-3-3.9M16.5 4.2a4 4 0 0 1 0 7.1" />
                </svg>
              </span>
              <h3 className="h-sm" style={{ margin: "16px 0 8px" }}>Dedicated Development Teams</h3>
              <p className="small">Autonomous engineering pods aligned with your product roadmap, working directly inside your tools and workflow.</p>
            </article>

            <article className="card" data-rv="up" data-delay="60">
              <span className="icon-tile">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2.6" y="7.2" width="18.8" height="13.2" rx="2.4" />
                  <path d="M8.4 7.2V5.4a2 2 0 0 1 2-2h3.2a2 2 0 0 1 2 2v1.8M2.6 12.6h18.8" />
                </svg>
              </span>
              <h3 className="h-sm" style={{ margin: "16px 0 8px" }}>Staff Augmentation</h3>
              <p className="small">Fill key skill gaps rapidly with senior frontend, backend, AI, and DevOps specialists on flexible contracts.</p>
            </article>

            <article className="card" data-rv="up" data-delay="120">
              <span className="icon-tile">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <circle cx="12" cy="12" r="5" />
                  <circle cx="12" cy="12" r="1.3" />
                </svg>
              </span>
              <h3 className="h-sm" style={{ margin: "16px 0 8px" }}>AI-Powered Candidate Vetting</h3>
              <p className="small">Every engineer undergoes technical coding challenges, architecture design reviews, and AI-assisted skill verification.</p>
            </article>

            <article className="card" data-rv="up" data-delay="180">
              <span className="icon-tile">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M13.4 2 4 13.6h6.2L10.6 22 20 10.4h-6.2z" />
                </svg>
              </span>
              <h3 className="h-sm" style={{ margin: "16px 0 8px" }}>Fast Time to Onboard</h3>
              <p className="small">Interview ready-to-deploy candidates within 48 hours and start building immediately without hiring overhead.</p>
            </article>

            <article className="card" data-rv="up" data-delay="240">
              <span className="icon-tile">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9.2" />
                  <path d="M2.8 12h18.4M12 2.8c2.5 2.6 3.8 5.9 3.8 9.2s-1.3 6.6-3.8 9.2c-2.5-2.6-3.8-5.9-3.8-9.2S9.5 5.4 12 2.8z" />
                </svg>
              </span>
              <h3 className="h-sm" style={{ margin: "16px 0 8px" }}>Global Talent Reach</h3>
              <p className="small">Access top engineering talent across regions with full time-zone alignment and seamless communication.</p>
            </article>

            <article className="card" data-rv="up" data-delay="300">
              <span className="icon-tile">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2.8H7a2.4 2.4 0 0 0-2.4 2.4v13.6A2.4 2.4 0 0 0 7 21.2h10a2.4 2.4 0 0 0 2.4-2.4V8.2z" />
                  <path d="M14 2.8v5.4h5.4M8.6 13h6.8M8.6 17h4.8" />
                </svg>
              </span>
              <h3 className="h-sm" style={{ margin: "16px 0 8px" }}>Transparent Billing &amp; Contracts</h3>
              <p className="small">No hidden fees, simple monthly invoicing, and risk-free trial periods to guarantee complete alignment.</p>
            </article>
          </div>
        </div>
      </section>
    </SiteView>
  )
}
