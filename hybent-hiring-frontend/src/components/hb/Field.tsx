import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type InputHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { clsx } from 'clsx'
import { Check, ChevronDown } from 'lucide-react'

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

/** Tallest the open list grows before it scrolls, in px. */
const LIST_MAX_H = 288

/**
 * A select whose open list is ours rather than the platform's.
 *
 * This was a styled native `<select>`: the closed control matched the text
 * fields, but the list it opened was the OS menu — square corners on Windows,
 * the system font, nothing of the brand. It now renders the list itself and
 * keeps the native API, so no caller changes: `value`, `defaultValue`,
 * `onChange(e)` with `e.target.value`, `name` and `onBlur` — which is also why
 * `{...field}` from react-hook-form still spreads straight onto it.
 *
 * Behaviour is the WAI-ARIA "select-only combobox": focus stays on the trigger
 * and `aria-activedescendant` tracks the highlighted option; arrows, Home/End
 * and type-ahead move it, Enter or Space picks, Escape and Tab close. The list
 * is portalled and fixed-positioned so a card's `overflow: hidden` or a
 * drawer's scroll cannot clip it, and it opens upwards when there is no room
 * below.
 */
export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  {
    label,
    description,
    error,
    options,
    placeholder,
    className,
    fieldClassName,
    required,
    value,
    defaultValue,
    onChange,
    onBlur,
    name,
    disabled,
    'aria-label': ariaLabel,
  },
  ref
) {
  const controlled = value !== undefined
  const [inner, setInner] = useState(String(defaultValue ?? ''))
  const current = controlled ? String(value ?? '') : inner

  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [pos, setPos] = useState<{
    left: number
    width: number
    top?: number
    bottom?: number
    maxHeight: number
  } | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const typeahead = useRef({ text: '', at: 0 })
  const listId = useId()

  const selectedIndex = options.findIndex((o) => o.value === current)
  const selected = options[selectedIndex]
  /* With no match and no placeholder a native select shows its first option;
     keep that, so screens that relied on it look the same. */
  const showingPlaceholder = !selected && !!placeholder
  const display = selected?.label ?? placeholder ?? options[0]?.label ?? ''

  const setRefs = (el: HTMLButtonElement | null) => {
    triggerRef.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = el
  }

  /* Next enabled option from `from` in direction `dir`; stays put at the ends. */
  const step = (from: number, dir: 1 | -1) => {
    for (let i = from + dir; i >= 0 && i < options.length; i += dir) {
      if (!options[i].disabled) return i
    }
    return from
  }

  const openList = () => {
    if (disabled || !options.length) return
    setActive(selectedIndex >= 0 ? selectedIndex : step(-1, 1))
    setOpen(true)
  }

  const commit = (i: number) => {
    const opt = options[i]
    if (!opt || opt.disabled) return
    if (!controlled) setInner(opt.value)
    /* Native `change` only fires when the value actually changes. */
    if (opt.value !== current) {
      onChange?.({
        target: { value: opt.value, name },
        currentTarget: { value: opt.value, name },
      } as unknown as ChangeEvent<HTMLSelectElement>)
    }
    setOpen(false)
  }

  const place = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const gap = 6
    const margin = 12
    const below = window.innerHeight - r.bottom - gap - margin
    const above = r.top - gap - margin
    const wanted = Math.min(LIST_MAX_H, options.length * 38 + 10)
    const up = below < wanted && above > below
    setPos({
      left: r.left,
      width: r.width,
      maxHeight: Math.max(120, Math.min(LIST_MAX_H, up ? above : below)),
      ...(up ? { bottom: window.innerHeight - r.top + gap } : { top: r.bottom + gap }),
    })
  }, [options.length])

  useLayoutEffect(() => {
    if (!open) return
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, place])

  /* Escape closes the list and nothing else. Overlays listen for Escape on
     `document` in the capture phase; `window` capture runs before that, so a
     select inside a drawer closes itself without taking the drawer with it. */
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      e.preventDefault()
      setOpen(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])

  useEffect(() => {
    if (!open || active < 0) return
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const onKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    const t = typeahead.current
    const typing = Date.now() - t.at < 600 && t.text !== ''

    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        e.preventDefault()
        if (!open) openList()
        else setActive((a) => step(a, e.key === 'ArrowDown' ? 1 : -1))
        return
      case 'Home':
      case 'End':
        if (!open) return
        e.preventDefault()
        setActive(e.key === 'Home' ? step(-1, 1) : step(options.length, -1))
        return
      case 'Enter':
        e.preventDefault()
        if (open) commit(active)
        else openList()
        return
      case ' ':
        if (typing) break
        e.preventDefault()
        if (open) commit(active)
        else openList()
        return
      case 'Tab':
        setOpen(false)
        return
    }

    /* Type-ahead: letters jump to the next option that starts with them, as a
       native select does — highlighting while open, choosing while closed. */
    if (e.key.length !== 1 || e.metaKey || e.ctrlKey || e.altKey) return
    t.text = typing ? t.text + e.key.toLowerCase() : e.key.toLowerCase()
    t.at = Date.now()
    const from = open ? active : selectedIndex
    /* A fresh single letter searches after the current option, so pressing it
       again cycles; a longer string may still match the current one. */
    const offset = t.text.length === 1 ? 1 : 0
    for (let n = 0; n < options.length; n++) {
      const i = (Math.max(from, 0) + offset + n) % options.length
      if (!options[i].disabled && options[i].label.toLowerCase().startsWith(t.text)) {
        if (open) setActive(i)
        else commit(i)
        return
      }
    }
  }

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
          <button
            ref={setRefs}
            id={id}
            type="button"
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            aria-required={required || undefined}
            aria-label={ariaLabel}
            disabled={disabled}
            onClick={() => (open ? setOpen(false) : openList())}
            onKeyDown={onKeyDown}
            onBlur={(e) => {
              setOpen(false)
              onBlur?.(e as unknown as FocusEvent<HTMLSelectElement>)
            }}
            className={clsx(
              CONTROL,
              'flex h-[42px] cursor-pointer items-center pl-[13px] pr-10 text-left',
              open && 'border-hb-blue/60 shadow-hb-ring',
              error && INVALID,
              className
            )}
          >
            <span className={clsx('min-w-0 truncate', showingPlaceholder && 'text-hb-dim')}>
              {display}
            </span>
          </button>
          <ChevronDown
            size={15}
            aria-hidden
            className={clsx(
              'pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-hb-dim transition-transform duration-hb ease-hb',
              open && 'rotate-180'
            )}
          />
          {name && <input type="hidden" name={name} value={current} />}

          {open &&
            pos &&
            createPortal(
              <ul
                ref={listRef}
                id={listId}
                role="listbox"
                aria-labelledby={id}
                /* Keeps focus on the trigger, so a click on an option or the
                   scrollbar does not blur it and close the list. */
                onMouseDown={(e) => e.preventDefault()}
                style={{
                  position: 'fixed',
                  left: pos.left,
                  width: pos.width,
                  top: pos.top,
                  bottom: pos.bottom,
                  maxHeight: pos.maxHeight,
                }}
                className="z-[1100] animate-fade-in overflow-y-auto overscroll-contain rounded-hb-md border border-hb-border bg-hb-elevated p-1 shadow-hb-card"
              >
                {options.map((o, i) => {
                  const isSelected = o.value === current
                  const isActive = i === active
                  return (
                    <li
                      key={o.value}
                      id={`${listId}-${i}`}
                      data-index={i}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={o.disabled || undefined}
                      onMouseEnter={() => !o.disabled && setActive(i)}
                      onClick={() => commit(i)}
                      className={clsx(
                        'flex items-center gap-2 rounded-hb-sm px-3 py-2 text-hb-sm transition-colors duration-hb',
                        o.disabled
                          ? 'cursor-not-allowed opacity-45'
                          : 'cursor-pointer',
                        isActive && !o.disabled ? 'bg-hb-blue/8 text-hb-text' : 'text-hb-muted',
                        isSelected && 'font-semibold text-hb-text'
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">{o.label}</span>
                      {isSelected && <Check size={14} aria-hidden className="shrink-0 text-hb-blue" />}
                    </li>
                  )
                })}
              </ul>,
              document.body
            )}
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
