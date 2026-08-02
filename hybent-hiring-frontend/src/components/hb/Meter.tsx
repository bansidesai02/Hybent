import { useId } from 'react'
import { clsx } from 'clsx'

/**
 * A proportion, as a bar.
 *
 * Five screens had rebuilt this independently — the recruiter overview's hiring
 * funnel, the AI-insights meters, the match score in the candidates table, the
 * criteria bars on an interview scorecard and the same bars on the candidate
 * profile. They disagreed on height (1px to 10px), on track colour and on
 * whether the fill was a flat colour or the brand gradient.
 *
 * The fill is the brand gradient by default, because width is already the
 * encoding: a row of bars is one measurement at different values, not several
 * unrelated metrics. `tone` exists for the cases where the value carries a
 * verdict — a match score, a pass rate — and is the only reason to depart.
 */

type Tone = 'brand' | 'success' | 'warning' | 'error' | 'auto'
type Size = 'xs' | 'sm' | 'md'

const TRACK: Record<Size, string> = {
  xs: 'h-1',
  sm: 'h-1.5',
  md: 'h-2.5',
}

const FILL: Record<Exclude<Tone, 'auto'>, string> = {
  brand: 'bg-hb-grad',
  success: 'bg-hb-success',
  warning: 'bg-hb-warning',
  error: 'bg-hb-error',
}

/** The three bands every score surface in the product already agreed on. */
function band(value: number): Exclude<Tone, 'auto'> {
  if (value >= 80) return 'success'
  if (value >= 60) return 'warning'
  return 'error'
}

export function Meter({
  value,
  max = 100,
  tone = 'brand',
  size = 'sm',
  label,
  /** Rendered at the right of the label row. Defaults to a rounded percentage. */
  valueLabel,
  /**
   * Accessible name, for a bare meter with no `label`.
   *
   * A `role="progressbar"` with no name is announced as just its value — "62
   * percent", with no indication of what is 62 percent. When `label` is given
   * it supplies the name automatically and this is unnecessary.
   */
  'aria-label': ariaLabel,
  className,
}: {
  value: number
  /** Set to 5 for a 1–5 rating. */
  max?: number
  /** `auto` picks success / warning / error from the percentage. */
  tone?: Tone
  size?: Size
  label?: React.ReactNode
  valueLabel?: React.ReactNode
  'aria-label'?: string
  className?: string
}) {
  const labelId = useId()
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  const resolved = tone === 'auto' ? band(pct) : tone

  return (
    <div className={clsx(label && 'space-y-1.5', className)}>
      {label && (
        <div className="flex items-baseline justify-between gap-3">
          <span id={labelId} className="text-hb-sm text-hb-muted">
            {label}
          </span>
          <span className="font-mono text-hb-xs tabular-nums text-hb-text">
            {valueLabel ?? `${Math.round(pct)}%`}
          </span>
        </div>
      )}

      <div
        role="progressbar"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={max}
        /* The visible label names the bar when there is one; `aria-label` is
           the fallback for a bare meter. */
        aria-labelledby={label ? labelId : undefined}
        aria-label={label ? undefined : ariaLabel}
        className={clsx('overflow-hidden rounded-full bg-hb-muted/15', TRACK[size])}
      >
        {/* Width is the one thing that cannot come from a class. */}
        <div
          className={clsx(
            'h-full rounded-full transition-[width] duration-hb-slow ease-hb',
            FILL[resolved]
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
