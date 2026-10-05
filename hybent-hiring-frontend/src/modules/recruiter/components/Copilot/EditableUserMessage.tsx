/**
 * A user turn that can be edited and resent, like ChatGPT / Claude.
 * Saving rewrites this turn: everything below it is dropped and the edited
 * text is processed as a fresh request. Shared by the widget and the full page.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { clsx } from 'clsx'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/hb'

interface EditableUserMessageProps {
  content: string
  /** The bubble as normally shown. */
  children: ReactNode
  /** Hide the edit control (approval turns, or while a reply is streaming). */
  canEdit: boolean
  onSubmit: (text: string) => void
  className?: string
  style?: CSSProperties
}

export function EditableUserMessage({ content, children, canEdit, onSubmit, className, style }: EditableUserMessageProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(content)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!editing) return
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [editing])

  // Grow with the text, capped so a long prompt scrolls inside the box.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`
  }, [draft, editing])

  const start = () => {
    setDraft(content)
    setEditing(true)
  }
  const submit = () => {
    const text = draft.trim()
    if (!text) return
    setEditing(false)
    if (text !== content.trim()) onSubmit(text)
  }

  if (editing) {
    // One box: the container carries the border and focus ring, the textarea is
    // bare (the app-wide :focus-visible outline would draw a second box inside).
    return (
      <div
        className={clsx(
          'w-full min-w-[14rem] sm:min-w-[22rem] rounded-hb-md border border-hb-border bg-hb-surface shadow-hb-1',
          'transition-[border-color,box-shadow] duration-hb focus-within:border-hb-blue/50 focus-within:shadow-hb-ring',
          className,
        )}
        style={style}
      >
        <textarea
          ref={ref}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              e.stopPropagation()
              submit()
            } else if (e.key === 'Escape') {
              e.stopPropagation()
              setEditing(false)
            }
          }}
          rows={1}
          aria-label="Edit message"
          className="block w-full resize-none border-0 bg-transparent px-4 pb-1 pt-3 text-hb-sm leading-relaxed text-hb-text shadow-none !outline-none"
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-2 pl-4">
          <span className="hidden text-hb-micro text-hb-dim sm:inline">Enter to send · Esc to cancel</span>
          <div className="ml-auto flex gap-1.5">
            <Button size="sm" variant="quiet" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="sm" onClick={submit} disabled={!draft.trim() || draft.trim() === content.trim()}>Send</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={clsx('group flex min-w-0 flex-col items-end gap-1', className)} style={style}>
      {children}
      {canEdit && (
        <button
          type="button"
          onClick={start}
          title="Edit message"
          aria-label="Edit message"
          className="flex h-7 w-7 items-center justify-center rounded-full text-hb-muted opacity-60 transition hover:bg-hb-blue/5 hover:text-hb-text hover:opacity-100 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <Pencil size={13} />
        </button>
      )}
    </div>
  )
}
