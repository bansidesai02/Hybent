import { SiteView } from '../components/SiteView'
import HeroRibbons from '../components/HeroRibbons'

export default function SecurityPage() {
  return (
    <SiteView route="security">
      <section className="hero">
        <HeroRibbons />
        <div className="hero__orb orb-a" data-para="0.02"></div>
        <div className="hero__orb orb-b" data-para="-0.03"></div>

        <div className="wrap">
          <p className="eyebrow" data-rv="up"><span className="bars"><i></i><i></i><i></i></span><span>Security &amp; compliance</span></p>
          <h1 style={{ fontSize: "clamp(2.35rem,4.6vw,3.6rem)", marginTop: "14px" }} data-rv="up" data-delay="80">The part of the platform we never ship “later”</h1>
          <p className="hero__sub" data-rv="up" data-delay="160">Security is a property of the platform, not a project we run once per product. Every product we launch inherits the same controls on its first day.</p>
        </div>
      </section>

      <section className="section section--tight-pt-none" id="security">
        <div className="wrap">    <div className="figrow" data-rv="up"><div className="figpanel"><svg className="fig" role="img" aria-label="Every product inherits the same encryption, access control, audit and explainability controls" viewBox="0 0 460 250" width="460" height="250">
            <g>
              <rect x="88" y="18" width="128" height="34" rx="10" fill="var(--surface)" stroke="var(--border-strong)" />
              <circle cx="108" cy="35" r="5" fill="var(--success)" />
              <text x="122" y="39" fontFamily="Figtree" fontSize="11" fontWeight="600" fill="var(--text)">Hybent Hiring</text>
              <rect x="228" y="18" width="86" height="34" rx="10" fill="var(--surface)" stroke="var(--border)" strokeDasharray="4 4" />
              <text x="248" y="39" fontFamily="Figtree" fontSize="11" fill="var(--dim)">CRM</text>
              <rect x="326" y="18" width="86" height="34" rx="10" fill="var(--surface)" stroke="var(--border)" strokeDasharray="4 4" />
              <text x="342" y="39" fontFamily="Figtree" fontSize="11" fill="var(--dim)">HRMS</text>
            </g>
            <g stroke="var(--border-strong)" strokeWidth="1.6" fill="none">
              <path d="M152 52v22M271 52v22M369 52v22" /></g>
            <g fontFamily="Geist Mono" fontSize="8" letterSpacing="1.4">
              <rect x="48" y="78" width="380" height="30" rx="9" fill="url(#hbgh)" opacity=".18" stroke="var(--border-strong)" />
              <text x="66" y="97" fill="var(--text)">ENCRYPTION IN TRANSIT &amp; AT REST</text>
              <rect x="48" y="114" width="380" height="30" rx="9" fill="url(#hbgh)" opacity=".14" stroke="var(--border-strong)" />
              <text x="66" y="133" fill="var(--text)">ROLE-BASED ACCESS CONTROL</text>
              <rect x="48" y="150" width="380" height="30" rx="9" fill="url(#hbgh)" opacity=".1" stroke="var(--border-strong)" />
              <text x="66" y="169" fill="var(--text)">IMMUTABLE AUDIT LOG</text>
              <rect x="48" y="186" width="380" height="30" rx="9" fill="url(#hbgh)" opacity=".07" stroke="var(--border-strong)" />
              <text x="66" y="205" fill="var(--text)">EXPLAINABLE AI DECISIONS</text>
            </g>
            <text x="238" y="238" textAnchor="middle" fontFamily="Geist Mono" fontSize="8" letterSpacing="1.5" fill="var(--dim)">INHERITED BY EVERY PRODUCT ON DAY ONE</text>
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
          </div>
        </div>
      </section>
    </SiteView>
  )
}
