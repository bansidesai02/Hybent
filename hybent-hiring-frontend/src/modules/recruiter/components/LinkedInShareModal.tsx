import { useCallback, useEffect, useId, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  Palette,
  RefreshCw,
  Sparkles,
  Unlink,
} from 'lucide-react'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'
import { useQuery } from '@tanstack/react-query'

import { aiApi } from '@/api/ai'
import { linkedinApi } from '@/api/linkedin'
import { organizationsApi } from '@/api/organizations'
import {
  Avatar,
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
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

/* ─── Canvas banner ─────────────────────────────────────────────────────────── */

const JOB_TYPE_LABEL: Record<string, string> = {
  full_time: 'Full-time', part_time: 'Part-time',
  contract: 'Contract', internship: 'Internship', freelance: 'Freelance',
}

/**
 * The four pickable card themes, as pairs of brand gradient stops.
 *
 * The one place in the product where colour varies by choice rather than by
 * meaning — the recruiter cycles them with "Change variant", and the result is
 * an image that leaves the product entirely.
 */
const CARD_THEMES = [
  ['--hb-brand-violet', '--hb-brand-blue'],
  ['--hb-brand-blue', '--hb-brand-cyan'],
  ['--hb-brand-magenta', '--hb-brand-violet'],
  ['--hb-brand-cyan', '--hb-brand-magenta'],
] as const

const BANNER_TOKENS = [
  '--hb-brand-cyan',
  '--hb-brand-blue',
  '--hb-brand-violet',
  '--hb-brand-magenta',
  '--hb-bg',
  '--hb-text',
  '--hb-f-display',
  '--hb-f-body',
] as const

/**
 * Reads the design tokens the banner paints with.
 *
 * The banner is a standalone image that always sits on a dark ground, so it is
 * painted from the *dark* theme's values whichever theme the app is in. Custom
 * properties only resolve on an element that is in the document, which is why
 * the probe is attached for the length of the read.
 */
function readBannerTokens(): Record<string, string> {
  const probe = document.createElement('div')
  probe.dataset.theme = 'dark'
  probe.hidden = true
  document.body.appendChild(probe)
  const computed = getComputedStyle(probe)
  const out: Record<string, string> = {}
  for (const name of BANNER_TOKENS) out[name] = computed.getPropertyValue(name).trim()
  probe.remove()
  return out
}

function generateJobCardImage(job: Job, variant: number = 0): string {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 628
  const ctx = canvas.getContext('2d')!

  const token = readBannerTokens()
  const c = (name: string, alpha = 1) => `rgb(${token[name]} / ${alpha})`
  const ink = (alpha = 1) => c('--hb-text', alpha)
  const display = token['--hb-f-display'] || 'sans-serif'
  const body = token['--hb-f-body'] || 'sans-serif'

  ctx.fillStyle = c('--hb-bg')
  ctx.fillRect(0, 0, 1200, 628)

  const [stopA, stopB] = CARD_THEMES[variant % CARD_THEMES.length]
  const bg = ctx.createLinearGradient(0, 0, 1200, 628)
  bg.addColorStop(0, c(stopA, 0.45))
  bg.addColorStop(0.5, c(stopB, 0.25))
  bg.addColorStop(1, c('--hb-bg', 0))
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, 1200, 628)

  const drawCircle = (x: number, y: number, r: number, color: string, alpha: number) => {
    ctx.save(); ctx.globalAlpha = alpha; ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); ctx.restore()
  }
  drawCircle(1050, 100, 200, c('--hb-brand-violet'), 0.15)
  drawCircle(200,  500, 150, c('--hb-brand-blue'), 0.12)
  drawCircle(900,  500, 120, c('--hb-brand-magenta'), 0.10)

  /* The four-stop identity gradient, at the same stops as `--hb-grad`. */
  const accentGrad = ctx.createLinearGradient(0, 0, 1200, 0)
  accentGrad.addColorStop(0, c('--hb-brand-cyan'))
  accentGrad.addColorStop(0.38, c('--hb-brand-blue'))
  accentGrad.addColorStop(0.72, c('--hb-brand-violet'))
  accentGrad.addColorStop(1, c('--hb-brand-magenta'))
  ctx.fillStyle = accentGrad; ctx.fillRect(0, 0, 1200, 6)

  ctx.fillStyle = c('--hb-brand-blue'); roundRect(ctx, 60, 40, 130, 44, 8)
  ctx.fillStyle = ink(); ctx.font = `bold 20px ${body}`; ctx.fillText('in LinkedIn', 80, 67)

  ctx.fillStyle = c('--hb-brand-violet', 0.85); roundRect(ctx, 60, 110, 240, 48, 10)
  ctx.fillStyle = ink(); ctx.font = `bold 22px ${body}`; ctx.fillText('🚀  WE\'RE HIRING!', 80, 141)

  ctx.fillStyle = ink(); ctx.font = `bold 62px ${display}`
  const titleLines = wrapText(ctx, job.title, 860)
  titleLines.slice(0, 2).forEach((line, i) => { ctx.fillText(line, 60, 250 + i * 74) })

  const divGrad = ctx.createLinearGradient(60, 0, 600, 0)
  divGrad.addColorStop(0, c('--hb-brand-violet')); divGrad.addColorStop(1, 'transparent')
  ctx.fillStyle = divGrad; ctx.fillRect(60, 340, 500, 3)

  const chips = [job.location || 'Remote', JOB_TYPE_LABEL[job.job_type] || job.job_type, job.experience_level || ''].filter(Boolean)
  let chipX = 60
  chips.forEach((chip) => {
    ctx.font = `16px ${body}`
    const w = ctx.measureText(chip).width + 28
    ctx.fillStyle = ink(0.12); roundRect(ctx, chipX, 360, w, 36, 18)
    ctx.fillStyle = ink(0.85); ctx.font = `bold 16px ${body}`; ctx.fillText(chip, chipX + 14, 383)
    chipX += w + 12
  })

  if (job.skills_required?.length) {
    const skills = job.skills_required.slice(0, 5)
    ctx.fillStyle = ink(0.5); ctx.font = `14px ${body}`; ctx.fillText('SKILLS:', 60, 430)
    let skillX = 130
    skills.forEach((skill) => {
      ctx.font = `14px ${body}`
      const w = ctx.measureText(skill).width + 22
      if (skillX + w > 1100) return
      ctx.fillStyle = c('--hb-brand-violet', 0.5); roundRect(ctx, skillX, 415, w, 28, 14)
      ctx.fillStyle = ink(0.92); ctx.font = `bold 14px ${body}`; ctx.fillText(skill, skillX + 11, 433)
      skillX += w + 10
    })
  }

  ctx.fillStyle = c('--hb-bg', 0.35); ctx.fillRect(0, 550, 1200, 78)

  const brandGrad = ctx.createLinearGradient(60, 0, 300, 0)
  brandGrad.addColorStop(0, c('--hb-brand-cyan')); brandGrad.addColorStop(1, c('--hb-brand-violet'))
  ctx.fillStyle = brandGrad; ctx.font = `bold 28px ${display}`; ctx.fillText('Hybent Hiring', 60, 596)
  ctx.fillStyle = ink(0.4); ctx.font = `18px ${body}`; ctx.fillText('AI-Powered Recruitment Platform', 170, 596)
  ctx.fillStyle = ink(0.6); ctx.font = `16px ${body}`
  ctx.textAlign = 'right'; ctx.fillText('Apply now · gethybent_hiring.netlify.app', 1140, 596); ctx.textAlign = 'left'

  return canvas.toDataURL('image/png')
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); ctx.fill()
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' '); const lines: string[] = []; let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && current) { lines.push(current); current = word }
    else { current = test }
  }
  if (current) lines.push(current)
  return lines
}

/* ─── Component ─────────────────────────────────────────────────────────────── */

interface LinkedInShareModalProps {
  job: Job | null
  onClose: () => void
}

type Screen = 'compose' | 'confirm' | 'success'

const TONES = ['professional', 'modern', 'creative', 'casual', 'minimalist'] as const
type Tone = (typeof TONES)[number]

const IMAGE_TYPES = [
  { value: 'card' as const, label: 'Job Card' },
  { value: 'ai' as const, label: 'AI Image' },
  { value: 'none' as const, label: 'None' },
]

/**
 * LinkedIn does not let a URL pre-fill post text into a member's composer —
 * only publishing through a member's own authenticated session can do that.
 * So "publish" here means: copy the drafted text/image, then open LinkedIn's
 * own blank composer for the recruiter to paste into and publish themselves.
 */
const LINKEDIN_COMPOSE_URL = 'https://www.linkedin.com/feed/?shareActive=true'

export function LinkedInShareModal({ job, onClose }: LinkedInShareModalProps) {
  // ── Screen machine ──────────────────────────────────────────────────────────
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
  const [imageUrl, setImageUrl] = useState<string>('')
  const [imageVariant, setImageVariant] = useState(0)
  const [imageType, setImageType] = useState<'card' | 'ai' | 'none'>('card')
  const [imagePrompt, setImagePrompt] = useState('')
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [aiImageUrl, setAiImageUrl] = useState('')
  const [selectedTone, setSelectedTone] = useState<Tone>('professional')

  // ── Post state ──────────────────────────────────────────────────────────────
  const [isPosting, setIsPosting] = useState(false)
  const [readySummary, setReadySummary] = useState<{ imageIncluded: boolean; imageCopied: boolean } | null>(null)

  const toneLabelId = useId()
  const visualLabelId = useId()

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

  // ── Generate card image when job or variant changes ─────────────────────────
  useEffect(() => {
    if (job) setImageUrl(generateJobCardImage(job, imageVariant))
  }, [job, imageVariant])

  // ── Reset screen when modal closes / reopens ────────────────────────────────
  useEffect(() => {
    if (!job) {
      setScreen('compose')
      setReadySummary(null)
      setIsPosting(false)
    }
  }, [job])

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

  // ── AI Generate ─────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!job) return
    setIsGenerating(true)
    try {
      const r: any = await aiApi.generateLinkedInPost({
        title: job.title, location: job.location, job_type: job.job_type,
        experience_level: job.experience_level, skills_required: job.skills_required,
        description: job.description, tone: selectedTone, apply_url: applyUrl || undefined,
      })
      const data = r.data ?? r
      if (data?.post_content) {
        let content: string = data.post_content
        if (applyUrl && !content.includes(applyUrl)) {
          content = `${content.trim()}\n\nApply here: ${applyUrl}`
        }
        setPostText(content)
      }
      if (data?.hashtags?.length) setHashtags(data.hashtags)
      toast.success('AI post generated!')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'AI generation failed.')
    } finally { setIsGenerating(false) }
  }, [job, selectedTone, applyUrl])

  /* Tags carry their hash into the post body, so one is added if the recruiter
     did not type it. Deduped after prefixing, so "react" cannot be added twice
     as "#react". */
  const handleTagsChange = (next: string[]) => {
    const tagged = next.map(t => (t.startsWith('#') ? t : `#${t}`))
    setHashtags([...new Set(tagged)])
  }

  const handleGenerateImagePrompt = useCallback(async () => {
    if (!job) return
    setIsGeneratingImage(true)
    try {
      const r: any = await aiApi.generateImagePrompt({ title: job.title, description: job.description })
      const prompt = r.data?.prompt ?? r?.prompt
      if (prompt) {
        setImagePrompt(prompt); setImageType('ai')
        const imgR: any = await aiApi.generateImage(prompt)
        const b64 = imgR.data?.image_base64 ?? imgR?.image_base64
        if (b64) setAiImageUrl(b64)
      }
      toast.success('AI Image generated!')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to generate AI image.')
    } finally { setIsGeneratingImage(false) }
  }, [job])

  const handleRefreshImage = async () => {
    if (!imagePrompt) return
    setIsGeneratingImage(true)
    try {
      const imgR: any = await aiApi.generateImage(imagePrompt)
      const b64 = imgR.data?.image_base64 ?? imgR?.image_base64
      if (b64) { setAiImageUrl(b64); toast.success('Visual refreshed!') }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to refresh image.')
    } finally { setIsGeneratingImage(false) }
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
  // LinkedIn does not accept prefilled post text via URL (and the direct
  // publish API requires the restricted `w_member_social` scope) — so this
  // copies the draft to the clipboard and opens LinkedIn's own composer for
  // the recruiter to paste into and review before publishing themselves.
  const handlePublish = async () => {
    if (!job) return
    setIsPosting(true)
    try {
      const fullText = postText.trim() + (hashtags.length ? '\n\n' + hashtags.join(' ') : '')
      const finalImageData = imageType === 'ai' ? aiImageUrl : (imageType === 'card' ? imageUrl : '')

      await navigator.clipboard.writeText(fullText)

      let imageCopied = false
      if (finalImageData) {
        const filename = `${job.title.replace(/\s+/g, '_')}_job_opening.png`
        const link = document.createElement('a')
        link.href = finalImageData
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        try {
          const res = await fetch(finalImageData)
          const blob = await res.blob()
          await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
          imageCopied = true
        } catch (err) {
          console.warn('Auto-copying image to clipboard failed, falling back to download only:', err)
        }
      }

      window.open(LINKEDIN_COMPOSE_URL, '_blank')
      setReadySummary({ imageIncluded: !!finalImageData, imageCopied })
      setScreen('success')

      if (finalImageData) {
        toast.success(imageCopied ? 'Text & image copied! Image also downloaded.' : 'Text copied & image downloaded!')
      } else {
        toast.success('Post text copied to clipboard!')
      }
    } catch (err: any) {
      console.error(err)
      toast.error('Failed to prepare the post. Please try again.')
    } finally { setIsPosting(false) }
  }

  const charCount = postText.length + (hashtags.length ? 2 + hashtags.join(' ').length : 0)
  const charLimit = 3000
  const finalImage = imageType === 'ai' ? aiImageUrl : (imageType === 'card' ? imageUrl : '')

  if (!job) return null

  const segChip = (active: boolean) =>
    clsx(
      'inline-flex h-8 items-center rounded-hb-full border px-3.5',
      'font-body text-hb-sm font-semibold whitespace-nowrap',
      'transition-all duration-hb ease-hb',
      'focus-visible:outline-none focus-visible:shadow-hb-ring',
      active
        ? 'border-hb-blue/40 bg-hb-blue/10 text-hb-blue'
        : 'border-hb-border bg-hb-surface text-hb-muted hover:border-hb-border-strong hover:text-hb-text'
    )

  const footer =
    screen === 'compose' ? (
      <>
        <p className="mr-auto max-w-[46ch] text-hb-xs text-hb-muted">
          Next, we'll copy this post and open LinkedIn so you can review and publish it yourself.
        </p>
        <Button
          size="lg"
          onClick={() => setScreen('confirm')}
          disabled={!postText.trim()}
          icon={<LinkedInGlyph size={17} />}
          trailingIcon={<ArrowRight size={16} />}
        >
          Review &amp; post to LinkedIn
        </Button>
      </>
    ) : screen === 'confirm' ? (
      <>
        <Button variant="ghost" icon={<ArrowLeft size={15} />} onClick={() => setScreen('compose')}>
          Edit post
        </Button>
        {/* The tooltip lives on the wrapper because a disabled Button is
            `pointer-events-none` — on the button itself it can never be seen,
            and it is the only thing explaining why publishing is unavailable. */}
        <span
          className="inline-flex"
          title={!isConnected ? 'Connect LinkedIn first' : undefined}
        >
          <Button
            onClick={handlePublish}
            loading={isPosting}
            disabled={!isConnected}
            icon={<LinkedInGlyph size={16} />}
          >
            {isPosting ? 'Preparing…' : 'Copy & open LinkedIn'}
          </Button>
        </span>
      </>
    ) : (
      <>
        <a
          href={LINKEDIN_COMPOSE_URL}
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
        <Button
          variant="ghost"
          icon={<RefreshCw size={14} />}
          onClick={() => { setScreen('compose'); setPostText(''); setHashtags([]); setReadySummary(null) }}
        >
          Post another
        </Button>
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
      description={`${job.title} — AI-powered post`}
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

          {/* Left — post content */}
          <div className="space-y-hb-4">
            <div className="flex flex-wrap items-center gap-hb-3">
              <span id={toneLabelId} className="font-mono text-hb-label uppercase text-hb-dim">
                Tone
              </span>
              <div role="group" aria-labelledby={toneLabelId} className="flex flex-wrap gap-1.5">
                {TONES.map(t => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={selectedTone === t}
                    onClick={() => setSelectedTone(t)}
                    className={clsx(segChip(selectedTone === t), 'capitalize')}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex-1" />
              <Button
                size="sm"
                onClick={handleGenerate}
                loading={isGenerating}
                icon={<Sparkles size={14} />}
              >
                {isGenerating ? 'Generating…' : 'Generate with AI'}
              </Button>
            </div>

            {isGenerating ? (
              <div className="grid gap-2">
                <Label>Post content</Label>
                <div className="min-h-[200px] rounded-hb-sm border border-hb-border bg-hb-surface p-hb-3">
                  <SkeletonText lines={6} />
                </div>
              </div>
            ) : (
              <Textarea
                label="Post content"
                value={postText}
                onChange={e => setPostText(e.target.value)}
                placeholder="Click 'Generate with AI' to create your LinkedIn post, or write your own…"
                rows={9}
                className="min-h-[200px] text-hb-sm"
              />
            )}

            <p
              className={clsx(
                'text-right font-mono text-hb-micro',
                charCount > charLimit * 0.9 ? 'text-hb-error' : 'text-hb-dim'
              )}
            >
              {charCount} / {charLimit}
            </p>

            <TagInput
              label="Hashtags"
              value={hashtags}
              onChange={handleTagsChange}
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

          {/* Right — visual */}
          <div className="space-y-hb-3">
            {/* Deliberately a pressed-chip group rather than `Tabs`: picking
                "AI Image" fires a paid image generation, and a tablist activates
                on arrow-key traversal — so merely tabbing past it would spend a
                generation. This selects a value, it does not switch views. */}
            <div className="flex flex-wrap items-center gap-hb-3">
              <span id={visualLabelId} className="font-mono text-hb-label uppercase text-hb-dim">
                Visual style
              </span>
              <div role="group" aria-labelledby={visualLabelId} className="flex flex-wrap gap-1.5">
                {IMAGE_TYPES.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    aria-pressed={imageType === t.value}
                    onClick={() => {
                      setImageType(t.value)
                      if (t.value === 'ai' && !aiImageUrl && !isGeneratingImage) handleGenerateImagePrompt()
                    }}
                    className={segChip(imageType === t.value)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {imageType === 'ai' && (
              <div className="space-y-hb-3">
                <Textarea
                  label="AI image prompt"
                  value={imagePrompt}
                  onChange={e => setImagePrompt(e.target.value)}
                  placeholder="Prompt for AI image generation…"
                  rows={3}
                  className="min-h-[76px] text-hb-xs"
                />
                <div className="flex flex-wrap gap-hb-2">
                  <Button
                    size="sm"
                    variant="quiet"
                    icon={<RefreshCw size={13} />}
                    loading={isGeneratingImage}
                    onClick={handleGenerateImagePrompt}
                  >
                    {isGeneratingImage ? 'Generating…' : 'Redraft prompt'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!imagePrompt || isGeneratingImage}
                    loading={isGeneratingImage}
                    onClick={handleRefreshImage}
                  >
                    Generate new visual
                  </Button>
                </div>
              </div>
            )}

            {imageType === 'card' && (
              <div className="flex flex-wrap items-center justify-between gap-hb-2">
                <span className="font-mono text-hb-label uppercase text-hb-dim">Card theme</span>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Palette size={14} />}
                  onClick={() => setImageVariant(v => (v + 1) % CARD_THEMES.length)}
                >
                  Change variant
                </Button>
              </div>
            )}

            {imageType !== 'none' && (
              <>
                {imageType === 'card' ? (
                  imageUrl ? (
                    <div className="overflow-hidden rounded-hb-md border border-hb-border shadow-hb-2">
                      <img src={imageUrl} alt={`Job card banner for ${job.title}`} className="block w-full" />
                    </div>
                  ) : (
                    <div className="grid aspect-[1200/628] place-items-center rounded-hb-md border border-dashed border-hb-border bg-hb-surface-2 text-hb-sm text-hb-muted">
                      Generating card…
                    </div>
                  )
                ) : (
                  <div className="relative overflow-hidden rounded-hb-md border border-hb-border shadow-hb-2">
                    {aiImageUrl ? (
                      <img
                        src={aiImageUrl}
                        alt="AI-generated banner"
                        className="block w-full"
                        onError={() => {
                          setImageType('card')
                          toast.error('AI Image service unreachable. Falling back to Job Card.')
                        }}
                      />
                    ) : (
                      <div className="grid aspect-[1200/628] place-items-center bg-hb-surface-2 px-hb-4 text-center text-hb-sm text-hb-muted">
                        {isGeneratingImage ? 'Generating image…' : 'Click "Generate new visual"'}
                      </div>
                    )}
                    {isGeneratingImage && (
                      <div
                        role="status"
                        className="absolute inset-0 grid place-items-center bg-hb-elevated/70 text-hb-sm font-semibold text-hb-text backdrop-blur-sm"
                      >
                        Creating magic…
                      </div>
                    )}
                  </div>
                )}
                <p className="text-center text-hb-xs text-hb-muted">
                  This banner will be automatically attached to your LinkedIn post.
                </p>
              </>
            )}

            {imageType === 'none' && (
              <div className="rounded-hb-md border border-dashed border-hb-border bg-hb-surface-2">
                <EmptyState
                  icon={<FileText />}
                  title="Text only mode"
                  description="Nothing will be attached to the post."
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SCREEN: CONFIRM ───────────────────────────────────────────────── */}
      {screen === 'confirm' && (
        <div className="space-y-hb-5">
          {!isConnected && !isCheckingConn && (
            <Card padding="loose" className="flex flex-col items-center text-center">
              <IconTile size="lg"><Link2 /></IconTile>
              <h3 className="mt-hb-3 font-display text-hb-h3 text-hb-text">
                Connect your LinkedIn account
              </h3>
              <p className="mt-hb-2 max-w-[46ch] text-hb-sm text-hb-muted">
                Connect your LinkedIn account once to post job openings.
                Click below — it opens a small popup.
              </p>
              <Button
                className="mt-hb-4"
                onClick={handleConnectLinkedIn}
                loading={isConnecting}
                icon={<LinkedInGlyph size={16} />}
              >
                {isConnecting ? 'Connecting…' : 'Connect LinkedIn'}
              </Button>
            </Card>
          )}

          <Card padding="loose">
            <p className="mb-hb-3 font-mono text-hb-label uppercase text-hb-dim">Post preview</p>

            {/* The post as LinkedIn will render it. */}
            <div className="overflow-hidden rounded-hb-sm border border-hb-border bg-hb-surface-2">
              <div className="flex items-center gap-hb-3 border-b border-hb-border px-hb-4 py-hb-3">
                <Avatar name="Recruiter" size="md" />
                <div className="min-w-0">
                  <p className="text-hb-sm font-semibold text-hb-text">Recruiter</p>
                  <p className="text-hb-xs text-hb-muted">Your Company · Just now</p>
                </div>
              </div>

              <div className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words px-hb-4 py-hb-3 text-hb-sm text-hb-text">
                {postText}
                {hashtags.length > 0 && (
                  <p className="mt-hb-2 font-semibold text-hb-blue">{hashtags.join(' ')}</p>
                )}
              </div>

              {finalImage && (
                <img src={finalImage} alt="Post banner" className="block max-h-60 w-full object-cover" />
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ── SCREEN: SUCCESS ───────────────────────────────────────────────── */}
      {screen === 'success' && (
        <div className="flex flex-col items-center py-hb-10 text-center">
          <IconTile size="lg" className="text-hb-success"><CheckCircle2 /></IconTile>
          <h3 className="mt-hb-4 font-display text-hb-h2 text-hb-text">Ready to post on LinkedIn</h3>
          <p className="mt-hb-2 max-w-[46ch] text-hb-sm text-hb-muted">
            LinkedIn's post composer has opened in a new tab.
          </p>
          <ol className="mt-hb-4 max-w-[46ch] list-decimal space-y-1.5 pl-5 text-left text-hb-sm text-hb-text">
            <li>Your post text has been copied to the clipboard.</li>
            {readySummary?.imageIncluded && (
              <li>
                The banner image has been downloaded{readySummary.imageCopied ? ' and copied' : ''} — attach it to the post on LinkedIn.
              </li>
            )}
            <li>Switch to the LinkedIn tab, press Ctrl/Cmd+V to paste the text, then review and publish.</li>
          </ol>
        </div>
      )}
    </Dialog>
  )
}
