import { useSearchParams } from 'react-router-dom'
import { SiteView } from '../components/SiteView'
import { TrialRequestForm } from '../components/TrialRequestForm'
import { SITE } from '@/app/paths'

const STEPS = [
  { title: 'Request', text: 'Tell us about you and your company. A business email is required.' },
  { title: 'We verify', text: 'Our team checks the company, usually within one business day.' },
  { title: 'Hire for 7 days', text: 'Set your password and use your chosen plan with your team.' },
]

// What each plan's trial includes, by the pricing card the visitor came from.
const INCLUDED = {
  standard: [
    'All Standard features: AI parsing, screening and match scoring',
    '1 admin seat',
    'Pipeline & interview scheduling',
    'Export your data to Excel, CSV or PDF at any time',
  ],
  pro: [
    'All Pro features, including the Recruiter Copilot',
    '1 admin + 1 recruiter seat',
    'AI resume parsing, screening and match scoring',
    'Export your data to Excel, CSV or PDF at any time',
  ],
}

function Check() {
  return <svg aria-hidden="true"><use href="#i-check" /></svg>
}

export default function FreeTrialPage() {
  const [params] = useSearchParams()
  const plan = params.get('plan') === 'standard' ? 'standard' : 'pro'
  const planName = plan === 'standard' ? 'Standard' : 'Pro'
  return (
    <SiteView route="free-trial">
      <section className="section" id="free-trial" style={{ paddingTop: 'calc(var(--nav-h) + clamp(40px,5vw,72px))' }}>
        <div className="wrap">
          <div className="split" style={{ alignItems: 'start' }}>
            <div data-rv="left">
              <p className="eyebrow"><span className="bars"><i></i><i></i><i></i></span><span>7-day free trial</span></p>
              <h1 className="h-lg">Try Hybent Hiring {planName} free for 7 days</h1>
              <p className="lead" style={{ marginTop: '22px' }}>
                Run a real search on Hybent Hiring with your team. No card required. When the trial ends, upgrade to {planName} and keep everything you set up.
              </p>

              <p className="mono" style={{ margin: '30px 0 12px' }}>Your trial includes</p>
              <ul className="feat-list">
                {INCLUDED[plan].map((item) => <li key={item}><Check />{item}</li>)}
              </ul>

              <p className="mono" style={{ margin: '30px 0 12px' }}>How it works</p>
              <ol style={{ display: 'grid', gap: '14px', listStyle: 'none', padding: 0 }}>
                {STEPS.map((step, i) => (
                  <li key={step.title} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                    <span className="icon-tile" style={{ width: '32px', height: '32px', borderRadius: '10px', flex: 'none', fontWeight: 700 }}>{i + 1}</span>
                    <span><b>{step.title}</b><br /><span style={{ color: 'var(--muted)' }}>{step.text}</span></span>
                  </li>
                ))}
              </ol>

              <p className="form-note" style={{ marginTop: '26px' }}>
                After 7 days your team’s access pauses until you choose a plan. Your admin can still sign in to upgrade
                or export data, and the trial workspace is deleted 30 days later if you don’t upgrade.
                See <a href={SITE.pricing}>pricing</a>.
              </p>
            </div>

            <div className="card trial-form-card" data-rv="right" style={{ padding: 'clamp(24px,3vw,36px)' }}>
              <TrialRequestForm />
            </div>
          </div>
        </div>
      </section>
    </SiteView>
  )
}
