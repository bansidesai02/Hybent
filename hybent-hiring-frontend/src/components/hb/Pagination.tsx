import { clsx } from 'clsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * List pagination.
 *
 * The primitive this replaces rendered two bare Previous/Next buttons and no
 * page numbers, so on a 40-page talent list the only way to reach page 30 was
 * to click Next twenty-nine times. It also hardcoded `text-gray-500`, which is
 * in no token set.
 *
 * `<nav>` + `aria-current="page"` means a screen reader announces which page it
 * is on, and the range summary is a live region so the count change is heard
 * after a filter narrows the result set.
 */

/** Page numbers around `page`, with `null` marking an elision. */
function pageWindow(page: number, pages: number): Array<number | null> {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)

  const out: Array<number | null> = [1]
  const from = Math.max(2, page - 1)
  const to = Math.min(pages - 1, page + 1)

  if (from > 2) out.push(null)
  for (let i = from; i <= to; i++) out.push(i)
  if (to < pages - 1) out.push(null)

  out.push(pages)
  return out
}

export function Pagination({
  page,
  pages,
  total,
  limit,
  onPage,
  /** What is being counted, for the range summary. */
  noun = 'results',
  /** Sitting directly under a `DataTable` inside a `Card padding="none"` — the
   * table supplies its own `px-4` inset and each row's own `border-b`, but the
   * last row's is dropped (`last:border-0`), so without this the pagination
   * row has no horizontal inset and nothing marking it as part of the same
   * card, reading as a mismatched, oddly-flush strip under the table. */
  asCardFooter = false,
  className,
}: {
  page: number
  pages: number
  total: number
  limit: number
  onPage: (next: number) => void
  noun?: string
  asCardFooter?: boolean
  className?: string
}) {
  if (pages <= 1) return null

  const from = (page - 1) * limit + 1
  const to = Math.min(page * limit, total)

  const step = clsx(
    'grid place-items-center h-9 min-w-9 px-2 rounded-hb-full border',
    'font-body text-hb-sm font-semibold',
    'transition-all duration-hb ease-hb',
    'disabled:opacity-40 disabled:pointer-events-none'
  )

  return (
    <nav
      aria-label="Pagination"
      className={clsx(
        'flex flex-wrap items-center justify-between gap-3 pt-hb-4',
        asCardFooter && 'px-4 pb-hb-4 border-t border-hb-border',
        className
      )}
    >
      <p role="status" className="text-hb-sm text-hb-muted">
        <span className="font-mono tabular-nums text-hb-text">
          {from}–{to}
        </span>{' '}
        of{' '}
        <span className="font-mono tabular-nums text-hb-text">{total.toLocaleString()}</span>{' '}
        {noun}
      </p>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          aria-label="Previous page"
          className={clsx(step, 'border-hb-border bg-hb-surface text-hb-muted hover:text-hb-text hover:border-hb-border-strong')}
        >
          <ChevronLeft size={16} aria-hidden />
        </button>

        {pageWindow(page, pages).map((p, i) =>
          p === null ? (
            <span key={`gap-${i}`} aria-hidden className="px-1 text-hb-dim">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPage(p)}
              aria-current={p === page ? 'page' : undefined}
              aria-label={`Page ${p}`}
              className={clsx(
                step,
                'tabular-nums',
                p === page
                  ? 'border-transparent bg-hb-grad text-hb-on-brand'
                  : 'border-hb-border bg-hb-surface text-hb-muted hover:text-hb-text hover:border-hb-border-strong'
              )}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page === pages}
          aria-label="Next page"
          className={clsx(step, 'border-hb-border bg-hb-surface text-hb-muted hover:text-hb-text hover:border-hb-border-strong')}
        >
          <ChevronRight size={16} aria-hidden />
        </button>
      </div>
    </nav>
  )
}
