import { Link2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { FacebookMark, LinkedInMark, WhatsAppMark, XMark } from './brandIcons'

/** "Share with someone awesome": the job's apply link on social apps, or copied. */
export function ShareJob({ url, title, company }: { url: string; title: string; company: string }) {
  const text = `${company} is hiring: ${title}`
  const u = encodeURIComponent(url)
  const t = encodeURIComponent(text)
  const links = [
    { label: 'Share on LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`, icon: <LinkedInMark /> },
    { label: 'Share on Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${u}`, icon: <FacebookMark /> },
    { label: 'Share on X', href: `https://twitter.com/intent/tweet?url=${u}&text=${t}`, icon: <XMark /> },
    { label: 'Share on WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, icon: <WhatsAppMark /> },
  ]
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied')
    } catch {
      toast.error("Couldn't copy the link")
    }
  }
  const btn =
    'grid h-10 w-10 place-items-center rounded-full border border-hb-border bg-hb-surface text-hb-muted transition-colors hover:border-hb-border-strong hover:text-hb-text'
  return (
    <div>
      <p className="mb-2.5 text-hb-sm font-semibold text-hb-text">Share with someone awesome</p>
      <div className="flex flex-wrap gap-2">
        {links.map((l) => (
          <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" aria-label={l.label} title={l.label} className={btn}>
            {l.icon}
          </a>
        ))}
        <button type="button" onClick={copy} aria-label="Copy link" title="Copy link" className={btn}>
          <Link2 size={17} aria-hidden />
        </button>
      </div>
    </div>
  )
}
