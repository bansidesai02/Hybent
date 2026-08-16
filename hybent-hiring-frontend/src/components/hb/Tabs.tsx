import { useCallback, useId, useRef, type ReactNode } from 'react'
import { clsx } from 'clsx'

/**
 * Tabs.
 *
 * Keyboard behaviour follows the WAI-ARIA tabs pattern: arrows move between
 * tabs, Home and End jump to the ends, and only the active tab is in the tab
 * order. The scorecard, candidate profile and client detail screens each built
 * their own tab strips out of `<div onClick>`, none of which were reachable
 * without a mouse.
 *
 * Appearance is the site's `.tab`: a 40px pill that fills with the brand
 * gradient when selected, with the ink flipping to `--hb-on-brand`. The first
 * version used a gradient underline instead, which read as a different product
 * the moment a marketing page and a workspace were open side by side.
 *
 * Because the selected state is now carried by fill rather than a rule, the
 * strip no longer needs a bottom border — the pills sit on the page the way
 * they do on the site.
 */

export interface TabItem<T extends string = string> {
  value: T
  label: ReactNode
  count?: number
  disabled?: boolean
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  'aria-label': ariaLabel,
  className,
}: {
  items: Array<TabItem<T>>
  value: T
  onChange: (next: T) => void
  'aria-label': string
  className?: string
}) {
  const baseId = useId()
  const listRef = useRef<HTMLDivElement>(null)

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const enabled = items.filter((i) => !i.disabled)
      if (!enabled.length) return
      const current = enabled.findIndex((i) => i.value === value)

      let nextIndex: number | null = null
      if (e.key === 'ArrowRight') nextIndex = (current + 1) % enabled.length
      else if (e.key === 'ArrowLeft') nextIndex = (current - 1 + enabled.length) % enabled.length
      else if (e.key === 'Home') nextIndex = 0
      else if (e.key === 'End') nextIndex = enabled.length - 1
      if (nextIndex === null) return

      e.preventDefault()
      const next = enabled[nextIndex]
      onChange(next.value)
      /* Move focus with selection, as the pattern requires. */
      listRef.current
        ?.querySelector<HTMLButtonElement>(`[data-tab="${next.value}"]`)
        ?.focus()
    },
    [items, value, onChange]
  )

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={clsx(
        'flex items-center gap-2 overflow-x-auto max-w-full py-1',
        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className
      )}
    >
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            id={`${baseId}-tab-${item.value}`}
            data-tab={item.value}
            aria-selected={active}
            aria-controls={`${baseId}-panel-${item.value}`}
            tabIndex={active ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
            className={clsx(
              'shrink-0 h-10 px-[18px] inline-flex items-center gap-2 rounded-hb-full border',
              'font-body text-hb-sm whitespace-nowrap',
              'transition-[color,background,border-color,transform] duration-hb-slow ease-hb',
              'focus-visible:outline-none focus-visible:shadow-hb-ring',
              'disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:translate-y-0',
              active
                ? 'border-transparent bg-hb-grad font-bold text-hb-on-brand'
                : 'border-hb-border bg-hb-surface text-hb-muted hover:-translate-y-[2px] hover:text-hb-text'
            )}
          >
            {item.label}
            {typeof item.count === 'number' && (
              <span
                className={clsx(
                  'font-mono text-hb-micro px-1.5 h-[18px] inline-flex items-center rounded-hb-full',
                  /* On the filled pill the count sits on the gradient, so it
                     borrows the same ink rather than a tinted chip. */
                  active ? 'bg-hb-on-brand/12 text-hb-on-brand' : 'bg-hb-muted/12 text-hb-muted'
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function TabPanel({
  value,
  active,
  children,
  className,
}: {
  value: string
  active: boolean
  children: ReactNode
  className?: string
}) {
  if (!active) return null
  return (
    <div
      role="tabpanel"
      aria-labelledby={`tab-${value}`}
      tabIndex={0}
      className={clsx('pt-hb-5 focus-visible:outline-none', className)}
    >
      {children}
    </div>
  )
}
