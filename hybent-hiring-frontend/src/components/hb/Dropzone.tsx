import { useRef, useState, type ReactNode } from 'react'
import { clsx } from 'clsx'
import { Loader2, UploadCloud } from 'lucide-react'
import { IconTile } from './IconTile'
import { Badge } from './Badge'

/**
 * File drop target.
 *
 * The job-description and resume uploads each built one of these from a
 * `<div onClick>` with a hidden input, so neither was reachable by keyboard —
 * you could see the control and not use it. This is a real `<button>` wrapping
 * a real `<input type="file">`, which gets keyboard, focus ring and the mobile
 * file picker for nothing.
 *
 * `busy` covers the panel rather than swapping the content out, so the drop
 * target does not resize while a parse is running.
 */
export function Dropzone({
  onFiles,
  accept,
  multiple = false,
  title,
  description,
  formats,
  busy = false,
  busyLabel = 'Processing…',
  icon,
  className,
}: {
  onFiles: (files: File[]) => void
  /** Passed straight to the input, e.g. `.pdf,.docx`. */
  accept?: string
  multiple?: boolean
  title: string
  description?: ReactNode
  /** Shown as badges, e.g. `['PDF', 'DOCX']`. */
  formats?: string[]
  busy?: boolean
  busyLabel?: string
  icon?: ReactNode
  className?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const take = (list: FileList | null) => {
    if (!list?.length) return
    onFiles(multiple ? Array.from(list) : [list[0]])
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className={clsx('relative', className)}>
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          take(e.dataTransfer.files)
        }}
        className={clsx(
          'flex w-full flex-col items-center gap-3 rounded-hb-md border-2 border-dashed px-6 py-10 text-center',
          'transition-colors duration-hb ease-hb',
          'focus-visible:outline-none focus-visible:shadow-hb-ring',
          'disabled:cursor-wait',
          dragOver
            ? 'border-hb-blue/60 bg-hb-blue/5'
            : 'border-hb-border-strong bg-hb-surface-2 hover:border-hb-blue/40'
        )}
      >
        <IconTile size="lg">{icon ?? <UploadCloud />}</IconTile>

        <span>
          <span className="block font-display text-hb-h3 text-hb-text">{title}</span>
          {description && (
            <span className="mt-1 block max-w-[42ch] text-hb-sm text-hb-muted">{description}</span>
          )}
        </span>

        {formats && formats.length > 0 && (
          <span className="flex flex-wrap justify-center gap-1.5">
            {formats.map((f) => (
              <Badge key={f}>{f}</Badge>
            ))}
          </span>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => take(e.target.files)}
      />

      {busy && (
        <div
          role="status"
          className="absolute inset-0 grid place-items-center rounded-hb-md bg-hb-surface/80 backdrop-blur-[2px]"
        >
          <span className="flex items-center gap-2.5 text-hb-sm font-semibold text-hb-text">
            <Loader2 size={16} className="animate-spin" aria-hidden />
            {busyLabel}
          </span>
        </div>
      )}
    </div>
  )
}
