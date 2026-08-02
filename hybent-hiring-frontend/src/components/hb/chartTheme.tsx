import { type ReactNode } from 'react'
import { clsx } from 'clsx'
import { ResponsiveContainer, Tooltip, type TooltipProps } from 'recharts'

/**
 * Recharts, bound to the design system.
 *
 * Charts are where hardcoded colour is hardest to dislodge: recharts takes hex
 * strings, not CSS classes, so `#6c47ff` ends up inline in every chart file and
 * the series stay violet after the rest of the page has moved. Reading the
 * computed custom properties at render keeps a chart correct in both themes
 * without any chart file naming a colour.
 *
 * Import `useChartTheme` in a chart, never a literal.
 */

/** Reads a `--hb-*` triplet off the document and returns a usable colour. */
function readToken(name: string, alpha?: number): string {
  if (typeof window === 'undefined') return 'transparent'
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  if (!raw) return 'transparent'
  /* Pre-composed values (the border tokens) come back as full rgb() strings. */
  if (raw.startsWith('rgb') || raw.startsWith('#')) return raw
  return alpha === undefined ? `rgb(${raw})` : `rgb(${raw} / ${alpha})`
}

export interface ChartTheme {
  /** Categorical series order. Follows the brand gradient's own progression. */
  series: string[]
  grid: string
  axis: string
  text: string
  surface: string
  border: string
  success: string
  warning: string
  error: string
  /** Fill for the area under a line, at the given series index. */
  fill: (index: number) => string
}

export function useChartTheme(): ChartTheme {
  const series = [
    readToken('--hb-blue'),
    readToken('--hb-cyan'),
    readToken('--hb-violet'),
    readToken('--hb-magenta'),
    readToken('--hb-success'),
    readToken('--hb-warning'),
  ]

  const seriesRaw = ['--hb-blue', '--hb-cyan', '--hb-violet', '--hb-magenta', '--hb-success', '--hb-warning']

  return {
    series,
    grid: readToken('--hb-muted', 0.14),
    axis: readToken('--hb-dim'),
    text: readToken('--hb-muted'),
    surface: readToken('--hb-elevated'),
    border: readToken('--hb-border'),
    success: readToken('--hb-success'),
    warning: readToken('--hb-warning'),
    error: readToken('--hb-error'),
    fill: (i: number) => readToken(seriesRaw[i % seriesRaw.length], 0.16),
  }
}

/** Shared axis props, so every chart's ticks look the same. */
export function axisProps(theme: ChartTheme) {
  return {
    stroke: theme.axis,
    tick: { fill: theme.text, fontSize: 11, fontFamily: 'Manrope, sans-serif' },
    tickLine: false,
    axisLine: { stroke: theme.grid },
  } as const
}

/**
 * Style object for a `<LabelList>`, which takes inline style rather than a
 * class. Kept here so a chart file never has to name `fill` itself.
 */
export function chartLabel(theme: ChartTheme, opts?: { emphasis?: boolean }) {
  return {
    fontSize: opts?.emphasis ? 12 : 11,
    fontWeight: 700,
    fontFamily: 'IBM Plex Mono, monospace',
    fill: theme.text,
  } as const
}

/**
 * Legend for a categorical chart.
 *
 * A pie or a stacked bar cannot label itself once the series palette wraps —
 * the seventh slice repeats the first colour. The legend is what carries the
 * names, so it uses the same `theme.series` order by index and nothing else.
 */
export function ChartLegend({
  items,
  theme,
  className,
}: {
  items: Array<{ name: string; value?: ReactNode }>
  theme: ChartTheme
  className?: string
}) {
  return (
    <ul
      className={clsx(
        'flex max-h-[104px] flex-wrap justify-center gap-x-4 gap-y-1.5 overflow-y-auto',
        className
      )}
    >
      {items.map((item, i) => (
        <li key={item.name} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: theme.series[i % theme.series.length] }}
          />
          <span className="whitespace-nowrap text-hb-xs text-hb-muted">
            {item.name}
            {item.value !== undefined && (
              <span className="ml-1 font-mono tabular-nums text-hb-dim">({item.value})</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Tooltip styled as a small elevated card rather than recharts' default. */
export function ChartTooltip(props: TooltipProps<number, string>) {
  return (
    <Tooltip
      {...props}
      cursor={{ fill: 'rgb(var(--hb-muted) / 0.08)' }}
      contentStyle={{
        background: 'rgb(var(--hb-elevated))',
        border: '1px solid var(--hb-border)',
        borderRadius: 'var(--hb-r-sm)',
        boxShadow: 'var(--hb-sh-2)',
        fontFamily: 'Manrope, sans-serif',
        fontSize: 12,
        color: 'rgb(var(--hb-text))',
        padding: '8px 12px',
      }}
      labelStyle={{
        color: 'rgb(var(--hb-muted))',
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: 10,
        letterSpacing: '.14em',
        textTransform: 'uppercase',
        marginBottom: 4,
      }}
      itemStyle={{ color: 'rgb(var(--hb-text))', padding: 0 }}
    />
  )
}

/**
 * Frame around a chart: title, optional action, fixed height, responsive width.
 * `ResponsiveContainer` needs a sized parent, which is the single most common
 * reason a recharts chart renders at zero height.
 */
export function ChartFrame({
  title,
  action,
  height = 260,
  children,
  className,
}: {
  title?: ReactNode
  action?: ReactNode
  height?: number
  children: ReactNode
  className?: string
}) {
  return (
    <div className={clsx('rounded-hb-md border border-hb-border bg-hb-surface p-5', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-4 mb-4">
          {title && <h3 className="font-display text-hb-h3 text-hb-text">{title}</h3>}
          {action}
        </div>
      )}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
