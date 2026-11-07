import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

/**
 * "Follow one candidate": the four phases of Hybent Hiring told through one
 * applicant (Priya). Each card sticks a little lower than the one before, so
 * they pile up like a deck as you scroll, and the card underneath shrinks and
 * dims as the next one slides over it.
 */

type Stage = {
  phase: string
  title: string
  chip: string
  text: string
  tags: string[]
  preview: ReactNode
}

const STAGES: Stage[] = [
  {
    phase: 'Phase 01 — Intake',
    title: 'AI Resume Intelligence & Parsing',
    chip: '~10 seconds parse',
    text: 'The moment a candidate uploads a CV, our AI parses the document in under 10 seconds. It extracts explicit skills, infers hidden competencies from context, calculates experience years, and determines seniority level automatically.',
    tags: ['Skill extraction', 'Experience calc', 'Seniority detection', 'PDF & DOCX'],
    preview: (
      <>
        <div className="cj-file"><span className="cj-file__ico">PDF</span><span><b>Priya_Sharma_CV.pdf</b><small>Uploaded just now</small></span><span className="cj-ok">Parsed</span></div>
        <div className="cj-fields">
          <span><small>Experience</small>6 yrs</span>
          <span><small>Seniority</small>Senior</span>
          <span><small>Location</small>Pune</span>
        </div>
        <div className="cj-tags"><i>React</i><i>Node.js</i><i>PostgreSQL</i><i>AWS</i><i className="cj-tags__ai">+ System design (inferred)</i></div>
      </>
    ),
  },
  {
    phase: 'Phase 02 — Scoring',
    title: 'Smart Auto-Shortlisting',
    chip: 'Fully automated',
    text: 'Candidate profiles are scored against job rubrics. When an applicant passes the threshold, they are automatically shortlisted, status is updated, HR is notified, and status emails trigger — with zero human lag.',
    tags: ['Match scoring', 'Auto-shortlist', 'HR notification', 'Rubric matching'],
    preview: (
      <>
        <div className="cj-score">
          <span className="cj-ring" style={{ '--p': '94' } as React.CSSProperties}><b>94</b></span>
          <span><b>Priya Sharma</b><small>Senior Backend Engineer · match</small></span>
        </div>
        <div className="cj-rubric"><span>Backend depth</span><i style={{ width: '96%' }} /></div>
        <div className="cj-rubric"><span>Databases</span><i style={{ width: '90%' }} /></div>
        <div className="cj-rubric"><span>Cloud</span><i style={{ width: '84%' }} /></div>
        <div className="cj-status"><span className="cj-ok">Shortlisted</span> HR notified · email sent</div>
      </>
    ),
  },
  {
    phase: 'Phase 03 — Scheduling',
    title: 'Conflict-Free Scheduling',
    chip: '30 seconds',
    text: 'One click cross-references candidate availability and interviewer calendars. It selects optimal slots, generates Google Meet links, and dispatches invites without endless back-and-forth emails.',
    tags: ['Slot matching', 'Conflict detection', 'Google Meet link', 'Calendar sync'],
    preview: (
      <>
        <div className="cj-cal">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d, i) => (
            <span key={d} className={i === 3 ? 'is-pick' : i === 1 ? 'is-busy' : undefined}><small>{d}</small>{i === 3 ? '11:00' : i === 1 ? 'Busy' : '—'}</span>
          ))}
        </div>
        <div className="cj-invite"><span className="cj-invite__dot" /><span><b>Technical interview · Priya</b><small>Thu 11:00 · Google Meet · 2 interviewers</small></span></div>
        <div className="cj-status"><span className="cj-ok">Invites sent</span> no back-and-forth</div>
      </>
    ),
  },
  {
    phase: 'Phase 04 — Decision',
    title: 'Interview Intelligence & Hiring',
    chip: 'AI recommendation',
    text: 'Post-interview feedback is analyzed by AI to surface hiring recommendations and update win probabilities. Profiles are index-saved into your permanent, searchable talent database.',
    tags: ['Feedback analysis', 'Hire probability', 'Talent database', 'Score aggregation'],
    preview: (
      <>
        <div className="cj-feedback"><b>Interviewer 1</b>Strong system design, clear communicator.<span>4.5 / 5</span></div>
        <div className="cj-feedback"><b>Interviewer 2</b>Solid Postgres depth; ready for ownership.<span>4.0 / 5</span></div>
        <div className="cj-reco"><span>AI recommendation</span><b>Hire · 87% likely to accept</b></div>
        <div className="cj-offer">Offer accepted · joins 1 Dec</div>
      </>
    ),
  },
]

export default function CandidateJourney() {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const list = listRef.current
    if (!list || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const cards = Array.from(list.querySelectorAll<HTMLElement>('.cj-card'))
    let frame = 0
    const update = () => {
      frame = 0
      cards.forEach((card, i) => {
        const next = cards[i + 1]
        if (!next) return
        const a = card.getBoundingClientRect()
        const b = next.getBoundingClientRect()
        // 0 while the next card is below this one, 1 once it fully covers it.
        const p = Math.min(1, Math.max(0, (a.bottom - b.top) / a.height))
        card.style.setProperty('--cover', p.toFixed(3))
      })
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    <div className="cj" ref={listRef}>
      {STAGES.map((s, i) => (
        <article key={s.phase} className={`cj-card cj-card--${i + 1}`} style={{ '--i': i } as React.CSSProperties}>
          <div className="cj-card__copy">
            <div className="cj-card__head">
              <p className="mono cj-card__phase">{s.phase}</p>
              <span className="chip cj-card__chip">{s.chip}</span>
            </div>
            <h3 className="h-sm cj-card__title">{s.title}</h3>
            <p className="small cj-card__text">{s.text}</p>
            <div className="cj-card__tags">{s.tags.map((t) => <span key={t} className="chip">{t}</span>)}</div>
          </div>
          <div className="cj-card__preview" aria-hidden="true">
            <p className="cj-card__who">Following <b>Priya Sharma</b> · step {i + 1} of {STAGES.length}</p>
            {s.preview}
          </div>
        </article>
      ))}
    </div>
  )
}
