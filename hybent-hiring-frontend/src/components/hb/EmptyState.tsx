import { type ReactNode } from 'react'
import { clsx } from 'clsx'
import { Inbox, SearchX, AlertTriangle } from 'lucide-react'
import { IconTile } from './IconTile'
import { Button } from './Button'

/**
 * Empty, no-results and error states.
 *
 * One component with three tones because they are the same layout and pages
 * kept shipping only the first — the audit found `EmptyState` in 9 of 77 page
 * files, and no page distinguished "you have no candidates yet" from "your
 * filter matched nothing". Those need different copy and different actions.
 */

type Tone = 'empty' | 'no-results' | 'error'

const DEFAULT_ICON = {
  empty: Inbox,
  'no-results': SearchX,
  error: AlertTriangle,
} as const

export interface EmptyStateProps {
  tone?: Tone
  title: string
  description?: ReactNode
  icon?: ReactNode
  action?: { label: string; onClick: () => void }
  secondaryAction?: { label: string; onClick: () => void }
  /** `inline` sits inside a card; `page` centres in the viewport region. */
  size?: 'inline' | 'page'
  className?: string
}

export function EmptyState({
  tone = 'empty',
  title,
  description,
  icon,
  action,
  secondaryAction,
  size = 'inline',
  className,
}: EmptyStateProps) {
  const Fallback = DEFAULT_ICON[tone]

  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={clsx(
        'flex flex-col items-center text-center',
        size === 'page' ? 'py-20 px-6' : 'py-12 px-5',
        className
      )}
    >
      <IconTile size="lg" className={tone === 'error' ? 'text-hb-error' : undefined}>
        {icon ?? <Fallback />}
      </IconTile>

      <h3 className="mt-4 font-display text-hb-h3 text-hb-text">{title}</h3>

      {description && (
        <p className="mt-2 max-w-[38ch] text-hb-sm text-hb-muted">{description}</p>
      )}

      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {action && (
            <Button size="sm" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button size="sm" variant="quiet" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
