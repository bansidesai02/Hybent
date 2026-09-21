import { SiteView } from '../components/SiteView'

export default function PlatformPage() {
  return (
    <SiteView route="platform">
      <section className="hero">
        <div className="hero__orb orb-a" data-para="0.02"></div>
        <div className="hero__orb orb-b" data-para="-0.03"></div>

        <div className="wrap">
          <p className="eyebrow" data-rv="up"><span className="bars"><i></i><i></i><i></i></span><span>The ecosystem</span></p>
          <h1 style={{ fontSize: "clamp(2.35rem,4.6vw,3.6rem)", marginTop: "14px" }} data-rv="up" data-delay="80">Four layers. Everything above inherits everything below.</h1>
          <p className="hero__sub" data-rv="up" data-delay="160">Hybent Hiring is our flagship AI recruitment product, built on top of our unified security, intelligence, and data platform foundation.</p>
        </div>
      </section>

      <section className="section section--tight-pt-none" id="ecosystem">
        <div className="wrap">
          <div className="eco" data-rv="scale">
            <div className="eco__layers">
              <div className="eco__layer">
                <div><p className="mono" style={{ marginBottom: "6px" }}>Layer 04</p><h4>Products</h4><p className="small">What your teams open every day. Hybent Hiring is live in production.</p></div>
                <div className="eco__mods">
                  <span className="mod mod--live"><span className="dot" style={{ background: "#34D399" }}></span>Hybent Hiring</span>
                </div>
              </div>
              <div className="eco__layer">
                <div><p className="mono" style={{ marginBottom: "6px" }}>Layer 03</p><h4>Intelligence</h4><p className="small">Shared models and assistants, always permission-aware.</p></div>
                <div className="eco__mods">
                  <span className="mod mod--core">Screening &amp; ranking</span><span className="mod mod--core">Resume parsing</span>
                  <span className="mod mod--core">Recruiter copilot</span><span className="mod mod--core">Evaluation harness</span>
                  <span className="mod mod--core">Natural-language reporting</span>
                </div>
              </div>
              <div className="eco__layer">
                <div><p className="mono" style={{ marginBottom: "6px" }}>Layer 02</p><h4>Platform services</h4><p className="small">Written once, used by every product we ship.</p></div>
                <div className="eco__mods">
                  <span className="mod">Identity &amp; SSO</span><span className="mod">Permissions</span><span className="mod">Workflow engine</span>
                  <span className="mod">Notifications</span><span className="mod">Files &amp; e-sign</span><span className="mod">APIs &amp; webhooks</span><span className="mod">Audit log</span>
                </div>
              </div>
              <div className="eco__layer">
                <div><p className="mono" style={{ marginBottom: "6px" }}>Layer 01</p><h4>Data foundation</h4><p className="small">One definition of a person, an organisation and a role.</p></div>
                <div className="eco__mods">
                  <span className="mod">Person</span><span className="mod">Organisation</span><span className="mod">Role</span>
                  <span className="mod">Transaction</span><span className="mod">Event stream</span><span className="mod">Residency &amp; encryption</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section section--tight section--tight-pt-none">
        <div className="wrap">
          <div className="split">
            <div data-rv="left">
              <p className="eyebrow"><span className="bars"><i></i><i></i><i></i></span><span>Technology</span></p>
              <h2 className="h-lg">Boring infrastructure, on purpose</h2>
              <p className="lead" style={{ marginTop: "22px" }}>We choose technology that will still be maintained in ten years and keep the interesting engineering for the product layer, where customers can actually feel it.</p>
              <div className="grid g2" style={{ marginTop: "30px" }}>
                <div><p className="mono" style={{ marginBottom: "10px" }}>Runtime</p><p className="small">Containerised services with automated deploys and one-command rollback, designed to add regions as we grow.</p></div>
                <div><p className="mono" style={{ marginBottom: "10px" }}>Data</p><p className="small">PostgreSQL as the system of record, event-driven sync between services, encryption in transit and at rest.</p></div>
                <div><p className="mono" style={{ marginBottom: "10px" }}>AI</p><p className="small">An evaluation harness gates every model change. Customer data is never used to train shared models.</p></div>
                <div><p className="mono" style={{ marginBottom: "10px" }}>Delivery</p><p className="small">Trunk-based development, continuous integration and feature-flagged releases, so changes ship small.</p></div>
              </div>
            </div>
            <div data-rv="right">
              <div className="card card--flat" style={{ padding: "clamp(22px,2.6vw,32px)" }}>
                <p className="mono" style={{ marginBottom: "18px" }}>Platform capabilities</p>
                <div className="eco__mods">
                  <span className="mod mod--core">Identity &amp; SSO</span><span className="mod mod--core">Permissions engine</span>
                  <span className="mod mod--core">Workflow automation</span><span className="mod mod--core">Audit log</span>
                  <span className="mod">REST &amp; GraphQL APIs</span><span className="mod">Webhooks</span>
                  <span className="mod">Event bus</span><span className="mod">Reporting engine</span>
                  <span className="mod">Notification service</span><span className="mod">File &amp; e-sign</span>
                  <span className="mod">Sandbox tenants</span><span className="mod">Data export</span>
                </div>
                <hr className="rule" style={{ margin: "26px 0" }} />
                <p className="mono" style={{ marginBottom: "18px" }}>Runs on</p>
                <div className="eco__mods">
                  <span className="mod">TypeScript</span><span className="mod">Go</span><span className="mod">Python</span>
                  <span className="mod">PostgreSQL</span><span className="mod">Kafka</span><span className="mod">Redis</span>
                  <span className="mod">Kubernetes</span><span className="mod">Terraform</span><span className="mod">OpenTelemetry</span>
                </div>
              </div>
                <div className="card card--flat codecard" style={{ padding: "clamp(22px,2.6vw,30px)", marginTop: "16px" }}>
                  <p className="mono" style={{ marginBottom: "16px" }}>Open by design</p>
                  {/* Whitespace inside <pre> is significant, so every space and
                      newline is written as an explicit string expression — JSX
                      would otherwise strip the indentation and line breaks. */}
                  <pre>
                    <span className="c-k">POST</span>{' /v1/candidates\n'}
                    <span className="c-d">Authorization:</span>{' Bearer ••••••••\n\n{\n  '}
                    <span className="c-s">"job_id"</span>{':     '}<span className="c-v">"req_8f21"</span>{',\n  '}
                    <span className="c-s">"resume_url"</span>{': '}<span className="c-v">"https://…/cv.pdf"</span>{',\n  '}
                    <span className="c-s">"source"</span>{':     '}<span className="c-v">"careers_page"</span>{'\n}\n\n'}
                    <span className="c-ok">201</span>{' '}<span className="c-d">created</span>{' → '}<span className="c-v">candidate.parsed</span>{' '}<span className="c-d">webhook queued</span>
                  </pre>
                  <p className="small" style={{ marginTop: "16px" }}>Documented REST endpoints and webhooks on every object. Full export in open formats, whenever you ask.</p>
                </div>
            </div>
          </div>
        </div>
      </section>
    </SiteView>
  )
}
