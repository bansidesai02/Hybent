import { useCallback, useEffect, useState } from 'react'
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  ImagePlus,
  Link2,
  Loader2,
  Sparkles,
  Trash2,
  Unlink,
} from 'lucide-react'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'
import { useQuery } from '@tanstack/react-query'

import { aiApi } from '@/api/ai'
import { linkedinApi } from '@/api/linkedin'
import { organizationsApi } from '@/api/organizations'
import {
  Badge,
  Button,
  Dialog,
  Dropzone,
  IconTile,
  Label,
  SkeletonText,
  TagInput,
  Textarea,
} from '@/components/hb'
import type { Job } from '@/types'

/**
 * lucide dropped its brand glyphs at v1.8, so LinkedIn's mark lives here.
 * `currentColor` so it takes the colour of whatever button carries it.
 */
function LinkedInGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

/* ─── Component ─────────────────────────────────────────────────────────────── */

interface LinkedInShareModalProps {
  job: Job | null
  onClose: () => void
}

type Screen = 'compose' | 'success'

/**
 * LinkedIn's post composer. With a `text` parameter it opens with the post
 * already typed in, so the recruiter only reviews and clicks Post. That
 * parameter is undocumented (LinkedIn's supported share URL takes a link
 * only) and works on the desktop site alone — the mobile site lands on the
 * plain feed — so the text is always copied to the clipboard as well.
 */
const LINKEDIN_COMPOSE_URL = 'https://www.linkedin.com/feed/?shareActive=true'

/* Well under the ~8 KB request-line limit common to web servers: past it, a
   prefilled link risks an error page instead of the composer, so a longer
   post opens the plain composer and relies on the clipboard. */
const MAX_PREFILL_URL_LENGTH = 7500

function composeUrlFor(text: string): string {
  const url = `${LINKEDIN_COMPOSE_URL}&text=${encodeURIComponent(text)}`
  return url.length <= MAX_PREFILL_URL_LENGTH ? url : LINKEDIN_COMPOSE_URL
}

const CHAR_LIMIT = 3000

const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif'
const IMAGE_MAX_BYTES = 10 * 1024 * 1024

/* Tags carry their hash into the post body, so one is added if the recruiter
   did not type it. Deduped after prefixing, so "react" cannot be added twice
   as "#react". */
function normalizeTags(tags: string[]): string[] {
  const tagged = tags.map(t => t.trim()).filter(Boolean).map(t => (t.startsWith('#') ? t : `#${t}`))
  return [...new Set(tagged)]
}

/** Browsers only put PNG on the clipboard, so a JPG/WEBP is redrawn as one. */
async function toPngBlob(file: File): Promise<Blob> {
  if (file.type === 'image/png') return file
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
  bitmap.close()
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('PNG conversion failed'))), 'image/png')
  })
}

export function LinkedInShareModal({ job, onClose }: LinkedInShareModalProps) {
  const [screen, setScreen] = useState<Screen>('compose')

  // ── LinkedIn connection ─────────────────────────────────────────────────────
  const [isConnected, setIsConnected] = useState<boolean | null>(null)
  const [isCheckingConn, setIsCheckingConn] = useState(true)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  // ── Compose state ───────────────────────────────────────────────────────────
  const [isGenerating, setIsGenerating] = useState(false)
  const [postText, setPostText] = useState('')
  const [hashtags, setHashtags] = useState<string[]>([])
  /* Each AI draft uses one of several post formats; the ones already used are
     sent back so "Regenerate" switches to a different format. */
  const [recentStyles, setRecentStyles] = useState<string[]>([])
  const [styleName, setStyleName] = useState('')
  /** The recruiter's own image, with an object URL for the preview. */
  const [image, setImage] = useState<{ file: File; url: string } | null>(null)

  // ── Post state ──────────────────────────────────────────────────────────────
  const [isPosting, setIsPosting] = useState(false)
  const [isCopyingImage, setIsCopyingImage] = useState(false)
  /** The composer link last opened, so "Open LinkedIn again" refills it too. */
  const [composeLink, setComposeLink] = useState(LINKEDIN_COMPOSE_URL)
  const [postPrefilled, setPostPrefilled] = useState(true)

  // ── Apply link — the org slug + job id, shared by the AI draft and the
  //    standalone "Copy Apply Link" button so a manually-written post can
  //    carry it too. ───────────────────────────────────────────────────────
  const { data: organization } = useQuery({
    queryKey: ['organization', 'me'],
    queryFn: () => organizationsApi.getMe().then(res => res.data),
    staleTime: 5 * 60 * 1000,
  })
  const applyUrl = job && organization?.slug
    ? `${window.location.origin}/apply/${organization.slug}/${job.id}`
    : ''

  // ── Check LinkedIn connection when modal opens ──────────────────────────────
  useEffect(() => {
    if (!job) return
    setIsCheckingConn(true)
    linkedinApi.status()
      .then((r: any) => setIsConnected(r?.connected ?? r?.data?.connected ?? false))
      .catch(() => setIsConnected(false))
      .finally(() => setIsCheckingConn(false))
  }, [job])

  // ── Reset when the modal closes — it stays mounted between jobs, so a draft
  //    for one job must not carry over to the next. ──────────────────────────
  useEffect(() => {
    if (!job) {
      setScreen('compose')
      setPostText('')
      setHashtags([])
      setRecentStyles([])
      setStyleName('')
      setImage(null)
      setComposeLink(LINKEDIN_COMPOSE_URL)
      setPostPrefilled(true)
      setIsPosting(false)
    }
  }, [job])

  // Frees each preview URL once it is replaced, removed or unmounted.
  useEffect(() => () => { if (image) URL.revokeObjectURL(image.url) }, [image])

  // ── OAuth popup ─────────────────────────────────────────────────────────────
  const handleConnectLinkedIn = async () => {
    setIsConnecting(true)
    try {
      const r: any = await linkedinApi.connectUrl()
      const url = r?.url || r?.data?.url
      if (!url) { toast.error('Could not get LinkedIn auth URL. Check server config.'); return }

      const popup = window.open(url, 'linkedin_oauth', 'width=600,height=700,scrollbars=yes,resizable=yes')

      const listener = (e: MessageEvent) => {
        if (e.data?.type === 'LINKEDIN_CONNECTED') {
          window.removeEventListener('message', listener)
          popup?.close()
          setIsConnected(true)
          toast.success('LinkedIn connected!')
        }
        if (e.data?.type === 'LINKEDIN_ERROR') {
          window.removeEventListener('message', listener)
          popup?.close()
          toast.error(`LinkedIn connection failed: ${e.data.message || 'Unknown error'}`)
        }
      }
      window.addEventListener('message', listener)
      // Cleanup after 10 min regardless
      setTimeout(() => window.removeEventListener('message', listener), 10 * 60 * 1000)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to initiate LinkedIn connection.')
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (isDisconnecting) return
    setIsDisconnecting(true)
    try {
      await linkedinApi.disconnect()
      setIsConnected(false)
      toast.success('LinkedIn disconnected.')
    } catch {
      toast.error('Failed to disconnect.')
    } finally {
      setIsDisconnecting(false)
    }
  }

  // ── AI post ─────────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!job) return
    setIsGenerating(true)
    try {
      const r: any = await aiApi.generateLinkedInPost({
        title: job.title, location: job.location, job_type: job.job_type,
        experience_level: job.experience_level, skills_required: job.skills_required,
        description: job.description, responsibilities: job.responsibilities,
        requirements: job.requirements, benefits: job.benefits,
        min_experience_years: job.min_experience_years, openings: job.openings,
        is_remote: job.is_remote, application_deadline: job.application_deadline,
        apply_url: applyUrl || undefined, recent_styles: recentStyles,
      })
      const data = r.data ?? r
      if (!data?.post_content) { toast.error('AI returned an empty post. Please try again.'); return }

      let content: string = data.post_content.trim()
      if (applyUrl && !content.includes(applyUrl)) {
        content = `${content}\n\nApply here: ${applyUrl}`
      }
      setPostText(content)
      if (data.hashtags?.length) setHashtags(normalizeTags(data.hashtags))
      if (data.style) {
        setRecentStyles(prev => [...prev, data.style].slice(-10))
        setStyleName(data.style_name || '')
      }
      toast.success('AI post generated!')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'AI generation failed.')
    } finally { setIsGenerating(false) }
  }, [job, applyUrl, recentStyles])

  // ── Recruiter's own image ───────────────────────────────────────────────────
  const handleImageFile = (file: File | undefined) => {
    if (!file) return
    if (!IMAGE_ACCEPT.split(',').includes(file.type)) {
      toast.error('Please choose a PNG, JPG, WEBP or GIF image.')
      return
    }
    if (file.size > IMAGE_MAX_BYTES) {
      toast.error('That image is over 10 MB — please choose a smaller one.')
      return
    }
    setImage({ file, url: URL.createObjectURL(file) })
  }

  /* A second, separate copy: the clipboard holds one thing at a time, so the
     image can only go on it after the post text has been pasted. */
  const handleCopyImage = async () => {
    if (!image) return
    setIsCopyingImage(true)
    try {
      const png = await toPngBlob(image.file)
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
      toast.success('Image copied — paste it into your LinkedIn post.')
    } catch {
      toast.error("Couldn't copy the image — attach it with LinkedIn's photo button instead.")
    } finally { setIsCopyingImage(false) }
  }

  // ── Copy apply link ─────────────────────────────────────────────────────────
  // Standalone from the AI draft — also for a post written entirely by hand.
  const handleCopyApplyLink = async () => {
    if (!applyUrl) { toast.error('Apply link is still loading — try again in a moment.'); return }
    try {
      await navigator.clipboard.writeText(applyUrl)
      toast.success('Apply link copied!')
    } catch {
      toast.error('Could not copy the apply link.')
    }
  }

  // ── Publish ─────────────────────────────────────────────────────────────────
  // Opens LinkedIn's composer with the post already filled in (see
  // LINKEDIN_COMPOSE_URL); the recruiter reviews it there and clicks Post.
  // The image, if any, cannot travel in a URL — it is copied as a second step
  // from the success screen.
  const handlePublish = async () => {
    if (!job) return
    setIsPosting(true)
    try {
      const fullText = postText.trim() + (hashtags.length ? '\n\n' + hashtags.join(' ') : '')
      const url = composeUrlFor(fullText)
      const isPrefilled = url !== LINKEDIN_COMPOSE_URL

      /* Before window.open: the new tab takes focus, and the clipboard refuses
         writes from a page that is not focused. A failure is not fatal when
         the text travels in the URL. */
      try {
        await navigator.clipboard.writeText(fullText)
      } catch (err) {
        if (!isPrefilled) throw err
      }

      window.open(url, '_blank')
      setComposeLink(url)
      setPostPrefilled(isPrefilled)
      setScreen('success')
      toast.success(
        isPrefilled ? 'LinkedIn opened with your post filled in!' : 'Post copied — paste it into LinkedIn.'
      )
    } catch (err: any) {
      console.error(err)
      toast.error('Failed to prepare the post. Please try again.')
    } finally { setIsPosting(false) }
  }

  if (!job) return null

  const charCount = postText.length + (hashtags.length ? 2 + hashtags.join(' ').length : 0)
  const publishBlocked = !isConnected
    ? 'Connect LinkedIn first'
    : !postText.trim()
      ? 'Write or generate the post first'
      : undefined

  const footer =
    screen === 'compose' ? (
      <>
        <p className="mr-auto max-w-[46ch] text-hb-xs text-hb-muted">
          LinkedIn opens with this post already filled in
          {image ? ' — add your image there,' : ' —'} review it and click Post.
        </p>
        {/* The tooltip lives on the wrapper because a disabled Button is
            `pointer-events-none` — on the button itself it can never be seen,
            and it is the only thing explaining why publishing is unavailable. */}
        <span className="inline-flex" title={publishBlocked}>
          <Button
            size="lg"
            onClick={handlePublish}
            loading={isPosting}
            disabled={!!publishBlocked}
            icon={<LinkedInGlyph size={17} />}
          >
            {isPosting ? 'Opening…' : 'Post on LinkedIn'}
          </Button>
        </span>
      </>
    ) : (
      <>
        <a
          href={composeLink}
          target="_blank"
          rel="noopener noreferrer"
          className={clsx(
            'inline-flex h-10 items-center gap-2 rounded-hb-full px-5',
            'bg-hb-grad font-body text-hb-body font-bold text-hb-on-brand',
            'transition-transform duration-hb ease-hb hover:-translate-y-[2px]'
          )}
        >
          <ExternalLink size={16} aria-hidden />
          Open LinkedIn again
        </a>
        <Button variant="quiet" onClick={onClose}>
          Close
        </Button>
      </>
    )

  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
      title={
        <span className="inline-flex items-center gap-hb-3">
          <IconTile size="md"><LinkedInGlyph /></IconTile>
          Share on LinkedIn
        </span>
      }
      description={job.title}
      footer={footer}
    >
      {/* ── Connection state ──────────────────────────────────────────────── */}
      <div className="mb-hb-5 flex flex-wrap items-center justify-end gap-hb-2 border-b border-hb-border pb-hb-4">
        {isCheckingConn ? (
          <span role="status" className="inline-flex items-center gap-1.5 text-hb-xs text-hb-muted">
            <Loader2 size={12} className="animate-spin" aria-hidden /> Checking…
          </span>
        ) : isConnected ? (
          <>
            <Badge tone="success" dot>LinkedIn connected</Badge>
            <Button
              variant="quiet"
              size="sm"
              icon={<Unlink size={13} />}
              loading={isDisconnecting}
              onClick={handleDisconnect}
            >
              Disconnect
            </Button>
          </>
        ) : (
          <>
            <Badge tone="warning">Not connected</Badge>
            <Button
              size="sm"
              icon={<LinkedInGlyph size={14} />}
              loading={isConnecting}
              onClick={handleConnectLinkedIn}
            >
              {isConnecting ? 'Connecting…' : 'Connect LinkedIn'}
            </Button>
          </>
        )}
      </div>

      {/* ── SCREEN: COMPOSE ───────────────────────────────────────────────── */}
      {screen === 'compose' && (
        <div className="grid gap-hb-6 md:grid-cols-2">

          {/* Left — post */}
          <div className="space-y-hb-3">
            <div className="flex flex-wrap items-center justify-between gap-hb-3">
              <p className="text-hb-xs text-hb-muted">
                AI drafts the post from this job — edit anything before posting.
              </p>
              <Button
                size="sm"
                onClick={handleGenerate}
                loading={isGenerating}
                icon={<Sparkles size={14} />}
              >
                {isGenerating ? 'Generating…' : postText ? 'Regenerate' : 'Generate with AI'}
              </Button>
            </div>

            {isGenerating ? (
              <div className="grid gap-2">
                <Label>Post content</Label>
                <div className="min-h-[260px] rounded-hb-sm border border-hb-border bg-hb-surface p-hb-3">
                  <SkeletonText lines={8} />
                </div>
              </div>
            ) : (
              <Textarea
                label="Post content"
                value={postText}
                onChange={e => setPostText(e.target.value)}
                placeholder="Click 'Generate with AI' to draft your LinkedIn post, or write your own…"
                rows={12}
                className="min-h-[260px] text-hb-sm"
              />
            )}

            <div className="flex items-baseline justify-between gap-hb-3">
              <p className="min-w-0 truncate text-hb-xs text-hb-muted">
                {styleName && !isGenerating && <>Format: {styleName} · Regenerate for a different one</>}
              </p>
              <p
                className={clsx(
                  'shrink-0 font-mono text-hb-micro',
                  charCount > CHAR_LIMIT * 0.9 ? 'text-hb-error' : 'text-hb-dim'
                )}
              >
                {charCount} / {CHAR_LIMIT}
              </p>
            </div>

            <TagInput
              label="Hashtags"
              value={hashtags}
              onChange={next => setHashtags(normalizeTags(next))}
              placeholder="#addtag"
            />

            <div className="flex items-center justify-between gap-hb-2 rounded-hb-sm border border-hb-border bg-hb-surface-2 px-hb-3 py-hb-2.5">
              <p className="min-w-0 truncate text-hb-xs text-hb-muted">
                {applyUrl || 'Apply link loads once organization info is ready…'}
              </p>
              <Button
                size="sm"
                variant="quiet"
                icon={<Link2 size={13} />}
                onClick={handleCopyApplyLink}
              >
                Copy apply link
              </Button>
            </div>
          </div>

          {/* Right — the recruiter's own image, optional */}
          <div className="space-y-hb-3">
            <span className="font-mono text-hb-label uppercase text-hb-dim">Image · optional</span>

            {image ? (
              <>
                <div className="overflow-hidden rounded-hb-md border border-hb-border bg-hb-surface-2 shadow-hb-2">
                  <img
                    src={image.url}
                    alt="Image for the LinkedIn post"
                    className="block max-h-80 w-full object-contain"
                  />
                </div>
                <div className="flex items-center justify-between gap-hb-2">
                  <p className="min-w-0 truncate text-hb-xs text-hb-muted">{image.file.name}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 size={13} />}
                    onClick={() => setImage(null)}
                  >
                    Remove
                  </Button>
                </div>
              </>
            ) : (
              <Dropzone
                onFiles={files => handleImageFile(files[0])}
                accept={IMAGE_ACCEPT}
                icon={<ImagePlus />}
                title="Drop your image here"
                description="Drag & drop or click to browse. Leave it empty to post text only."
                formats={['PNG', 'JPG', 'WEBP', 'GIF']}
              />
            )}
          </div>
        </div>
      )}

      {/* ── SCREEN: SUCCESS ───────────────────────────────────────────────── */}
      {screen === 'success' && (
        <div className="flex flex-col items-center py-hb-8 text-center">
          <IconTile size="lg" className="text-hb-success"><CheckCircle2 /></IconTile>
          <h3 className="mt-hb-4 font-display text-hb-h3 text-hb-text">LinkedIn is open in a new tab</h3>
          <ol className="mt-hb-4 max-w-[46ch] list-decimal space-y-1.5 pl-5 text-left text-hb-sm text-hb-text">
            {postPrefilled ? (
              <li>
                Your post is already filled in LinkedIn's composer. If it shows up empty (LinkedIn's
                mobile site does not support this), paste it with Ctrl/Cmd+V — it's copied too.
              </li>
            ) : (
              <li>
                This post is too long for LinkedIn to fill in automatically — paste it with
                Ctrl/Cmd+V, it's already copied.
              </li>
            )}
            {image && (
              <li>
                Copy your image and paste it into the post too — or attach it with LinkedIn's
                photo button.
                <div className="mt-hb-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Copy size={13} />}
                    loading={isCopyingImage}
                    onClick={handleCopyImage}
                  >
                    Copy image
                  </Button>
                </div>
              </li>
            )}
            <li>Review it and click Post.</li>
          </ol>
        </div>
      )}
    </Dialog>
  )
}
