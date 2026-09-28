import { SiteView } from '../components/SiteView'

export default function AboutPage() {
  return (
    <SiteView route="about">
      <section className="hero">
        <div className="hero__orb orb-a" data-para="0.02"></div>
        <div className="hero__orb orb-b" data-para="-0.03"></div>

        <div className="wrap">
          <p className="eyebrow" data-rv="up"><span className="bars"><i></i><i></i><i></i></span><span>Company</span></p>
          <h1 style={{ fontSize: "clamp(2.35rem,4.6vw,3.6rem)", marginTop: "14px" }} data-rv="up" data-delay="80">AI-powered software, built for businesses that need results.</h1>
          <p className="hero__sub" data-rv="up" data-delay="160">We build custom software and AI products — including Hybent Hiring — that remove work instead of adding another dashboard. For teams in India and worldwide.</p>
          <div className="hero__actions" data-rv="up" data-delay="240">
            <a className="btn btn-primary btn-lg" href="/contact">Talk to us <svg className="arw" width="17" height="17" aria-hidden="true"><use href="#i-arrow" /></svg></a>
          </div>
        </div>
      </section>

      <section className="section section--tight-pt-none" id="story">
        <div className="wrap">
          <div style={{ maxWidth: "760px" }} data-rv="up">
            <p className="eyebrow"><span className="bars"><i></i><i></i><i></i></span><span>Our story</span></p>
            <h2 className="h-lg">Why we built HYBENT</h2>
            <p className="lead" style={{ marginTop: "22px" }}>We kept watching the same two problems slow businesses down.</p>
            <p className="lead" style={{ marginTop: "16px" }}>Building software took too long and cost too much — agencies over-promised, freelancers disappeared, and internal teams were already stretched thin. And hiring, the thing every growing company needs most, was drowning teams in manual work: hundreds of resumes, endless spreadsheets, decisions made on gut feel at midnight.</p>
            <p className="lead" style={{ marginTop: "16px" }}>So we stopped complaining and started building.</p>
            <p className="lead" style={{ marginTop: "16px" }}>HYBENT began with a simple conviction: AI should genuinely remove work, not just add another dashboard. Today we do two things. Our services team designs and builds custom web, mobile and AI software for businesses — end to end, from first sketch to maintenance. And our product line is led by Hybent Hiring, an AI recruitment platform that parses resumes, screens candidates with explainable AI, and hands recruiters back their time.</p>
            <p className="lead" style={{ marginTop: "16px" }}>We&rsquo;re based in Ahmedabad, India, and we work with teams everywhere. We ship fast, we give honest timelines, and we treat every client like a long-term partner — because the best work comes from long relationships.</p>
          </div>
        </div>
      </section>

      <section className="section section--tight-pt-none" id="what-we-do">
        <div className="wrap">
          <div className="section-head" data-rv="up">
            <p className="eyebrow" style={{ justifyContent: "center" }}><span className="bars"><i></i><i></i><i></i></span><span>What we do</span></p>
            <h2 className="h-lg">Two ways we work with you</h2>
          </div>
          <div className="grid g2" style={{ gap: "clamp(16px,2vw,24px)" }}>
            <article className="card" data-rv="left" style={{ padding: "clamp(28px,3.4vw,44px)" }}>
              <div className="card__glow" style={{ top: "-60px", left: "-40px" }}></div>
              <p className="eyebrow"><span className="icon-tile" style={{ width: "32px", height: "32px", borderRadius: "9px" }}><svg style={{ width: "15px", height: "15px" }} aria-hidden="true"><use href="#i-users" /></svg></span><span>Products</span></p>
              <h3 className="h-md">Hybent Hiring — our AI recruitment platform</h3>
              <p className="lead" style={{ marginTop: "18px", fontSize: "1rem" }}>Resume parsing, AI-powered screening, interview management, and a recruiter copilot — so your team shortlists in minutes, not days.</p>
              <p style={{ marginTop: "22px" }}><a className="link-arrow" href="/products/hiring">Explore Hybent Hiring <svg width="15" height="15" aria-hidden="true"><use href="#i-arrow" /></svg></a></p>
            </article>
            <article className="card" data-rv="right" style={{ padding: "clamp(28px,3.4vw,44px)" }}>
              <div className="card__glow" style={{ top: "-60px", right: "-40px" }}></div>
              <p className="eyebrow"><span className="icon-tile" style={{ width: "32px", height: "32px", borderRadius: "9px" }}><svg style={{ width: "15px", height: "15px" }} aria-hidden="true"><use href="#i-code" /></svg></span><span>IT Services</span></p>
              <h3 className="h-md">Custom software, built end to end</h3>
              <p className="lead" style={{ marginTop: "18px", fontSize: "1rem" }}>Web, mobile and AI software designed, built, tested and maintained by one team. First working release in 4–8 weeks. Dedicated pre-vetted engineers available when you need extra hands.</p>
              <p style={{ display: "flex", gap: "22px", flexWrap: "wrap", marginTop: "22px" }}>
                <a className="link-arrow" href="/services">Start a project <svg width="15" height="15" aria-hidden="true"><use href="#i-arrow" /></svg></a>
                <a className="link-arrow" href="/hire-talent">Hire engineers <svg width="15" height="15" aria-hidden="true"><use href="#i-arrow" /></svg></a>
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="section section--tight-pt-none" id="how-we-work">
        <div className="wrap">
          <div className="section-head" data-rv="up">
            <p className="eyebrow" style={{ justifyContent: "center" }}><span className="bars"><i></i><i></i><i></i></span><span>How we work</span></p>
            <h2 className="h-lg">What you can expect from us</h2>
          </div>
          <div className="grid g3">
            <article className="card" data-rv="up"><h3 className="h-sm">Honest timelines</h3><p className="small" style={{ marginTop: "10px" }}>We quote realistically and ship when we say we will. No surprise invoices, no &ldquo;two more weeks&rdquo; forever.</p></article>
            <article className="card" data-rv="up" data-delay="70"><h3 className="h-sm">AI with accountability</h3><p className="small" style={{ marginTop: "10px" }}>Our AI is explainable and auditable — you can always see why it made a recommendation. You stay in control of every decision.</p></article>
            <article className="card" data-rv="up" data-delay="140"><h3 className="h-sm">Partners, not vendors</h3><p className="small" style={{ marginTop: "10px" }}>We win when you win. We&rsquo;d rather build one product that lasts five years than five products that last five months.</p></article>
          </div>
        </div>
      </section>

      <section className="section section--tight-pt-none">
        <div className="wrap">
          <div className="split" style={{ alignItems: "start" }}>
            <div data-rv="left">
              <p className="eyebrow"><span className="bars"><i></i><i></i><i></i></span><span>Where we are</span></p>
              <h2 className="h-md">Company milestones</h2>
              <p className="small" style={{ marginTop: "14px", maxWidth: "44ch" }}>We would rather show progress than badges. This space will hold recognition when it has actually been earned.</p>
              <div className="grid" style={{ gap: "12px", marginTop: "26px" }}>
                <article className="card" style={{ display: "flex", gap: "16px", alignItems: "center", padding: "20px 22px" }}>
                  <span className="icon-tile"><svg aria-hidden="true"><use href="#i-award" /></svg></span>
                  <span><h3 className="h-sm">First product live</h3><p className="small">Hybent Hiring is in production with our earliest customers</p></span></article>
                <article className="card" style={{ display: "flex", gap: "16px", alignItems: "center", padding: "20px 22px" }}>
                  <span className="icon-tile"><svg aria-hidden="true"><use href="#i-zap" /></svg></span>
                  <span><h3 className="h-sm">AI-first development</h3><p className="small">Every product built on the same AI and platform foundation</p></span></article>
                <article className="card" style={{ display: "flex", gap: "16px", alignItems: "center", padding: "20px 22px" }}>
                  <span className="icon-tile"><svg aria-hidden="true"><use href="#i-heart" /></svg></span>
                  <span><h3 className="h-sm">Growing team, growing ecosystem</h3><p className="small">Hiring engineers and designers to build what comes after Hybent Hiring</p></span></article>
              </div>
            </div>

            <div data-rv="right">
              <p className="eyebrow"><span className="bars"><i></i><i></i><i></i></span><span>Our base</span></p>
              <h2 className="h-md">Built in India, for teams anywhere</h2>
              <div className="globe" style={{ marginTop: "22px" }}>
                <svg viewBox="0 0 420 200" role="img" aria-label="Illustrative world map">
                  <g fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="1">
                    <path d="M40 70 L70 52 L110 60 L128 84 L104 120 L70 130 L44 104Z" />
                    <path d="M112 128 L138 122 L150 150 L136 182 L118 168Z" />
                    <path d="M186 44 L232 38 L246 58 L224 74 L192 68Z" />
                    <path d="M196 84 L232 78 L248 108 L232 154 L206 148 L192 116Z" />
                    <path d="M258 52 L300 46 L332 62 L322 96 L286 104 L262 82Z" />
                    <path d="M330 130 L372 124 L384 152 L356 170 L332 156Z" />
                  </g>
                  <g>
                    <circle className="pin" cx="272" cy="92" r="3.4" /><circle className="pin-ring" cx="272" cy="92" r="3" />
                    <circle className="pin" cx="204" cy="56" r="3" /><circle className="pin-ring" cx="204" cy="56" r="3" style={{ animationDelay: ".8s" }} />
                    <circle className="pin" cx="78" cy="78" r="3" /><circle className="pin-ring" cx="78" cy="78" r="3" style={{ animationDelay: "1.6s" }} />
                    <circle className="pin" cx="356" cy="146" r="3" /><circle className="pin-ring" cx="356" cy="146" r="3" style={{ animationDelay: "2.4s" }} />
                  </g>
                </svg>
              </div>
              <div style={{ marginTop: "20px" }}>
                <div className="region"><b>Ahmedabad, India</b><span>Headquarters · engineering, product &amp; design</span></div>
                <div className="region"><b>India</b><span>Our primary market today</span></div>
                <div className="region"><b>Remote</b><span>Distributed team on IST core hours</span></div>
                <div className="region"><b>Worldwide</b><span>Hybent Hiring is available to teams in any region</span></div>
                <div className="region"><b>Expansion</b><span>EMEA and Americas presence — planned</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="cta-band" data-rv="scale">
            <div style={{ maxWidth: "640px" }}>
              <p className="eyebrow"><span className="bars"><i></i><i></i><i></i></span><span>Get started</span></p>
              <h2 className="h-lg">Have a project — or a hiring problem?</h2>
              <p className="lead" style={{ marginTop: "18px" }}>Talk to us. We&rsquo;ll scope it honestly and tell you what it really takes.</p>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "30px" }}>
                <a className="btn btn-primary btn-lg" href="/contact">Talk to us <svg className="arw" width="17" height="17" aria-hidden="true"><use href="#i-arrow" /></svg></a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </SiteView>
  )
}
