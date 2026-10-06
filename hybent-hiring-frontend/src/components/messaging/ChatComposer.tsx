import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Paperclip, SendHorizontal, Loader2, X, FileText, Image as ImageIcon, AlertCircle } from 'lucide-react'
import {
  chatApi,
  ALLOWED_ATTACHMENT_EXTENSIONS,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_MESSAGE,
} from '@/api/messages'
import { formatFileSize } from './fileUtils'

interface PendingFile {
  key: string
  file: File
  progress: number
  status: 'uploading' | 'done' | 'error'
  attachmentId?: string
  controller: AbortController
}

interface ChatComposerProps {
  /** Resolves when the message is sent; reject to keep the draft. */
  onSend: (content: string, attachmentIds: string[]) => Promise<void>
  placeholder?: string
  disabled?: boolean
}

const isTouch = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

/**
 * Chat input: auto-growing textarea, attach button, send button.
 *
 * Files upload as soon as they are picked (max 10 MB each, 5 per message), so
 * pressing send only posts the message with the uploaded attachment ids.
 * Enter sends and Shift+Enter adds a line; on touch screens Enter always adds
 * a line and the send button sends.
 */
export function ChatComposer({ onSend, placeholder = 'Message…', disabled }: ChatComposerProps) {
  const [text, setText] = useState('')
  const [files, setFiles] = useState<PendingFile[]>([])
  const [dragOver, setDragOver] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-grow up to ~5 lines
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`
  }, [text])

  // Abort in-flight uploads on unmount
  useEffect(() => () => files.forEach((f) => f.status === 'uploading' && f.controller.abort()), []) // eslint-disable-line react-hooks/exhaustive-deps

  const uploading = files.some((f) => f.status === 'uploading')
  const readyIds = files.filter((f) => f.status === 'done' && f.attachmentId).map((f) => f.attachmentId!)
  const canSend = !disabled && !uploading && (text.trim().length > 0 || readyIds.length > 0)

  const addFiles = (list: FileList | File[]) => {
    const incoming = Array.from(list)
    const room = MAX_ATTACHMENTS_PER_MESSAGE - files.length
    if (incoming.length > room) {
      toast.error(`You can attach up to ${MAX_ATTACHMENTS_PER_MESSAGE} files per message.`)
    }
    incoming.slice(0, Math.max(0, room)).forEach((file) => {
      const ext = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`
      if (!ALLOWED_ATTACHMENT_EXTENSIONS.includes(ext)) {
        toast.error(`${file.name}: this file type isn't supported.`)
        return
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast.error(`${file.name} is ${formatFileSize(file.size)}. The limit is 10 MB.`)
        return
      }
      if (file.size === 0) {
        toast.error(`${file.name} is empty.`)
        return
      }
      const key = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`
      const controller = new AbortController()
      setFiles((prev) => [...prev, { key, file, progress: 0, status: 'uploading', controller }])

      chatApi
        .uploadAttachment(
          file,
          (pct) => setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, progress: pct } : f))),
          controller.signal,
        )
        .then((res) =>
          setFiles((prev) =>
            prev.map((f) => (f.key === key ? { ...f, status: 'done', progress: 100, attachmentId: res.data.id } : f)),
          ),
        )
        .catch((err) => {
          if (controller.signal.aborted) return
          setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, status: 'error' } : f)))
          toast.error(err?.response?.data?.detail || err?.response?.data?.message || `Couldn't upload ${file.name}.`)
        })
    })
  }

  const removeFile = (key: string) => {
    setFiles((prev) => {
      prev.find((f) => f.key === key)?.controller.abort()
      return prev.filter((f) => f.key !== key)
    })
  }

  const submit = async () => {
    if (!canSend) return
    // Clear the draft right away so the message feels sent instantly; the
    // panel shows it as pending. On failure, restore the draft to retry.
    const draftText = text
    const draftFiles = files
    setText('')
    setFiles([])
    textareaRef.current?.focus()
    try {
      await onSend(draftText.trim(), readyIds)
    } catch {
      /* caller shows the error; restore the draft */
      setText(draftText)
      setFiles(draftFiles)
    }
  }

  return (
    <div
      className="border-t border-hb-border bg-hb-surface-2 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:pt-4 sm:pb-4"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault()
          setDragOver(true)
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
      }}
    >
      {files.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2" aria-label="Attachments">
          {files.map((f) => {
            const isImage = f.file.type.startsWith('image/')
            return (
              <li
                key={f.key}
                className={`relative flex max-w-full items-center gap-2 overflow-hidden rounded-hb-sm border bg-hb-surface py-1.5 pl-2 pr-1 text-hb-xs ${
                  f.status === 'error' ? 'border-hb-error/50' : 'border-hb-border'
                }`}
              >
                {f.status === 'error' ? (
                  <AlertCircle className="h-4 w-4 shrink-0 text-hb-error" />
                ) : isImage ? (
                  <ImageIcon className="h-4 w-4 shrink-0 text-hb-blue" />
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-hb-blue" />
                )}
                <span className="min-w-0 max-w-[140px] truncate font-medium text-hb-text sm:max-w-[180px]">{f.file.name}</span>
                <span className="shrink-0 text-hb-dim">
                  {f.status === 'uploading' ? `${f.progress}%` : f.status === 'error' ? 'Failed' : formatFileSize(f.file.size)}
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(f.key)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-hb-dim transition-colors hover:bg-hb-surface-2 hover:text-hb-text"
                  aria-label={`Remove ${f.file.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                {f.status === 'uploading' && (
                  <span
                    className="absolute bottom-0 left-0 h-0.5 bg-hb-grad transition-[width] duration-200"
                    style={{ width: `${f.progress}%` }}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className={`flex items-end gap-1.5 rounded-hb-md border bg-hb-surface p-1.5 shadow-hb-1 transition-[border-color,box-shadow] duration-hb focus-within:border-hb-blue/50 focus-within:ring-2 focus-within:ring-hb-blue/15 ${
          dragOver ? 'border-hb-blue border-dashed' : 'border-hb-border'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          accept={ALLOWED_ATTACHMENT_EXTENSIONS.join(',')}
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || files.length >= MAX_ATTACHMENTS_PER_MESSAGE}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-hb-sm text-hb-muted transition-colors duration-hb hover:bg-hb-surface-2 hover:text-hb-blue disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Attach files (max 10 MB each)"
          title="Attach files (max 10 MB each)"
        >
          <Paperclip className="h-5 w-5" />
        </button>

        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            if (e.clipboardData.files.length) {
              e.preventDefault()
              addFiles(e.clipboardData.files)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !isTouch()) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder={placeholder}
          aria-label="Message"
          className="block max-h-[132px] min-h-10 min-w-0 flex-1 resize-none border-0 bg-transparent px-1 py-2 font-body text-hb-body leading-6 text-hb-text shadow-none outline-none ring-0 placeholder:text-hb-dim focus:border-0 focus:shadow-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
        />

        <button
          type="submit"
          disabled={!canSend}
          aria-busy={uploading || undefined}
          aria-label="Send message"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-hb-sm transition-all duration-hb disabled:cursor-not-allowed ${
            canSend
              ? 'bg-hb-grad text-white shadow-hb-1 hover:brightness-110 active:scale-95'
              : 'bg-hb-muted/15 text-hb-dim'
          }`}
        >
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <SendHorizontal className="h-5 w-5" />}
        </button>
      </form>
    </div>
  )
}
