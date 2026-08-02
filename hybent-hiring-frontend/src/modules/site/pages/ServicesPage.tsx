import { SiteView } from '../components/SiteView'

export default function ServicesPage() {
  return (
    <SiteView route="services">
      <section className="hero">
        <div className="hero__orb orb-a" data-para="0.02"></div>
        <div className="hero__orb orb-b" data-para="-0.03"></div>

        <div className="wrap">
          <p className="eyebrow" data-rv="up"><span className="bars"><i></i><i></i><i></i></span><span>Enterprise Services</span></p>
          <h1 style={{ fontSize: "clamp(2.35rem,4.6vw,3.6rem)", marginTop: "14px" }} data-rv="up" data-delay="80">End-to-end software engineering &amp; IT solutions</h1>
          <p className="hero__sub" data-rv="up" data-delay="160">From enterprise software development to cloud architecture and AI integration, we deliver high-impact digital solutions tailored to your business goals.</p>
        </div>
      </section>

      <section className="section" id="services">
        <div className="wrap">
          <div className="grid g3">
            <article className="card" data-rv="up">
              <span className="icon-tile">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 2.6 2.8 7.3 12 12l9.2-4.7z" />
                  <path d="M2.8 12.4 12 17l9.2-4.6M2.8 17 12 21.6 21.2 17" />
                </svg>
              </span>
              <h3 className="h-sm" style={{ margin: "16px 0 8px" }}>Custom Software Engineering</h3>
              <p className="small">Scalable backend architectures, modern web apps, and microservices designed for enterprise security and high throughput.</p>
            </article>

            <article className="card" data-rv="up" data-delay="60">
              <span className="icon-tile">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="4" y="8" width="16" height="12" rx="3" />
                  <path d="M12 4.4V8M9.4 13.4v1.6M14.6 13.4v1.6M2 13v3M22 13v3" />
                  <circle cx="12" cy="3" r="1.4" />
                </svg>
              </span>
              <h3 className="h-sm" style={{ margin: "16px 0 8px" }}>AI &amp; Machine Learning Integration</h3>
              <p className="small">Custom AI models, LLM fine-tuning, automated workflow pipelines, and intelligent data extraction engines.</p>
            </article>

            <article className="card" data-rv="up" data-delay="120">
              <span className="icon-tile">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="5" y="5" width="14" height="14" rx="2.4" />
                  <rect x="9" y="9" width="6" height="6" rx="1.2" />
                  <path d="M9 2.6v2.4M15 2.6v2.4M9 19v2.4M15 19v2.4M2.6 9H5M2.6 15H5M19 9h2.4M19 15h2.4" />
                </svg>
              </span>
              <h3 className="h-sm" style={{ margin: "16px 0 8px" }}>Web &amp; Mobile Product Development</h3>
              <p className="small">Native and cross-platform apps built with React, TypeScript, Node.js, and mobile frameworks for seamless UX.</p>
            </article>

            <article className="card" data-rv="up" data-delay="180">
              <span className="icon-tile">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.1 11.2 3.9 3.9 0 0 0 6.5 19z" />
                </svg>
              </span>
              <h3 className="h-sm" style={{ margin: "16px 0 8px" }}>Cloud Infrastructure &amp; DevOps</h3>
              <p className="small">CI/CD pipelines, containerization, cloud migration, and automated infrastructure management on AWS and GCP.</p>
            </article>

            <article className="card" data-rv="up" data-delay="240">
              <span className="icon-tile">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 22s8-3.6 8-9.6V5.4L12 2 4 5.4v7c0 6 8 9.6 8 9.6z" />
                  <path d="M9.2 12.2l2 2 3.6-3.9" />
                </svg>
              </span>
              <h3 className="h-sm" style={{ margin: "16px 0 8px" }}>IT Security &amp; Compliance</h3>
              <p className="small">Role-based access controls, SOC2 / ISO compliance alignment, vulnerability auditing, and automated data encryption.</p>
            </article>

            <article className="card" data-rv="up" data-delay="300">
              <span className="icon-tile">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <ellipse cx="12" cy="5.6" rx="8" ry="3.2" />
                  <path d="M4 5.6v12.8c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2V5.6M4 12c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2" />
                </svg>
              </span>
              <h3 className="h-sm" style={{ margin: "16px 0 8px" }}>Data Engineering &amp; Analytics</h3>
              <p className="small">Real-time data streaming pipelines, analytics dashboards, enterprise data warehousing, and system monitoring.</p>
            </article>
          </div>
        </div>
      </section>
    </SiteView>
  )
}
