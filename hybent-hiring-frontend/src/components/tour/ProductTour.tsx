import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  type LucideIcon, ArrowLeft, ArrowRight, BriefcaseBusiness, CalendarDays, Check, Inbox, Rocket, Sparkles,
  Search, SquareKanban, UserPlus, Users,
} from 'lucide-react'

import { START_TOUR_EVENT } from './tourEvents'

/**
 * Guided product tour for admins and recruiters.
 *
 * Each step opens the real page and spotlights the thing to use there (the
 * page's main button, or its title), with a card next to it.
 *
 * Smoothness rules:
 * - the tour's pages are preloaded when it starts, so "Next" never waits for code;
 * - the spotlight never disappears between steps: it stays where it was and
 *   springs to the new target once that exists;
 * - the target is followed every frame, so a page header that animates in
 *   carries the spotlight with it instead of leaving it behind.
 */

interface Step {
  path: string
  target: string[]
  icon: LucideIcon
  eyebrow: string
  title: string
  body: string
  tip?: string
}

const stepsFor = (base: string, copilot: boolean): Step[] => [
  ...(copilot ? [{
    path: `${base}/copilot`, target: ['main textarea', 'main input[placeholder^="Ask"]', '[data-tour="page-title"]'],
    icon: Sparkles, eyebrow: 'Recruiter Copilot', title: 'Just ask',
    body: '"Top 5 for Sales Executive", "schedule Raj tomorrow 11am", "draft a JD". Copilot does it, and asks before it changes anything.',
  }] : []),
  { path: `${base}/global-search`, target: ['[data-tour="page-actions"]', 'main input[type="search"]', 'main input', '[data-tour="page-title"]'], icon: Search, eyebrow: 'Global search',
    title: 'Find anything, fast',
    body: 'Search candidates beyond your own database, by skill, role and location, and add the right ones in one click.',
    tip: 'Try "React developer, Ahmedabad, 3+ years".' },
  { path: `${base}/inbox`, target: ['[data-tour="page-actions"]', '[data-tour="page-title"]'],
    icon: Inbox, eyebrow: 'Gmail Inbox', title: 'Let resumes come to you',
    body: 'Connect your Gmail and every resume that lands in it becomes a candidate on its own. Bills and spam stay out.' },
  { path: `${base}/jobs`, target: ['[data-tour="page-actions"] a', '[data-tour="page-actions"]', '[data-tour="page-title"]'],
    icon: BriefcaseBusiness, eyebrow: 'Jobs', title: 'Post a position',
    body: 'Add the role or paste a JD. Hybent turns it into a scoring rubric, and you get a public apply link to share.',
    tip: 'Candidates can also apply on WhatsApp from that link.' },
  { path: `${base}/candidates`, target: ['[data-tour="page-actions"] a', '[data-tour="page-actions"]', '[data-tour="page-title"]'],
    icon: UserPlus, eyebrow: 'Candidates', title: 'Add resumes, get AI scores',
    body: 'Upload one CV or hundreds. Each is parsed in seconds and scored against the job, with the reason for the score.' },
  { path: `${base}/pipeline`, target: ['[data-tour="page-title"]'],
    icon: SquareKanban, eyebrow: 'Pipeline', title: 'Move people forward',
    body: 'Drag candidates from screening to offer. They get WhatsApp and email updates at each step, automatically.' },
  { path: `${base}/interviews`, target: ['[data-tour="page-actions"]', '[data-tour="page-title"]'],
    icon: CalendarDays, eyebrow: 'Schedule', title: 'Interviews without the back-and-forth',
    body: 'Connect Google Calendar for conflict-free slots and Meet links. Candidates get reminders a day and an hour before.' },
]

const PRELOAD = () => Promise.allSettled([
  import('@/modules/recruiter/pages/JobsListPage'),
  import('@/modules/recruiter/pages/CandidatesPage'),
  import('@/modules/recruiter/pages/InboxPage'),
  import('@/modules/recruiter/pages/PipelinePage'),
  import('@/modules/recruiter/pages/InterviewsListPage'),
  import('@/modules/recruiter/pages/CopilotPage'),
])

const storageKey = (id: string) => `hb-tour-done:${id}`
const readDone = (id: string) => { try { return localStorage.getItem(storageKey(id)) === '1' } catch { return false } }
const writeDone = (id: string) => { try { localStorage.setItem(storageKey(id), '1') } catch { /* private mode */ } }

type Rect = { top: number; left: number; width: number; height: number }
const PAD = 10
const CARD_W = 380
const GAP = 16
const SPRING = { type: 'spring', stiffness: 240, damping: 30, mass: 0.9 } as const

function findEl(selectors: string[]): HTMLElement | null {
  for (const sel of selectors) {
    const el = document.querySelector<HTMLElement>(`main ${sel}`) ?? document.querySelector<HTMLElement>(sel)
    if (el && el.getBoundingClientRect().width > 0) return el
  }
  return null
}

function rectOf(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect()
  return { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 }
}

function placeCard(r: Rect | null, cardH: number) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  if (!r || vw < 768) return null
  const below = r.top + r.height + GAP
  const top = below + cardH < vh - 16 ? below : Math.max(16, r.top - GAP - cardH)
  const left = Math.min(Math.max(16, r.left + r.width - CARD_W), vw - CARD_W - 16)
  const arrowLeft = Math.min(Math.max(24, r.left + r.width / 2 - left), CARD_W - 24)
  return { top, left, arrowLeft, above: top < r.top }
}

export function ProductTour({ userId, firstName, basePath, enabled, copilot = true }: {
  userId?: string; firstName?: string; basePath: string; enabled: boolean; copilot?: boolean
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const steps = useMemo(() => stepsFor(basePath, copilot), [basePath, copilot])
  const [phase, setPhase] = useState<'idle' | 'welcome' | 'tour' | 'done'>('idle')
  const [index, setIndex] = useState(0)
  // Only pages this workspace actually has (e.g. Global Search may be off).
  const [active, setActive] = useState<Step[]>(steps)
  const [rect, setRect] = useState<Rect | null>(null)
  const [dir, setDir] = useState(1)
  const [cardH, setCardH] = useState(240)
  const cardRef = useRef<HTMLDivElement>(null)
  const startPath = useRef<string>(basePath)

  useEffect(() => {
    if (!enabled || !userId || readDone(userId)) return
    const t = window.setTimeout(() => { void PRELOAD(); setPhase('welcome') }, 900)
    return () => window.clearTimeout(t)
  }, [enabled, userId])

  useEffect(() => {
    const open = () => { void PRELOAD(); setIndex(0); setRect(null); setPhase('welcome') }
    window.addEventListener(START_TOUR_EVENT, open)
    return () => window.removeEventListener(START_TOUR_EVENT, open)
  }, [])

  const close = useCallback(() => {
    if (userId) writeDone(userId)
    setPhase('idle')
    setRect(null)
  }, [userId])

  const step = phase === 'tour' ? active[index] : undefined

  useEffect(() => {
    if (step && location.pathname !== step.path) navigate(step.path)
  }, [step, location.pathname, navigate])

  // Follow the step's target every frame. The previous spotlight stays put
  // until the new target exists, then springs to it.
  useLayoutEffect(() => {
    if (!step) return
    let frame = 0
    let last = ''
    let scrolled = false
    const tick = () => {
      const el = location.pathname === step.path ? findEl(step.target) : null
      if (el) {
        if (!scrolled) {
          scrolled = true
          const r = el.getBoundingClientRect()
          if (r.top < 80 || r.bottom > window.innerHeight - 80) el.scrollIntoView({ block: 'center' })
        }
        const r = rectOf(el)
        const sig = `${Math.round(r.top)}|${Math.round(r.left)}|${Math.round(r.width)}|${Math.round(r.height)}`
        if (sig !== last) { last = sig; setRect(r) }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [step, location.pathname])

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight)
  }, [index, phase])

  const next = useCallback(() => {
    setDir(1)
    if (index + 1 < active.length) setIndex(index + 1)
    else { setPhase('done'); setRect(null); navigate(startPath.current) }
  }, [index, active.length, navigate])
  const back = useCallback(() => { setDir(-1); setIndex((i) => Math.max(0, i - 1)) }, [])

  useEffect(() => {
    if (phase === 'idle') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (phase !== 'tour') return
      if (e.key === 'ArrowRight') { e.preventDefault(); next() }
      if (e.key === 'ArrowLeft') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, next, back, close])

  const begin = () => {
    const inNav = (p: string) => !!document.querySelector(`aside a[href="${p}"]`) || p.endsWith('/candidates')
    setActive(steps.filter((s) => inNav(s.path)))
    startPath.current = location.pathname
    setIndex(0)
    setPhase('tour')
  }

  if (typeof document === 'undefined') return null
  const pos = placeCard(rect, cardH)
  const progress = active.length ? ((index + 1) / active.length) * 100 : 0

  return createPortal(
    <AnimatePresence>
      {(phase === 'welcome' || phase === 'done') && (
        <motion.div key={phase} className="fixed inset-0 z-[10050] flex items-end justify-center p-4 sm:items-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-[rgb(10_14_30/0.5)] backdrop-blur-[8px]" onClick={close} />
          <motion.div role="dialog" aria-modal="true"
            className="relative w-full max-w-[460px] overflow-hidden rounded-[24px] border border-white/10 bg-hb-elevated shadow-[0_40px_100px_-30px_rgb(20_30_80/0.55)]"
            initial={{ y: 30, scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ y: 14, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}>
            {/* Hero: soft mesh, a faint grid, the Hybent mark with feature icons orbiting it. */}
            <div className="relative h-48 overflow-hidden bg-[#0b0b1f]">
              <div aria-hidden className="absolute inset-0 [background:radial-gradient(60%_80%_at_20%_10%,rgb(34_211_238/0.55),transparent_60%),radial-gradient(60%_80%_at_85%_20%,rgb(217_70_239/0.55),transparent_60%),radial-gradient(70%_90%_at_50%_120%,rgb(99_102_241/0.7),transparent_60%)]" />
              <div aria-hidden className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgb(255_255_255/0.5)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.5)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(circle_at_center,black,transparent_75%)]" />
              <div className="absolute inset-0 flex items-center justify-center">
                {phase === 'welcome' ? (
                  <div className="relative h-36 w-36">
                    <motion.div aria-hidden className="absolute inset-0 rounded-full border border-white/20"
                      animate={{ rotate: 360 }} transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}>
                      {[Users, BriefcaseBusiness, Sparkles, Search].map((I, i) => (
                        <motion.span key={i}
                          className="absolute flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white ring-1 ring-white/30 backdrop-blur-md"
                          style={{ left: `calc(50% + ${Math.cos((i * Math.PI) / 2) * 72}px - 18px)`, top: `calc(50% + ${Math.sin((i * Math.PI) / 2) * 72}px - 18px)` }}
                          animate={{ rotate: -360 }} transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}>
                          <I size={16} />
                        </motion.span>
                      ))}
                    </motion.div>
                    <motion.div className="absolute inset-0 m-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-[0_0_40px_10px_rgb(124_92_255/0.55)]"
                      initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}>
                      <img src="/hybent/hybent-mark.png" alt="" className="h-9 w-9 object-contain" />
                    </motion.div>
                  </div>
                ) : (
                  <motion.div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-hb-success shadow-[0_0_40px_10px_rgb(34_197_94/0.45)]"
                    initial={{ scale: 0.4, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 14 }}>
                    <Check size={30} strokeWidth={3} />
                  </motion.div>
                )}
              </div>
            </div>
            <div className="px-7 pb-7 pt-6">
              {phase === 'welcome' ? (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-hb-violet/10 px-2.5 py-1 text-[11px] font-semibold text-hb-violet">
                    <Sparkles size={12} /> Quick tour · {steps.length} stops · 1 min
                  </span>
                  <h2 className="mt-3 text-[26px] font-semibold leading-tight tracking-tight text-hb-text">
                    Welcome to Hybent{firstName ? `, ${firstName}` : ''} 👋
                  </h2>
                  <p className="mt-2 text-hb-sm leading-relaxed text-hb-muted">
                    We'll open each part of Hybent and point at the one thing that matters there.
                  </p>
                  <button type="button" onClick={begin} autoFocus
                    className="group mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-hb-grad px-6 py-3.5 text-hb-sm font-semibold text-white shadow-[0_16px_36px_-14px_rgb(80_70_255/0.9)] transition hover:brightness-110 active:scale-[0.99]">
                    Show me around <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                  </button>
                  <button type="button" onClick={close}
                    className="mt-2 w-full rounded-xl py-2 text-center text-hb-sm font-medium text-hb-muted transition hover:text-hb-text">
                    Maybe later
                  </button>
                </>
              ) : (
                <>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-hb-success">You're all set</p>
                  <h2 className="mt-1.5 text-[24px] font-semibold tracking-tight text-hb-text">Start with these three</h2>
                  <div className="mt-4 space-y-2">
                    {[
                      { icon: BriefcaseBusiness, label: 'Post your first position', to: `${basePath}/jobs/new` },
                      { icon: UserPlus, label: 'Upload a few resumes', to: `${basePath}/upload` },
                      { icon: Inbox, label: 'Connect your Gmail', to: `${basePath}/inbox` },
                    ].map(({ icon: I, label, to }) => (
                      <button key={to} type="button" onClick={() => { close(); navigate(to) }}
                        className="group flex w-full items-center gap-3 rounded-2xl border border-hb-border px-4 py-3 text-left transition hover:border-hb-violet/40 hover:bg-hb-surface-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-hb-grad text-white"><I size={17} /></span>
                        <span className="flex-1 text-hb-sm font-semibold text-hb-text">{label}</span>
                        <ArrowRight size={15} className="text-hb-dim transition group-hover:translate-x-0.5 group-hover:text-hb-text" />
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={close} className="mt-5 w-full text-center text-hb-sm font-medium text-hb-muted hover:text-hb-text">
                    I'll explore on my own
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}

      {phase === 'tour' && step && (
        <motion.div key="tour" className="fixed inset-0 z-[10050]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

          {rect ? (
            <motion.div className="pointer-events-none absolute rounded-[18px]"
              initial={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height, opacity: 0 }}
              animate={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height, opacity: 1 }}
              transition={SPRING}
              style={{ boxShadow: '0 0 0 9999px rgb(8 12 28 / 0.6)' }}>
              <div className="absolute inset-0 rounded-[18px] ring-2 ring-white/90 shadow-[0_0_0_6px_rgb(124_92_255/0.35),0_0_40px_6px_rgb(124_92_255/0.35)]" />
              <motion.div className="absolute -inset-2 rounded-[22px] ring-2 ring-hb-brand-violet/60"
                animate={{ opacity: [0.8, 0, 0.8], scale: [1, 1.06, 1] }} transition={{ duration: 2.2, repeat: Infinity }} />
            </motion.div>
          ) : (
            <motion.div className="absolute inset-0 bg-[rgb(8_12_28/0.6)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
          )}

          <motion.div ref={cardRef} role="dialog" aria-modal="true" aria-live="polite"
            className={pos ? 'absolute' : 'absolute inset-x-4 bottom-[calc(var(--hb-mobile-nav,0px)+16px)] mx-auto max-w-[440px]'}
            style={pos ? { width: CARD_W } : undefined}
            initial={pos ? { top: pos.top, left: pos.left, opacity: 0, y: 10 } : { opacity: 0, y: 10 }}
            animate={pos ? { top: pos.top, left: pos.left, opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
            transition={SPRING}>
            {pos && (
              <motion.span aria-hidden
                className={`absolute h-3.5 w-3.5 rotate-45 border-hb-border bg-hb-elevated ${pos.above ? '-bottom-[7px] border-b border-r' : '-top-[7px] border-l border-t'}`}
                initial={false} animate={{ left: pos.arrowLeft - 7 }} transition={SPRING} />
            )}
            <div className="overflow-hidden rounded-[22px] border border-hb-border bg-hb-elevated shadow-[0_30px_80px_-24px_rgb(10_16_40/0.6)]">
              <div className="h-1 bg-hb-surface-2">
                <motion.div className="h-full bg-hb-grad" initial={false} animate={{ width: `${progress}%` }} transition={{ duration: 0.45 }} />
              </div>
              <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                <motion.div key={index} className="px-6 pb-4 pt-5"
                  initial={{ opacity: 0, x: 20 * dir }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 * dir }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-hb-grad text-white shadow-[0_10px_24px_-10px_rgb(80_70_255/0.8)]">
                      <step.icon size={20} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-hb-violet">{index === 0 ? step.eyebrow : `Step ${index} · ${step.eyebrow}`}</p>
                      <h3 className="text-[18px] font-semibold leading-snug tracking-tight text-hb-text">{step.title}</h3>
                    </div>
                  </div>
                  <p className="mt-3 text-hb-sm leading-relaxed text-hb-muted">{step.body}</p>
                  {step.tip && (
                    <p className="mt-3 flex items-start gap-2 rounded-xl bg-hb-surface-2 px-3 py-2 text-hb-xs text-hb-text">
                      <Rocket size={13} className="mt-0.5 shrink-0 text-hb-violet" /> {step.tip}
                    </p>
                  )}
                </motion.div>
              </AnimatePresence>
              <div className="flex items-center justify-between border-t border-hb-border px-6 py-3">
                <button type="button" onClick={close} className="text-hb-xs font-medium text-hb-muted hover:text-hb-text">
                  Skip tour
                </button>
                <div className="flex items-center gap-2">
                  <span className="mr-1 text-hb-xs tabular-nums text-hb-dim">{index + 1} / {active.length}</span>
                  {index > 0 && (
                    <button type="button" onClick={back} aria-label="Back"
                      className="rounded-full border border-hb-border p-2 text-hb-muted transition hover:bg-hb-surface-2 hover:text-hb-text">
                      <ArrowLeft size={15} />
                    </button>
                  )}
                  <button type="button" onClick={next} autoFocus
                    className="inline-flex items-center gap-1.5 rounded-full bg-hb-grad px-5 py-2 text-hb-sm font-semibold text-white transition hover:brightness-110">
                    {index + 1 === active.length ? <>Finish <Check size={14} /></> : <>Next <ArrowRight size={14} /></>}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
