import { useState } from 'react'
import { clsx } from 'clsx'

/**
 * A person, as initials or a photo.
 *
 * The primitive this replaces hashed the first character of a name to one of
 * six Tailwind hues — violet, pink, teal, amber, blue, emerald. Six accent
 * colours that exist in no Hybent palette, assigned by a rule that carries no
 * meaning: "Anna" and "Amit" were always the same colour, and a list of twenty
 * candidates read as a bag of sweets.
 *
 * One appearance, from the brand gradient. Identity comes from the initials and
 * the name beside them, which is where it should come from.
 */

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const SIZE: Record<Size, string> = {
  xs: 'w-6 h-6 text-hb-micro',
  sm: 'w-8 h-8 text-hb-xs',
  md: 'w-10 h-10 text-hb-sm',
  lg: 'w-12 h-12 text-hb-body',
  xl: 'w-16 h-16 text-hb-h3',
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function Avatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name: string
  src?: string | null
  size?: Size
  className?: string
}) {
  const [broken, setBroken] = useState(false)

  if (src && !broken) {
    return (
      <img
        src={src}
        alt={name ? `${name}'s avatar` : 'User avatar'}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className={clsx(
          'shrink-0 rounded-full border border-hb-border object-cover bg-hb-surface-2',
          SIZE[size],
          className
        )}
      />
    )
  }

  return (
    /* Decorative: the name is always rendered next to it, so announcing the
       initials as well would read the person twice. */
    <span
      aria-hidden
      className={clsx(
        'grid shrink-0 select-none place-items-center rounded-full',
        'border border-hb-border-strong bg-hb-grad-soft',
        'font-display font-semibold text-hb-cyan',
        SIZE[size],
        className
      )}
    >
      {initials(name) || '?'}
    </span>
  )
}
