import { SiteView } from '../components/SiteView'

export default function SecurityPage() {
  return (
    <SiteView route="security">
      <section className="hero">
        <div className="hero__orb orb-a" data-para="0.02"></div>
        <div className="hero__orb orb-b" data-para="-0.03"></div>

        <div className="wrap">
          <p className="eyebrow" data-rv="up"><span className="bars"><i></i><i></i><i></i></span><span>Security &amp; compliance</span></p>
          <h1 style={{ fontSize: "clamp(2.35rem,4.6vw,3.6rem)", marginTop: "14px" }} data-rv="up" data-delay="80">The part of the platform we never ship “later”</h1>
          <p className="hero__sub" data-rv="up" data-delay="160">Security is a property of the platform, not a project we run once per product. Every product we launch inherits the same controls on its first day.</p>
        </div>
      </section>

      <section className="section" id="security">
        <div className="wrap">    <div className="figrow" data-rv="up"><div className="figpanel"><svg className="fig" role="img" aria-label="Every product inherits the same encryption, access control, audit and explainability controls" viewBox="0 0 460 250" width="460" height="250">
            <g>
              <rect x="88" y="18" width="128" height="34" rx="10" fill="var(--surface)" stroke="var(--border-strong)" />
              <circle cx="108" cy="35" r="5" fill="var(--success)" />
              <text x="122" y="39" fontFamily="Sora" fontSize="11" fontWeight="600" fill="var(--text)">Hybent Hiring</text>
              <rect x="228" y="18" width="86" height="34" rx="10" fill="var(--surface)" stroke="var(--border)" strokeDasharray="4 4" />
              <text x="248" y="39" fontFamily="Sora" fontSize="11" fill="var(--dim)">CRM</text>
              <rect x="326" y="18" width="86" height="34" rx="10" fill="var(--surface)" stroke="var(--border)" strokeDasharray="4 4" />
              <text x="342" y="39" fontFamily="Sora" fontSize="11" fill="var(--dim)">HRMS</text>
            </g>
            <g stroke="var(--border-strong)" strokeWidth="1.6" fill="none">
              <path d="M152 52v22M271 52v22M369 52v22" /></g>
            <g fontFamily="IBM Plex Mono" fontSize="8" letterSpacing="1.4">
              <rect x="48" y="78" width="380" height="30" rx="9" fill="url(#hbgh)" opacity=".18" stroke="var(--border-strong)" />
              <text x="66" y="97" fill="var(--text)">ENCRYPTION IN TRANSIT &amp; AT REST</text>
              <rect x="48" y="114" width="380" height="30" rx="9" fill="url(#hbgh)" opacity=".14" stroke="var(--border-strong)" />
              <text x="66" y="133" fill="var(--text)">ROLE-BASED ACCESS CONTROL</text>
              <rect x="48" y="150" width="380" height="30" rx="9" fill="url(#hbgh)" opacity=".1" stroke="var(--border-strong)" />
              <text x="66" y="169" fill="var(--text)">IMMUTABLE AUDIT LOG</text>
              <rect x="48" y="186" width="380" height="30" rx="9" fill="url(#hbgh)" opacity=".07" stroke="var(--border-strong)" />
              <text x="66" y="205" fill="var(--text)">EXPLAINABLE AI DECISIONS</text>
            </g>
            <text x="238" y="238" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="8" letterSpacing="1.5" fill="var(--dim)">INHERITED BY EVERY PRODUCT ON DAY ONE</text>
          </svg></div></div>
          <div className="shield-grid">
            <article className="card" data-rv="up"><span className="icon-tile"><svg aria-hidden="true"><use href="#i-lock" /></svg></span>
              <h3 className="h-sm" style={{ margin: "16px 0 8px" }}>Encrypted end to end</h3>
              <p className="small">TLS in transit and AES-256 at rest, with tenant data isolated and keys managed separately from the application.</p></article>
            <article className="card" data-rv="up" data-delay="80"><span className="icon-tile"><svg aria-hidden="true"><use href="#i-shield" /></svg></span>
              <h3 className="h-sm" style={{ margin: "16px 0 8px" }}>Access you can prove</h3>
              <p className="small">Role-based permissions on every record and an audit log of who saw what, when — exportable whenever you need it.</p></article>
            <article className="card" data-rv="up" data-delay="160"><span className="icon-tile"><svg aria-hidden="true"><use href="#i-globe" /></svg></span>
              <h3 className="h-sm" style={{ margin: "16px 0 8px" }}>Clear on where data lives</h3>
              <p className="small">We publish our sub-processors and tell you exactly where your data is stored. Additional regions arrive as we expand.</p></article>
            <article className="card" data-rv="up" data-delay="240"><span className="icon-tile"><svg aria-hidden="true"><use href="#i-eye" /></svg></span>
              <h3 className="h-sm" style={{ margin: "16px 0 8px" }}>Tested, not assumed</h3>
              <p className="small">Continuous dependency scanning today; independent penetration testing and a disclosure programme on our security roadmap.</p></article>
            <article className="card" data-rv="up" data-delay="320"><span className="icon-tile"><svg aria-hidden="true"><use href="#i-ai" /></svg></span>
              <h3 className="h-sm" style={{ margin: "16px 0 8px" }}>Responsible AI by design</h3>
              <p className="small">Screening scores always show their evidence, a human makes the final call, and any automated step can be switched off.</p></article>
            <article className="card" data-rv="up" data-delay="400"><span className="icon-tile"><svg aria-hidden="true"><use href="#i-doc" /></svg></span>
              <h3 className="h-sm" style={{ margin: "16px 0 8px" }}>Documentation on request</h3>
              <p className="small">Security overview, data processing agreement and sub-processor list sent as one packet — ask and we will send it.</p></article>
          </div>
          <div className="compliance" data-rv="up">
            <span className="chip"><svg aria-hidden="true"><use href="#i-check" /></svg>Encryption in transit &amp; at rest</span>
            <span className="chip"><svg aria-hidden="true"><use href="#i-check" /></svg>Role-based access control</span>
            <span className="chip"><svg aria-hidden="true"><use href="#i-check" /></svg>GDPR-aligned</span>
            <span className="chip"><svg aria-hidden="true"><use href="#i-check" /></svg>India DPDP Act-aligned</span>
            <span className="chip"><svg aria-hidden="true"><use href="#i-check" /></svg>Audit logging</span>
            <span className="chip"><svg aria-hidden="true"><use href="#i-check" /></svg>Explainable AI decisions</span>
            <span className="chip"><svg aria-hidden="true"><use href="#i-check" /></svg>WCAG 2.2 AA — target</span>
            <div className="figrow" data-rv="up">
              <div className="figpanel">
                <svg className="fig" viewBox="0 0 880 210" role="img" aria-label="How candidate data moves through Hybent Hiring: encrypted in transit, stored encrypted and tenant-isolated, read only through role-based access with every read logged, and exported or deleted on request">
                  <line x1="96" y1="76" x2="784" y2="76" stroke="var(--border)" strokeWidth="1.6" />
                  <g>
                    <circle cx="96" cy="76" r="34" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="1.6" />
                    <rect x="82" y="62" width="28" height="20" rx="5" fill="none" stroke="url(#hbgh)" strokeWidth="2.4" />
                    <path d="M82 66l14 9 14-9" fill="none" stroke="url(#hbgh)" strokeWidth="2.2" strokeLinejoin="round" />

                    <circle cx="325" cy="76" r="34" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="1.6" />
                    <rect x="312" y="72" width="26" height="20" rx="4" fill="none" stroke="url(#hbgh)" strokeWidth="2.4" />
                    <path d="M317 72v-7a8 8 0 0116 0v7" fill="none" stroke="url(#hbgh)" strokeWidth="2.4" />

                    <circle cx="555" cy="76" r="34" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="1.6" />
                    <ellipse cx="555" cy="64" rx="17" ry="6.5" fill="none" stroke="url(#hbgh)" strokeWidth="2.4" />
                    <path d="M538 64v22c0 3.6 7.6 6.5 17 6.5s17-2.9 17-6.5V64" fill="none" stroke="url(#hbgh)" strokeWidth="2.4" />
                    <path d="M538 75c0 3.6 7.6 6.5 17 6.5s17-2.9 17-6.5" fill="none" stroke="url(#hbgh)" strokeWidth="2" />

                    <circle cx="784" cy="76" r="34" fill="url(#hbgh)" opacity=".14" stroke="var(--border-strong)" strokeWidth="1.6" />
                    <path d="M784 62v26M773 77l11 11 11-11" fill="none" stroke="url(#hbgh)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                  <g fontFamily="IBM Plex Mono" fontSize="9.5" letterSpacing="1.3" fill="var(--text)" textAnchor="middle">
                    <text x="96" y="134">SUBMITTED</text><text x="325" y="134">ENCRYPTED</text><text x="555" y="134">ISOLATED</text><text x="784" y="134">YOURS TO TAKE</text>
                  </g>
                  <g fontFamily="Manrope" fontSize="11" fill="var(--muted)" textAnchor="middle">
                    <text x="96" y="156">Candidate applies</text>
                    <text x="325" y="156">In transit and at rest</text>
                    <text x="555" y="156">Per-tenant, role-gated</text>
                    <text x="784" y="156">Export or delete, on ask</text>
                  </g>
                  <g transform="translate(300,178)">
                    <rect width="280" height="22" rx="11" fill="var(--cyan)" opacity=".13" />
                    <text x="140" y="15" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="8.5" letterSpacing="1.2" fill="var(--cyan)">EVERY READ WRITTEN TO THE AUDIT LOG</text>
                  </g>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>
    </SiteView>
  )
}
