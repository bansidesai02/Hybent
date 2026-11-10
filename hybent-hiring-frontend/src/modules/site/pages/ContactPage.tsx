import { ContactForm } from '../components/ContactForm'
import { SiteView } from '../components/SiteView'

export default function ContactPage() {
  return (
    <SiteView route="contact">
      <section className="section" id="contact" style={{ paddingTop: "calc(var(--nav-h) + clamp(40px,5vw,72px))" }}>
        <div className="wrap">
          <div className="split" style={{ alignItems: "start" }}>
            <div data-rv="left">
              <p className="eyebrow"><span className="bars"><i></i><i></i><i></i></span><span>Contact</span></p>
              <h1 className="h-lg">Tell us what you are trying to fix</h1>
              <p className="lead" style={{ marginTop: "22px" }}>Send us the problem, not a meeting request. Someone from the team replies within one business day — with an answer, not a calendar link to another calendar link.</p>
              <div style={{ marginTop: "34px" }}>
                <div className="contact-item"><span className="icon-tile" style={{ width: "38px", height: "38px", borderRadius: "11px" }}><svg style={{ width: "17px", height: "17px" }} aria-hidden="true"><use href="#i-mail" /></svg></span><span><b><a href="mailto:info@hybent.com">info@hybent.com</a></b><span>Sales, support, partnerships &amp; security</span></span></div>
                <div className="contact-item"><span className="icon-tile" style={{ width: "38px", height: "38px", borderRadius: "11px" }}><svg style={{ width: "17px", height: "17px" }} aria-hidden="true"><use href="#i-pin" /></svg></span><span><b>Ahmedabad, Gujarat, India</b><span>Headquarters · Mon–Fri, 09:00–18:00 IST</span></span></div>
              </div>
            </div>

            <div className="card" data-rv="right" style={{ padding: "clamp(24px,3vw,36px)" }}>
              <ContactForm />
            </div>
            <div className="next-steps" data-rv="up">
              <p className="mono">What happens after you send it</p>
              <ol>
                <li><span className="next-steps__n">1</span><b>You describe it</b><span>Tell us what you are trying to fix. Two lines is enough.</span></li>
                <li><span className="next-steps__n">2</span><b>A person replies</b><span>Someone from the team answers within one business day, Mon–Fri IST.</span></li>
                <li><span className="next-steps__n">3</span><b>We work it</b><span>A clear answer, a quote or a short call, whatever moves it forward.</span></li>
              </ol>
            </div>
          </div>
        </div>
      </section>
    </SiteView>
  )
}
