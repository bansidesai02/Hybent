import { useId, useState, type ReactNode } from 'react'
import { clsx } from 'clsx'
import { Search, SlidersHorizontal, X } from 'lucide-react'

/**
 * The search + filter + bulk-action bar above a list.
 *
 * Every list page in the product rebuilt this from scratch, which is why the
 * search box is a different height on the candidates, jobs, interviews and
 * talent screens. One bar, one set of slots.
 *
 * The bulk-action row replaces the selection UI each page invented, and is the
 * reason selection state belongs to the list rather than the table.
 */

export function Toolbar({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={clsx(
        'flex flex-wrap items-center gap-2 mb-hb-4',
        className
      )}
    >
      {children}
    </div>
  )
}

export function ToolbarSearch({
  value,
  onChange,
  placeholder = 'Search…',
  className,
  'aria-label': ariaLabel,
}: {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  className?: string
  'aria-label'?: string
}) {
  return (
    <div className={clsx('relative flex-1 min-w-[140px] sm:min-w-[200px] max-w-md', className)}>
      <Search
        size={15}
        aria-hidden
        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-hb-dim pointer-events-none"
      />
      <input
        type="search"
        value={value}
        aria-label={ariaLabel ?? placeholder}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={clsx(
          'w-full h-10 pl-10 pr-9 rounded-hb-full',
          'border border-hb-border bg-hb-surface',
          'font-body text-hb-sm text-hb-text placeholder:text-hb-dim',
          'transition-[border-color,box-shadow] duration-hb ease-hb',
          'focus:outline-none focus:border-hb-blue/60 focus:shadow-hb-ring',
          '[&::-webkit-search-cancel-button]:hidden'
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 grid place-items-center w-6 h-6 rounded-full text-hb-dim hover:text-hb-text hover:bg-hb-muted/10 transition-colors duration-hb"
        >
          <X size={13} aria-hidden />
        </button>
      )}
    </div>
  )
}

/**
 * A list's filter controls (selects, date fields…).
 *
 * Desktop: rendered inline in the toolbar, exactly as if unwrapped.
 * Phones: folded behind a "Filters" button — with a count of the filters in
 * use — that expands them full-width under the search, so the list starts
 * near the top of the screen instead of under a wall of dropdowns. Children
 * render once either way (no duplicated inputs), only the layout changes.
 */
export function ToolbarFilters({
  children,
  activeCount = 0,
  onReset,
}: {
  children: ReactNode
  /** Filters currently narrowing the list — shown on the phone button. */
  activeCount?: number
  /** Shows a "Reset" action in the phone panel when filters are active. */
  onReset?: () => void
}) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className={clsx(
          'relative inline-flex h-10 shrink-0 items-center gap-2 rounded-hb-full border px-4 md:hidden',
          'font-body text-hb-sm font-semibold transition-colors duration-hb',
          open || activeCount > 0
            ? 'border-hb-blue/40 bg-hb-blue/10 text-hb-text'
            : 'border-hb-border bg-hb-surface text-hb-muted'
        )}
      >
        <SlidersHorizontal size={15} aria-hidden />
        Filters
        {activeCount > 0 && (
          <span className="grid h-5 min-w-5 place-items-center rounded-hb-full bg-hb-grad px-1 font-mono text-[10px] font-bold text-hb-on-brand">
            {activeCount}
          </span>
        )}
      </button>

      <div
        id={panelId}
        className={clsx(
          'md:contents',
          open
            ? 'grid w-full grid-cols-1 gap-3 rounded-hb-md border border-hb-border bg-hb-surface p-3 max-md:[&>*]:!w-full'
            : 'hidden'
        )}
      >
        {children}
        {onReset && activeCount > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="h-10 rounded-hb-sm text-hb-sm font-semibold text-hb-blue md:hidden"
          >
            Reset filters
          </button>
        )}
      </div>
    </>
  )
}

/** Pushes everything after it to the right edge. */
export function ToolbarSpacer() {
  return <div className="flex-1" />
}

/**
 * Appears when rows are selected. Announced politely so a screen reader hears
 * the count change without losing the user's place.
 */
export function ToolbarSelection({
  count,
  onClear,
  children,
  className,
}: {
  count: number
  onClear: () => void
  children?: ReactNode
  className?: string
}) {
  if (count === 0) return null
  return (
    <div
      role="status"
      className={clsx(
        'flex flex-wrap items-center gap-2 w-full',
        'rounded-hb-md border border-hb-blue/25 bg-hb-blue/8 px-4 py-2.5',
        className
      )}
    >
      <span className="font-mono text-hb-label uppercase text-hb-blue">
        {count} selected
      </span>
      <div className="flex-1" />
      {children}
      <button
        type="button"
        onClick={onClear}
        className="text-hb-xs font-semibold text-hb-muted hover:text-hb-text transition-colors duration-hb"
      >
        Clear
      </button>
    </div>
  )
}

/** Segmented filter chips. Single-select; `null` is the "all" state. */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  allLabel = 'All',
  className,
}: {
  options: Array<{ value: T; label: string; count?: number }>
  value: T | null
  onChange: (next: T | null) => void
  allLabel?: string
  className?: string
}) {
  const chip = (active: boolean) =>
    clsx(
      'inline-flex items-center gap-1.5 h-8 px-3.5 rounded-hb-full border shrink-0',
      'font-body text-hb-sm font-semibold whitespace-nowrap',
      'transition-all duration-hb ease-hb',
      active
        ? 'border-hb-blue/40 bg-hb-blue/10 text-hb-blue'
        : 'border-hb-border bg-hb-surface text-hb-muted hover:text-hb-text hover:border-hb-border-strong'
    )

  return (
    <div className={clsx('flex items-center gap-1.5 overflow-x-auto max-w-full scrollbar-hide py-0.5', className)}>
      <button
        type="button"
        onClick={() => onChange(null)}
        aria-pressed={value === null}
        className={chip(value === null)}
      >
        {allLabel}
      </button>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={chip(value === o.value)}
        >
          {o.label}
          {typeof o.count === 'number' && (
            <span className="font-mono text-hb-micro opacity-70">{o.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}
