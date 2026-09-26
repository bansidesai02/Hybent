import { SiteView } from '../components/SiteView'
import { AUTH, SITE } from '@/app/paths'

/**
 * Pricing for Hybent Hiring.
 *
 * Every paid plan is the same product and the same seat bundle (1 admin + 2
 * recruiters); the only variable is the commitment term. Monthly rates are the
 * $69 standard rate less 5% (6 months) and 10% (12 months), rounded to whole
 * dollars. Additional seats and custom terms go through sales.
 */

type Plan = {
  id: string
  name: string
  term: string
  price: string | null
  /** Standard monthly rate, struck through on discounted terms. */
  was?: string
  billed: string
  save?: string
  featured?: boolean
  cta: { label: string; href: string }
}

const PLANS: Plan[] = [
  {
    id: '1m',
    name: 'Standard',
    term: 'Billed monthly',
    price: '69',
    billed: 'Billed $69 monthly',
    cta: { label: 'Get started', href: `${AUTH.register}?plan=1m` },
  },
  {
    id: '6m',
    name: '6 months',
    term: '6-month term',
    price: '66',
    was: '69',
    billed: 'Billed $396 every 6 months',
    save: 'Save 5%',
    cta: { label: 'Get started', href: `${AUTH.register}?plan=6m` },
  },
  {
    id: '12m',
    name: '12 months',
    term: '12-month term',
    price: '62',
    was: '69',
    billed: 'Billed $744 per year',
    save: 'Save 10%',
    featured: true,
    cta: { label: 'Get started', href: `${AUTH.register}?plan=12m` },
  },
  {
    id: 'custom',
    name: 'Custom',
    term: 'Tailored to your team',
    price: null,
    billed: 'Custom seats and terms',
    cta: { label: 'Contact sales', href: SITE.contact },
  },
]

const INCLUDED = [
  '1 admin + 2 recruiter seats',
  'AI resume parsing & screening',
  'AI match scoring',
  'Pipeline & interview scheduling',
  'Hiring analytics',
]

const CUSTOM_INCLUDED = [
  'Everything in the standard plans',
  'Seats sized to your team',
  'Tailored onboarding',
  'Invoicing on your terms',
]

const PRICING_FAQ = [
  {
    q: 'What is included in every plan?',
    a: 'Every plan includes the full Hybent Hiring product with 1 admin seat and 2 recruiter seats. The 1, 6 and 12 month plans differ only in commitment term and monthly rate.',
  },
  {
    q: 'How do additional seats work?',
    a: 'Need more than 2 recruiters? Additional seats can be added to any plan. Contact us and we will size them to your team.',
  },
  {
    q: 'How are the 6 and 12 month plans billed?',
    a: 'The 6-month plan is $66 per month, billed $396 every 6 months (5% off the monthly rate). The 12-month plan is $62 per month, billed $744 per year (10% off).',
  },
  {
    q: 'Can I switch plans later?',
    a: 'Yes. Talk to us when you want to move to a longer term or add seats and we will adjust your plan.',
  },
]

function Check() {
  return <svg aria-hidden="true"><use href="#i-check" /></svg>
}

export default function PricingPage() {
  return (
    <SiteView route="pricing">
      <section className="hero">
        <div className="hero__orb orb-a" data-para="0.02"></div>
        <div className="hero__orb orb-b" data-para="-0.03"></div>

        <div className="wrap center">
          <p className="eyebrow" data-rv="up" style={{ justifyContent: 'center' }}><span className="bars"><i></i><i></i><i></i></span><span>Pricing</span></p>
          <h1 style={{ fontSize: 'clamp(2.35rem,4.6vw,3.6rem)', marginTop: '14px' }} data-rv="up" data-delay="80">Simple pricing for <span className="grad-text">Hybent Hiring</span></h1>
          <p className="hero__sub" data-rv="up" data-delay="160" style={{ marginInline: 'auto', textAlign: 'center' }}>Every plan includes 1 admin and 2 recruiter seats. Commit longer, pay less.</p>
        </div>
      </section>

      <section className="section section--tight-pt-none" id="plans">
        <div className="wrap">
          <div className="price-grid">
            {PLANS.map((plan, i) => (
              <article key={plan.id} className="price-card" data-rv="up" data-delay={i * 60}>
                <div className="price-card__head">
                  <h2 className="price-card__name">{plan.name}</h2>
                  {plan.featured ? (
                    <span className="price-card__tag">Best value</span>
                  ) : (
                    plan.save && <span className="price-card__save">{plan.save}</span>
                  )}
                </div>

                <p className="price-card__amount">
                  {plan.price ? (
                    <>
                      <b>${plan.price}</b>
                      <span>/month</span>
                      {plan.was && <s>${plan.was}</s>}
                    </>
                  ) : (
                    <b className="price-card__talk">Let&rsquo;s talk</b>
                  )}
                </p>
                <p className="price-card__billed">
                  {plan.billed}
                  {plan.featured && plan.save && <> &middot; <em>{plan.save}</em></>}
                </p>

                <a className="btn btn-ghost price-card__cta" href={plan.cta.href}>
                  {plan.cta.label}
                </a>

                <p className="price-card__inc">Includes</p>
                <ul className="price-card__list">
                  {(plan.price ? INCLUDED : CUSTOM_INCLUDED).map((item) => (
                    <li key={item}><Check />{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <p className="price-note" data-rv="up">
            Need more than 2 recruiters? Additional seats are available on any plan &mdash;{' '}
            <a href={SITE.contact}>contact us</a>.
          </p>
        </div>
      </section>

      <section className="section section--tight" id="pricing-faq">
        <div className="wrap" style={{ maxWidth: '860px' }}>
          <div className="section-head center" data-rv="up">
            <p className="eyebrow" style={{ justifyContent: 'center' }}><span className="bars"><i></i><i></i><i></i></span><span>Questions</span></p>
            <h2 className="h-lg">Pricing FAQ</h2>
          </div>
          <div className="faq" data-rv="up">
            {PRICING_FAQ.map((item, i) => (
              <details key={item.q} open={i === 0}>
                <summary>{item.q}<span className="pm"></span></summary>
                <div className="ans">{item.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--tight-pt-none">
        <div className="wrap">
          <div className="cta-band" data-rv="scale">
            <div className="split">
              <div>
                <p className="eyebrow"><span className="bars"><i></i><i></i><i></i></span><span>Get started</span></p>
                <h2 className="h-lg">Start hiring with Hybent today</h2>
                <p className="lead" style={{ marginTop: '22px' }}>
                  Pick a plan and set up your workspace in minutes, or talk to us about a plan built around your team.
                </p>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '30px' }}>
                  <a className="btn btn-primary" href={`${AUTH.register}?plan=12m`}>
                    Get started
                    <svg className="arw" width="16" height="16" aria-hidden="true"><use href="#i-arrow" /></svg>
                  </a>
                  <a className="btn btn-ghost" href={SITE.contact}>Talk to sales</a>
                </div>
              </div>
              <div>
                <p className="mono" style={{ marginBottom: '14px' }}>Every plan includes</p>
                <ul className="feat-list">
                  <li><Check />1 admin and 2 recruiter seats</li>
                  <li><Check />The full Hybent Hiring product</li>
                  <li><Check />Additional seats on request</li>
                  <li><Check />Up to 10% off with a longer term</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
    </SiteView>
  )
}
