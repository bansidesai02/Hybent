import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode, MouseEvent as ReactMouseEvent } from 'react'

import '@/styles/hybent-site.css'

/**
 * Hybent Auth Kit
 * -----------------------------------------------------------------------------
 * The one visual system behind every Hybent company-brand auth surface — sign
 * in, create account, reset password. Each page supplies only its own form; the
 * glass card, animated border light, logo and typography all come from here, so
 * the three pages can never drift apart.
 *
 * The page behind the card is not a copy of the homepage's atmosphere — it is
 * the homepage's atmosphere. The shell wears the same `hb-site hb-surface`
 * classes every site view wears, so the gradients, grid and lighting are
 * identical by construction, with no duplicated rules to drift.
 *
 * The site is light-only, so `[data-theme="classic"]` is what renders in
 * practice. The dark rules below are kept because they are what the shared
 * design system is authored against — they cost nothing and mean the card is
 * already correct if a dark surface is ever reintroduced.
 */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/* ── Icons ─────────────────────────────────────────────────────────────────── */

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
 * This is the same asset the global nav renders — not a redraw — so the
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

/* ── Shell ─────────────────────────────────────────────────────────────────── */

export type HybentAuthShellProps = {
  title: string
  subtitle: string
  children: ReactNode
  /** Widen the card for forms with more fields than sign-in. */
  wide?: boolean
}

/**
 * Background, glass card and animated border light. Every auth page renders its
 * form as `children` and inherits the rest.
 */
export function HybentAuthShell({ title, subtitle, children, wide }: HybentAuthShellProps) {
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
    /* `hb-site hb-surface` are the same two classes every homepage view wears —
       they bring the site's tokens plus its ::before gradient wash and ::after
       grid, so the backdrop here is the homepage's, not a look-alike. */
    <div className="hlp hb-site hb-surface" data-reduced={reduced ? 'true' : undefined}>
      <style>{AUTH_CSS}</style>

      <main className="hlp-stage">
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
              <h1 className="hlp-title" id="hlp-title">{title}</h1>
              <p className="hlp-sub">{subtitle}</p>
            </header>
            {children}
          </div>

          {/* ── Border light: four beams reading as one clockwise source ──
              Last in the DOM and pointer-events:none, so it paints over the
              card edge without ever intercepting a click. */}
          <span className="hlp-beams" aria-hidden="true">
            <span className="hlp-beam hlp-beam--t" />
            <span className="hlp-beam hlp-beam--r" />
            <span className="hlp-beam hlp-beam--b" />
            <span className="hlp-beam hlp-beam--l" />
          </span>
        </section>
      </main>
    </div>
  )
}

/* ── Styles ────────────────────────────────────────────────────────────────── */

export const AUTH_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Manrope:wght@400;500;600;700&display=swap');

/* The page ground, gradients and grid all come from .hb-surface. Only the
   auth-specific tokens live here — and they follow the site's own
   classic/signature split, so the card reads correctly on either ground. */
/* Brand ramp, straight from the Hybent palette — sky, primary blue, indigo,
   purple, magenta. Nothing outside it is introduced. */
.hlp{
  --sky:#38BDF8;
  --pri:#3B82F6;
  --indigo:#6366F1;
  --purple:#A855F7;
  --magenta:#D946EF;
  --pri-hov:#6366F1;
  --acc:#3B82F6;
  --card:rgba(15,23,42,.76);
  --line:rgba(255,255,255,.08);
  --line-2:rgba(255,255,255,.16);
  --field:rgba(2,6,23,.55);
  --field-focus:rgba(2,6,23,.72);
  --glass-glow:rgba(59,130,246,.26);
  --blue-shadow:rgba(59,130,246,.18);
  --beam:#FFFFFF;
  --danger:#F87171;
  --ok:#34D399;
  --r-sm:10px; --r-md:16px; --r-lg:22px; --r-full:999px;

  display:flex;
  min-height:100dvh;
  overflow-x:hidden;
}
.hlp *,.hlp *::before,.hlp *::after{box-sizing:border-box}

/* Classic — the site's light ground. Same geometry, inverted glass, and the
   palette's own neutrals: #FFFFFF / #F8FAFC surfaces, #0F172A headings,
   #64748B body, #E5E7EB borders. */
[data-theme="classic"] .hlp{
  --pri:#3B82F6;
  --pri-hov:#6366F1;
  --acc:#3B82F6;
  --card:rgba(255,255,255,.86);
  --line:#E5E7EB;
  --line-2:#E5E7EB;
  --field:#F8FAFC;
  --field-focus:#FFFFFF;
  --glass-glow:rgba(59,130,246,.14);
  --blue-shadow:rgba(15,23,42,.12);
  --beam:#3B82F6;
  --danger:#D63B54;
  --ok:#0F7A56;
}

/* ---------- Stage ----------
   An auto margin on the card, not centred flex alignment, is what centres it.
   A centred flex item taller than the viewport has its top clipped with no way
   to scroll back up; an auto-margined one stays reachable and simply scrolls. */
.hlp-stage{
  position:relative;z-index:2;
  flex:1;display:flex;
  width:100%;padding:clamp(16px,4vw,40px) clamp(16px,5vw,32px);
}

/* ---------- Card ---------- */
.hlp-card{
  position:relative;
  margin:auto;
  width:100%;max-width:404px;
  border-radius:var(--r-lg);
  transform:perspective(1400px) rotateX(var(--hlp-rx,0deg)) rotateY(var(--hlp-ry,0deg));
  transform-style:preserve-3d;
  transition:transform .5s cubic-bezier(.22,1,.36,1);
  animation:hlp-rise .82s cubic-bezier(.22,1,.36,1) both;
}
.hlp-card--wide{max-width:436px}
@keyframes hlp-rise{
  from{opacity:0;transform:perspective(1400px) translateY(22px) scale(.975)}
  to{opacity:1;transform:perspective(1400px) translateY(0) scale(1)}
}

/* ---------- Animated border light ----------
   Four beams — top, right, bottom, left — each travelling a quarter of a 4s
   cycle and handing off to the next, so they read as one light running
   clockwise. Only transform and opacity animate, so the whole effect stays on
   the compositor and holds 60fps; the bloom is a static filter. */
.hlp-beams{
  position:absolute;inset:-1px;
  border-radius:inherit;
  overflow:hidden;
  pointer-events:none;
  z-index:5;
}
.hlp-beam{
  position:absolute;
  opacity:0;
  will-change:transform,opacity;
  filter:
    drop-shadow(0 0 8px rgba(255,255,255,.7))
    drop-shadow(0 0 18px rgba(59,130,246,.85))
    drop-shadow(0 0 28px rgba(56,189,248,.45));
  transition:filter .45s ease;
}
.hlp-beam--t,.hlp-beam--b{
  height:2px;width:44%;
  background:linear-gradient(90deg,transparent,var(--beam),transparent);
}
.hlp-beam--r,.hlp-beam--l{
  width:2px;height:44%;
  background:linear-gradient(180deg,transparent,var(--beam),transparent);
}
/* A white runner vanishes on the site's light ground, so classic runs the
   brand blue and trades the white bloom for a denser blue one. */
[data-theme="classic"] .hlp-beam{
  filter:
    drop-shadow(0 0 6px rgba(59,130,246,.55))
    drop-shadow(0 0 14px rgba(99,102,241,.45))
    drop-shadow(0 0 26px rgba(56,189,248,.35));
}
[data-theme="classic"] .hlp-card:hover .hlp-beam{
  filter:
    drop-shadow(0 0 8px rgba(59,130,246,.75))
    drop-shadow(0 0 20px rgba(99,102,241,.6))
    drop-shadow(0 0 38px rgba(56,189,248,.5))
    brightness(1.1);
}
.hlp-beam--t{top:0;left:0;animation:hlp-beam-t 4s linear infinite}
.hlp-beam--r{top:0;right:0;animation:hlp-beam-r 4s linear infinite 1s}
.hlp-beam--b{bottom:0;right:0;animation:hlp-beam-b 4s linear infinite 2s}
.hlp-beam--l{bottom:0;left:0;animation:hlp-beam-l 4s linear infinite 3s}

/* A 44%-wide beam clears a 100%-wide edge at 227% of its own width. Each beam
   runs in the first quarter of the cycle, then parks off-screen. */
@keyframes hlp-beam-t{
  0%{transform:translateX(-100%);opacity:0}
  2%{opacity:1}
  23%{opacity:1}
  25%{transform:translateX(228%);opacity:0}
  100%{transform:translateX(228%);opacity:0}
}
@keyframes hlp-beam-r{
  0%{transform:translateY(-100%);opacity:0}
  2%{opacity:1}
  23%{opacity:1}
  25%{transform:translateY(228%);opacity:0}
  100%{transform:translateY(228%);opacity:0}
}
@keyframes hlp-beam-b{
  0%{transform:translateX(100%);opacity:0}
  2%{opacity:1}
  23%{opacity:1}
  25%{transform:translateX(-228%);opacity:0}
  100%{transform:translateX(-228%);opacity:0}
}
@keyframes hlp-beam-l{
  0%{transform:translateY(100%);opacity:0}
  2%{opacity:1}
  23%{opacity:1}
  25%{transform:translateY(-228%);opacity:0}
  100%{transform:translateY(-228%);opacity:0}
}

/* Hover lifts the bloom without touching the timeline, so nothing stutters. */
.hlp-card:hover .hlp-beam{
  filter:
    drop-shadow(0 0 10px rgba(255,255,255,.95))
    drop-shadow(0 0 26px rgba(59,130,246,1))
    drop-shadow(0 0 44px rgba(56,189,248,.7))
    brightness(1.18);
}
.hlp-card:hover .hlp-card__in{
  border-color:rgba(96,165,250,.28);
  box-shadow:
    0 1px 0 rgba(255,255,255,.09) inset,
    0 26px 66px -28px rgba(2,6,23,.95),
    0 70px 130px -60px rgba(37,99,235,.32),
    0 0 0 1px rgba(37,99,235,.12);
}

/* Pointer-following glow inside the glass. */
.hlp-card__glow{
  position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:2;
  background:radial-gradient(340px circle at var(--hlp-mx,50%) var(--hlp-my,0%),var(--glass-glow),transparent 68%);
  opacity:calc(var(--hlp-glow,0) * .9);transition:opacity .45s ease;
}
/* Static top reflection. */
.hlp-card__sheen{
  position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:3;
  background:linear-gradient(160deg,rgba(255,255,255,.10) 0%,rgba(255,255,255,.02) 26%,transparent 52%);
}

.hlp-card__in{
  position:relative;z-index:4;
  padding:clamp(22px,4vw,30px) clamp(20px,4vw,28px) clamp(20px,3.5vw,26px);
  border-radius:inherit;
  background:var(--card);
  border:1px solid var(--line);
  backdrop-filter:blur(26px) saturate(150%);
  -webkit-backdrop-filter:blur(26px) saturate(150%);
  box-shadow:
    0 1px 0 rgba(255,255,255,.06) inset,
    0 24px 60px -28px rgba(2,6,23,.95),
    0 60px 120px -60px var(--blue-shadow),
    0 0 0 1px rgba(37,99,235,.06);
  transition:border-color .45s ease,box-shadow .45s ease;
}

/* ---------- Logo ---------- */
.hlp-mark{position:relative;display:grid;place-items:center;width:56px;height:56px;margin:0 auto 12px}
.hlp-mark__ring{
  position:absolute;inset:-7px;border-radius:50%;
  background:conic-gradient(from 210deg,transparent,rgba(96,165,250,.55),transparent 62%);
  filter:blur(7px);opacity:.85;animation:hlp-spin 9s linear infinite;
}
.hlp-mark__glass{
  position:relative;display:grid;place-items:center;width:100%;height:100%;
  border-radius:50%;overflow:hidden;
  background:linear-gradient(160deg,rgba(59,130,246,.22),rgba(15,23,42,.86));
  border:1px solid rgba(147,197,253,.28);
  box-shadow:0 12px 34px -14px rgba(59,130,246,.8),0 1px 0 rgba(255,255,255,.16) inset;
}
.hlp-mark__img{width:30px;height:30px;object-fit:contain;filter:drop-shadow(0 3px 10px rgba(59,130,246,.55))}
.hlp-mark__shine{
  position:absolute;top:-120%;left:-40%;width:52%;height:340%;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.42),transparent);
  transform:rotate(22deg);animation:hlp-shine 4.6s ease-in-out infinite;
}
@keyframes hlp-spin{to{transform:rotate(360deg)}}
@keyframes hlp-shine{0%{left:-60%}55%,100%{left:130%}}

/* ---------- Header ---------- */
.hlp-head{text-align:center;margin-bottom:16px}
.hlp-title{
  margin:0 0 6px;font-family:var(--f-display);
  font-size:clamp(1.34rem,3.4vw,1.58rem);font-weight:700;letter-spacing:-.02em;line-height:1.16;
  background:linear-gradient(180deg,#fff,#BFDBFE);
  -webkit-background-clip:text;background-clip:text;color:transparent;
}
.hlp-sub{margin:0;font-size:.865rem;color:var(--muted);line-height:1.45}

/* ---------- Banners ---------- */
.hlp-alert{
  display:flex;align-items:flex-start;gap:9px;margin:0 0 16px;
  padding:11px 13px;border-radius:var(--r-sm);
  background:rgba(248,113,113,.10);border:1px solid rgba(248,113,113,.28);
  color:#FCA5A5;font-size:.85rem;line-height:1.45;
}
.hlp-alert__icon{flex:none;width:17px;height:17px;margin-top:1px}
.hlp-alert__icon svg{width:100%;height:100%}

/* ---------- Success ---------- */
.hlp-done{text-align:center}
.hlp-done__badge{
  display:grid;place-items:center;width:62px;height:62px;margin:2px auto 16px;
  border-radius:50%;color:var(--ok);
  background:rgba(52,211,153,.12);border:1px solid rgba(52,211,153,.32);
  box-shadow:0 0 34px -8px rgba(52,211,153,.5);
}
.hlp-done__badge svg{width:30px;height:30px}
.hlp-done__badge--mail{
  color:var(--pri);
  background:rgba(59,130,246,.12);border-color:rgba(59,130,246,.32);
  box-shadow:0 0 34px -8px rgba(59,130,246,.5);
}
.hlp-done__badge--busy{
  color:var(--pri);
  background:rgba(59,130,246,.10);border-color:rgba(59,130,246,.26);
  box-shadow:none;
}
.hlp-done p{margin:0 0 20px;font-size:.9rem;color:var(--muted);line-height:1.6}
.hlp-done strong{color:var(--text);font-weight:600}

/* Transient confirmation — quieter than an alert, louder than a hint. */
.hlp-notice{
  margin:0 0 14px;padding:10px 13px;border-radius:var(--r-sm);
  background:rgba(59,130,246,.10);border:1px solid rgba(59,130,246,.26);
  color:#BFDBFE;font-size:.83rem;line-height:1.45;text-align:center;
}

/* ---------- Form ---------- */
.hlp-form{display:flex;flex-direction:column;gap:12px}
.hlp-field{display:flex;flex-direction:column;gap:6px}
.hlp-label{font-size:.795rem;font-weight:600;letter-spacing:.02em;color:rgba(255,255,255,.82)}

.hlp-input{
  position:relative;display:flex;align-items:center;gap:10px;
  height:45px;padding:0 12px;border-radius:var(--r-sm);
  background:var(--field);
  border:1px solid var(--line-2);
  transition:border-color .25s ease,box-shadow .25s ease,background .25s ease;
}
.hlp-input:hover{border-color:rgba(255,255,255,.24)}
.hlp-input:focus-within{
  border-color:var(--pri);
  background:var(--field-focus);
  box-shadow:0 0 0 4px rgba(37,99,235,.18),0 0 34px -8px var(--glass-glow);
}
.hlp-input.is-invalid{border-color:rgba(248,113,113,.62)}
.hlp-input.is-invalid:focus-within{box-shadow:0 0 0 4px rgba(248,113,113,.16)}
.hlp-input__icon{flex:none;width:19px;height:19px;color:rgba(255,255,255,.46);transition:color .25s ease}
.hlp-input__icon svg{width:100%;height:100%}
.hlp-input:focus-within .hlp-input__icon{color:var(--acc)}
.hlp-input input{
  flex:1;min-width:0;height:100%;border:0;outline:0;background:transparent;
  color:var(--text);font:500 .93rem/1 var(--f-body);letter-spacing:.01em;
}
.hlp-input input::placeholder{color:rgba(255,255,255,.34)}
.hlp-input input:disabled{cursor:not-allowed;opacity:.6}
/* Chrome's autofill repaint would otherwise blow out the glass surface. */
.hlp-input input:-webkit-autofill,
.hlp-input input:-webkit-autofill:hover,
.hlp-input input:-webkit-autofill:focus{
  -webkit-text-fill-color:var(--text);
  -webkit-box-shadow:0 0 0 60px #0B1226 inset;
  caret-color:var(--text);
}
/* Every button rule below is scoped under .hlp so it outranks the site's
   own "button { color: inherit }" reset, which is one point more specific
   than a bare class and would otherwise repaint every button in this card
   with body text colour — including white-on-blue submit labels. */
.hlp .hlp-reveal{
  flex:none;display:grid;place-items:center;width:31px;height:31px;
  border:0;border-radius:8px;background:transparent;cursor:pointer;
  color:rgba(255,255,255,.5);transition:color .2s ease,background .2s ease;
}
.hlp-reveal svg{width:18px;height:18px}
.hlp .hlp-reveal:hover:not(:disabled){color:var(--acc);background:rgba(255,255,255,.07)}
.hlp-reveal:disabled{cursor:not-allowed;opacity:.5}

.hlp-err{margin:0;font-size:.775rem;color:var(--danger);line-height:1.4}
.hlp-hint{margin:0;font-size:.775rem;color:rgba(255,255,255,.45);line-height:1.4}

/* ---------- Password strength ---------- */
.hlp-meter{display:flex;gap:5px;margin-top:2px}
.hlp-meter span{
  flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,.10);
  transition:background .3s ease,box-shadow .3s ease;
}
.hlp-meter span.on{background:linear-gradient(90deg,var(--acc),var(--pri));box-shadow:0 0 10px -2px var(--glass-glow)}

/* ---------- Row: remember / forgot ---------- */
.hlp-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:1px}
.hlp-check{display:inline-flex;align-items:center;gap:9px;cursor:pointer;user-select:none}
.hlp-check input{position:absolute;opacity:0;width:0;height:0}
.hlp-check__box{
  display:grid;place-items:center;width:18px;height:18px;flex:none;
  border-radius:6px;border:1px solid var(--line-2);background:rgba(2,6,23,.6);
  color:transparent;transition:background .22s ease,border-color .22s ease,color .22s ease,box-shadow .22s ease;
}
.hlp-check__box svg{width:11px;height:11px}
.hlp-check input:checked + .hlp-check__box{
  background:linear-gradient(180deg,var(--acc),var(--pri));
  border-color:transparent;color:#fff;box-shadow:0 4px 14px -4px var(--blue-shadow);
}
.hlp-check input:focus-visible + .hlp-check__box{box-shadow:0 0 0 4px rgba(37,99,235,.32)}
.hlp-check__text{font-size:.845rem;color:var(--muted)}
.hlp-check:hover .hlp-check__text{color:rgba(255,255,255,.85)}

.hlp .hlp-link{
  border:0;background:none;padding:0;cursor:pointer;
  font:600 .845rem var(--f-body);color:var(--acc);
  transition:color .2s ease;
}
.hlp .hlp-link:hover:not(:disabled){color:#93C5FD}
[data-theme="classic"] .hlp .hlp-link:hover:not(:disabled){color:#1E3A8A}
.hlp-link:disabled{cursor:not-allowed;opacity:.55}

/* ---------- Primary button ---------- */
.hlp .hlp-submit{
  position:relative;overflow:hidden;
  display:flex;align-items:center;justify-content:center;gap:9px;
  width:100%;height:46px;margin-top:4px;
  border:0;border-radius:var(--r-sm);cursor:pointer;
  font:700 .94rem var(--f-body);letter-spacing:.01em;color:#fff;
  background:linear-gradient(135deg,var(--sky) 0%,var(--pri) 46%,var(--indigo) 100%);
  box-shadow:0 10px 26px -12px rgba(59,130,246,.9),0 1px 0 rgba(255,255,255,.22) inset;
  transition:transform .28s cubic-bezier(.22,1,.36,1),box-shadow .28s ease,filter .28s ease;
}
.hlp-submit:hover:not(:disabled){
  transform:translateY(-2px) scale(1.012);
  box-shadow:0 18px 40px -14px rgba(59,130,246,1),0 0 40px -12px var(--glass-glow),0 1px 0 rgba(255,255,255,.28) inset;
  filter:saturate(1.08);
}
.hlp-submit:active:not(:disabled){transform:translateY(0) scale(.995)}
.hlp-submit:disabled{cursor:not-allowed;opacity:.62;box-shadow:none}
.hlp-submit__sweep{
  position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(105deg,transparent 32%,rgba(255,255,255,.34) 50%,transparent 68%);
  transform:translateX(-130%);
}
.hlp-submit:hover:not(:disabled) .hlp-submit__sweep{transition:transform .85s ease;transform:translateX(130%)}
.hlp-submit__arrow{display:grid;place-items:center;width:17px;height:17px;transition:transform .28s ease}
.hlp-submit__arrow svg{width:100%;height:100%}
.hlp-submit:hover:not(:disabled) .hlp-submit__arrow{transform:translateX(3px)}

.hlp-spinner{
  width:17px;height:17px;flex:none;border-radius:50%;
  border:2px solid rgba(255,255,255,.32);border-top-color:#fff;
  animation:hlp-spin .72s linear infinite;
}
.hlp-spinner--dark{border-color:rgba(255,255,255,.22);border-top-color:var(--acc)}

/* ---------- Divider ---------- */
.hlp-divider{display:flex;align-items:center;gap:13px;margin:15px 0 12px}
.hlp-divider::before,.hlp-divider::after{
  content:'';flex:1;height:1px;
  background:linear-gradient(90deg,transparent,var(--line-2),transparent);
}
.hlp-divider span{font-size:.72rem;font-weight:600;letter-spacing:.14em;color:rgba(255,255,255,.42)}

/* ---------- Google ---------- */
.hlp .hlp-google{
  display:flex;align-items:center;justify-content:center;gap:10px;
  width:100%;height:44px;border-radius:var(--r-sm);cursor:pointer;
  background:rgba(255,255,255,.045);border:1px solid var(--line-2);
  color:rgba(255,255,255,.92);font:600 .9rem var(--f-body);
  transition:background .25s ease,border-color .25s ease,transform .28s cubic-bezier(.22,1,.36,1),box-shadow .28s ease;
}
.hlp-google:hover:not(:disabled){
  background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.26);
  transform:translateY(-2px);box-shadow:0 14px 30px -18px rgba(2,6,23,.95);
}
.hlp-google:active:not(:disabled){transform:translateY(0)}
.hlp-google:disabled{cursor:not-allowed;opacity:.6}
.hlp-google__icon{display:grid;place-items:center;width:18px;height:18px;flex:none}
.hlp-google__icon svg{width:100%;height:100%}

/* ---------- Footer ---------- */
.hlp-foot{margin:14px 0 0;text-align:center;font-size:.845rem;color:var(--muted)}
.hlp .hlp-underline{
  position:relative;border:0;background:none;padding:0;cursor:pointer;
  font:700 .87rem var(--f-body);color:var(--acc);
}
.hlp-underline::after{
  content:'';position:absolute;left:0;bottom:-2px;width:100%;height:1.5px;border-radius:2px;
  background:linear-gradient(90deg,var(--acc),var(--pri));
  transform:scaleX(0);transform-origin:right;transition:transform .34s cubic-bezier(.22,1,.36,1);
}
.hlp-underline:hover:not(:disabled)::after{transform:scaleX(1);transform-origin:left}
.hlp-underline:disabled{cursor:not-allowed;opacity:.55}

/* ---------- Classic ground ----------
   Everything above is authored for the signature (dark) view. These rules
   repaint only the surfaces that were hardcoded white-on-dark; geometry,
   timing and behaviour are untouched. */
[data-theme="classic"] .hlp-card__in{
  background:var(--card);
  border-color:var(--line);
  box-shadow:
    0 1px 0 rgba(255,255,255,.9) inset,
    0 18px 46px -26px rgba(11,18,32,.34),
    0 50px 100px -60px rgba(37,99,235,.20),
    0 0 0 1px rgba(11,18,32,.03);
}
[data-theme="classic"] .hlp-card:hover .hlp-card__in{
  border-color:rgba(37,99,235,.22);
  box-shadow:
    0 1px 0 rgba(255,255,255,.95) inset,
    0 22px 54px -26px rgba(11,18,32,.38),
    0 60px 116px -60px rgba(37,99,235,.28),
    0 0 0 1px rgba(37,99,235,.08);
}
[data-theme="classic"] .hlp-card__sheen{
  background:linear-gradient(160deg,rgba(255,255,255,.55) 0%,rgba(255,255,255,.14) 26%,transparent 52%);
}
[data-theme="classic"] .hlp-title{
  background:linear-gradient(180deg,#0F172A,#334155);
  -webkit-background-clip:text;background-clip:text;color:transparent;
}
[data-theme="classic"] .hlp-sub,
[data-theme="classic"] .hlp-check__text,
[data-theme="classic"] .hlp-foot,
[data-theme="classic"] .hlp-done p{color:#64748B}
[data-theme="classic"] .hlp-mark__ring{
  background:conic-gradient(from 210deg,transparent,rgba(37,99,235,.45),transparent 62%);
}
[data-theme="classic"] .hlp-mark__glass{
  background:linear-gradient(160deg,#FFFFFF,#EAF1FF);
  border-color:rgba(37,99,235,.22);
  box-shadow:0 12px 30px -16px rgba(37,99,235,.55),0 1px 0 rgba(255,255,255,.9) inset;
}
[data-theme="classic"] .hlp-mark__shine{
  background:linear-gradient(90deg,transparent,rgba(37,99,235,.16),transparent);
}
[data-theme="classic"] .hlp-label{color:#0F172A}
[data-theme="classic"] .hlp-input:hover{border-color:#CBD5E1}
[data-theme="classic"] .hlp-input__icon{color:#64748B}
[data-theme="classic"] .hlp-input input::placeholder{color:#94A3B8}
[data-theme="classic"] .hlp-input input:-webkit-autofill,
[data-theme="classic"] .hlp-input input:-webkit-autofill:hover,
[data-theme="classic"] .hlp-input input:-webkit-autofill:focus{
  -webkit-text-fill-color:#0B1220;
  -webkit-box-shadow:0 0 0 60px #FFFFFF inset;
  caret-color:#0B1220;
}
[data-theme="classic"] .hlp-reveal{color:#64748B}
[data-theme="classic"] .hlp-reveal:hover:not(:disabled){color:var(--pri);background:#F8FAFC}
[data-theme="classic"] .hlp-hint{color:#64748B}
[data-theme="classic"] .hlp-meter span{background:#E5E7EB}
[data-theme="classic"] .hlp-check__box{background:#FFFFFF;border-color:#CBD5E1}
[data-theme="classic"] .hlp-divider span{color:#64748B}
[data-theme="classic"] .hlp-alert{
  background:rgba(214,59,84,.07);border-color:rgba(214,59,84,.24);color:#B02A42;
}
[data-theme="classic"] .hlp-done__badge{
  background:rgba(15,122,86,.08);border-color:rgba(15,122,86,.26);
  box-shadow:0 0 28px -10px rgba(15,122,86,.35);
}
[data-theme="classic"] .hlp-done__badge--mail{
  background:#E0F2FE;border-color:rgba(59,130,246,.28);
  box-shadow:0 0 28px -10px rgba(59,130,246,.4);
}
[data-theme="classic"] .hlp-done__badge--busy{
  background:#E0F2FE;border-color:rgba(59,130,246,.24);box-shadow:none;
}
[data-theme="classic"] .hlp-notice{
  background:#E0F2FE;border-color:rgba(59,130,246,.26);color:#1E40AF;
}
[data-theme="classic"] .hlp-google{
  background:#FFFFFF;border-color:#E5E7EB;color:#0F172A;
  box-shadow:0 1px 2px rgba(15,23,42,.05);
}
[data-theme="classic"] .hlp-google:hover:not(:disabled){
  background:#F8FAFC;border-color:#CBD5E1;
  box-shadow:0 12px 26px -18px rgba(15,23,42,.45);
}
[data-theme="classic"] .hlp-submit__sweep{
  background:linear-gradient(105deg,transparent 32%,rgba(255,255,255,.42) 50%,transparent 68%);
}

/* ---------- Focus ----------
   The field wrapper already paints the focus state (blue border + ring), so the
   inner control must not draw a second one — two rings on one field is the
   mismatch that made Email look unlike Password. Every other control keeps its
   visible focus ring for keyboard users. */
.hlp :focus-visible{outline:2px solid var(--acc);outline-offset:2px;border-radius:6px}
/* Three classes deep so it beats the generic rule above and the site's own
   :focus-visible. The wrapper keeps its radius — only the ring is suppressed. */
.hlp .hlp-input:focus-within{outline:none}
.hlp .hlp-input input:focus,
.hlp .hlp-input input:focus-visible{
  outline:none;outline-offset:0;box-shadow:none;border-radius:0;
}
.hlp .hlp-input .hlp-reveal:focus-visible{outline:2px solid var(--acc);outline-offset:1px;border-radius:8px}

/* ---------- Responsive ---------- */
@media (max-width:520px){
  .hlp-card,.hlp-card--wide{max-width:100%}
  .hlp-row{gap:10px}
  .hlp-mark{width:52px;height:52px}
  .hlp-mark__img{width:28px;height:28px}
}
@media (max-width:360px){
  .hlp-row{flex-direction:column;align-items:flex-start}
}
/* Short viewports — a laptop at 125% zoom lands here. Trim the vertical rhythm
   rather than let the card grow a scrollbar. */
@media (max-height:720px){
  .hlp-stage{padding-block:16px}
  .hlp-mark{width:48px;height:48px;margin-bottom:10px}
  .hlp-mark__img{width:26px;height:26px}
  .hlp-head{margin-bottom:13px}
  .hlp-form{gap:10px}
  .hlp-divider{margin:12px 0 10px}
  .hlp-foot{margin-top:11px}
}

/* ---------- Reduced motion ---------- */
@media (prefers-reduced-motion:reduce){
  .hlp *,.hlp *::before,.hlp *::after{
    animation-duration:.001ms !important;animation-iteration-count:1 !important;
    transition-duration:.001ms !important;
  }
  .hlp-card{transform:none !important}
  .hlp-beams{display:none}
}
.hlp[data-reduced='true'] .hlp-card{transform:none}
`
