import { type ReactNode } from 'react'
import { clsx } from 'clsx'

/**
 * The site's `.badge`, unchanged in character: mono, uppercase, wide-tracked,
 * pill. Semantic tones only — there is no `badge variant="violet"`, because
 * colour that does not mean something is what produced 56 competing status maps.
 *
 * For candidate stages and interview states use `StatusPill`, which owns the
 * domain mapping. This is for everything else.
 */

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'error' | 'info' | 'brand'

const TONE: Record<BadgeTone, string> = {
  neutral: 'text-hb-muted border-hb-border-strong bg-hb-muted/8',
  success: 'text-hb-success border-hb-success/30 bg-hb-success/10',
  warning: 'text-hb-warning border-hb-warning/30 bg-hb-warning/10',
  error: 'text-hb-error border-hb-error/30 bg-hb-error/10',
  info: 'text-hb-blue border-hb-blue/30 bg-hb-blue/10',
  brand: 'text-hb-violet border-hb-violet/30 bg-hb-violet/10',
}

export interface BadgeProps {
  children: ReactNode
  tone?: BadgeTone
  /** Leading dot. `pulse` animates it, for genuinely live states only. */
  dot?: boolean | 'pulse'
  className?: string
}

export function Badge({ children, tone = 'neutral', dot, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-[7px] h-[26px] px-[11px] rounded-hb-full border',
        'font-mono text-[10.5px] tracking-[.14em] uppercase whitespace-nowrap',
        TONE[tone],
        className
      )}
    >
      {dot && (
        <span
          aria-hidden
          className={clsx(
            'w-1.5 h-1.5 rounded-full bg-current shrink-0',
            dot === 'pulse' && 'animate-pulse'
          )}
        />
      )}
      {children}
    </span>
  )
}
