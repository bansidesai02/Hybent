import { type ReactNode } from 'react'
import { clsx } from 'clsx'

/**
 * The site's `.icon-tile`, at product sizes.
 *
 * Replaces `GlassIcon`, which was used in 42 files and is the single biggest
 * visual mismatch in the product: frosted tiles tinted violet, pink, teal,
 * amber and emerald — five accent colours that exist in no Hybent design
 * language. Same shape and role, correct palette.
 *
 * There is exactly one tile appearance. If a caller wants to distinguish
 * meaning, that is what `StatusPill` and copy are for; colour-coding a tile per
 * feature is how the old system ended up with 175 hardcoded hexes.
 */

type Size = 'sm' | 'md' | 'lg'

/* The glyph is sized by a descendant selector rather than a `size` prop, so a
   caller passes a bare lucide icon and cannot get it wrong. */
const SIZE: Record<Size, string> = {
  sm: 'w-8 h-8 rounded-hb-sm [&>svg]:w-[15px] [&>svg]:h-[15px]',
  md: 'w-10 h-10 rounded-hb-tile [&>svg]:w-[18px] [&>svg]:h-[18px]',
  lg: 'w-[46px] h-[46px] rounded-hb-tile [&>svg]:w-[21px] [&>svg]:h-[21px]',
}

export function IconTile({
  children,
  size = 'md',
  className,
}: {
  /** A lucide icon. Sized by the tile, so pass it without a size prop. */
  children: ReactNode
  size?: Size
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={clsx(
        'grid place-items-center shrink-0 border border-hb-border-strong',
        'bg-hb-grad-soft text-hb-cyan',
        /* The site's `.card:hover .icon-tile` — lift and a small counter-
           clockwise tilt, over .4s. It is the most recognisable single motion
           in the Hybent visual language, and the product had none of it.
           Driven by `group-hover` so it fires from whatever wraps the tile;
           `Card variant="interactive"` and the quick-action tiles both set
           `group`. */
        'transition-[transform,color] duration-[400ms] ease-hb',
        'group-hover:-translate-y-[3px] group-hover:-rotate-[4deg]',
        SIZE[size],
        className
      )}
    >
      {children}
    </span>
  )
}
