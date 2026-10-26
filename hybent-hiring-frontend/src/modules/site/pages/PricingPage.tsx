import { useState } from 'react'
import { SiteView } from '../components/SiteView'
import { AUTH, SITE } from '@/app/paths'

/**
 * Pricing for Hybent Hiring.
 *
 * Two monthly plans with the same seat bundle (1 admin seat, recruiters added
 * at $10 / ₹999 each): Standard with 5,000 AI credits, and Pro with 10,000
 * credits and the Recruiter Copilot.
 * Custom seats and terms go through sales. Prices are shown in USD or INR;
 * the INR figures are set prices, not a live conversion.
 */

type Currency = 'INR' | 'USD'

type Plan = {
  id: string
  name: string
  price: Record<Currency, string> | null
  billed: string
  featured?: boolean
  includes: string[]
  cta: { label: string; href: string }
}

const STANDARD_INCLUDED = [
  '1 admin seat',
  'Add recruiters as you grow',
  '5,000 AI credits a month',
  'AI resume parsing & screening',
  'AI match scoring',
  'Pipeline & interview scheduling',
  'Hiring analytics',
]

const PLANS: Plan[] = [
  {
    id: 'standard',
    name: 'Standard',
    price: { USD: '$29', INR: '₹2,799' },
    billed: 'Billed monthly',
    includes: STANDARD_INCLUDED,
    cta: { label: 'Get started', href: `${AUTH.register}?plan=standard` },
  },
  {
    id: 'pro',
    name: 'Pro',
    price: { USD: '$39', INR: '₹3,799' },
    billed: 'Billed monthly',
    featured: true,
    includes: ['Everything in Standard', 'Recruiter Copilot', '10,000 AI credits a month', ...STANDARD_INCLUDED.slice(0, 2)],
    cta: { label: 'Get started', href: `${AUTH.register}?plan=pro` },
  },
  {
    id: 'custom',
    name: 'Custom',
    price: null,
    billed: 'Custom seats and terms',
    includes: [
      'Everything in Pro',
      'Seats sized to your team',
      'Tailored onboarding',
      'Invoicing on your terms',
    ],
    cta: { label: 'Contact sales', href: `${SITE.contact}?topic=hiring` },
  },
]

const PRICING_FAQ = [
  {
    q: 'What is the difference between Standard and Pro?',
    a: 'Both plans include the Hybent Hiring platform with 1 admin seat: AI resume parsing and screening, match scoring, pipeline and interview scheduling, and hiring analytics. Standard includes 5,000 AI credits a month. Pro doubles that to 10,000 and adds the Recruiter Copilot, the AI assistant you can ask about candidates, roles and your pipeline in plain language.',
  },
  {
    q: 'What are AI credits?',
    a: 'AI features such as resume parsing, match scoring, pre-screening and the copilot use AI credits. Standard includes 5,000 credits a month and Pro 10,000, shared by your team. If you need more, your admin can buy a top-up from the AI Credits page: 5,000 credits for $10.',
  },
  {
    q: 'How do additional seats work?',
    a: 'Every plan has one admin seat. Need more recruiters? An extra recruiter seat is ₹999 ($10) a month and adds 1,000 AI credits to your monthly pool. Your admin can add seats from the Billing page, or contact us. Interviewers don’t need a seat.',
  },
  {
    q: 'Can I switch plans later?',
    a: 'Yes. Move from Standard to Pro, or add seats, whenever you need to. Talk to us and we will adjust your plan.',
  },
]

function Check() {
  return <svg aria-hidden="true"><use href="#i-check" /></svg>
}

export default function PricingPage() {
  const [currency, setCurrency] = useState<Currency>('INR')

  return (
    <SiteView route="pricing">
      <section className="hero">
        <div className="hero__orb orb-a" data-para="0.02"></div>
        <div className="hero__orb orb-b" data-para="-0.03"></div>

        <div className="wrap center">
          <p className="eyebrow" data-rv="up" style={{ justifyContent: 'center' }}><span className="bars"><i></i><i></i><i></i></span><span>Pricing</span></p>
          <h1 style={{ fontSize: 'clamp(2.35rem,4.6vw,3.6rem)', marginTop: '14px' }} data-rv="up" data-delay="80">Simple pricing for <span className="grad-text">Hybent Hiring</span></h1>
          <p className="hero__sub" data-rv="up" data-delay="160" style={{ marginInline: 'auto', textAlign: 'center' }}>Every plan includes 1 admin seat. Add recruiters as you need them, and choose Pro for the Recruiter Copilot.</p>
        </div>
      </section>

      <section className="section section--tight-pt-none" id="plans">
        <div className="wrap">
          <div className="price-cur" data-rv="up">
            <div className="price-cur__seg" role="group" aria-label="Currency">
              <button type="button" aria-pressed={currency === 'INR'} onClick={() => setCurrency('INR')}><b>₹</b>INR</button>
              <button type="button" aria-pressed={currency === 'USD'} onClick={() => setCurrency('USD')}><b>$</b>USD</button>
            </div>
          </div>
          <div className="price-grid">
            {PLANS.map((plan, i) => (
              <article key={plan.id} className="price-card" data-rv="up" data-delay={i * 60}>
                <div className="price-card__head">
                  <h2 className="price-card__name">{plan.name}</h2>
                  {plan.featured && <span className="price-card__tag">Most popular</span>}
                </div>

                <p className="price-card__amount">
                  {plan.price ? (
                    <>
                      <b>{plan.price[currency]}</b>
                      <span>/month</span>
                    </>
                  ) : (
                    <b className="price-card__talk">Let&rsquo;s talk</b>
                  )}
                </p>
                <p className="price-card__billed">{plan.billed}</p>

                <a className="btn btn-ghost price-card__cta" href={plan.cta.href}>
                  {plan.cta.label}
                </a>

                <p className="price-card__inc">Includes</p>
                <ul className="price-card__list">
                  {plan.includes.map((item) => (
                    <li key={item}><Check />{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <p className="price-note" data-rv="up">
            Need more recruiters? Extra recruiter seats are {currency === 'INR' ? '₹999' : '$10'}/month (+1,000 AI credits). Every plan has one admin seat &mdash;{' '}
            <a href={`${SITE.contact}?topic=hiring`}>contact us</a>.
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
                  <a className="btn btn-primary" href={`${AUTH.register}?plan=pro`}>
                    Get started
                    <svg className="arw" width="16" height="16" aria-hidden="true"><use href="#i-arrow" /></svg>
                  </a>
                  <a className="btn btn-ghost" href={`${SITE.contact}?topic=hiring`}>Talk to sales</a>
                </div>
              </div>
              <div>
                <p className="mono" style={{ marginBottom: '14px' }}>Every plan includes</p>
                <ul className="feat-list">
                  <li><Check />1 admin seat</li>
                  <li><Check />5,000 AI credits a month (10,000 on Pro)</li>
                  <li><Check />Recruiter Copilot on Pro</li>
                  <li><Check />Extra recruiter seats from ₹999 ($10) a month</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
    </SiteView>
  )
}
