import { SiteView } from '../components/SiteView'
import { DemoScheduler } from '../components/DemoScheduler'

const SEE = [
  'AI screening and match scores on a role like yours',
  'Interview scheduling with Google Meet, no back-and-forth',
  'The Recruiter Copilot doing real pipeline work',
  'Pricing, onboarding and your questions',
]

/** hybent.com/book-demo: pick a 30-minute slot and book it. */
export default function BookDemoPage() {
  return (
    <SiteView route="book-demo">
      <section className="section bd" style={{ paddingTop: 'calc(var(--nav-h) + clamp(32px,4vw,56px))' }}>
        <div className="wrap">
          <div className="bd__shell" data-rv="up">
            <aside className="bd__info">
              <img className="bd__logo" src="/hybent/hybent-mark.png" alt="" width="44" height="44" />
              <p className="bd__host">Hybent team</p>
              <h1 className="bd__title">Hybent Hiring demo</h1>
              <ul className="bd__meta">
                <li><span aria-hidden="true">◷</span>30 minutes</li>
                <li><span aria-hidden="true">▶</span>Google Meet · link sent on booking</li>
                <li><span aria-hidden="true">✓</span>Free · no commitment</li>
              </ul>
              <p className="bd__lead">A live walkthrough on your own hiring, not a slide deck. You’ll see:</p>
              <ul className="bd__see">{SEE.map((s) => <li key={s}>{s}</li>)}</ul>
              <p className="bd__alt">Prefer to try it yourself? <a href="/free-trial">Start a 7-day free trial</a>.</p>
            </aside>
            <div className="bd__main">
              <h2 className="bd__step">Select a date &amp; time</h2>
              <DemoScheduler mode="book" />
            </div>
          </div>
        </div>
      </section>
    </SiteView>
  )
}
