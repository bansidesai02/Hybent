import { Children, isValidElement, type ReactNode } from 'react'
import { clsx } from 'clsx'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card } from './Card'
import { IconTile } from './IconTile'
import { Reveal } from './Reveal'

/**
 * The one KPI card.
 *
 * Replaces a locally-defined equivalent in every dashboard — the recruiter
 * overview built one at 20px radius, super admin another at 24px, and the
 * shared `Card` primitive claimed 14px. All three are this now.
 *
 * The figure is Sora at the `hb-num` step, which is what gives a stat row the
 * same typographic weight as a site hero number.
 */

export type Trend = {
  value: string
  direction: 'up' | 'down' | 'flat'
  /** Whether `up` is good. Time-to-hire going up is not. */
  goodWhen?: 'up' | 'down'
}

export interface StatCardProps {
  label: string
  value: ReactNode
  icon?: ReactNode
  trend?: Trend
  /** Renders a muted skeleton in place of the figure. */
  loading?: boolean
  onClick?: () => void
  className?: string
}

const TREND_ICON = { up: TrendingUp, down: TrendingDown, flat: Minus }

function trendTone(t: Trend) {
  if (t.direction === 'flat') return 'text-hb-muted bg-hb-muted/10'
  const good = (t.goodWhen ?? 'up') === t.direction
  return good ? 'text-hb-success bg-hb-success/10' : 'text-hb-error bg-hb-error/10'
}

export function StatCard({
  label,
  value,
  icon,
  trend,
  loading = false,
  onClick,
  className,
}: StatCardProps) {
  const TrendIcon = trend ? TREND_ICON[trend.direction] : null

  return (
    <Card
      variant={onClick ? 'interactive' : 'flat'}
      className={clsx('flex flex-col gap-4', className)}
      onClick={onClick}
      {...(onClick
        ? {
            role: 'button',
            tabIndex: 0,
            onKeyDown: (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            },
          }
        : {})}
    >
      <div className="flex items-start justify-between gap-3">
        {icon ? <IconTile size="md">{icon}</IconTile> : <span />}
        {trend && TrendIcon && (
          <span
            className={clsx(
              'inline-flex items-center gap-1 rounded-hb-full px-2 h-[22px]',
              'font-mono text-hb-micro tracking-[.08em] uppercase',
              trendTone(trend)
            )}
          >
            <TrendIcon size={11} aria-hidden />
            {trend.value}
          </span>
        )}
      </div>

      <div>
        {loading ? (
          <div className="h-7 w-20 rounded-hb-sm bg-hb-muted/15 animate-pulse" />
        ) : (
          /* Gradient-filled, exactly as the site paints `.stat b`. A row of
             stat cards is where the brand gradient does most of its work on a
             light Hybent page. */
          <p className="hb-grad-text font-display text-hb-num">{value}</p>
        )}
        <p className="mt-1.5 font-mono text-hb-label uppercase text-hb-muted">{label}</p>
      </div>
    </Card>
  )
}

/**
 * Standard responsive grid for a row of stats.
 *
 * Each tile is wrapped in a `Reveal` and staggered 70ms after the one before,
 * so the row cascades in the way the site's card grids do rather than all
 * snapping on at once. Doing it here rather than at every call site is what
 * gets the effect onto all six dashboards without touching any of them.
 */
export function StatGrid({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={clsx(
        'grid gap-hb-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4',
        className
      )}
    >
      {Children.map(children, (child, i) =>
        isValidElement(child) ? (
          <Reveal delay={i * 70} className="h-full">
            {child}
          </Reveal>
        ) : (
          child
        )
      )}
    </div>
  )
}
