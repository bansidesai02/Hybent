import { forwardRef, type ButtonHTMLAttributes, type ElementType, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import { Loader2 } from 'lucide-react'

/**
 * The Hybent button.
 *
 * Four variants, down from the old six — `glass`, `secondary` and `outline` all
 * described the same "not the primary action" role and drifted apart. Anything
 * that was `glass` or `secondary` is `ghost`; anything that was `outline` is
 * `ghost` too.
 *
 * The full pill radius is deliberate and non-negotiable: it is the loudest
 * carry-over from the site, and it is what makes a dashboard toolbar read as the
 * same product as the marketing hero.
 *
 * `to` and `href` render a real link. Without them, every button-shaped
 * navigation in the product was a `<button onClick={navigate}>`, which looks
 * identical and silently drops middle-click, Ctrl/Cmd-click, "open in new tab"
 * and "copy link address" — the four things a user expects of anything that
 * takes them somewhere.
 */

type Variant = 'primary' | 'ghost' | 'quiet' | 'danger'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  /** Rendered before the label. Hidden from assistive tech. */
  icon?: ReactNode
  /** Nudges right on hover, matching the site's `.btn .arw`. */
  trailingIcon?: ReactNode
  fullWidth?: boolean
  /** Renders a react-router `<Link>`. For in-app navigation. */
  to?: string
  /** Renders an `<a>`. For external URLs and downloads. */
  href?: string
  /** Anchor target, e.g. `_blank`. Ignored unless `to` or `href` is set. */
  target?: string
  rel?: string
}

const VARIANT: Record<Variant, string> = {
  /* Gradient pans on a clipped ::before layer — same motion as `.btn-primary`. */
  primary: clsx(
    'relative isolate overflow-hidden bg-transparent',
    'text-hb-on-brand font-bold border-transparent',
    'before:content-[""] before:absolute before:left-0 before:top-0 before:h-full before:w-[180%]',
    'before:-z-10 before:rounded-[inherit] before:bg-hb-grad',
    'before:translate-x-0 before:transition-transform before:duration-[1150ms] before:ease-hb',
    'hover:before:-translate-x-[44.444%]',
    'shadow-[0_10px_34px_-14px_rgb(76_111_255_/_0.9)]',
    'hover:-translate-y-[2px]',
    'hover:shadow-[0_18px_44px_-14px_rgb(168_85_247_/_0.85)]'
  ),
  ghost: clsx(
    'bg-hb-surface text-hb-text border-hb-border shadow-hb-1',
    'hover:bg-hb-surface-2 hover:border-hb-border-strong hover:-translate-y-[1px]'
  ),
  quiet: 'bg-transparent text-hb-muted border-transparent hover:text-hb-text hover:bg-hb-blue/5',
  danger: clsx(
    'bg-hb-error text-white border-transparent',
    'hover:brightness-110 hover:-translate-y-[1px]'
  ),
}

const SIZE: Record<Size, string> = {
  sm: 'h-8 px-4 text-hb-sm gap-1.5',
  md: 'h-10 px-5 text-hb-body gap-2',
  lg: 'h-[46px] px-7 text-hb-ctl-lg gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    icon,
    trailingIcon,
    fullWidth = false,
    to,
    href,
    className,
    children,
    disabled,
    type = 'button',
    ...props
  },
  ref
) {
  /* A disabled link is not a thing — `<a>` has no disabled state and removing
     the href leaves an element that is still in the tab order. So a disabled or
     loading link falls back to a real disabled button, which is inert for
     free. */
  const inert = disabled || loading
  const Tag: ElementType = inert ? 'button' : to ? Link : href ? 'a' : 'button'
  const isLink = Tag !== 'button'

  return (
    <Tag
      ref={ref as never}
      {...(isLink
        ? { ...(to ? { to } : { href }) }
        : { type, disabled: inert, 'aria-busy': loading || undefined })}
      className={clsx(
        'group inline-flex items-center justify-center whitespace-nowrap',
        'rounded-hb-full border font-body font-semibold tracking-[-.01em]',
        'transition-all duration-hb-slow ease-hb',
        'active:translate-y-px active:scale-[.99]',
        /* `cursor-not-allowed`, not `pointer-events-none`: the native `disabled`
           attribute already blocks clicks and focus, and killing pointer events
           on top of it also kills hover — which means a `title` explaining *why*
           the button is disabled can never appear. That is exactly when the
           explanation matters most. */
        'disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANT[variant],
        SIZE[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin shrink-0" aria-hidden />
      ) : (
        icon && <span className="shrink-0 [&>svg]:block" aria-hidden>{icon}</span>
      )}
      {children}
      {trailingIcon && (
        <span
          className="shrink-0 [&>svg]:block transition-transform duration-hb ease-hb group-hover:translate-x-1"
          aria-hidden
        >
          {trailingIcon}
        </span>
      )}
    </Tag>
  )
})
