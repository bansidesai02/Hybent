import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode, MouseEvent as ReactMouseEvent } from 'react'

import '@/styles/hybent-site.css'
import '@/styles/hybent-auth.css'

/**
 * Hybent Auth Kit
 * -----------------------------------------------------------------------------
 * The one visual system behind every Hybent company-brand auth surface â€” sign
 * in, create account, reset password. Each page supplies only its own form; the
 * glass card, animated border light, logo and typography all come from here, so
 * the three pages can never drift apart.
 *
 * The page behind the card is not a copy of the homepage's atmosphere â€” it is
 * the homepage's atmosphere. The shell wears the same `hb-site hb-surface`
 * classes every site view wears, so the gradients, grid and lighting are
 * identical by construction, with no duplicated rules to drift.
 *
 * The site is light-only, so `[data-theme="classic"]` is what renders in
 * practice. The dark rules below are kept because they are what the shared
 * design system is authored against â€” they cost nothing and mean the card is
 * already correct if a dark surface is ever reintroduced.
 */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/* â”€â”€ Icons â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <rect x="2.75" y="4.75" width="18.5" height="14.5" rx="3.25" stroke="currentColor" strokeWidth="1.6" />
      <path d="m3.5 8 7.35 4.9a2 2 0 0 0 2.3 0L20.5 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <rect x="4.75" y="10.25" width="14.5" height="9.5" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8.25 10V7.75a3.75 3.75 0 0 1 7.5 0V10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="15" r="1.35" fill="currentColor" />
    </svg>
  )
}

export function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <circle cx="12" cy="8.25" r="3.6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4.75 19.5a7.25 7.25 0 0 1 14.5 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function BuildingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M4.75 20.25V6.4a1.4 1.4 0 0 1 .93-1.32l7-2.45a1.4 1.4 0 0 1 1.87 1.32v16.3" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14.55 9.25h3.3a1.4 1.4 0 0 1 1.4 1.4v9.6M3.25 20.25h17.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8.4 8.75v.01M8.4 12.25v.01M8.4 15.75v.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M2.5 12s3.6-6 9.5-6 9.5 6 9.5 6-3.6 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.75" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

export function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M9.9 5.2A9.6 9.6 0 0 1 12 5c5.9 0 9.5 6 9.5 6a17 17 0 0 1-2.85 3.4M6.4 6.9A17 17 0 0 0 2.5 11s3.6 6 9.5 6a9.4 9.4 0 0 0 3.72-.76" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.9 9.95a2.9 2.9 0 0 0 4.07 4.07" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="m4 4 16 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 7.5v5.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="16.2" r="1.1" fill="currentColor" />
    </svg>
  )
}

export function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="m5 12.5 4.4 4.4L19 7.7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M5 12h13.5m0 0-5-5m5 5-5 5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M23.04 12.26c0-.86-.08-1.69-.22-2.48H12v4.7h6.19a5.3 5.3 0 0 1-2.3 3.47v2.89h3.72c2.18-2 3.43-4.96 3.43-8.58Z" />
      <path fill="#34A853" d="M12 24c3.1 0 5.7-1.03 7.61-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.89 1.1-2.99 0-5.52-2.02-6.43-4.73H1.73v2.98A11.5 11.5 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.57 14.69a6.9 6.9 0 0 1 0-4.4V7.31H1.73a11.5 11.5 0 0 0 0 10.36l3.84-2.98Z" />
      <path fill="#EA4335" d="M12 4.75c1.69 0 3.2.58 4.4 1.72l3.29-3.29C17.7 1.24 15.1 0 12 0A11.5 11.5 0 0 0 1.73 7.31l3.84 2.98C6.48 7.58 9.01 4.75 12 4.75Z" />
    </svg>
  )
}

export function SuccessIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.6" />
      <path d="m7.75 12.4 2.9 2.9 5.6-6.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * The official Hybent mark, in the glass disc the auth cards use.
 *
 * This is the same asset the global nav renders â€” not a redraw â€” so the
 * gradient, proportions and swoosh stay identical to every other Hybent
 * surface. The disc behind it is deliberately neutral so the logo's own
 * colours read true instead of being tinted by the glass.
 */
export function HybentMark() {
  return (
    <span className="hlp-mark" aria-hidden="true">
      <span className="hlp-mark__ring" />
      <span className="hlp-mark__glass">
        <img className="hlp-mark__img" src="/hybent/hybent-mark.png" alt="" />
        <span className="hlp-mark__shine" />
      </span>
    </span>
  )
}

/* â”€â”€ Shell â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export type HybentAuthShellProps = {
  title: string
  subtitle: string
  children: ReactNode
  /** Widen the card for forms with more fields than sign-in. */
  wide?: boolean
  /**
   * Mono uppercase kicker above the title — "Hybent Hiring" when someone
   * arrives from a product rather than from the company site.
   *
   * This is what let the product-branded auth pages be deleted. They existed
   * so a visitor already inside Hybent Hiring would not feel handed off to the
   * parent brand mid-journey; a line of context does that without a second
   * design system, two codepaths and 880 lines to keep in sync.
   */
  eyebrow?: string
  /**
   * Optional panel beside the card — context for a page that is more than a
   * form (the access-request page's "what happens next"). Stacks under the
   * card on narrow screens.
   */
  aside?: ReactNode
}

/**
 * Background, glass card and animated border light. Every auth page renders its
 * form as `children` and inherits the rest.
 */
export function HybentAuthShell({ title, subtitle, children, wide, eyebrow, aside }: HybentAuthShellProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduced(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  /* Pointer glow + 3D tilt ride CSS custom properties, so the browser
     composites them without a React render per mouse move. */
  const onCardMove = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      const el = cardRef.current
      if (!el || reduced) return
      const r = el.getBoundingClientRect()
      const x = e.clientX - r.left
      const y = e.clientY - r.top
      el.style.setProperty('--hlp-mx', `${x.toFixed(1)}px`)
      el.style.setProperty('--hlp-my', `${y.toFixed(1)}px`)
      el.style.setProperty('--hlp-rx', `${((0.5 - y / r.height) * 5.5).toFixed(2)}deg`)
      el.style.setProperty('--hlp-ry', `${((x / r.width - 0.5) * 5.5).toFixed(2)}deg`)
      el.style.setProperty('--hlp-glow', '1')
    },
    [reduced]
  )

  const onCardLeave = useCallback(() => {
    const el = cardRef.current
    if (!el) return
    el.style.setProperty('--hlp-rx', '0deg')
    el.style.setProperty('--hlp-ry', '0deg')
    el.style.setProperty('--hlp-glow', '0')
  }, [])

  return (
    /* `hb-site hb-surface` are the same two classes every homepage view wears â€”
       they bring the site's tokens plus its ::before gradient wash and ::after
       grid, so the backdrop here is the homepage's, not a look-alike. */
    <div className="hlp hb-site hb-surface" data-reduced={reduced ? 'true' : undefined}>
      <main className="hlp-stage">
        <div className={aside ? 'hlp-split' : 'hlp-solo'}>
        {aside && <aside className="hlp-aside">{aside}</aside>}
        <section
          className={`hlp-card${wide ? ' hlp-card--wide' : ''}`}
          ref={cardRef}
          onMouseMove={onCardMove}
          onMouseLeave={onCardLeave}
          aria-labelledby="hlp-title"
        >
          <span className="hlp-card__glow" aria-hidden="true" />
          <span className="hlp-card__sheen" aria-hidden="true" />

          <div className="hlp-card__in">
            <header className="hlp-head">
              <HybentMark />
              {eyebrow && (
                <p className="hlp-eyebrow">
                  <i aria-hidden="true" />
                  {eyebrow}
                </p>
              )}
              <h1 className="hlp-title" id="hlp-title">{title}</h1>
              <p className="hlp-sub">{subtitle}</p>
            </header>
            {children}
          </div>

          {/* â”€â”€ Border light: four beams reading as one clockwise source â”€â”€
              Last in the DOM and pointer-events:none, so it paints over the
              card edge without ever intercepting a click. */}
          <span className="hlp-beams" aria-hidden="true">
            <span className="hlp-beam hlp-beam--t" />
            <span className="hlp-beam hlp-beam--r" />
            <span className="hlp-beam hlp-beam--b" />
            <span className="hlp-beam hlp-beam--l" />
          </span>
        </section>
        </div>
      </main>
    </div>
  )
}

