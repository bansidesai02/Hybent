import { useState, useEffect, useCallback } from 'react'
import { ArrowRight, CheckCircle2, Loader2, Unlink, ExternalLink, RefreshCw } from 'lucide-react'
import { GlassIcon } from '@/components/common/GlassIcon'
import { motion, AnimatePresence } from 'framer-motion'
import { Modal } from '@/components/ui/Modal'
import { aiApi } from '@/api/ai'
import { linkedinApi } from '@/api/linkedin'
import type { Job } from '@/types'
import toast from 'react-hot-toast'

// ─── Canvas Image Generator ────────────────────────────────────────────────────

const JOB_TYPE_LABEL: Record<string, string> = {
  full_time: 'Full-time', part_time: 'Part-time',
  contract: 'Contract', internship: 'Internship', freelance: 'Freelance',
}

function generateJobCardImage(job: Job, variant: number = 0): string {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 628
  const ctx = canvas.getContext('2d')!

  const gradients = [
    ['#0f0c29', '#302b63', '#24243e'],
    ['#1a1a2e', '#16213e', '#0f3460'],
    ['#13001e', '#3d0066', '#6c0096'],
    ['#0a0a0a', '#1a1a3e', '#2d1b69'],
  ]
  const [c1, c2, c3] = gradients[variant % gradients.length]
  const bg = ctx.createLinearGradient(0, 0, 1200, 628)
  bg.addColorStop(0, c1); bg.addColorStop(0.5, c2); bg.addColorStop(1, c3)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, 1200, 628)

  const drawCircle = (x: number, y: number, r: number, color: string, alpha: number) => {
    ctx.save(); ctx.globalAlpha = alpha; ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); ctx.restore()
  }
  drawCircle(1050, 100, 200, '#a78bfa', 0.15)
  drawCircle(200,  500, 150, '#0077b5', 0.12)
  drawCircle(900,  500, 120, '#9b59b6', 0.10)

  const accentGrad = ctx.createLinearGradient(0, 0, 1200, 0)
  accentGrad.addColorStop(0, '#a78bfa'); accentGrad.addColorStop(1, '#0077b5')
  ctx.fillStyle = accentGrad; ctx.fillRect(0, 0, 1200, 6)

  ctx.fillStyle = '#0077b5'; roundRect(ctx, 60, 40, 130, 44, 8)
  ctx.fillStyle = '#fff'; ctx.font = 'bold 20px Arial, sans-serif'; ctx.fillText('in LinkedIn', 80, 67)

  ctx.fillStyle = 'rgba(167,139,250,0.85)'; roundRect(ctx, 60, 110, 240, 48, 10)
  ctx.fillStyle = '#fff'; ctx.font = 'bold 22px Arial, sans-serif'; ctx.fillText('🚀  WE\'RE HIRING!', 80, 141)

  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 62px Georgia, serif'
  const titleLines = wrapText(ctx, job.title, 860)
  titleLines.slice(0, 2).forEach((line, i) => { ctx.fillText(line, 60, 250 + i * 74) })

  const divGrad = ctx.createLinearGradient(60, 0, 600, 0)
  divGrad.addColorStop(0, '#a78bfa'); divGrad.addColorStop(1, 'transparent')
  ctx.fillStyle = divGrad; ctx.fillRect(60, 340, 500, 3)

  const chips = [job.location || 'Remote', JOB_TYPE_LABEL[job.job_type] || job.job_type, job.experience_level || ''].filter(Boolean)
  let chipX = 60
  chips.forEach((chip) => {
    ctx.font = '16px Arial, sans-serif'
    const w = ctx.measureText(chip).width + 28
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; roundRect(ctx, chipX, 360, w, 36, 18)
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = 'bold 16px Arial, sans-serif'; ctx.fillText(chip, chipX + 14, 383)
    chipX += w + 12
  })

  if (job.skills_required?.length) {
    const skills = job.skills_required.slice(0, 5)
    let skillX = 60
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '14px Arial, sans-serif'; ctx.fillText('SKILLS:', 60, 430)
    skillX = 130
    skills.forEach((skill) => {
      ctx.font = '14px Arial, sans-serif'
      const w = ctx.measureText(skill).width + 22
      if (skillX + w > 1100) return
      ctx.fillStyle = 'rgba(167,139,250,0.5)'; roundRect(ctx, skillX, 415, w, 28, 14)
      ctx.fillStyle = '#d4b4ff'; ctx.font = 'bold 14px Arial, sans-serif'; ctx.fillText(skill, skillX + 11, 433)
      skillX += w + 10
    })
  }

  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 550, 1200, 78)

  const brandGrad = ctx.createLinearGradient(60, 0, 300, 0)
  brandGrad.addColorStop(0, '#a78bfa'); brandGrad.addColorStop(1, '#0077b5')
  ctx.fillStyle = brandGrad; ctx.font = 'bold 28px Georgia, serif'; ctx.fillText('Hybent Hiring', 60, 596)
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '18px Arial, sans-serif'; ctx.fillText('AI-Powered Recruitment Platform', 170, 596)
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '16px Arial, sans-serif'
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

// ─── Component ─────────────────────────────────────────────────────────────────

interface LinkedInShareModalProps {
  job: Job | null
  onClose: () => void
}

type Screen = 'compose' | 'confirm' | 'success'

export function LinkedInShareModal({ job, onClose }: LinkedInShareModalProps) {
  // ── Screen machine ──────────────────────────────────────────────────────────
  const [screen, setScreen] = useState<Screen>('compose')

  // ── LinkedIn connection ─────────────────────────────────────────────────────
  const [isConnected, setIsConnected] = useState<boolean | null>(null)
  const [isCheckingConn, setIsCheckingConn] = useState(true)
  const [isConnecting, setIsConnecting] = useState(false)

  // ── Compose state ───────────────────────────────────────────────────────────
  const [isGenerating, setIsGenerating] = useState(false)
  const [postText, setPostText] = useState('')
  const [hashtags, setHashtags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [imageUrl, setImageUrl] = useState<string>('')
  const [imageVariant, setImageVariant] = useState(0)
  const [imageType, setImageType] = useState<'card' | 'ai' | 'none'>('card')
  const [imagePrompt, setImagePrompt] = useState('')
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [aiImageUrl, setAiImageUrl] = useState('')
  const [selectedTone, setSelectedTone] = useState<'professional' | 'modern' | 'creative' | 'casual' | 'minimalist'>('professional')

  // ── Post state ──────────────────────────────────────────────────────────────
  const [isPosting, setIsPosting] = useState(false)
  const [postResult, setPostResult] = useState<{ post_id: string; post_url: string } | null>(null)

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
      setPostResult(null)
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
          toast.success('LinkedIn connected! You can now post directly.')
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
    try {
      await linkedinApi.disconnect()
      setIsConnected(false)
      toast.success('LinkedIn disconnected.')
    } catch {
      toast.error('Failed to disconnect.')
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
        description: job.description, tone: selectedTone,
      })
      const data = r.data ?? r
      if (data?.post_content) setPostText(data.post_content)
      if (data?.hashtags?.length) setHashtags(data.hashtags)
      toast.success('AI post generated!')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'AI generation failed.')
    } finally { setIsGenerating(false) }
  }, [job, selectedTone])

  const handleAddTag = () => {
    const tag = newTag.trim().startsWith('#') ? newTag.trim() : `#${newTag.trim()}`
    if (newTag.trim() && !hashtags.includes(tag)) setHashtags(prev => [...prev, tag])
    setNewTag('')
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

  // ── Publish ─────────────────────────────────────────────────────────────────
  const handlePublish = async () => {
    setIsPosting(true)
    try {
      const fullText = postText.trim() + (hashtags.length ? '\n\n' + hashtags.join(' ') : '')
      const finalImage = imageType === 'ai' ? aiImageUrl : (imageType === 'card' ? imageUrl : undefined)

      const r: any = await linkedinApi.post({ text: fullText, image_base64: finalImage })
      const result = r?.data ?? r
      setPostResult(result)
      setScreen('success')
      toast.success('Posted to LinkedIn! 🎉')
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.detail || 'Failed to post.'
      if (err?.response?.status === 401) {
        setIsConnected(false)
        setScreen('confirm')
        toast.error('LinkedIn session expired. Please reconnect.')
      } else {
        toast.error(msg)
      }
    } finally { setIsPosting(false) }
  }

  const charCount = postText.length + (hashtags.length ? 2 + hashtags.join(' ').length : 0)
  const charLimit = 3000
  const finalImage = imageType === 'ai' ? aiImageUrl : (imageType === 'card' ? imageUrl : '')

  if (!job) return null

  // ── Connection badge ─────────────────────────────────────────────────────────
  const ConnectionBadge = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {isCheckingConn ? (
        <span style={{ fontSize: 11, color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Checking…
        </span>
      ) : isConnected ? (
        <>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#16a34a', background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.25)', borderRadius: 20, padding: '2px 8px' }}>
            <CheckCircle2 size={10} /> LinkedIn Connected
          </span>
          <button onClick={handleDisconnect} style={{ background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3, padding: 0 }}>
            <Unlink size={10} /> Disconnect
          </button>
        </>
      ) : (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#d97706', background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.25)', borderRadius: 20, padding: '2px 8px' }}>
          Not connected
        </span>
      )}
    </div>
  )

  return (
    <Modal open={!!job} onClose={onClose} title="" size="xl" hideScrollbar>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minHeight: 500 }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24, paddingBottom: 18, borderBottom: '1px solid var(--table-border)' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#0077b5', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,119,181,0.35)', flexShrink: 0 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 2 }}>Share on LinkedIn</h2>
            <p style={{ fontSize: 13, color: 'var(--text-light)' }}>{job.title} — AI-powered post</p>
          </div>
          <ConnectionBadge />
        </div>

        {/* ── SCREEN: COMPOSE ─────────────────────────────────────────────── */}
        {screen === 'compose' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

            {/* Left — Post Content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Generate button + tone */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Post Content</label>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: isGenerating ? 'rgba(167,139,250,0.4)' : 'linear-gradient(135deg, var(--violet), var(--brand2, #6c47ff))', color: '#fff', fontSize: 12, fontWeight: 700, boxShadow: '0 4px 12px rgba(167, 139, 250, 0.30)', transition: 'all 0.2s' }}
                >
                  {isGenerating ? <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>✦</span> Generating...</> : <><GlassIcon icon="Sparkles" variant="violet" size={16} iconSize={10} glow={false} /> Generate with AI</>}
                </button>
              </div>

              {/* Tone */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(['professional', 'modern', 'creative', 'casual', 'minimalist'] as const).map(t => (
                  <button key={t} onClick={() => setSelectedTone(t)} style={{ padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, textTransform: 'capitalize', cursor: 'pointer', border: '1px solid var(--table-border)', background: selectedTone === t ? 'rgba(167,139,250,0.12)' : 'transparent', color: selectedTone === t ? 'var(--violet)' : 'var(--text-light)', borderColor: selectedTone === t ? 'var(--violet)' : 'var(--table-border)', transition: 'all 0.2s' }}>{t}</button>
                ))}
              </div>

              {/* Textarea / skeleton */}
              {isGenerating ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[100, 80, 90, 70, 85].map((w, i) => (
                    <div key={i} style={{ height: 14, borderRadius: 6, background: 'linear-gradient(90deg, var(--card-bg) 25%, var(--kpi-bg) 50%, var(--card-bg) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite', width: `${w}%` }} />
                  ))}
                </div>
              ) : (
                <textarea
                  value={postText}
                  onChange={e => setPostText(e.target.value)}
                  placeholder="Click 'Generate with AI' to create your LinkedIn post, or write your own..."
                  style={{ width: '100%', minHeight: 200, padding: 14, borderRadius: 12, border: '1.5px solid var(--table-border)', outline: 'none', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 13, lineHeight: 1.7, resize: 'vertical', fontFamily: 'inherit', transition: 'border-color 0.2s' }}
                  onFocus={e => e.target.style.borderColor = 'var(--violet)'}
                  onBlur={e => e.target.style.borderColor = 'var(--table-border)'}
                />
              )}

              {/* Char count */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 11, color: charCount > charLimit * 0.9 ? '#ef4444' : 'var(--text-light)', fontWeight: 600 }}>
                {charCount} / {charLimit}
              </div>

              {/* Hashtags */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 10 }}>Hashtags</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  {hashtags.map((tag, i) => (
                    <motion.span key={tag} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: 'rgba(0,119,181,0.10)', color: '#0077b5', border: '1px solid rgba(0,119,181,0.25)', fontSize: 12, fontWeight: 700 }}>
                      {tag}
                      <button onClick={() => setHashtags(h => h.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 11, lineHeight: 1, padding: 0 }}>×</button>
                    </motion.span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())} placeholder="#addtag" style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1.5px solid var(--table-border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 13, outline: 'none' }} />
                  <button onClick={handleAddTag} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'rgba(0,119,181,0.12)', color: '#0077b5', fontWeight: 700, fontSize: 13 }}>+ Add</button>
                </div>
              </div>
            </div>

            {/* Right — Image Preview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Visual type toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Visual Style</label>
                <div style={{ display: 'flex', background: 'var(--kpi-bg)', padding: 3, borderRadius: 10 }}>
                  {(['card', 'ai', 'none'] as const).map(t => (
                    <button key={t} onClick={() => { setImageType(t); if (t === 'ai' && !aiImageUrl) handleGenerateImagePrompt() }}
                      style={{ padding: '4px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, background: imageType === t ? 'var(--card-bg)' : 'transparent', color: imageType === t ? 'var(--violet)' : 'var(--text-light)', boxShadow: imageType === t ? '0 2px 8px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}>
                      {t === 'card' ? 'Job Card' : t === 'ai' ? 'AI Image' : 'None'}
                    </button>
                  ))}
                </div>
              </div>

              {imageType === 'ai' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-light)' }}>AI Image Prompt</label>
                    <button onClick={handleGenerateImagePrompt} disabled={isGeneratingImage} style={{ background: 'none', border: 'none', color: 'var(--violet)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      {isGeneratingImage ? 'Generating...' : '↺ Redraft Prompt'}
                    </button>
                  </div>
                  <textarea value={imagePrompt} onChange={e => setImagePrompt(e.target.value)} placeholder="Prompt for AI image generation..." style={{ width: '100%', minHeight: 60, padding: 10, borderRadius: 10, border: '1px solid var(--table-border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 11, resize: 'none', outline: 'none' }} />
                  <button onClick={handleRefreshImage} style={{ padding: '8px', borderRadius: 10, border: '1px solid var(--violet)', background: 'rgba(167,139,250,0.05)', color: 'var(--violet)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    Generate New Visual
                  </button>
                </motion.div>
              )}

              {imageType === 'card' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-light)' }}>Card Theme</label>
                  <button onClick={() => setImageVariant(v => (v + 1) % 4)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--table-border)', background: 'var(--card-bg)', color: 'var(--text-mid)', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                    <GlassIcon icon="Palette" variant="violet" size={16} iconSize={10} glow={false} /> Change Variant
                  </button>
                </div>
              )}

              {/* Image preview */}
              {imageType !== 'none' && (
                <>
                  {imageType === 'card' ? (
                    imageUrl ? (
                      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--table-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
                        <img src={imageUrl} alt="Job card preview" style={{ width: '100%', display: 'block' }} />
                      </motion.div>
                    ) : (
                      <div style={{ borderRadius: 12, background: 'var(--kpi-bg)', aspectRatio: '1200/628', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--table-border)' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-light)' }}>Generating card...</span>
                      </div>
                    )
                  ) : (
                    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--table-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
                      {aiImageUrl ? (
                        <img src={aiImageUrl} alt="AI visual" style={{ width: '100%', display: 'block' }} onError={() => { setImageType('card'); toast.error('AI Image service unreachable. Falling back to Job Card.') }} />
                      ) : (
                        <div style={{ borderRadius: 12, background: 'var(--kpi-bg)', aspectRatio: '1200/628', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 13, color: 'var(--text-light)' }}>{isGeneratingImage ? 'Generating image...' : 'Click "Generate New Visual"'}</span>
                        </div>
                      )}
                      {isGeneratingImage && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                          <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>Creating Magic...</div>
                        </div>
                      )}
                    </div>
                  )}
                  <p style={{ fontSize: 11, color: 'var(--text-light)', textAlign: 'center', lineHeight: 1.5 }}>
                    This banner will be automatically attached to your LinkedIn post.
                  </p>
                </>
              )}

              {imageType === 'none' && (
                <div style={{ flex: 1, borderRadius: 12, background: 'var(--kpi-bg)', border: '1px dashed var(--table-border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, opacity: 0.7, minHeight: 120 }}>
                  <span style={{ fontSize: 24, opacity: 0.5 }}>📝</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-light)' }}>Text Only Mode</span>
                </div>
              )}

              {/* Next → Confirm */}
              <button
                onClick={() => setScreen('confirm')}
                disabled={!postText.trim()}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '14px 24px', borderRadius: 12, border: 'none', cursor: !postText.trim() ? 'not-allowed' : 'pointer', background: !postText.trim() ? 'rgba(0,119,181,0.35)' : '#0077b5', color: '#fff', fontSize: 15, fontWeight: 800, letterSpacing: '0.3px', boxShadow: postText.trim() ? '0 6px 20px rgba(0,119,181,0.40)' : 'none', transition: 'all 0.2s', marginTop: 4 }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                Review &amp; Post to LinkedIn
                <ArrowRight size={16} />
              </button>
              <p style={{ fontSize: 11, color: 'var(--text-light)', textAlign: 'center', marginTop: 0 }}>
                Your post will publish directly to your LinkedIn feed — no copy-paste needed.
              </p>
            </div>
          </div>
        )}

        {/* ── SCREEN: CONFIRM ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {screen === 'confirm' && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* Connect LinkedIn CTA (when not connected) */}
              {!isConnected && !isCheckingConn && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: 20, borderRadius: 14, background: 'linear-gradient(135deg, rgba(251,191,36,0.07), rgba(217,119,6,0.05))', border: '1px solid rgba(251,191,36,0.30)', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', textAlign: 'center' }}>
                  <div style={{ fontSize: 36 }}>🔗</div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Connect your LinkedIn account</div>
                    <div style={{ fontSize: 13, color: 'var(--text-light)', maxWidth: 380 }}>
                      To publish directly to LinkedIn you need to authorise Hybent Hiring once. Click below — it opens a small popup.
                    </div>
                  </div>
                  <button
                    onClick={handleConnectLinkedIn}
                    disabled={isConnecting}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 12, border: 'none', background: '#0077b5', color: '#fff', fontSize: 14, fontWeight: 800, cursor: isConnecting ? 'wait' : 'pointer', boxShadow: '0 6px 20px rgba(0,119,181,0.4)', transition: 'all 0.2s' }}
                  >
                    {isConnecting ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Connecting…</> : <><svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> Connect LinkedIn</>}
                  </button>
                </motion.div>
              )}

              {/* Post Preview */}
              <div style={{ padding: 20, borderRadius: 14, background: 'var(--card-bg)', border: '1px solid var(--table-border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 12 }}>Post Preview</div>

                {/* Fake LinkedIn post card */}
                <div style={{ borderRadius: 12, border: '1px solid var(--table-border)', overflow: 'hidden', background: 'var(--kpi-bg)' }}>
                  {/* Profile row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--table-border)' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, var(--violet), #0077b5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16 }}>R</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Recruiter</div>
                      <div style={{ fontSize: 11, color: 'var(--text-light)' }}>Your Company · Just now</div>
                    </div>
                  </div>
                  {/* Post text */}
                  <div style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 160, overflowY: 'auto' }}>
                    {postText}
                    {hashtags.length > 0 && <div style={{ marginTop: 8, color: '#0077b5', fontWeight: 600 }}>{hashtags.join(' ')}</div>}
                  </div>
                  {/* Image preview */}
                  {finalImage && (
                    <img src={finalImage} alt="Post banner" style={{ width: '100%', display: 'block', maxHeight: 240, objectFit: 'cover' }} />
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', alignItems: 'center' }}>
                <button onClick={() => setScreen('compose')} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid var(--table-border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  ← Edit Post
                </button>
                <button
                  onClick={handlePublish}
                  disabled={isPosting || !isConnected}
                  title={!isConnected ? 'Connect LinkedIn first' : undefined}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 12, border: 'none', background: (!isConnected || isPosting) ? 'rgba(0,119,181,0.4)' : '#0077b5', color: '#fff', fontSize: 14, fontWeight: 800, cursor: (!isConnected || isPosting) ? 'not-allowed' : 'pointer', boxShadow: isConnected && !isPosting ? '0 6px 20px rgba(0,119,181,0.40)' : 'none', transition: 'all 0.2s', minWidth: 160 }}
                >
                  {isPosting ? (
                    <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Publishing…</>
                  ) : (
                    <><svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> Publish to LinkedIn</>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── SCREEN: SUCCESS ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {screen === 'success' && (
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '40px 20px', textAlign: 'center' }}>
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.1 }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(22,163,74,0.15), rgba(22,163,74,0.08))', border: '2px solid rgba(22,163,74,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                  <CheckCircle2 size={40} color="#16a34a" />
                </div>
              </motion.div>

              <div>
                <h3 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)', marginBottom: 8 }}>Posted to LinkedIn! 🎉</h3>
                <p style={{ fontSize: 14, color: 'var(--text-light)', maxWidth: 380, margin: '0 auto', lineHeight: 1.6 }}>
                  Your job post is now live on LinkedIn. It may take a few seconds to appear in your feed.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                {postResult?.post_url && (
                  <a href={postResult.post_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 12, background: '#0077b5', color: '#fff', fontWeight: 800, fontSize: 14, textDecoration: 'none', boxShadow: '0 6px 20px rgba(0,119,181,0.4)', transition: 'opacity 0.2s' }}>
                    <ExternalLink size={16} /> View Post on LinkedIn
                  </a>
                )}
                <button onClick={() => { setScreen('compose'); setPostText(''); setHashtags([]); setPostResult(null) }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '12px 20px', borderRadius: 12, border: '1px solid var(--table-border)', background: 'var(--card-bg)', color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  <RefreshCw size={14} /> Post Another
                </button>
                <button onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '12px 20px', borderRadius: 12, border: '1px solid var(--table-border)', background: 'var(--card-bg)', color: 'var(--text-light)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  Close
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      <style>{`
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </Modal>
  )
}
