import { useEffect, useState } from 'react'

import { SiteView } from '@/modules/site/components/SiteView'
import { AUTH, SITE } from '@/app/paths'
import { HiringSimulator } from '../components/HiringSimulator'

/**
 * Hybent Hiring — the product's page inside the company site.
 *
 * Rebuilt in phase 5 on the site design system. It previously carried its own:
 * Fraunces headlines, a violet→pink→teal gradient, GlassIcon tiles in five
 * accent colours, hand-rolled framer-motion variants and 65 inline styles —
 * none of which appear anywhere else on hybent.com. Sitting one click from
 * /products, it read as a different company's page.
 *
 * Now it is built from the same vocabulary as every other site view: `.hero`,
 * `.section`, `.card`, `.icon-tile`, `.eyebrow`, `.chip`, `.faq`, `.cta-band`,
 * with `[data-rv]` for scroll reveal. Nothing here names a colour or a font —
 * `hybent-site.css` owns all of it, so the page cannot drift again.
 */

/* ─── Content ──────────────────────────────────────────────────────────────── */

const STATS = [
  { value: '80%', label: 'Reduction in resume screening time' },
  { value: '90%', label: 'Interview scheduling fully automated' },
  { value: '60%', label: 'Faster overall time-to-hire' },
  { value: '30h', label: 'HR hours saved every single week' },
]

const PHASES = [
  {
    phase: 'Phase 01 — Intake',
    icon: 'i-ai',
    title: 'AI Resume Intelligence',
    desc: "The moment a candidate uploads their resume, Hybent Hiring's AI engine kicks in. It parses the document, extracts explicit skills like React, Node.js and TypeScript, and infers hidden skills from context clues. Experience years are calculated precisely and seniority level is determined automatically.",
    tags: ['Skill extraction', 'Experience calc', 'Seniority detection', '~10 seconds'],
  },
  {
    phase: 'Phase 02 — Scoring',
    icon: 'i-target',
    title: 'Smart Auto-Shortlisting',
    desc: "Hybent Hiring compares each candidate's profile against your requirements and generates a precise match score. If a candidate clears your threshold, they're instantly shortlisted, their status updated, your HR team notified, and the candidate gets an automated email — all without a single human action.",
    tags: ['Match scoring', 'Auto-shortlist', 'HR notification', 'Fully automated'],
  },
  {
    phase: 'Phase 03 — Scheduling',
    icon: 'i-cal',
    title: 'Conflict-Free Scheduling',
    desc: "One click. Hybent Hiring cross-references the candidate's availability, the interviewer's calendar, and checks for existing bookings. It selects the optimal slot, generates a Google Meet link, and dispatches calendar invites to everyone involved. What used to take 15 emails and 3 days now takes 30 seconds.",
    tags: ['Slot matching', 'Conflict detection', 'Meet link', '30 seconds'],
  },
  {
    phase: 'Phase 04 — Decision',
    icon: 'i-chart',
    title: 'Interview Intelligence & Hiring',
    desc: "Post-interview, the interviewer submits structured feedback. Hybent Hiring's AI analyses it, generates a summary, updates the hire probability score, and surfaces a hiring recommendation to HR. Every decision is data-backed, and every candidate is stored permanently in your searchable talent database.",
    tags: ['Feedback analysis', 'Hire probability', 'Talent database', 'AI recommendation'],
  },
]

const FEATURES = [
  {
    icon: 'i-ai',
    title: 'AI Resume Intelligence',
    desc: 'Parse any resume format in under 10 seconds. Get precise skills, experience years and match scores automatically.',
    bullets: [
      'PDF and DOCX parsing, any format',
      'Explicit and inferred skill extraction',
      'Experience years auto-calculated',
      'Seniority level classification',
      '87% average match accuracy',
    ],
  },
  {
    icon: 'i-target',
    title: 'Smart Auto-Shortlisting',
    desc: 'Set your thresholds once. Hybent Hiring filters automatically — only the best candidates ever reach your desk.',
    bullets: [
      'Configurable match thresholds per role',
      'Instant HR dashboard notifications',
      'Automatic candidate status emails',
      'Multi-role concurrent processing',
      'Zero manual resume filtering',
    ],
  },
  {
    icon: 'i-cal',
    title: 'Conflict-Free Scheduling',
    desc: 'One-click interview scheduling that prevents double-booking and removes every back-and-forth email.',
    bullets: [
      'Candidate and interviewer availability sync',
      'Automatic conflict detection',
      'Google Meet link generation',
      'Calendar invites to all parties',
      'Reschedule handling built in',
    ],
  },
  {
    icon: 'i-users',
    title: 'Interview Intelligence',
    desc: 'Structure your feedback, remove bias, and continuously improve hiring decisions with AI-powered analysis.',
    bullets: [
      'Structured feedback forms per role',
      'AI-generated interview summaries',
      'Hire probability updated after each stage',
      'Bias detection across candidates',
      'Multi-interviewer score aggregation',
    ],
  },
  {
    icon: 'i-db',
    title: 'Permanent Talent Database',
    desc: 'Every candidate you have ever considered is stored, indexed and searchable — forever. Never lose great talent again.',
    bullets: [
      'Permanent storage of all profiles',
      'Full-text skill and experience search',
      'Re-match past candidates to new roles',
      'Smart alerts for role-candidate fits',
      'Hire in days for repeat roles',
    ],
  },
  {
    icon: 'i-chart',
    title: 'Predictive Analytics',
    desc: 'Understand pipeline health, spot bottlenecks, and continuously improve your hiring funnel with data.',
    bullets: [
      'Real-time pipeline funnel visualisation',
      'Time-to-hire trend tracking',
      'Hire probability modelling per role',
      'Sourcing channel performance',
      'Team workload and efficiency reports',
    ],
  },
]

type Faq = { q: string; a: string }

/* ─── Small pieces ─────────────────────────────────────────────────────────── */

function Eyebrow({ children }: { children: string }) {
  return (
    <p className="eyebrow">
      <span className="bars"><i /><i /><i /></span>
      <span>{children}</span>
    </p>
  )
}

function Tile({ icon }: { icon: string }) {
  return (
    <span className="icon-tile">
      <svg aria-hidden="true"><use href={`#${icon}`} /></svg>
    </span>
  )
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */

export default function HiringHomePage() {
  /* FAQ copy is editable without a deploy, so it stays remote. */
  const [faqs, setFaqs] = useState<Faq[]>([])

  useEffect(() => {
    let live = true
    fetch('/landing-config.json')
      .then((res) => res.json())
      .then((data) => {
        if (live) setFaqs(data.faqs ?? [])
      })
      .catch(() => {
        /* The section simply does not render. A marketing FAQ is not worth an
           error state on an otherwise complete page. */
      })
    return () => {
      live = false
    }
  }, [])

  return (
    <SiteView route="hiring">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="hero">
        <div className="hero__orb orb-a" data-para="0.02" />
        <div className="hero__orb orb-b" data-para="-0.03" />

        <div className="wrap center">
          <p className="hero__pill" data-rv="up">
            <i className="dot dot--pulse" />
            AI-powered recruiting platform
          </p>

          <h1 className="h-xl" data-rv="up" data-delay="80" style={{ marginTop: '18px' }}>
            Hire on <span className="grad-text">autopilot</span>.
          </h1>

          <p className="hero__sub" data-rv="up" data-delay="160" style={{ marginInline: 'auto', textAlign: 'center' }}>
            Hybent Hiring uses AI to parse resumes, score candidates, manage your pipeline and
            close the best talent — in a fraction of the time.
          </p>

          <div className="hero__actions" data-rv="up" data-delay="240" style={{ justifyContent: 'center', marginInline: 'auto' }}>
            <a className="btn btn-primary btn-lg" href={AUTH.register}>
              Start for free
              <svg className="arw" width="16" height="16" aria-hidden="true"><use href="#i-arrow" /></svg>
            </a>
            <a className="btn btn-ghost btn-lg" href={SITE.contact}>Book a demo</a>
          </div>

          {/* Interactive AI Autopilot Hiring Simulator Widget */}
          <HiringSimulator />
        </div>
      </section>

      {/* ── Outcomes ──────────────────────────────────────────────────────── */}
      <section className="section section--tight">
        <div className="wrap">
          <div className="grid g4">
            {STATS.map((s, i) => (
              <div className="card card--flat stat" key={s.value} data-rv="up" data-delay={i * 70}>
                <b>{s.value}</b>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section className="section" id="how-it-works">
        <div className="wrap">
          <div className="section-head" data-rv="up">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="h-lg">Four phases, and your team touches almost none of them</h2>
            <p className="lead">
              From the second a resume lands to the moment an offer is signed, the work that used
              to fill a recruiter&rsquo;s week happens on its own.
            </p>
          </div>

          <div className="grid g2">
            {PHASES.map((p, i) => (
              <article className="card" key={p.phase} data-rv="up" data-delay={i * 80}>
                <span className="card__glow" />
                <Tile icon={p.icon} />
                <p className="mono" style={{ margin: '18px 0 8px' }}>{p.phase}</p>
                <h3 className="h-sm">{p.title}</h3>
                <p className="small" style={{ marginTop: '12px' }}>{p.desc}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '22px' }}>
                  {p.tags.map((t) => (
                    <span className="chip" key={t}>{t}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section className="section section--canvas" id="features">
        <div className="wrap">
          <div className="section-head" data-rv="up">
            <Eyebrow>Capabilities</Eyebrow>
            <h2 className="h-lg">Everything the pipeline needs, in one product</h2>
            <p className="lead">
              Not a collection of integrations. One system where parsing, scoring, scheduling and
              analytics share the same candidate record.
            </p>
          </div>

          <div className="grid g3">
            {FEATURES.map((f, i) => (
              <article className="card" key={f.title} data-rv="up" data-delay={(i % 3) * 80}>
                <span className="card__glow" />
                <Tile icon={f.icon} />
                <h3 className="h-sm" style={{ marginTop: '18px' }}>{f.title}</h3>
                <p className="small" style={{ marginTop: '10px' }}>{f.desc}</p>
                <ul className="feat-list">
                  {f.bullets.map((b) => (
                    <li key={b}>
                      <svg aria-hidden="true"><use href="#i-check" /></svg>
                      {b}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── About ─────────────────────────────────────────────────────────── */}
      <section className="section" id="about">
        <div className="wrap">
          <div className="split">
            <div data-rv="left">
              <Eyebrow>About Hybent Hiring</Eyebrow>
              <h2 className="h-lg">Reimagining the future of talent acquisition</h2>
              <p className="lead" style={{ marginTop: '22px' }}>
                Hybent Hiring was born from a simple mission — to fix a recruiting process that had
                not meaningfully changed in decades.
              </p>
              <p className="small" style={{ marginTop: '18px' }}>
                From years in human resources and talent acquisition, our founder saw first-hand how
                great teams were drowning in manual spreadsheets and inbox chaos. She set out to
                build the co-pilot she always wished existed — not another database, but an
                intelligent layer that handles the repetitive work so recruiters can focus on the
                human side of hiring.
              </p>
              <p className="small" style={{ marginTop: '14px' }}>
                Today Hybent Hiring is that vision, in production. By automating the parts nobody
                wanted to do, talent teams hire exceptional people faster than they thought possible.
              </p>
            </div>

            <div data-rv="right">
              {/* Markup mirrors the site's own `.quote` — mark, paragraph,
                  footer with avatar — so it inherits the card styling rather
                  than approximating it. */}
              <div className="card card--flat quote">
                <span className="quote__mark" aria-hidden="true">&ldquo;</span>
                <p>
                  I didn&rsquo;t want to build just another HR tool. I wanted to build the thing I
                  wish existed — a recruiter&rsquo;s co-pilot that handles the boring parts so
                  humans can focus on the human parts.
                </p>
                <footer>
                  <span className="avatar" aria-hidden="true">HH</span>
                  <div>
                    <b>Founder</b>
                    <span>Hybent Hiring</span>
                  </div>
                </footer>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQs ──────────────────────────────────────────────────────────── */}
      {faqs.length > 0 && (
        <section className="section section--tight" id="faqs">
          <div className="wrap" style={{ maxWidth: '860px' }}>
            <div className="section-head center" data-rv="up">
              <Eyebrow>Questions</Eyebrow>
              <h2 className="h-lg">Frequently asked</h2>
            </div>

            <div className="faq" data-rv="up">
              {faqs.map((faq, i) => (
                <details key={faq.q} open={i === 0}>
                  <summary>
                    {faq.q}
                    <span className="pm" />
                  </summary>
                  <div className="ans">{faq.a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Close ─────────────────────────────────────────────────────────── */}
      <section className="section">
        <div className="wrap">
          <div className="cta-band" data-rv="scale">
            <div className="split">
              <div>
                <Eyebrow>Get started</Eyebrow>
                <h2 className="h-lg">See what Hybent Hiring does to your pipeline</h2>
                <p className="lead" style={{ marginTop: '22px' }}>
                  Bring one open role. We will show you the parsing, the scoring and the scheduling
                  on your own candidates, not a demo dataset.
                </p>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '30px' }}>
                  <a className="btn btn-primary" href={AUTH.register}>
                    Start for free
                    <svg className="arw" width="16" height="16" aria-hidden="true"><use href="#i-arrow" /></svg>
                  </a>
                  <a className="btn btn-ghost" href={SITE.contact}>Talk to us</a>
                </div>
              </div>
              <div>
                <p className="mono" style={{ marginBottom: '14px' }}>What you get on day one</p>
                <ul className="feat-list">
                  <li><svg aria-hidden="true"><use href="#i-check" /></svg>Resume parsing on your existing pipeline</li>
                  <li><svg aria-hidden="true"><use href="#i-check" /></svg>Match scoring against your live roles</li>
                  <li><svg aria-hidden="true"><use href="#i-check" /></svg>Scheduling wired to your calendars</li>
                  <li><svg aria-hidden="true"><use href="#i-check" /></svg>Every candidate kept, indexed and searchable</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
    </SiteView>
  )
}
