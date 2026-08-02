import { clsx } from 'clsx'

/**
 * A 0–100 figure as a ring.
 *
 * Three bands, matching every other score surface in the product: 80+ success,
 * 60+ warning, below that error. The previous version hardcoded `#e5e7eb` for
 * the track, which is invisible in dark mode, and drew the number in the band
 * colour at 8px — below the size at which colour contrast is legible at all.
 * The number is now always ink-coloured; the ring carries the band.
 *
 * `polarity` exists because not every 0–100 figure is better when it is high.
 * A match score of 90 is good; disk utilisation of 90 is an incident. The
 * health monitor was drawing its CPU/RAM/disk rings in three arbitrary brand
 * colours precisely because the score bands would have said the wrong thing.
 */
export function ScoreRing({
  score,
  size = 56,
  strokeWidth = 5,
  /** `higher-better` for scores, `lower-better` for utilisation and load. */
  polarity = 'higher-better',
  /** Accessible name. Defaults to the match-score phrasing. */
  label,
  /** Appended to the figure inside the ring, e.g. `%`. */
  suffix,
  className,
}: {
  score: number | null | undefined
  size?: number
  strokeWidth?: number
  polarity?: 'higher-better' | 'lower-better'
  label?: string
  suffix?: string
  className?: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const pct = score != null ? Math.min(100, Math.max(0, score)) : 0
  const offset = circumference - (pct / 100) * circumference

  /* Read the value from the "good" end so both polarities share one ladder. */
  const good = score == null ? null : polarity === 'higher-better' ? score : 100 - score

  const stroke =
    good == null
      ? 'rgb(var(--hb-dim))'
      : good >= 80
        ? 'rgb(var(--hb-success))'
        : good >= 60
          ? 'rgb(var(--hb-warning))'
          : 'rgb(var(--hb-error))'

  const name =
    label ??
    (score != null ? `Match score ${Math.round(score)} out of 100` : 'No match score')

  return (
    <div
      className={clsx('relative inline-grid place-items-center', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ? `${name}: ${score != null ? Math.round(score) : 'unknown'}${suffix ?? ''}` : name}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-hb-muted/15"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-hb-slow ease-hb"
        />
      </svg>
      <span
        aria-hidden
        className="absolute font-mono font-semibold tabular-nums text-hb-text"
        style={{ fontSize: Math.max(10, Math.round(size * 0.26)) }}
      >
        {score != null ? Math.round(score) : '—'}
        {score != null && suffix}
      </span>
    </div>
  )
}
