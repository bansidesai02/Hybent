import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Download, FileText, Loader2 } from 'lucide-react'
import { chatApi, type ChatAttachment } from '@/api/messages'
import { formatFileSize } from './fileUtils'

/** Signed URLs live 5 minutes server-side; reuse them for 4 to avoid refetching per render. */
const urlCache = new Map<string, { url: string; at: number }>()

async function signedUrl(id: string, download = false): Promise<string> {
  const key = `${id}:${download}`
  const hit = urlCache.get(key)
  if (hit && Date.now() - hit.at < 4 * 60 * 1000) return hit.url
  const res = await chatApi.getAttachmentUrl(id, download)
  urlCache.set(key, { url: res.data.url, at: Date.now() })
  return res.data.url
}

function ImageAttachment({ att }: { att: ChatAttachment }) {
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    signedUrl(att.id).then((u) => alive && setSrc(u)).catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [att.id])

  if (failed) return <FileAttachment att={att} />

  return (
    <button
      type="button"
      onClick={() => src && window.open(src, '_blank', 'noopener,noreferrer')}
      className="block overflow-hidden rounded-xl border border-hb-border bg-hb-surface-2"
      aria-label={`Open ${att.file_name}`}
    >
      {src ? (
        <img src={src} alt={att.file_name} className="max-h-56 w-full max-w-[240px] object-cover" loading="lazy" />
      ) : (
        <div className="flex h-32 w-[200px] items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-hb-dim" />
        </div>
      )}
    </button>
  )
}

function FileAttachment({ att }: { att: ChatAttachment }) {
  const [busy, setBusy] = useState(false)
  const open = async () => {
    setBusy(true)
    try {
      const url = await signedUrl(att.id, true)
      // Save under the original name — storage backends (Cloudinary) rename
      // downloads generically. Fall back to opening the link if fetch fails.
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(String(res.status))
        const blobUrl = URL.createObjectURL(await res.blob())
        const a = document.createElement('a')
        a.href = blobUrl
        a.download = att.file_name
        a.click()
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000)
      } catch {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    } catch {
      toast.error("Couldn't open this file.")
    } finally {
      setBusy(false)
    }
  }
  const ext = att.file_name.split('.').pop()?.toUpperCase() ?? 'FILE'

  return (
    <button
      type="button"
      onClick={open}
      className="flex w-full max-w-[260px] items-center gap-3 rounded-xl border border-hb-border bg-hb-surface p-2.5 text-left transition-colors hover:border-hb-blue/40"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-hb-blue/10 text-hb-blue">
        <FileText className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-hb-xs font-semibold text-hb-text">{att.file_name}</span>
        <span className="block font-mono text-hb-micro uppercase text-hb-dim">
          {ext} · {formatFileSize(att.size_bytes)}
        </span>
      </span>
      {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-hb-dim" /> : <Download className="h-4 w-4 shrink-0 text-hb-dim" />}
    </button>
  )
}

export function MessageAttachments({ attachments, alignEnd }: { attachments: ChatAttachment[]; alignEnd?: boolean }) {
  if (!attachments.length) return null
  return (
    <div className={`flex flex-col gap-1.5 ${alignEnd ? 'items-end' : 'items-start'}`}>
      {attachments.map((a) =>
        a.mime_type.startsWith('image/') ? <ImageAttachment key={a.id} att={a} /> : <FileAttachment key={a.id} att={a} />,
      )}
    </div>
  )
}
