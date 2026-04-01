import { useState, useEffect, useRef, useCallback } from 'react'
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

  // Background gradients
  const gradients = [
    ['#0f0c29', '#302b63', '#24243e'],
    ['#1a1a2e', '#16213e', '#0f3460'],
    ['#13001e', '#3d0066', '#6c0096'],
    ['#0a0a0a', '#1a1a3e', '#2d1b69'],
  ]
  const [c1, c2, c3] = gradients[variant % gradients.length]
  const bg = ctx.createLinearGradient(0, 0, 1200, 628)
  bg.addColorStop(0, c1)
  bg.addColorStop(0.5, c2)
  bg.addColorStop(1, c3)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, 1200, 628)

  // Decorative circles
  const drawCircle = (x: number, y: number, r: number, color: string, alpha: number) => {
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    ctx.restore()
  }
  drawCircle(1050, 100, 200, '#6c47ff', 0.15)
  drawCircle(200, 500, 150, '#0077b5', 0.12)
  drawCircle(900, 500, 120, '#9b59b6', 0.10)

  // Top accent bar
  const accentGrad = ctx.createLinearGradient(0, 0, 1200, 0)
  accentGrad.addColorStop(0, '#6c47ff')
  accentGrad.addColorStop(1, '#0077b5')
  ctx.fillStyle = accentGrad
  ctx.fillRect(0, 0, 1200, 6)

  // LinkedIn logo area (top-left badge)
  ctx.fillStyle = '#0077b5'
  roundRect(ctx, 60, 40, 130, 44, 8)
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 20px Arial, sans-serif'
  ctx.fillText('in LinkedIn', 80, 67)

  // "WE'RE HIRING" badge
  ctx.fillStyle = 'rgba(108,71,255,0.85)'
  roundRect(ctx, 60, 110, 240, 48, 10)
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 22px Arial, sans-serif'
  ctx.fillText('🚀  WE\'RE HIRING!', 80, 141)

  // Job title
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 62px Georgia, serif'
  const titleLines = wrapText(ctx, job.title, 860)
  titleLines.slice(0, 2).forEach((line, i) => {
    ctx.fillText(line, 60, 250 + i * 74)
  })

  // Divider
  const divGrad = ctx.createLinearGradient(60, 0, 600, 0)
  divGrad.addColorStop(0, '#6c47ff')
  divGrad.addColorStop(1, 'transparent')
  ctx.fillStyle = divGrad
  ctx.fillRect(60, 340, 500, 3)

  // Job meta chips
  const chips = [
    job.location || 'Remote',
    JOB_TYPE_LABEL[job.job_type] || job.job_type,
    job.experience_level || '',
  ].filter(Boolean)

  let chipX = 60
  chips.forEach((chip) => {
    ctx.font = '16px Arial, sans-serif'
    const w = ctx.measureText(chip).width + 28
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    roundRect(ctx, chipX, 360, w, 36, 18)
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.font = 'bold 16px Arial, sans-serif'
    ctx.fillText(chip, chipX + 14, 383)
    chipX += w + 12
  })

  // Skills
  if (job.skills_required?.length) {
    const skills = job.skills_required.slice(0, 5)
    let skillX = 60
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = '14px Arial, sans-serif'
    ctx.fillText('SKILLS:', 60, 430)
    skillX = 130

    skills.forEach((skill) => {
      ctx.font = '14px Arial, sans-serif'
      const w = ctx.measureText(skill).width + 22
      if (skillX + w > 1100) return
      ctx.fillStyle = 'rgba(108,71,255,0.5)'
      roundRect(ctx, skillX, 415, w, 28, 14)
      ctx.fillStyle = '#d4b4ff'
      ctx.font = 'bold 14px Arial, sans-serif'
      ctx.fillText(skill, skillX + 11, 433)
      skillX += w + 10
    })
  }

  // Bottom branding bar
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.fillRect(0, 550, 1200, 78)

  // HireOn branding
  const brandGrad = ctx.createLinearGradient(60, 0, 300, 0)
  brandGrad.addColorStop(0, '#6c47ff')
  brandGrad.addColorStop(1, '#0077b5')
  ctx.fillStyle = brandGrad
  ctx.font = 'bold 28px Georgia, serif'
  ctx.fillText('HireOn', 60, 596)

  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.font = '18px Arial, sans-serif'
  ctx.fillText('AI-Powered Recruitment Platform', 170, 596)

  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '16px Arial, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('Apply now → gethireon.netlify.app', 1140, 596)
  ctx.textAlign = 'left'

  return canvas.toDataURL('image/png')
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
  ctx.fill()
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface LinkedInShareModalProps {
  job: Job | null
  onClose: () => void
}

export function LinkedInShareModal({ job, onClose }: LinkedInShareModalProps) {
  const [isConnected, setIsConnected] = useState<boolean | null>(null)
  const [isCheckingStatus, setIsCheckingStatus] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  const [postText, setPostText] = useState('')
  const [hashtags, setHashtags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [imageUrl, setImageUrl] = useState<string>('')
  const [imageVariant, setImageVariant] = useState(0)
  const [postUrl, setPostUrl] = useState('')
  const [imageType, setImageType] = useState<'card' | 'ai' | 'none'>('card')
  const [imagePrompt, setImagePrompt] = useState('')
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [aiImageUrl, setAiImageUrl] = useState('')
  const [selectedTone, setSelectedTone] = useState<'professional' | 'modern' | 'creative' | 'casual' | 'minimalist'>('professional')
  const popupRef = useRef<Window | null>(null)

  // Generate image when job changes or variant changes
  useEffect(() => {
    if (job) {
      setImageUrl(generateJobCardImage(job, imageVariant))
    }
  }, [job, imageVariant])

  // Check LinkedIn connection status
  useEffect(() => {
    if (!job) return
    setIsCheckingStatus(true)
    linkedinApi.getStatus()
      .then((r: any) => setIsConnected(r.data?.connected ?? false))
      .catch(() => setIsConnected(false))
      .finally(() => setIsCheckingStatus(false))
  }, [job])

  // Listen for popup postMessage
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data === 'linkedin_connected') {
        popupRef.current?.close()
        setIsConnected(true)
        toast.success('LinkedIn connected!')
      } else if (e.data === 'linkedin_error') {
        popupRef.current?.close()
        toast.error('LinkedIn connection failed. Please try again.')
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const handleConnect = useCallback(async () => {
    try {
      const r: any = await linkedinApi.getAuthUrl()
      const authUrl = r.data?.auth_url
      if (!authUrl) { toast.error('Could not get auth URL.'); return }
      const popup = window.open(authUrl, 'linkedin_oauth', 'width=600,height=650,left=300,top=100')
      popupRef.current = popup
    } catch {
      toast.error('Failed to initiate LinkedIn auth.')
    }
  }, [])

  const handleGenerate = useCallback(async () => {
    if (!job) return
    setIsGenerating(true)
    try {
      const r: any = await aiApi.generateLinkedInPost({
        title: job.title,
        location: job.location,
        job_type: job.job_type,
        experience_level: job.experience_level,
        skills_required: job.skills_required,
        description: job.description,
        tone: selectedTone,
      })
      const data = r.data
      if (data?.post_content) setPostText(data.post_content)
      if (data?.hashtags?.length) setHashtags(data.hashtags)
      toast.success('AI post generated!')
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.detail || 'AI generation failed. Please try again.'
      toast.error(msg)
    } finally {
      setIsGenerating(false)
    }
  }, [job])

  const handleAddTag = () => {
    const tag = newTag.trim().startsWith('#') ? newTag.trim() : `#${newTag.trim()}`
    if (newTag.trim() && !hashtags.includes(tag)) {
      setHashtags(prev => [...prev, tag])
    }
    setNewTag('')
  }

  const handleGenerateImagePrompt = useCallback(async () => {
    if (!job) return
    setIsGeneratingImage(true)
    try {
      const r: any = await aiApi.generateImagePrompt({ 
        title: job.title, 
        description: job.description 
      })
      if (r.data?.prompt) {
        setImagePrompt(r.data.prompt)
        setImageType('ai')
        // Automatically generate the first image from the prompt
        const imgR: any = await aiApi.generateImage(r.data.prompt)
        if (imgR.data?.image_base64) {
          setAiImageUrl(imgR.data.image_base64)
        }
      }
      toast.success('AI Image generated via Hugging Face!')
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.detail || 'Failed to generate AI image.'
      toast.error(msg)
    } finally {
      setIsGeneratingImage(false)
    }
  }, [job])

  const handleRefreshImage = async () => {
    if (!imagePrompt) return
    setIsGeneratingImage(true)
    try {
      const imgR: any = await aiApi.generateImage(imagePrompt)
      if (imgR.data?.image_base64) {
        setAiImageUrl(imgR.data.image_base64)
        toast.success('Visual refreshed!')
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.detail || 'Failed to refresh image.'
      toast.error(msg)
    } finally {
      setIsGeneratingImage(false)
    }
  }

  const handlePost = async () => {
    if (!postText.trim()) { toast.error('Post content cannot be empty.'); return }
    setIsPosting(true)
    try {
      const fullText = postText + '\n\n' + hashtags.join(' ')
      let finalImage: string | undefined = undefined
      
      if (imageType === 'card') {
        finalImage = imageUrl
      } else if (imageType === 'ai' && aiImageUrl) {
        finalImage = aiImageUrl
      }
      // If imageType === 'none', finalImage remains undefined

      const r: any = await linkedinApi.post({ post_text: fullText, image_base64: finalImage })
      const url = r.data?.post_url
      setPostUrl(url || 'https://www.linkedin.com/feed/')
      toast.success('Posted to LinkedIn! 🎉')
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Failed to post to LinkedIn.'
      if (detail.includes('token expired') || detail.includes('reconnect')) {
        setIsConnected(false)
      }
      toast.error(detail)
    } finally {
      setIsPosting(false)
    }
  }

  const charCount = postText.length + '\n\n'.length + hashtags.join(' ').length
  const charLimit = 3000

  if (!job) return null

  return (
    <Modal
      open={!!job}
      onClose={onClose}
      title=""
      size="xl"
      hideScrollbar
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minHeight: 500 }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24,
          paddingBottom: 18, borderBottom: '1px solid var(--table-border)'
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, background: '#0077b5',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,119,181,0.35)',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 2 }}>
              Share on LinkedIn
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-light)' }}>
              {job.title} — AI-powered post with image
            </p>
          </div>

          {/* Connection status */}
          {!isCheckingStatus && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              {isConnected ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700,
                  color: '#059669', background: 'rgba(16,185,129,0.10)',
                  border: '1px solid rgba(16,185,129,0.25)', padding: '5px 12px', borderRadius: 20,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                  Connected
                  <button
                    onClick={() => { linkedinApi.disconnect(); setIsConnected(false) }}
                    style={{ marginLeft: 4, opacity: 0.6, cursor: 'pointer', background: 'none', border: 'none', color: 'inherit', fontSize: 11 }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleConnect}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
                    background: '#0077b5', color: '#fff', border: 'none', borderRadius: 10,
                    cursor: 'pointer', fontSize: 13, fontWeight: 700,
                    boxShadow: '0 4px 14px rgba(0,119,181,0.35)',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  Connect LinkedIn
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Success State ── */}
        <AnimatePresence>
          {postUrl && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                padding: 28, borderRadius: 16, textAlign: 'center',
                background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(5,150,105,0.06))',
                border: '1px solid rgba(16,185,129,0.25)',
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: '#059669', marginBottom: 8 }}>
                Posted to LinkedIn!
              </h3>
              <p style={{ fontSize: 14, color: 'var(--text-mid)', marginBottom: 20 }}>
                Your job opening is now live on LinkedIn.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                <a
                  href={postUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '10px 22px', background: '#0077b5', color: '#fff',
                    borderRadius: 10, textDecoration: 'none', fontSize: 13, fontWeight: 700,
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}
                >
                  View Post →
                </a>
                <button
                  onClick={onClose}
                  style={{
                    padding: '10px 22px', background: 'var(--card-bg)',
                    border: '1px solid var(--card-border)', color: 'var(--text)',
                    borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                  }}
                >
                  Close
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!postUrl && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

            {/* ── Left — Post Content ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Generate button */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                  Post Content
                </label>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: isGenerating ? 'rgba(108,71,255,0.5)' : 'linear-gradient(135deg, #6c47ff, #8b6bff)',
                    color: '#fff', fontSize: 12, fontWeight: 700,
                    boxShadow: '0 4px 12px rgba(108,71,255,0.30)',
                    transition: 'all 0.2s',
                  }}
                >
                  {isGenerating ? (
                    <>
                      <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>✦</span>
                      Generating...
                    </>
                  ) : (
                    <>✨ Generate with AI</>
                  )}
                </button>
              </div>

              {/* Tone Selection */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(['professional', 'modern', 'creative', 'casual', 'minimalist'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setSelectedTone(t)}
                    style={{
                      padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                      textTransform: 'capitalize', cursor: 'pointer', border: '1px solid var(--table-border)',
                      background: selectedTone === t ? 'rgba(108,71,255,0.1)' : 'transparent',
                      color: selectedTone === t ? '#6c47ff' : 'var(--text-light)',
                      borderColor: selectedTone === t ? '#6c47ff' : 'var(--table-border)',
                      transition: 'all 0.2s'
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Textarea or loading skeleton */}
              {isGenerating ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[100, 80, 90, 70, 85].map((w, i) => (
                    <div key={i} style={{
                      height: 14, borderRadius: 6,
                      background: 'linear-gradient(90deg, var(--card-bg) 25%, var(--kpi-bg) 50%, var(--card-bg) 75%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.4s infinite',
                      width: `${w}%`,
                    }} />
                  ))}
                </div>
              ) : (
                <textarea
                  value={postText}
                  onChange={e => setPostText(e.target.value)}
                  placeholder="Click 'Generate with AI' to create your LinkedIn post, or write your own..."
                  style={{
                    width: '100%', minHeight: 200, padding: 14, borderRadius: 12,
                    border: '1.5px solid var(--table-border)', outline: 'none',
                    background: 'var(--card-bg)', color: 'var(--text)',
                    fontSize: 13, lineHeight: 1.7, resize: 'vertical',
                    fontFamily: 'inherit', transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.target.style.borderColor = '#6c47ff'}
                  onBlur={e => e.target.style.borderColor = 'var(--table-border)'}
                />
              )}

              {/* Character counter */}
              <div style={{
                display: 'flex', justifyContent: 'flex-end',
                fontSize: 11, color: charCount > charLimit * 0.9 ? '#ef4444' : 'var(--text-light)',
                fontWeight: 600,
              }}>
                {charCount} / {charLimit}
              </div>

              {/* Hashtags */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 10 }}>
                  Hashtags
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  {hashtags.map((tag, i) => (
                    <motion.span
                      key={tag}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '4px 10px', borderRadius: 20,
                        background: 'rgba(0,119,181,0.10)', color: '#0077b5',
                        border: '1px solid rgba(0,119,181,0.25)',
                        fontSize: 12, fontWeight: 700,
                      }}
                    >
                      {tag}
                      <button
                        onClick={() => setHashtags(h => h.filter((_, j) => j !== i))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 11, lineHeight: 1, padding: 0 }}
                      >
                        ×
                      </button>
                    </motion.span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={newTag}
                    onChange={e => setNewTag(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    placeholder="#addtag"
                    style={{
                      flex: 1, padding: '8px 12px', borderRadius: 8,
                      border: '1.5px solid var(--table-border)', background: 'var(--card-bg)',
                      color: 'var(--text)', fontSize: 13, outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleAddTag}
                    style={{
                      padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: 'rgba(0,119,181,0.12)', color: '#0077b5', fontWeight: 700, fontSize: 13,
                    }}
                  >
                    + Add
                  </button>
                </div>
              </div>
            </div>

            {/* ── Right — Image Preview ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                    Visual Style
                  </label>
                  <div style={{ display: 'flex', background: 'var(--kpi-bg)', padding: 3, borderRadius: 10 }}>
                    <button
                      onClick={() => setImageType('card')}
                      style={{
                        padding: '4px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                        fontSize: 11, fontWeight: 700,
                        background: imageType === 'card' ? 'var(--card-bg)' : 'transparent',
                        color: imageType === 'card' ? '#6c47ff' : 'var(--text-light)',
                        boxShadow: imageType === 'card' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                        transition: 'all 0.2s',
                      }}
                    >
                      Job Card
                    </button>
                    <button
                      onClick={() => {
                        setImageType('ai')
                        if (!aiImageUrl) handleGenerateImagePrompt()
                      }}
                      style={{
                        padding: '4px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                        fontSize: 11, fontWeight: 700,
                        background: imageType === 'ai' ? 'var(--card-bg)' : 'transparent',
                        color: imageType === 'ai' ? '#6c47ff' : 'var(--text-light)',
                        boxShadow: imageType === 'ai' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                        transition: 'all 0.2s',
                      }}
                    >
                      AI Image
                    </button>
                    <button
                      onClick={() => setImageType('none')}
                      style={{
                        padding: '4px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                        fontSize: 11, fontWeight: 700,
                        background: imageType === 'none' ? 'var(--card-bg)' : 'transparent',
                        color: imageType === 'none' ? '#6c47ff' : 'var(--text-light)',
                        boxShadow: imageType === 'none' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                        transition: 'all 0.2s',
                      }}
                    >
                      None
                    </button>
                  </div>
                </div>

                {imageType === 'ai' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-light)' }}>
                        AI Image Prompt
                      </label>
                      <button
                        onClick={handleGenerateImagePrompt}
                        disabled={isGeneratingImage}
                        style={{ background: 'none', border: 'none', color: '#6c47ff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                      >
                        {isGeneratingImage ? 'Generating...' : '↺ Redraft Prompt'}
                      </button>
                    </div>
                    <textarea
                      value={imagePrompt}
                      onChange={e => setImagePrompt(e.target.value)}
                      placeholder="Prompt for AI image generation..."
                      style={{
                        width: '100%', minHeight: 60, padding: 10, borderRadius: 10,
                        border: '1px solid var(--table-border)', background: 'var(--card-bg)',
                        color: 'var(--text)', fontSize: 11, resize: 'none', outline: 'none'
                      }}
                    />
                    <button
                      onClick={handleRefreshImage}
                      style={{
                        padding: '8px', borderRadius: 10, border: '1px solid #6c47ff',
                        background: 'rgba(108,71,255,0.05)', color: '#6c47ff',
                        fontSize: 11, fontWeight: 700, cursor: 'pointer'
                      }}
                    >
                      Generate New Visual
                    </button>
                  </motion.div>
                )}

                {imageType === 'card' && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-light)' }}>
                      Card Theme
                    </label>
                    <button
                      onClick={() => setImageVariant(v => (v + 1) % 4)}
                      style={{
                        padding: '6px 12px', borderRadius: 8, border: '1px solid var(--table-border)',
                        background: 'var(--card-bg)', color: 'var(--text-mid)',
                        cursor: 'pointer', fontSize: 11, fontWeight: 700,
                      }}
                    >
                      🎨 Change Variant
                    </button>
                  </div>
                )}
              </div>

              {imageType !== 'none' && (
                <>
                  {imageType === 'card' ? (
                    imageUrl ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={{
                          borderRadius: 12, overflow: 'hidden',
                          border: '1px solid var(--table-border)',
                          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                        }}
                      >
                        <img
                          src={imageUrl}
                          alt="Job card preview"
                          style={{ width: '100%', display: 'block' }}
                        />
                      </motion.div>
                    ) : (
                      <div style={{
                        borderRadius: 12, background: 'var(--kpi-bg)', aspectRatio: '1200/628',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '1px dashed var(--table-border)',
                      }}>
                        <span style={{ fontSize: 13, color: 'var(--text-light)' }}>Generating card...</span>
                      </div>
                    )
                  ) : (
                    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--table-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
                      {aiImageUrl ? (
                        <img
                          src={aiImageUrl}
                          alt="AI generated visual"
                          style={{ width: '100%', display: 'block' }}
                          onLoad={() => setIsGeneratingImage(false)}
                          onError={() => {
                            setImageType('card')
                            setIsGeneratingImage(false)
                            toast.error('AI Image service unreachable. Falling back to Job Card.')
                          }}
                        />
                      ) : (
                        <div style={{ borderRadius: 12, background: 'var(--kpi-bg)', aspectRatio: '1200/628', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 13, color: 'var(--text-light)' }}>
                            {isGeneratingImage ? 'Generating image...' : 'Click "Generate New Visual"'}
                          </span>
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
                    This card will be attached to your LinkedIn post. Click "Change Style" for different background variants.
                  </p>
                </>
              )}

              {imageType === 'none' && (
                <div style={{
                  flex: 1, borderRadius: 12, background: 'var(--kpi-bg)', border: '1px dashed var(--table-border)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, opacity: 0.7
                }}>
                  <div style={{ fontSize: 24, opacity: 0.5 }}>📝</div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-light)' }}>Text Only Mode</span>
                  <p style={{ fontSize: 11, color: 'var(--text-light)', textAlign: 'center', padding: '0 20px' }}>
                    No image will be attached to this post.
                  </p>
                </div>
              )}

              {/* Post button */}
              <button
                onClick={handlePost}
                disabled={isPosting || !isConnected || !postText.trim()}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  padding: '14px 24px', borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: (!isConnected || !postText.trim()) ? 'rgba(0,119,181,0.4)' : '#0077b5',
                  color: '#fff', fontSize: 15, fontWeight: 800, letterSpacing: '0.3px',
                  boxShadow: isConnected ? '0 6px 20px rgba(0,119,181,0.40)' : 'none',
                  transition: 'all 0.2s', opacity: isPosting ? 0.75 : 1,
                  marginTop: 4,
                }}
              >
                {isPosting ? (
                  <>
                    <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block', fontSize: 14 }}>⟳</span>
                    Posting...
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                    Post to LinkedIn
                  </>
                )}
              </button>

              {!isConnected && !isCheckingStatus && (
                <p style={{ fontSize: 12, color: '#d97706', textAlign: 'center', fontWeight: 600 }}>
                  ⚠ Connect your LinkedIn account first
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Modal>
  )
}
