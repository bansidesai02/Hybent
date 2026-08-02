import { type Key, type ReactNode } from 'react'
import { clsx } from 'clsx'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { Skeleton, SkeletonTable } from './Skeleton'
import { EmptyState, type EmptyStateProps } from './EmptyState'

/**
 * The product table.
 *
 * Two things it does that the hand-built tables do not:
 *
 * 1. It collapses to cards below `md`. Every list in the product is currently a
 *    `min-w-[750px]` table inside `overflow-x-auto`, which on a phone means
 *    horizontal scrolling through columns — worst on the candidate portal,
 *    which is the surface most likely to be opened on a phone.
 *
 * 2. Sorting is a real `<button>` in the header with `aria-sort` on the cell,
 *    so it is reachable and announced. The existing sortable headers are
 *    `<div onClick>`.
 *
 * Sort and selection are controlled — the page owns them, because the page also
 * owns the query that acts on them.
 */

export type SortDirection = 'asc' | 'desc'

export interface Column<Row> {
  /** Stable key. Also the sort key sent to `onSortChange`. */
  key: string
  header: ReactNode
  /** Cell content. Receives the row and its index. */
  cell: (row: Row, index: number) => ReactNode
  sortable?: boolean
  align?: 'left' | 'right' | 'center'
  /** Any CSS width — `160px`, `20%`, `minmax(0,2fr)`. */
  width?: string
  /** Hidden in the mobile card view. Use for redundant or decorative columns. */
  hideOnCard?: boolean
  /** Renders as the card's title instead of a labelled row. One per table. */
  cardTitle?: boolean
  className?: string
}

export interface DataTableProps<Row> {
  columns: Array<Column<Row>>
  rows: Row[]
  rowKey: (row: Row, index: number) => Key
  loading?: boolean
  /** Shown when `rows` is empty and not loading. */
  empty?: EmptyStateProps
  sort?: { key: string; direction: SortDirection } | null
  onSortChange?: (next: { key: string; direction: SortDirection }) => void
  onRowClick?: (row: Row) => void
  selection?: {
    selected: Set<Key>
    onToggle: (key: Key) => void
    onToggleAll: (keys: Key[]) => void
  }
  /** Caption for assistive tech. Strongly recommended. */
  caption?: string
  className?: string
}

const ALIGN = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
} as const

export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  loading = false,
  empty,
  sort,
  onSortChange,
  onRowClick,
  selection,
  caption,
  className,
}: DataTableProps<Row>) {
  if (loading) {
    return <SkeletonTable rows={6} columns={Math.min(columns.length, 6)} />
  }

  if (!rows.length) {
    return (
      <div className={clsx('rounded-hb-md border border-hb-border bg-hb-surface', className)}>
        <EmptyState {...(empty ?? { title: 'Nothing here yet' })} />
      </div>
    )
  }

  const allKeys = rows.map(rowKey)
  const allSelected = selection ? allKeys.every((k) => selection.selected.has(k)) : false
  const someSelected = selection ? allKeys.some((k) => selection.selected.has(k)) : false

  const toggleSort = (key: string) => {
    if (!onSortChange) return
    const direction: SortDirection =
      sort?.key === key && sort.direction === 'asc' ? 'desc' : 'asc'
    onSortChange({ key, direction })
  }

  return (
    <>
      {/* ── Table, md and up ─────────────────────────────────────────────── */}
      <div
        className={clsx(
          'hidden md:block overflow-x-auto rounded-hb-md border border-hb-border bg-hb-surface',
          className
        )}
      >
        <table className="w-full border-collapse">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="bg-hb-surface-2">
              {selection && (
                <th scope="col" className="w-11 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected && !allSelected
                    }}
                    onChange={() => selection.onToggleAll(allKeys)}
                    aria-label={allSelected ? 'Deselect all rows' : 'Select all rows'}
                    className="w-4 h-4 cursor-pointer rounded-hb-xs border border-hb-border-strong accent-hb-blue focus-visible:outline-none focus-visible:shadow-hb-ring"
                  />
                </th>
              )}
              {columns.map((col) => {
                const active = sort?.key === col.key
                const SortIcon = !active ? ArrowUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown
                return (
                  <th
                    key={col.key}
                    scope="col"
                    style={col.width ? { width: col.width } : undefined}
                    aria-sort={
                      active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined
                    }
                    className={clsx(
                      'px-4 py-3 font-mono text-hb-label uppercase text-hb-muted whitespace-nowrap',
                      'border-b border-hb-border',
                      ALIGN[col.align ?? 'left']
                    )}
                  >
                    {col.sortable && onSortChange ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className={clsx(
                          'inline-flex items-center gap-1.5 rounded-hb-sm px-1 -mx-1',
                          'transition-colors duration-hb hover:text-hb-text',
                          'focus-visible:outline-none focus-visible:shadow-hb-ring',
                          active && 'text-hb-text'
                        )}
                      >
                        {col.header}
                        <SortIcon size={12} aria-hidden className={clsx(!active && 'opacity-45')} />
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, i) => {
              const key = rowKey(row, i)
              const isSelected = selection?.selected.has(key) ?? false
              return (
                <tr
                  key={key}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={clsx(
                    'border-b border-hb-border last:border-0 transition-colors duration-hb',
                    onRowClick && 'cursor-pointer',
                    isSelected ? 'bg-hb-blue/6' : 'hover:bg-hb-surface-2'
                  )}
                >
                  {selection && (
                    <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => selection.onToggle(key)}
                        aria-label={`Select row ${i + 1}`}
                        className="w-4 h-4 cursor-pointer rounded-hb-xs border border-hb-border-strong accent-hb-blue focus-visible:outline-none focus-visible:shadow-hb-ring"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={clsx(
                        'px-4 py-3.5 text-hb-sm text-hb-text align-middle',
                        ALIGN[col.align ?? 'left'],
                        col.className
                      )}
                    >
                      {col.cell(row, i)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Cards, below md ──────────────────────────────────────────────── */}
      <ul className={clsx('md:hidden grid gap-2.5', className)}>
        {rows.map((row, i) => {
          const key = rowKey(row, i)
          const isSelected = selection?.selected.has(key) ?? false
          const titleCol = columns.find((c) => c.cardTitle)
          const bodyCols = columns.filter((c) => !c.cardTitle && !c.hideOnCard)

          return (
            <li key={key}>
              <div
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                role={onRowClick ? 'button' : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onRowClick(row)
                        }
                      }
                    : undefined
                }
                className={clsx(
                  'rounded-hb-md border bg-hb-surface p-4 transition-colors duration-hb',
                  'focus-visible:outline-none focus-visible:shadow-hb-ring',
                  isSelected ? 'border-hb-blue/40 bg-hb-blue/5' : 'border-hb-border',
                  onRowClick && 'cursor-pointer'
                )}
              >
                <div className="flex items-start gap-3">
                  {selection && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => selection.onToggle(key)}
                      aria-label={`Select row ${i + 1}`}
                      className="mt-0.5 w-4 h-4 shrink-0 cursor-pointer rounded-hb-xs border border-hb-border-strong accent-hb-blue"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    {titleCol && (
                      <div className="font-display text-hb-h3 text-hb-text mb-3">
                        {titleCol.cell(row, i)}
                      </div>
                    )}
                    <dl className="grid gap-2">
                      {bodyCols.map((col) => (
                        <div key={col.key} className="flex items-baseline justify-between gap-3">
                          <dt className="font-mono text-hb-label uppercase text-hb-muted shrink-0">
                            {col.header}
                          </dt>
                          <dd className="text-hb-sm text-hb-text text-right min-w-0">
                            {col.cell(row, i)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}

/** Name + secondary line, the most repeated cell shape in the product. */
export function CellStack({
  primary,
  secondary,
  leading,
}: {
  primary: ReactNode
  secondary?: ReactNode
  leading?: ReactNode
}) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      {leading && <span className="shrink-0">{leading}</span>}
      <div className="min-w-0">
        <div className="font-semibold text-hb-text truncate">{primary}</div>
        {secondary && <div className="text-hb-xs text-hb-muted truncate">{secondary}</div>}
      </div>
    </div>
  )
}

export { Skeleton }
