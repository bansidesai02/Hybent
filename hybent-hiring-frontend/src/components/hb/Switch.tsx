import { useId, type ReactNode } from 'react'
import { clsx } from 'clsx'

/**
 * An on/off setting that applies immediately.
 *
 * The distinction from `Checkbox` is not appearance, it is timing: a checkbox
 * states an intention that a submit button later commits, a switch *is* the
 * commit. Feature flags, notification preferences and per-tenant overrides are
 * switches; a form's "I agree" is a checkbox.
 *
 * Three screens had rebuilt this as a `<button>` wrapping a translated `<div>`
 * — the client onboarding wizard, the feature-flags page and platform
 * settings. None of them was announced as a switch, none of them had a label
 * association, and two used a raw `bg-slate-300` for the off state. This is a
 * real `role="switch"` with `aria-checked`, so a screen reader says
 * "AI scoring engine, switch, on".
 */

const TRACK = { sm: 'h-5 w-9', md: 'h-6 w-11' } as const
const KNOB = { sm: 'h-4 w-4', md: 'h-5 w-5' } as const
const SHIFT = { sm: 'translate-x-4', md: 'translate-x-5' } as const

export function Switch({
  checked,
  onChange,
  label,
  description,
  size = 'md',
  disabled = false,
  /**
   * Accessible name for a switch with no visible `label` — a matrix cell,
   * say, where the column header names the setting but is not associated
   * with the control. Without one it is announced as just "switch, on".
   */
  'aria-label': ariaLabel,
  className,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  /** Visible label. Omit only when `aria-label` names it instead. */
  label?: ReactNode
  description?: ReactNode
  size?: 'sm' | 'md'
  disabled?: boolean
  'aria-label'?: string
  className?: string
}) {
  const labelId = useId()
  const descId = useId()

  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={label ? labelId : undefined}
      aria-label={label ? undefined : ariaLabel}
      aria-describedby={description ? descId : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex shrink-0 items-center rounded-full p-0.5',
        TRACK[size],
        'border transition-colors duration-hb ease-hb',
        'focus-visible:outline-none focus-visible:shadow-hb-ring',
        'disabled:cursor-not-allowed disabled:opacity-45',
        checked
          ? 'border-transparent bg-hb-grad'
          : 'border-hb-border-strong bg-hb-muted/20'
      )}
    >
      <span
        aria-hidden
        className={clsx(
          'rounded-full bg-white shadow-sm',
          KNOB[size],
          'transition-transform duration-hb ease-hb',
          checked ? SHIFT[size] : 'translate-x-0'
        )}
      />
    </button>
  )

  if (!label) return <span className={className}>{control}</span>

  return (
    <div className={clsx('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <span id={labelId} className="block text-hb-sm font-semibold text-hb-text">
          {label}
        </span>
        {description && (
          <span id={descId} className="mt-0.5 block text-hb-xs text-hb-muted">
            {description}
          </span>
        )}
      </div>
      {control}
    </div>
  )
}
