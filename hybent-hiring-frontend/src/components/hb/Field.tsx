import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { clsx } from 'clsx'
import { ChevronDown } from 'lucide-react'

/**
 * Form controls.
 *
 * The mono uppercase label is the site's `.field label`, and it is the single
 * strongest carrier of the brand into a form — nothing else about a text input
 * can look like Hybent. The focus ring is the site's exact
 * `0 0 0 4px rgb(76 111 255 / .12)`.
 *
 * Every control here wires label, description and error to the input with real
 * ids and `aria-describedby`. The old `Input` rendered a bare `<label>` with no
 * `htmlFor`, so clicking a label did nothing and screen readers announced the
 * field unlabelled.
 */

/* Shared by input, textarea and select so they cannot drift apart. */
const CONTROL = clsx(
  'w-full rounded-hb-sm border border-hb-border bg-hb-surface',
  'font-body text-hb-body text-hb-text',
  'placeholder:text-hb-dim',
  'transition-[border-color,box-shadow,background] duration-hb ease-hb',
  'focus:outline-none focus:border-hb-blue/60 focus:shadow-hb-ring',
  'disabled:opacity-55 disabled:cursor-not-allowed disabled:bg-hb-surface-2'
)

const INVALID = 'border-hb-error/60 focus:border-hb-error focus:shadow-[0_0_0_4px_rgb(214_59_84_/_0.12)]'

export function Label({
  htmlFor,
  children,
  required,
  className,
}: {
  htmlFor?: string
  children: ReactNode
  required?: boolean
  className?: string
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={clsx(
        'block font-mono text-hb-label uppercase text-hb-dim',
        className
      )}
    >
      {children}
      {required && (
        <span className="text-hb-error ml-1" aria-hidden>
          *
        </span>
      )}
    </label>
  )
}

type FieldShellProps = {
  label?: ReactNode
  description?: ReactNode
  error?: ReactNode
  required?: boolean
  className?: string
  children: (ids: { id: string; describedBy?: string }) => ReactNode
}

/**
 * Owns id generation and the label/description/error wiring, so each control
 * below is only responsible for its own appearance.
 */
export function Field({
  label,
  description,
  error,
  required,
  className,
  children,
}: FieldShellProps) {
  const id = useId()
  const descId = description ? `${id}-desc` : undefined
  const errId = error ? `${id}-err` : undefined
  const describedBy = [descId, errId].filter(Boolean).join(' ') || undefined

  return (
    <div className={clsx('grid gap-2', className)}>
      {label && (
        <Label htmlFor={id} required={required}>
          {label}
        </Label>
      )}
      {description && (
        <p id={descId} className="text-hb-sm text-hb-muted -mt-0.5">
          {description}
        </p>
      )}
      {children({ id, describedBy })}
      {error && (
        <p id={errId} role="alert" className="text-hb-xs font-medium text-hb-error">
          {error}
        </p>
      )}
    </div>
  )
}

/* ─── Input ────────────────────────────────────────────────────────────────── */

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: ReactNode
  description?: ReactNode
  error?: ReactNode
  leadingIcon?: ReactNode
  trailingSlot?: ReactNode
  fieldClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, description, error, leadingIcon, trailingSlot, className, fieldClassName, required, ...props },
  ref
) {
  return (
    <Field
      label={label}
      description={description}
      error={error}
      required={required}
      className={fieldClassName}
    >
      {({ id, describedBy }) => (
        <div className="relative">
          {leadingIcon && (
            <span
              aria-hidden
              className="absolute left-3 top-1/2 -translate-y-1/2 text-hb-dim pointer-events-none [&>svg]:block"
            >
              {leadingIcon}
            </span>
          )}
          <input
            ref={ref}
            id={id}
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            required={required}
            className={clsx(
              CONTROL,
              'h-[42px] px-[13px]',
              leadingIcon && 'pl-10',
              trailingSlot && 'pr-11',
              error && INVALID,
              className
            )}
            {...props}
          />
          {trailingSlot && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
              {trailingSlot}
            </span>
          )}
        </div>
      )}
    </Field>
  )
})

/* ─── Textarea ─────────────────────────────────────────────────────────────── */

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode
  description?: ReactNode
  error?: ReactNode
  fieldClassName?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, description, error, className, fieldClassName, required, rows = 5, ...props },
  ref
) {
  return (
    <Field
      label={label}
      description={description}
      error={error}
      required={required}
      className={fieldClassName}
    >
      {({ id, describedBy }) => (
        <textarea
          ref={ref}
          id={id}
          rows={rows}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          required={required}
          className={clsx(
            CONTROL,
            'px-[13px] py-3 leading-relaxed resize-y min-h-[110px]',
            error && INVALID,
            className
          )}
          {...props}
        />
      )}
    </Field>
  )
})

/* ─── Select ───────────────────────────────────────────────────────────────── */

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: ReactNode
  description?: ReactNode
  error?: ReactNode
  options: SelectOption[]
  placeholder?: string
  fieldClassName?: string
}

/**
 * A styled native `<select>`.
 *
 * Replaces both `Select` and `CustomSelect`, which did the same job two ways.
 * Native is the right default: it is keyboard- and screen-reader-correct for
 * free, and it renders as the platform picker on mobile. A listbox with search
 * or multi-select is a different component, and should be built when a screen
 * actually needs one rather than as the default everywhere.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, description, error, options, placeholder, className, fieldClassName, required, ...props },
  ref
) {
  return (
    <Field
      label={label}
      description={description}
      error={error}
      required={required}
      className={fieldClassName}
    >
      {({ id, describedBy }) => (
        <div className="relative">
          <select
            ref={ref}
            id={id}
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            required={required}
            className={clsx(
              CONTROL,
              'h-[42px] pl-[13px] pr-10 appearance-none cursor-pointer',
              error && INVALID,
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((o) => (
              <option key={o.value} value={o.value} disabled={o.disabled}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={15}
            aria-hidden
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-hb-dim pointer-events-none"
          />
        </div>
      )}
    </Field>
  )
})

/* ─── Checkbox ─────────────────────────────────────────────────────────────── */

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode
  description?: ReactNode
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, className, ...props },
  ref
) {
  const id = useId()
  return (
    <div className={clsx('flex items-start gap-2.5', className)}>
      <input
        ref={ref}
        id={id}
        type="checkbox"
        className={clsx(
          'mt-0.5 w-4 h-4 shrink-0 cursor-pointer rounded-hb-xs',
          'border border-hb-border-strong bg-hb-surface',
          'accent-hb-blue',
          'focus-visible:outline-none focus-visible:shadow-hb-ring'
        )}
        {...props}
      />
      <div className="min-w-0">
        <label htmlFor={id} className="block text-hb-sm text-hb-text cursor-pointer">
          {label}
        </label>
        {description && <p className="text-hb-xs text-hb-muted mt-0.5">{description}</p>}
      </div>
    </div>
  )
})
