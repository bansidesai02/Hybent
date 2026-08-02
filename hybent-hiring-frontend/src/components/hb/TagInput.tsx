import { useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { Field } from './Field'
import { Button } from './Button'

/**
 * A list of short strings — skills, tags, keywords.
 *
 * The remove button is a real button with an accessible name ("Remove React"),
 * and the list is announced as a list. The version this replaces rendered a
 * bare `×` character inside a `<button>` with no label, so a screen reader read
 * a row of skills as "React button, TypeScript button".
 */
export function TagInput({
  value,
  onChange,
  label,
  placeholder,
  description = 'Press Enter or comma to add',
  className,
}: {
  value: string[]
  onChange: (next: string[]) => void
  label?: string
  placeholder?: string
  description?: string
  className?: string
}) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const trimmed = draft.trim().replace(/,$/, '')
    if (trimmed && !value.includes(trimmed)) onChange([...value, trimmed])
    setDraft('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add()
      return
    }
    /* Backspace on an empty field removes the last tag — the behaviour anyone
       who has used a tag field expects. */
    if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <Field label={label} description={description} className={className}>
      {({ id }) => (
        <div>
          <div className="flex gap-2">
            <input
              id={id}
              value={draft}
              placeholder={placeholder}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              onBlur={add}
              className="h-[42px] w-full rounded-hb-sm border border-hb-border bg-hb-surface px-[13px] font-body text-hb-body text-hb-text placeholder:text-hb-dim transition-[border-color,box-shadow] duration-hb ease-hb focus:border-hb-blue/60 focus:shadow-hb-ring focus:outline-none"
            />
            <Button variant="ghost" onClick={add} disabled={!draft.trim()}>
              Add
            </Button>
          </div>

          {value.length > 0 && (
            <ul className="mt-2.5 flex flex-wrap gap-1.5">
              {value.map((tag) => (
                <li key={tag}>
                  <span className="inline-flex h-[26px] items-center gap-1.5 rounded-hb-full border border-hb-blue/25 bg-hb-blue/8 pl-3 pr-1.5 font-mono text-[10.5px] uppercase tracking-[.14em] text-hb-blue">
                    {tag}
                    <button
                      type="button"
                      onClick={() => onChange(value.filter((v) => v !== tag))}
                      aria-label={`Remove ${tag}`}
                      className="grid h-4 w-4 place-items-center rounded-full transition-colors duration-hb hover:bg-hb-blue/20 focus-visible:outline-none focus-visible:shadow-hb-ring"
                    >
                      <X size={11} aria-hidden />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Field>
  )
}
