import { useEffect, useRef, useState } from 'react'

/**
 * Recruiter Copilot, told by scrolling. The section pins while the visitor
 * scrolls through it: a question types itself into the Copilot box, the answer
 * arrives (three ranked candidates), a follow-up is typed, and the actions tick
 * off one by one. Scrolling back up rewinds it.
 *
 * Everything is driven by one number, the scroll progress p (0 → 1). People who
 * ask the system to reduce motion get the finished conversation, unpinned.
 */

const Q1 = 'Who are my top 3 candidates for Senior Backend Engineer?'
const Q2 = 'Book all three for interviews on Thursday.'

const CANDIDATES = [
  { name: 'Priya Sharma', score: 94, why: '6 yrs Node & Postgres · led a payments migration', g: 'linear-gradient(135deg,#22CFFF,#4C6FFF)' },
  { name: 'Arjun Mehta', score: 91, why: 'Scaled APIs to 2M users · strong system design', g: 'linear-gradient(135deg,#4C6FFF,#A855F7)' },
  { name: 'Sara Khan', score: 88, why: 'Go + AWS · on-call lead at a fintech', g: 'linear-gradient(135deg,#A855F7,#E85CFF)' },
]

const ACTIONS = [
  'Thursday slots found for all 3 · no clashes',
  'Google Meet links created',
  'Invites sent to candidates and 2 interviewers',
  'Pipeline moved to “Interview scheduled”',
]

/** 0 → 1 across [a, b]. */
const span = (p: number, a: number, b: number) => Math.min(1, Math.max(0, (p - a) / (b - a)))
const typed = (text: string, t: number) => text.slice(0, Math.round(text.length * t))

export default function CopilotScroll() {
  const ref = useRef<HTMLDivElement>(null)
  const [p, setP] = useState(0)
  const [still, setStill] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStill(true)
      setP(1)
      return
    }
    const el = ref.current
    if (!el) return
    let frame = 0
    const update = () => {
      frame = 0
      const r = el.getBoundingClientRect()
      // 0 when the block's top reaches the upper part of the screen, 1 when
      // its end does: the stage stays pinned for that whole stretch.
      const start = window.innerHeight * 0.2
      const run = el.offsetHeight - window.innerHeight * 0.8
      setP(Math.min(1, Math.max(0, (start - r.top) / Math.max(1, run))))
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

  // Timeline.
  const t1 = span(p, 0.02, 0.18)          // typing question 1
  const sent1 = p >= 0.2
  const think1 = p >= 0.2 && p < 0.27
  const cards = CANDIDATES.filter((_, i) => p >= 0.27 + i * 0.07).length
  const t2 = span(p, 0.5, 0.63)           // typing question 2
  const sent2 = p >= 0.65
  const think2 = p >= 0.65 && p < 0.7
  const done = ACTIONS.filter((_, i) => p >= 0.7 + i * 0.05).length

  const typing = !sent1 ? typed(Q1, t1) : !sent2 && t2 > 0 ? typed(Q2, t2) : ''

  return (
    <div className={`cps${still ? ' cps--still' : ''}`} ref={ref}>
      <div className="cps__stage">
        <div className={`cps__intro${sent1 ? ' is-gone' : ''}`}>
          <span className="cps__badge">Recruiter Copilot</span>
          <p className="cps__title">Ask in plain words. Copilot does the hiring work.</p>
        </div>
        <div className={`cps__chat${sent1 ? ' is-open' : ''}`} aria-live="off">
          {sent1 && <div className="cps__q">{Q1}</div>}
          {think1 && <div className="cps__think"><i /><i /><i /></div>}
          {cards > 0 && (
            <div className="cps__a">
              <p className="cps__a-lead">Here are your strongest matches, ranked against the role’s rubric:</p>
              {CANDIDATES.slice(0, cards).map((c, i) => (
                <div className="cps__cand" key={c.name}>
                  <span className="cps__rank">{i + 1}</span>
                  <span className="cps__av" style={{ background: c.g }} />
                  <span className="cps__who"><b>{c.name}</b><small>{c.why}</small></span>
                  <span className="cps__score">{c.score}</span>
                </div>
              ))}
            </div>
          )}
          {sent2 && <div className="cps__q">{Q2}</div>}
          {think2 && <div className="cps__think"><i /><i /><i /></div>}
          {done > 0 && (
            <div className="cps__a">
              <ul className="cps__done">
                {ACTIONS.slice(0, done).map((a) => <li key={a}>{a}</li>)}
              </ul>
              {done === ACTIONS.length && <p className="cps__a-lead cps__a-end">All set. Thursday is booked. 🎉</p>}
            </div>
          )}
        </div>

        <div className="cps__box">
          <span className="cps__spark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 2l2.2 6.3L20.5 10.5l-6.3 2.2L12 19l-2.2-6.3L3.5 10.5l6.3-2.2z" fill="url(#cps-g)" /><defs><linearGradient id="cps-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#22CFFF" /><stop offset=".5" stopColor="#4C6FFF" /><stop offset="1" stopColor="#E85CFF" /></linearGradient></defs></svg>
          </span>
          <span className={`cps__input${typing ? '' : ' is-empty'}`}>
            {typing || 'Ask Recruiter Copilot anything…'}
            {typing && <i className="cps__caret" />}
          </span>
          <span className="cps__send" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        </div>
        <p className="cps__hint" aria-hidden="true">{p < 0.02 ? 'Scroll to watch Copilot work' : 'Recruiter Copilot · included in Pro'}</p>
      </div>
    </div>
  )
}
