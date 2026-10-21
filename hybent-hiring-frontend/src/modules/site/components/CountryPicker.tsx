import { useEffect, useId, useMemo, useRef, useState, type ComponentType } from 'react'
import { getCountryCallingCode, type Country } from 'react-phone-number-input'

/**
 * The country button of the contact form's phone field, used as
 * react-phone-number-input's `countrySelectComponent`.
 *
 * The library's own picker is a native <select> laid invisibly over the flag,
 * so it opens the browser's bare OS list: two hundred country names with no
 * flags, no dial codes and no way to type to find one. This shows the flag and
 * "+91" on the button and opens a searchable list — flag, name, code — that
 * matches on either the name or the number.
 *
 * Keyboard: the button opens the list with focus in the search box; arrows move,
 * Enter picks, Escape closes and returns focus to the button.
 */

type Option = { value?: Country; label: string; divider?: boolean }

type Props = {
  value?: Country
  options: Option[]
  onChange: (country?: Country) => void
  iconComponent: ComponentType<{ country: Country; label: string; 'aria-hidden'?: boolean }>
  disabled?: boolean
  readOnly?: boolean
  'aria-label'?: string
}

const dialCode = (c: Country) => `+${getCountryCallingCode(c)}`

export function CountryPicker({ value, options, onChange, iconComponent: Flag, disabled, readOnly, 'aria-label': ariaLabel }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()

  const countries = useMemo(
    () => options.filter((o): o is Option & { value: Country } => !!o.value && !o.divider),
    [options]
  )
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^\+/, '')
    if (!q) return countries
    return countries.filter(
      (o) => o.label.toLowerCase().includes(q) || getCountryCallingCode(o.value).startsWith(q) || o.value.toLowerCase() === q
    )
  }, [countries, query])
  const selected = countries.find((o) => o.value === value)

  const openList = () => {
    if (disabled || readOnly) return
    setQuery('')
    setActive(Math.max(0, countries.findIndex((o) => o.value === value)))
    setOpen(true)
  }
  const close = (refocus: boolean) => {
    setOpen(false)
    if (refocus) buttonRef.current?.focus()
  }
  const pick = (country: Country) => {
    onChange(country)
    close(true)
  }

  // Close on a click anywhere outside the picker.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  // Keep the highlighted row in view as the arrows move it.
  useEffect(() => {
    if (open) listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const onSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, shown.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (shown[active]) pick(shown[active].value)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      close(true)
    }
  }

  return (
    <div className="PhoneInputCountry country-pick" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="country-pick__btn"
        aria-label={`${ariaLabel ?? 'Country'}: ${selected ? `${selected.label} ${dialCode(selected.value)}` : 'none'}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => (open ? close(false) : openList())}
      >
        {selected && <Flag country={selected.value} label={selected.label} aria-hidden />}
        <span className="country-pick__code">{selected ? dialCode(selected.value) : '+'}</span>
        <svg className="country-pick__chev" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="country-pick__pop">
          <input
            className="country-pick__search"
            type="text"
            autoFocus
            placeholder="Search country or code"
            aria-label="Search country or dial code"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={shown[active] ? `${listId}-${shown[active].value}` : undefined}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={onSearchKey}
          />
          <ul className="country-pick__list" role="listbox" id={listId} ref={listRef} aria-label="Countries">
            {shown.map((o, i) => (
              <li
                key={o.value}
                id={`${listId}-${o.value}`}
                role="option"
                aria-selected={o.value === value}
                className={`country-pick__opt${i === active ? ' is-active' : ''}`}
                onPointerEnter={() => setActive(i)}
                onClick={() => pick(o.value)}
              >
                <Flag country={o.value} label={o.label} aria-hidden />
                <span className="country-pick__name">{o.label}</span>
                <span className="country-pick__dial">{dialCode(o.value)}</span>
              </li>
            ))}
            {!shown.length && <li className="country-pick__empty">No country matches “{query}”</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
