import { clsx } from 'clsx'

/**
 * Loading placeholders.
 *
 * The rule these exist to enforce: a skeleton mirrors the layout it replaces.
 * Generic stacked bars tell the reader nothing and cause a visible reflow when
 * the real content lands, which is most of what the current dashboards do.
 * `SkeletonTable` and `SkeletonStats` are here so the common cases are as easy
 * to reach for as the wrong ones.
 */

export function Skeleton({
  className,
  rounded = 'sm',
}: {
  className?: string
  rounded?: 'sm' | 'md' | 'full'
}) {
  return (
    <div
      aria-hidden
      className={clsx(
        'animate-pulse bg-hb-muted/15',
        rounded === 'sm' && 'rounded-hb-sm',
        rounded === 'md' && 'rounded-hb-md',
        rounded === 'full' && 'rounded-hb-full',
        className
      )}
    />
  )
}

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number
  className?: string
}) {
  return (
    <div className={clsx('space-y-2', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={clsx('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  )
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-hb-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-hb-md border border-hb-border bg-hb-surface p-5">
          <Skeleton className="h-10 w-10" rounded="md" />
          <Skeleton className="mt-4 h-7 w-20" />
          <Skeleton className="mt-2 h-2.5 w-28" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonTable({
  rows = 6,
  columns = 5,
}: {
  rows?: number
  columns?: number
}) {
  return (
    <div className="overflow-hidden rounded-hb-md border border-hb-border bg-hb-surface">
      <div
        className="grid gap-4 border-b border-hb-border bg-hb-surface-2 px-5 py-3"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}
      >
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} className="h-2.5 w-16" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div
          key={r}
          className="grid gap-4 border-b border-hb-border px-5 py-4 last:border-0"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}
        >
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} className={clsx('h-3', c === 0 ? 'w-full' : 'w-3/4')} />
          ))}
        </div>
      ))}
    </div>
  )
}
