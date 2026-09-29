import { useEffect, useState } from 'react'

/**
 * Typewriter label for the hero lattice pills. All pills type in together on
 * load, then each one erases and retypes on its own loop, offset by `order`,
 * so the retyping ripples round the ring and only one pill is ever blank.
 * The visible length is derived from elapsed time rather than counted ticks,
 * so the offsets never drift.
 *
 * A hidden full-length copy reserves the pill's width; the pills are centred
 * with translate(-50%,-50%), so a pill that grew with its text would jitter.
 */

const START_DELAY = 700 // lets the lattice's scale reveal land first
const TYPE_MS = 75
const ERASE_MS = 35
const FIRST_HOLD = 3000 // after the shared entrance, when the first pill erases
const STAGGER = 1200 // between neighbouring pills; CYCLE / 5 spreads the five evenly
const CYCLE = 6000
const RETYPE_AT = 900 // ms into each cycle: erase, a short blank, then retype

function visibleChars(elapsed: number, len: number, order: number) {
  const firstErase = FIRST_HOLD + order * STAGGER
  if (elapsed < firstErase) return Math.min(len, Math.floor(elapsed / TYPE_MS))
  const t = (elapsed - firstErase) % CYCLE
  if (t < RETYPE_AT) return Math.max(0, len - Math.floor(t / ERASE_MS))
  return Math.min(len, Math.floor((t - RETYPE_AT) / TYPE_MS))
}

export function TypedLabel({ text, order = 0 }: { text: string; order?: number }) {
  const [reduce] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [n, setN] = useState(reduce ? text.length : 0)

  useEffect(() => {
    if (reduce) return
    const t0 = performance.now() + START_DELAY
    const timer = window.setInterval(() => {
      const elapsed = performance.now() - t0
      if (elapsed >= 0) setN(visibleChars(elapsed, text.length, order))
    }, 30)
    return () => window.clearInterval(timer)
  }, [text, order, reduce])

  return (
    <span className="typed">
      <span className="typed__ghost" aria-hidden="true">{text}</span>
      <span className="typed__text" aria-hidden="true">
        {text.slice(0, n)}
        {!reduce && <span className="typed__caret" />}
      </span>
      <span className="typed__sr">{text}</span>
    </span>
  )
}
