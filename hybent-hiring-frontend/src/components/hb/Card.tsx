import { type ElementType, type HTMLAttributes, type ReactNode } from 'react'
import { clsx } from 'clsx'

/**
 * The card, matching the site's.
 *
 * Radius, padding and both shadows are the site's `.card` values, not an
 * approximation of them: 22px, `clamp(22px,2.4vw,30px)`, and the two-layer
 * contact-plus-halo drop. A card is the surface a reader compares most directly
 * between a marketing page and the product, so it is the one that has to be
 * exact.
 *
 * The one deliberate departure is the glass. The site's dark card is
 * `backdrop-filter: blur(18px)` over a translucent gradient; its *light* card
 * already sets `backdrop-filter: none` and a solid `#fff`, which is what the
 * product renders, so in the theme that actually ships there is no difference.
 * On dark the product stays solid, because blurring behind a scrolling table
 * costs real frames and softens 13px text.
 *
 * The gradient hairline on hover (`hb-edge`) is the site's `.card::before`.
 */

type CardVariant = 'flat' | 'interactive'

/* Typed against HTMLElement rather than HTMLDivElement so `as` can render a
   list item or an article without the event handlers narrowing to a div. */
export interface CardProps extends HTMLAttributes<HTMLElement> {
  variant?: CardVariant
  padding?: 'none' | 'compact' | 'default' | 'loose'
  as?: 'div' | 'article' | 'section' | 'li'
}

/* `default` and `loose` are the two ends of the site's own
   `clamp(22px, 2.4vw, 30px)`. `compact` has no equivalent on the site and
   exists for table rows and sidebars, where 22px would be wasteful. */
const PADDING = {
  none: '',
  compact: 'p-[14px]',
  default: 'p-[22px]',
  loose: 'p-[22px] xl:p-[30px]',
} as const

export function Card({
  variant = 'flat',
  padding = 'default',
  as = 'div',
  className,
  children,
  ...props
}: CardProps) {
  const Tag = as as ElementType
  return (
    <Tag
      className={clsx(
        'relative isolate rounded-hb-lg border border-hb-border bg-hb-surface',
        /* A large surface settling slowly is a lot of what makes the brand feel
           unhurried, so the card runs on the `lift` band, not the control band. */
        'shadow-hb-card transition-all duration-hb-lift ease-hb',
        variant === 'interactive' && [
          /* `group` so a nested `IconTile` picks up the site's hover tilt.
             `hb-edge` is the gradient hairline, `hb-glow` the blue radial —
             the site runs both together on `.card:hover`. */
          'group hb-edge hb-glow cursor-pointer',
          /* The site lifts `.card` a full 6px on hover. This was 2px, which
             reads as a twitch rather than as the surface coming toward you —
             the difference is most of the perceived quality of the whole board. */
          'hover:-translate-y-1.5 hover:shadow-hb-card-hover hover:border-hb-border-strong',
        ],
        PADDING[padding],
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  )
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  icon?: ReactNode
  className?: string
}) {
  return (
    /* Phones: the action (a filter select, a button) wraps under the title at
       full width instead of squeezing it to "Your mail…" or running off-card. */
    <div className={clsx('flex flex-wrap items-start justify-between gap-x-4 gap-y-3 mb-4', className)}>
      <div className="flex min-w-0 flex-1 items-start gap-3 max-md:basis-full">
        {icon && <span className="shrink-0 mt-0.5">{icon}</span>}
        <div className="min-w-0">
          <h3 className="font-display text-hb-h3 text-hb-text max-md:whitespace-normal md:truncate">{title}</h3>
          {subtitle && <p className="mt-1 text-hb-sm text-hb-muted">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0 max-w-full">{action}</div>}
    </div>
  )
}

/** Full-bleed divider inside a padded card. The inset matches `padding="default"`. */
export function CardDivider({ className }: { className?: string }) {
  return <hr className={clsx('-mx-[22px] my-4 h-px border-0 bg-hb-border', className)} />
}
