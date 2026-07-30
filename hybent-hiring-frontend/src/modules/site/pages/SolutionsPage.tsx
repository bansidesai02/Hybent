import { SiteView } from '../components/SiteView'

export default function SolutionsPage() {
  return (
    <SiteView route="solutions">
      <section className="hero">
        <div className="hero__orb orb-a" data-para="0.02"></div>
        <div className="hero__orb orb-b" data-para="-0.03"></div>

        <div className="wrap">
          <p className="eyebrow" data-rv="up"><span className="bars"><i></i><i></i><i></i></span><span>Solutions</span></p>
          <h1 style={{ fontSize: "clamp(2.35rem,4.6vw,3.6rem)", marginTop: "14px" }} data-rv="up" data-delay="80">Start where the pain is loudest</h1>
          <p className="hero__sub" data-rv="up" data-delay="160">Four ways teams put HYBENT to work. Everything described here runs on Hybent Hiring today, and gets deeper as further products arrive.</p>
        </div>
      </section>

      <section className="section" id="solutions">
        <div className="wrap">
          <div className="tabs" role="tablist" aria-label="Solutions">
            <button className="tab" role="tab" aria-selected="true" aria-controls="sp1" id="st1">Talent acquisition</button>
            <button className="tab" role="tab" aria-selected="false" aria-controls="sp2" id="st2">People operations</button>
            <button className="tab" role="tab" aria-selected="false" aria-controls="sp3" id="st3">Hiring managers</button>
            <button className="tab" role="tab" aria-selected="false" aria-controls="sp4" id="st4">IT &amp; security</button>
          </div>

          <div className="tabpanel on" id="sp1" role="tabpanel" aria-labelledby="st1">
            <div className="split" style={{ alignItems: "start" }}>
              <div>
                <h3 className="h-md">Hire faster without lowering the bar</h3>
                <p className="lead" style={{ marginTop: "16px" }}>Put every applicant through the same rubric automatically, then spend the hours you get back on the shortlist that actually deserves them.</p>
                <ul className="feat-list" style={{ marginTop: "24px" }}>
                  <li><svg aria-hidden="true"><use href="#i-check" /></svg><span>Resume parsing and AI screening on every application</span></li>
                  <li><svg aria-hidden="true"><use href="#i-check" /></svg><span>Interview scheduling across panels and time zones</span></li>
                  <li><svg aria-hidden="true"><use href="#i-check" /></svg><span>A searchable talent database you can hire from twice</span></li>
                </ul>
              </div>
              <div className="grid g2">
                <svg className="fig fig--thumb" style={{ gridColumn: "1/-1" }} role="img" aria-label="Hiring funnel narrowing from applicants to shortlist" viewBox="0 0 240 140" width="240" height="140">
            <rect x="1" y="1" width="238" height="138" rx="12" fill="var(--surface)" stroke="var(--border)" />
            <path d="M40 30h160l-32 34v34l-96 24V64z" fill="url(#hbgh)" opacity=".16" />
            <path d="M40 30h160l-32 34v34l-96 24V64z" fill="none" stroke="url(#hbgh)" strokeWidth="2" />
            <g fontFamily="IBM Plex Mono" fontSize="7.5" letterSpacing="1" fill="var(--dim)">
              <text x="206" y="34">1284</text><text x="176" y="70">312</text><text x="176" y="120">96</text></g>
          </svg>
                <div className="card card--flat stat"><b>One</b><span>Rubric, applied to every applicant</span><em>Consistent, evidenced scoring</em></div>
                <div className="card card--flat stat"><b>Zero</b><span>Résumés keyed in by hand</span><em>Parsing on upload</em></div>
              </div>
            </div>
          </div>

          <div className="tabpanel" id="sp2" role="tabpanel" aria-labelledby="st2" hidden>
            <div className="split" style={{ alignItems: "start" }}>
              <div>
                <h3 className="h-md">One person record, from first application onward</h3>
                <p className="lead" style={{ marginTop: "16px" }}>Everything Hybent Hiring captures during hiring is stored on the shared person record, ready to carry into HRMS when it launches. No re-keying, no CSV, no second version of the truth.</p>
                <ul className="feat-list" style={{ marginTop: "24px" }}>
                  <li><svg aria-hidden="true"><use href="#i-check" /></svg><span>Offer and approval history kept with the candidate</span></li>
                  <li><svg aria-hidden="true"><use href="#i-check" /></svg><span>Requisition status visible to everyone who needs it</span></li>
                  <li><svg aria-hidden="true"><use href="#i-check" /></svg><span>Documents stored once, referenced wherever they are needed</span></li>
                </ul>
              </div>
              <div className="grid g2">
                <svg className="fig fig--thumb" style={{ gridColumn: "1/-1" }} role="img" aria-label="One record carried from candidate to employee" viewBox="0 0 240 140" width="240" height="140">
            <rect x="1" y="1" width="238" height="138" rx="12" fill="var(--surface)" stroke="var(--border)" />
            <rect x="24" y="46" width="76" height="48" rx="11" fill="var(--surface-2)" stroke="var(--border)" />
            <circle cx="48" cy="70" r="11" fill="url(#hbg)" />
            <rect x="66" y="64" width="24" height="5" rx="2.5" fill="var(--border-strong)" />
            <rect x="66" y="74" width="18" height="4" rx="2" fill="var(--border)" />
            <path d="M108 70h24" stroke="url(#hbgh)" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M126 64l8 6-8 6" fill="none" stroke="url(#hbgh)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="140" y="46" width="76" height="48" rx="11" fill="var(--surface-2)" stroke="var(--border)" />
            <circle cx="164" cy="70" r="11" fill="url(#hbg)" />
            <rect x="182" y="64" width="24" height="5" rx="2.5" fill="var(--border-strong)" />
            <rect x="182" y="74" width="18" height="4" rx="2" fill="var(--border)" />
            <g fontFamily="IBM Plex Mono" fontSize="7" letterSpacing="1.1" fill="var(--dim)" textAnchor="middle">
              <text x="62" y="112">CANDIDATE</text><text x="178" y="112">EMPLOYEE</text></g>
          </svg>
                <div className="card card--flat stat"><b>One</b><span>Candidate record, carried forward</span><em>Shared person model</em></div>
                <div className="card card--flat stat"><b>Soon</b><span>HRMS continues where Hybent Hiring ends</span><em>Coming soon</em></div>
              </div>
            </div>
          </div>

          <div className="tabpanel" id="sp3" role="tabpanel" aria-labelledby="st3" hidden>
            <div className="split" style={{ alignItems: "start" }}>
              <div>
                <h3 className="h-md">Give hiring managers a decision, not a spreadsheet</h3>
                <p className="lead" style={{ marginTop: "16px" }}>Managers see a ranked shortlist with the reasoning attached, rate candidates on the same competencies as everyone else on the panel, and stop chasing recruiters for status.</p>
                <ul className="feat-list" style={{ marginTop: "24px" }}>
                  <li><svg aria-hidden="true"><use href="#i-check" /></svg><span>Ranked shortlists with the evidence attached</span></li>
                  <li><svg aria-hidden="true"><use href="#i-check" /></svg><span>Structured scorecards the whole panel shares</span></li>
                  <li><svg aria-hidden="true"><use href="#i-check" /></svg><span>Pipeline visibility without a status meeting</span></li>
                </ul>
              </div>
              <div className="grid g2">
                <svg className="fig fig--thumb" style={{ gridColumn: "1/-1" }} role="img" aria-label="Structured scorecard with matching competency ratings" viewBox="0 0 240 140" width="240" height="140">
            <rect x="1" y="1" width="238" height="138" rx="12" fill="var(--surface)" stroke="var(--border)" />
            <rect x="34" y="26" width="172" height="88" rx="11" fill="var(--surface-2)" stroke="var(--border)" />
            <g>
              <rect x="50" y="42" width="64" height="6" rx="3" fill="var(--border-strong)" />
              <g stroke="url(#hbgh)" strokeWidth="2.2" fill="none" strokeLinecap="round">
                <path d="M50 64l4 4 7-8" /><path d="M50 82l4 4 7-8" /><path d="M50 100l4 4 7-8" /></g>
              <rect x="72" y="60" width="80" height="5" rx="2.5" fill="var(--border)" />
              <rect x="72" y="78" width="96" height="5" rx="2.5" fill="var(--border)" />
              <rect x="72" y="96" width="64" height="5" rx="2.5" fill="var(--border)" />
              <g fill="url(#hbgh)"><rect x="172" y="58" width="18" height="9" rx="4.5" /><rect x="172" y="76" width="18" height="9" rx="4.5" opacity=".7" /><rect x="172" y="94" width="18" height="9" rx="4.5" opacity=".45" /></g>
            </g>
          </svg>
                <div className="card card--flat stat"><b>One</b><span>Scorecard everyone actually completes</span><em>Structured interviews</em></div>
                <div className="card card--flat stat"><b>Live</b><span>Pipeline visible without chasing</span><em>Recruiter dashboard</em></div>
              </div>
            </div>
          </div>

          <div className="tabpanel" id="sp4" role="tabpanel" aria-labelledby="st4" hidden>
            <div className="split" style={{ alignItems: "start" }}>
              <div>
                <h3 className="h-md">Fewer vendors, fewer integrations, one review</h3>
                <p className="lead" style={{ marginTop: "16px" }}>As the ecosystem grows, consolidating onto one platform means one security review, one identity connection and one place to answer “who touched this record, and when”.</p>
                <ul className="feat-list" style={{ marginTop: "24px" }}>
                  <li><svg aria-hidden="true"><use href="#i-check" /></svg><span>Single sign-on and centralised user provisioning</span></li>
                  <li><svg aria-hidden="true"><use href="#i-check" /></svg><span>Role-based permissions and exportable audit history</span></li>
                  <li><svg aria-hidden="true"><use href="#i-check" /></svg><span>Documented sub-processors and clear data handling</span></li>
                </ul>
              </div>
              <div className="grid g2">
                <svg className="fig fig--thumb" style={{ gridColumn: "1/-1" }} role="img" aria-label="Security shield covering SSO, role-based access and audit" viewBox="0 0 240 140" width="240" height="140">
            <rect x="1" y="1" width="238" height="138" rx="12" fill="var(--surface)" stroke="var(--border)" />
            <path d="M120 26l40 14v30c0 24-18 38-40 44-22-6-40-20-40-44V40z" fill="url(#hbgh)" opacity=".14" stroke="url(#hbgh)" strokeWidth="2" />
            <path d="M106 70l9 9 20-21" fill="none" stroke="url(#hbgh)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <g fontFamily="IBM Plex Mono" fontSize="7" letterSpacing="1.1" fill="var(--dim)" textAnchor="middle"><text x="120" y="126">SSO · RBAC · AUDIT</text></g>
          </svg>
                <div className="card card--flat stat"><b>One</b><span>Security review, not one per product</span><em>Controls live in the platform</em></div>
                <div className="card card--flat stat"><b>Full</b><span>Data export, whenever you ask</span><em>Open formats, no ticket</em></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </SiteView>
  )
}
