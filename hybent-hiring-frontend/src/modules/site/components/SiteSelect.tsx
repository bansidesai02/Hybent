import { useEffect, useRef, useState } from 'react'

/**
 * A dropdown for the site's forms, drawn to match the country picker on the
 * contact form's phone field rather than opening the browser's bare OS list.
 *
 * The button looks like a `.field input`; the list opens beneath it. Options
 * can carry a one-line hint ("Our AI recruitment platform…") shown under the
 * label in the list but not on the button.
 *
 * Keyboard follows the select-only combobox pattern: Enter, Space or the arrows
 * open the list; arrows move, Home/End jump, Enter or Space picks, Escape
 * closes, Tab closes and moves on.
 */

export type SiteSelectOption<T extends string> = { value: T; label: string; hint?: string }

type Props<T extends string> = {
  id: string
  value: T | ''
  options: Array<SiteSelectOption<T>>
  onChange: (value: T) => void
  placeholder?: string
  invalid?: boolean
  describedBy?: string
  required?: boolean
}

export function SiteSelect<T extends string>({ id, value, options, onChange, placeholder = 'Select…', invalid, describedBy, required }: Props<T>) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = `${id}-list`
  const selected = options.find((o) => o.value === value)

  const openList = () => {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)))
    setOpen(true)
  }
  const pick = (v: T) => {
    onChange(v)
    setOpen(false)
  }

  // Close on a click anywhere outside.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  useEffect(() => {
    if (open) listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        openList()
      }
      return
    }
    const last = options.length - 1
    if (e.key === 'ArrowDown') setActive((i) => Math.min(i + 1, last))
    else if (e.key === 'ArrowUp') setActive((i) => Math.max(i - 1, 0))
    else if (e.key === 'Home') setActive(0)
    else if (e.key === 'End') setActive(last)
    else if (e.key === 'Enter' || e.key === ' ') pick(options[active].value)
    else if (e.key === 'Escape') setOpen(false)
    else if (e.key === 'Tab') {
      setOpen(false)
      return
    } else return
    e.preventDefault()
  }

  return (
    <div className={`site-select${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        id={id}
        type="button"
        role="combobox"
        className="site-select__btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
      >
        <span className={selected ? 'site-select__value' : 'site-select__placeholder'}>{selected?.label ?? placeholder}</span>
        <svg className="site-select__chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul className="site-select__pop" role="listbox" id={listId} ref={listRef} aria-labelledby={id}>
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={o.value === value}
              className={`site-select__opt${i === active ? ' is-active' : ''}`}
              onPointerEnter={() => setActive(i)}
              // Keep focus on the button so the keyboard keeps working after a click.
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => pick(o.value)}
            >
              <span className="site-select__text">
                <span className="site-select__label">{o.label}</span>
                {o.hint && <span className="site-select__hint">{o.hint}</span>}
              </span>
              {o.value === value && (
                <svg className="site-select__tick" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
