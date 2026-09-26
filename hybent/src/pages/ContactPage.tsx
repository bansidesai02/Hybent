export default function ContactPage() {
  return (
    <div className="route route--on" data-route="contact">
      <section className="hero">
        <div className="hero__orb orb-a" data-para="0.02"></div>
        <div className="hero__orb orb-b" data-para="-0.03"></div>

        <div className="wrap">
          <p className="eyebrow" data-rv="up"><span className="bars"><i></i><i></i><i></i></span><span>Contact</span></p>
          <h1 style={{ fontSize: "clamp(2.35rem,4.6vw,3.6rem)", marginTop: "14px" }} data-rv="up" data-delay="80">Talk to the people building it</h1>
          <p className="hero__sub" data-rv="up" data-delay="160">No SDR queue, no qualification call before the real one. Describe the problem and someone who works on the product will answer it.</p>
        </div>
      </section>

      <section className="section section--tight-pt-none" id="contact">
        <div className="wrap">
          <div className="split" style={{ alignItems: "start" }}>
            <div data-rv="left">
              <p className="eyebrow"><span className="bars"><i></i><i></i><i></i></span><span>Contact</span></p>
              <h2 className="h-lg">Tell us what you are trying to fix</h2>
              <p className="lead" style={{ marginTop: "22px" }}>Send us the problem, not a meeting request. Someone from the team replies within one business day — with an answer, not a calendar link to another calendar link.</p>
              <div style={{ marginTop: "34px" }}>
                <div className="contact-item"><span className="icon-tile" style={{ width: "38px", height: "38px", borderRadius: "11px" }}><svg style={{ width: "17px", height: "17px" }} aria-hidden="true"><use href="#i-mail" /></svg></span><span><b><a href="mailto:info@hybent.com">info@hybent.com</a></b><span>Sales, support, partnerships &amp; security</span></span></div>
                <div className="contact-item"><span className="icon-tile" style={{ width: "38px", height: "38px", borderRadius: "11px" }}><svg style={{ width: "17px", height: "17px" }} aria-hidden="true"><use href="#i-pin" /></svg></span><span><b>Ahmedabad, Gujarat, India</b><span>Headquarters · Mon–Fri, 09:00–18:00 IST</span></span></div>
              </div>
            </div>

            <div className="card" data-rv="right" style={{ padding: "clamp(24px,3vw,36px)" }}>
              <form id="contactForm" noValidate>
                <div className="grid g2" style={{ gap: "16px" }}>
                  <div className="field"><label htmlFor="cf-name">Full name</label><input id="cf-name" name="name" type="text" placeholder="Ananya Shah" required /></div>
                  <div className="field"><label htmlFor="cf-email">Work email</label><input id="cf-email" name="email" type="email" placeholder="ananya@company.com" required /></div>
                </div>
                <div className="grid g2" style={{ gap: "16px", marginTop: "16px" }}>
                  <div className="field"><label htmlFor="cf-company">Company</label><input id="cf-company" name="company" type="text" placeholder="Company name" /></div>
                  <div className="field"><label htmlFor="cf-size">Team size</label>
                    <select id="cf-size" name="size" defaultValue="251–1,000"><option>1–50</option><option>51–250</option><option>251–1,000</option><option>1,000–5,000</option><option>5,000+</option></select>
                  </div>
                </div>
                <div className="field" style={{ marginTop: "16px" }}><label htmlFor="cf-topic">What brings you here</label>
                  <select id="cf-topic" name="topic"><option>Book a Hybent Hiring demo</option><option>Platform &amp; roadmap</option><option>Security &amp; compliance</option><option>Partner with HYBENT</option><option>Careers</option><option>Something else</option></select>
                </div>
                <div className="field" style={{ marginTop: "16px" }}><label htmlFor="cf-msg">Message</label><textarea id="cf-msg" name="message" placeholder="We hire around 200 people a year and lose two weeks of every search in screening…"></textarea></div>
                <button className="btn btn-primary btn-lg" type="submit" style={{ width: "100%", marginTop: "22px" }}>Send message <svg className="arw" width="17" height="17" aria-hidden="true"><use href="#i-arrow" /></svg></button>
                <p className="toast" id="contactToast" role="status">Thanks — we have your message and will reply within one business day.</p>
                <p className="form-note" style={{ marginTop: "14px" }}>By sending this you agree to our privacy policy. We will never sell your details, and one email is all it takes to be removed from our systems.</p>
              </form>
            </div>
            <div className="figrow" data-rv="up">
              <div className="figpanel figpanel--stack"><p className="mono" style={{ marginBottom: "14px", color: "var(--dim)" }}>What happens after you send it</p>
              <svg className="fig" viewBox="0 0 480 120" role="img" aria-label="Three steps after sending a message: you describe the problem, a named person replies within one business day, then we work through it together">
              <line x1="60" y1="46" x2="420" y2="46" stroke="var(--border)" strokeWidth="1.6" />
              <g>
              <circle cx="60" cy="46" r="26" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="1.6" />
              <rect x="48" y="38" width="24" height="17" rx="4" fill="none" stroke="url(#hbgh)" strokeWidth="2.4" />
              <path d="M48 41l12 8 12-8" fill="none" stroke="url(#hbgh)" strokeWidth="2.2" strokeLinejoin="round" />
              <circle cx="240" cy="46" r="26" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="1.6" />
              <circle cx="240" cy="40" r="7.5" fill="url(#hbg)" />
              <path d="M228 58a12 12 0 0124 0" fill="url(#hbg)" opacity=".55" />
              <circle cx="420" cy="46" r="26" fill="url(#hbgh)" opacity=".16" stroke="var(--border-strong)" strokeWidth="1.6" />
              <path d="M409 46l7 7 14-15" fill="none" stroke="url(#hbgh)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </g>
              <g fontFamily="IBM Plex Mono" fontSize="9" letterSpacing="1.3" fill="var(--dim)" textAnchor="middle">
              <text x="60" y="94">YOU DESCRIBE IT</text><text x="240" y="94">A PERSON REPLIES</text><text x="420" y="94">WE WORK IT</text>
              </g>
              <text x="240" y="110" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="8.5" letterSpacing="1.2" fill="var(--cyan)">WITHIN ONE BUSINESS DAY</text>
              </svg></div>
              </div>
            <div className="figrow" data-rv="up">
              <div className="figpanel">
                <svg className="fig" viewBox="0 0 900 190" role="img" aria-label="HYBENT is headquartered in Ahmedabad, Gujarat, India">
                  <g stroke="var(--border)" strokeWidth="1.2" opacity=".85">
                    <path d="M0 46h900M0 96h900M0 146h900M120 0v190M270 0v190M420 0v190M570 0v190M720 0v190" />
                  </g>
                  <g stroke="var(--border-strong)" strokeWidth="1.6" fill="none" opacity=".7">
                    <path d="M0 118C140 118 200 74 330 74S520 122 660 122 820 70 900 70" />
                  </g>
                  <g opacity=".5" fill="url(#hbsoft)">
                    <rect x="150" y="56" width="90" height="34" rx="7" /><rect x="470" y="106" width="76" height="30" rx="7" />
                    <rect x="740" y="52" width="104" height="36" rx="7" /><rect x="300" y="126" width="86" height="30" rx="7" />
                  </g>
                  <g transform="translate(420,58)">
                    <circle cx="30" cy="34" r="30" fill="url(#hbgh)" opacity=".13" />
                    <circle cx="30" cy="34" r="19" fill="url(#hbgh)" opacity=".18" />
                    <path d="M30 12a13 13 0 00-13 13c0 10 13 21 13 21s13-11 13-21a13 13 0 00-13-13z" fill="var(--surface)" stroke="url(#hbgh)" strokeWidth="2.6" />
                    <circle cx="30" cy="25" r="5" fill="url(#hbgh)" />
                  </g>
                  <g fontFamily="IBM Plex Mono" letterSpacing="1.6">
                    <text x="500" y="86" fontSize="12" fill="var(--text)">AHMEDABAD · GUJARAT · INDIA</text>
                    <text x="500" y="106" fontSize="9" fill="var(--dim)">HEADQUARTERS — ENGINEERING, PRODUCT &amp; DESIGN</text>
                    <text x="500" y="124" fontSize="9" fill="var(--dim)">MON–FRI · 09:00–18:00 IST</text>
                  </g>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section section--tight">
        <div className="wrap">
          <div className="news" data-rv="scale">
            <p className="eyebrow" style={{ justifyContent: "center" }}><span className="bars"><i></i><i></i><i></i></span><span>The build log</span></p>
            <h2 className="h-md" style={{ maxWidth: "22ch", marginInline: "auto" }}>Watch the ecosystem get built</h2>
            <p className="lead center" style={{ marginTop: "16px", maxWidth: "52ch" }}>One email a month: what shipped, what slipped, and what we learned building it. No campaigns, no drip sequences.</p>
            <form className="news__form" id="newsForm" noValidate>
              <label htmlFor="nf-email" className="visually-hidden" style={{ position: "absolute", left: "-9999px" }}>Email address</label>
              <input id="nf-email" type="email" placeholder="you@company.com" required />
              <button className="btn btn-primary" type="submit">Subscribe</button>
            </form>
            <p className="toast" id="newsToast" role="status">You are on the list. The next issue goes out at the start of the month.</p>
          </div>
        </div>
      </section>
    </div>
  )
}
