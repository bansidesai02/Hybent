import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react'
import { clsx } from 'clsx'

/**
 * Content that arrives, rather than content that is simply there.
 *
 * The Hybent site fades and slides every section in as it enters the viewport
 * (`[data-rv]` in `hybent-site.css`, 850ms on the brand curve, staggered by a
 * `data-delay`). The product shipped with none of it — every page appeared
 * fully formed and instantly, which is a large part of why the workspace read
 * as an admin panel next to the marketing pages.
 *
 * This is the same effect and the same timings, but implemented in the
 * component rather than as a global `[data-rv]` rule, so it needs no stylesheet
 * of its own and cannot leak into the site scope.
 *
 * Three things it deliberately gets right:
 *
 * - It reveals **once**. Re-animating a section every time it scrolls back into
 *   view is the tell of a cheap template.
 * - `prefers-reduced-motion` short-circuits to visible. Never animate at
 *   someone who has asked you not to.
 * - It starts visible when `IntersectionObserver` is missing, so a failure mode
 *   is "no animation", never "no content".
 */

type Direction = 'up' | 'left' | 'right' | 'scale' | 'none'

/** The site's own offsets, verbatim. */
const HIDDEN: Record<Direction, string> = {
  up: 'opacity-0 translate-y-[34px]',
  left: 'opacity-0 -translate-x-10',
  right: 'opacity-0 translate-x-10',
  scale: 'opacity-0 scale-[.94]',
  none: 'opacity-0',
}

export function Reveal({
  children,
  direction = 'up',
  /** Stagger, in ms. Give siblings `i * 80` to make a grid cascade. */
  delay = 0,
  as = 'div',
  className,
}: {
  children: ReactNode
  direction?: Direction
  delay?: number
  as?: ElementType
  className?: string
}) {
  const ref = useRef<HTMLElement | null>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || !('IntersectionObserver' in window)) {
      setShown(true)
      return
    }

    /* Already on screen at mount — above-the-fold content should not wait for a
       scroll that may never come. */
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          setShown(true)
          io.unobserve(entry.target)
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    )

    io.observe(el)

    /* Failsafe. This component starts its subject at `opacity-0`, so anything
       that stops the observer from ever firing — a layout that never scrolls
       the element past the threshold, a browser quirk, a container that clips
       oddly — would leave real content permanently invisible. Since it wraps
       every page header and every stat tile, that failure would be a blank
       dashboard, not a missing animation. After 1.2s, show it regardless. */
    const failsafe = window.setTimeout(() => setShown(true), 1200)

    return () => {
      io.disconnect()
      window.clearTimeout(failsafe)
    }
  }, [])

  const Tag = as as ElementType

  return (
    <Tag
      ref={ref}
      style={{ transitionDelay: shown && delay ? `${delay}ms` : undefined }}
      className={clsx(
        'transition-[opacity,transform] duration-hb-reveal ease-hb motion-reduce:transition-none',
        shown ? 'translate-x-0 translate-y-0 scale-100 opacity-100' : HIDDEN[direction],
        className
      )}
    >
      {children}
    </Tag>
  )
}
