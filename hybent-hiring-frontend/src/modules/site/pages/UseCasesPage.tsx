import { PRODUCTS, SITE } from '@/app/paths'
import { SiteView } from '../components/SiteView'

/**
 * Use Cases — the hiring situations Hybent Hiring is built for.
 *
 * Replaces the old /solutions view (which still 301s here). Every card names
 * only features that ship today; check the product before adding one.
 */
const USE_CASES = [
  {
    id: 'high-volume',
    title: 'High-volume hiring',
    problem: 'Hundreds of applications per role, and screening them by hand takes weeks.',
    solution:
      'Every resume is parsed on upload and screened against the same criteria, so the team starts from a ranked shortlist instead of an inbox.',
    features: ['AI Screening', 'Bulk import from CSV or Excel', 'Public apply links', 'Automated Scheduling'],
  },
  {
    id: 'tech-hiring',
    title: 'Tech and engineering hiring',
    problem: 'Engineers lose hours to interviews that were never set up to compare candidates fairly.',
    solution:
      "Interviewers get a prep kit before each interview and fill in a scorecard after it, so every panel judges candidates the same way.",
    features: ["Interviewer's Portal", 'Prep kits', 'Scorecards', 'AI Screening'],
  },
  {
    id: 'small-teams',
    title: 'Startups and small teams',
    problem: 'There is no dedicated recruiter, so the founder or a manager hires between everything else.',
    solution:
      "One admin seat covers the whole pipeline. On Pro, the Recruiter's Copilot drafts and suggests next steps so less of the work lands on one person.",
    features: ["Recruiter's Copilot", 'AI Screening', 'Automated Scheduling'],
  },
  {
    id: 'referrals',
    title: 'Hiring from email and referrals',
    problem: 'Referrers and partners send several resumes in one email, and each has to be entered by hand.',
    solution:
      'When an email arrives with several resumes attached, each one becomes its own candidate, parsed and ready to screen.',
    features: ['Email resume intake', 'Resume parsing', 'AI Screening'],
  },
  {
    id: 'candidate-experience',
    title: 'A better candidate experience',
    problem: 'Candidates apply and then hear nothing, so good ones drop out or accept elsewhere.',
    solution:
      "Every candidate gets a Candidate's Portal to follow their applications, interviews and offers, and to prepare for what comes next.",
    features: ["Candidate's Portal", 'Interview updates', 'Offers', 'Prep hub'],
  },
] as const

const FAQS = [
  {
    q: 'Can a small team use Hybent Hiring?',
    a: "Yes. Every plan includes one admin seat, and recruiter seats are added only when you need them at $10 (₹999) a month each. Standard is $29 (₹2,799) a month; Pro is $39 (₹3,799) and adds the Recruiter's Copilot.",
  },
  {
    q: 'Can we bring in candidates we already have?',
    a: 'Yes. Existing candidates can be imported in bulk from a CSV or Excel file, and resumes that arrive in a connected mailbox are turned into candidates automatically.',
  },
  {
    q: 'Do interviewers and candidates need a paid seat?',
    a: "No. Interviewers work in the Interviewer's Portal and candidates in the Candidate's Portal without a seat. Seats are for the admin and recruiters.",
  },
  {
    q: 'Which plan do we need?',
    a: "Standard covers screening, scheduling and both portals. Choose Pro if your team wants the Recruiter's Copilot. See the pricing page for the full comparison.",
  },
]

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
}

export default function UseCasesPage() {
  return (
    <SiteView route="use-cases">
      <section className="hero">
        <div className="hero__orb orb-a" data-para="0.02"></div>
        <div className="hero__orb orb-b" data-para="-0.03"></div>

        <div className="wrap">
          <p className="eyebrow" data-rv="up"><span className="bars"><i></i><i></i><i></i></span><span>Use Cases</span></p>
          <h1 style={{ fontSize: "clamp(2.35rem,4.6vw,3.6rem)", marginTop: "14px" }} data-rv="up" data-delay="80">How teams hire with Hybent Hiring</h1>
          <p className="hero__sub" data-rv="up" data-delay="160">Five hiring situations Hybent Hiring is built for, and the features that handle each one. Everything on this page is live today.</p>
          <div className="hero__actions" data-rv="up" data-delay="240">
            <a className="btn btn-primary btn-lg" href={SITE.freeTrial}>Start 7-day free trial <svg className="arw" width="17" height="17" aria-hidden="true"><use href="#i-arrow" /></svg></a>
            <a className="btn btn-ghost btn-lg" href="/pricing">See pricing</a>
          </div>
        </div>
      </section>

      <section className="section section--tight" id="use-cases">
        <div className="wrap">
          <div className="grid g2">
            {USE_CASES.map((useCase, i) => (
              <article key={useCase.id} id={useCase.id} className="card" data-rv="up" data-delay={String((i % 2) * 80)}>
                <h2 className="h-md">{useCase.title}</h2>
                <p className="small" style={{ marginTop: "12px" }}><b>The problem:</b> {useCase.problem}</p>
                <p style={{ marginTop: "10px" }}>{useCase.solution}</p>
                <ul className="feat-list" style={{ marginTop: "18px" }}>
                  {useCase.features.map((feature) => (
                    <li key={feature}><svg aria-hidden="true"><use href="#i-check" /></svg><span>{feature}</span></li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <p className="small" style={{ marginTop: "28px" }}>
            <a className="link-arrow" href={PRODUCTS.hiring}>See everything in Hybent Hiring <svg width="15" height="15" aria-hidden="true"><use href="#i-arrow" /></svg></a>
          </p>
        </div>
      </section>

      <section className="section" id="plans">
        <div className="wrap">
          <div className="section-head" data-rv="up">
            <h2 className="h-lg">Which plan fits</h2>
            <p className="lead" style={{ marginTop: "14px" }}>Both plans include one admin seat and are billed monthly. Recruiter seats are $10 (₹999) a month each.</p>
          </div>
          <div className="grid g2" style={{ marginTop: "28px" }}>
            <div className="card card--flat" data-rv="up">
              <h3 className="h-md">Standard · $29 / month</h3>
              <p style={{ marginTop: "10px" }}>For high-volume, tech, referral-driven and candidate-experience hiring: AI screening, automated scheduling, the Interviewer's Portal and the Candidate's Portal.</p>
            </div>
            <div className="card card--flat" data-rv="up" data-delay="80">
              <h3 className="h-md">Pro · $39 / month</h3>
              <p style={{ marginTop: "10px" }}>Everything in Standard plus the Recruiter's Copilot. The better fit for small teams where one person runs hiring.</p>
            </div>
          </div>
          <p className="small" style={{ marginTop: "20px" }}><a className="link-arrow" href="/pricing">Compare plans <svg width="15" height="15" aria-hidden="true"><use href="#i-arrow" /></svg></a></p>
        </div>
      </section>

      <section className="section" id="faq">
        <div className="wrap" style={{ maxWidth: "900px" }}>
          <div className="section-head" data-rv="up"><h2 className="h-lg">Questions</h2></div>
          <div className="faq" data-rv="up" style={{ marginTop: "24px" }}>
            {FAQS.map(({ q, a }, i) => (
              <details key={q} open={i === 0}><summary>{q}<span className="pm"></span></summary><div className="ans">{a}</div></details>
            ))}
          </div>
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }} />
          <div className="section-head center" style={{ marginTop: "48px" }} data-rv="up">
            <p className="small">Not sure which one is you? <a className="link-arrow" href="/contact">Talk to us <svg width="15" height="15" aria-hidden="true"><use href="#i-arrow" /></svg></a></p>
          </div>
        </div>
      </section>
    </SiteView>
  )
}
