/**
 * CopilotMessageContent
 * Shared Markdown + candidate-card rendering used by CopilotPage.
 * The widget keeps its own inline renderer for now (no behaviour change required).
 */
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import toast from 'react-hot-toast'
import { ArrowRight, Banknote, Check, Clock, Copy, FileDown, Mail, MapPin, Save, Sparkles, Star } from 'lucide-react'
import { useState } from 'react'
import { Avatar, Badge, Button, Card } from '@/components/hb'
import { useAuthStore } from '@/store/authStore'
import { aiApi } from '@/api/ai'
import type { CandidateCardData } from './conversationUtils'
import { parseCandidateCard } from './conversationUtils'

// ── Stage colour helper ───────────────────────────────────────────────────────
function getStageStyle(stageText?: string): React.CSSProperties {
  const text = (stageText || '').toLowerCase()
  const tone = (token: string): React.CSSProperties => ({
    background: `rgb(var(${token}) / .10)`,
    color: `rgb(var(${token}))`,
    border: `1px solid rgb(var(${token}) / .30)`,
  })
  if (text.includes('applied')) return tone('--hb-blue')
  if (text.includes('screening')) return tone('--hb-warning')
  if (text.includes('technical') || text.includes('practical') || text.includes('interview'))
    return tone('--hb-violet')
  if (text.includes('offered') || text.includes('hired')) return tone('--hb-success')
  if (text.includes('rejected')) return tone('--hb-error')
  return { background: 'rgb(var(--hb-surface-2))', color: 'rgb(var(--hb-muted))', border: '1px solid var(--hb-border)' }
}

// ── CandidateCard ─────────────────────────────────────────────────────────────
export function CandidateCard({
  candidate,
  onViewProfile,
}: {
  candidate: CandidateCardData
  onViewProfile?: (candidate: CandidateCardData) => void
}) {
  const facts: Array<{ icon: React.ReactNode; value: string; truncate?: boolean }> = [
    candidate.email && { icon: <Mail size={12} aria-hidden />, value: candidate.email, truncate: true },
    candidate.location && { icon: <MapPin size={12} aria-hidden />, value: candidate.location },
    candidate.experience && { icon: <Star size={12} aria-hidden />, value: candidate.experience },
    candidate.notice && { icon: <Clock size={12} aria-hidden />, value: candidate.notice },
    candidate.salary && { icon: <Banknote size={12} aria-hidden />, value: candidate.salary },
  ].filter(Boolean) as Array<{ icon: React.ReactNode; value: string; truncate?: boolean }>

  return (
    <Card
      variant="interactive"
      padding="compact"
      className="w-full"
      role={onViewProfile ? 'button' : undefined}
      tabIndex={onViewProfile ? 0 : undefined}
      onClick={onViewProfile ? () => onViewProfile(candidate) : undefined}
      onKeyDown={
        onViewProfile
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onViewProfile(candidate) }
            }
          : undefined
      }
    >
      <div className="flex items-center gap-3">
        <Avatar name={candidate.name} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-hb-body font-semibold text-hb-text">{candidate.name}</p>
          {candidate.title && <p className="truncate text-hb-xs text-hb-muted">{candidate.title}</p>}
        </div>
      </div>
      {facts.length > 0 && (
        <dl className="mt-3 grid gap-1.5 border-t border-hb-border pt-2.5 text-hb-xs text-hb-muted">
          {facts.map((f) => (
            <div key={f.value} className="flex items-center gap-1.5">
              <span className="shrink-0 text-hb-dim">{f.icon}</span>
              <span className={f.truncate ? 'truncate' : undefined}>{f.value}</span>
            </div>
          ))}
        </dl>
      )}
      {candidate.skills && (
        <ul className="mt-3 flex flex-wrap gap-1 overflow-hidden border-t border-hb-border pt-2">
          {candidate.skills.replace('Skills:', '').split(',').map((s) => s.trim()).filter(Boolean).map((skill) => (
            <li key={skill}><Badge>{skill}</Badge></li>
          ))}
        </ul>
      )}
      {(candidate.stage || onViewProfile) && (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-hb-border pt-2.5">
          {candidate.stage ? (
            <span
              className="inline-flex items-center rounded-hb-full px-2.5 py-1 font-mono text-hb-micro uppercase"
              style={getStageStyle(candidate.stage)}
            >
              {candidate.stage.replace('Stage:', '').trim()}
            </span>
          ) : <span />}
          {onViewProfile && (
            <Button size="sm" trailingIcon={<ArrowRight size={13} />} onClick={(e) => { e.stopPropagation(); onViewProfile(candidate) }}>
              View profile
            </Button>
          )}
        </div>
      )}
    </Card>
  )
}

// ── JD ActionBar ──────────────────────────────────────────────────────────────
function parseMarkdownJD(content: string) {
  let title = ''
  const titleMatch = content.match(/##\s+([^\n]+)/) || content.match(/#\s+([^\n]+)/) || content.match(/\*\*Position:\*\*\s*([^\n]+)/i)
  if (titleMatch) title = titleMatch[1].replace(/[*#]/g, '').trim()

  let location = 'Hybrid / Remote'
  const locMatch = content.match(/\*\*Location(?:\s*\/\s*Work\s*Mode)?:\*\*\s*([^\n]+)/i)
  if (locMatch) location = locMatch[1].replace(/[*]/g, '').trim()

  let experience = '2-4 Years'
  const expMatch = content.match(/\*\*Experience(?:\s*Level)?:\*\*\s*([^\n]+)/i)
  if (expMatch) experience = expMatch[1].replace(/[*]/g, '').trim()

  let description = ''
  const descMatch = content.match(/###\s*📌?\s*Role Overview\s*\n+([\s\S]*?)(?=\n+###|\n+---|$)/i)
  if (descMatch) description = descMatch[1].trim()
  else description = content.replace(/^#+.*$/gm, '').replace(/\[CTA_BUTTON:.*?\]/g, '').trim()

  const respMatch = content.match(/###\s*🎯?\s*Key Responsibilities\s*\n+([\s\S]*?)(?=\n+###|\n+---|$)/i)
  let key_responsibilities: string[] = []
  if (respMatch)
    key_responsibilities = respMatch[1].split('\n').map((l) => l.replace(/^[-*•\d.]+\s*/, '').trim()).filter((l) => l.length > 2)

  let required_qualifications_skills: string[] = []
  const coreMatch = content.match(/###\s*🔑?\s*Core Skills\s*\n+([\s\S]*?)(?=\n+###|\n+---|$)/i)
  if (coreMatch) {
    required_qualifications_skills = coreMatch[1].replace(/^[-*•]+\s*/gm, '').trim().split(/[,\n]/).map((s) => s.replace(/[*_`]/g, '').trim()).filter((s) => s.length > 0 && s.length < 50)
  } else {
    const qualMatch = content.match(/###\s*🛠️?\s*Required Qualifications[^\n]*\n+([\s\S]*?)(?=\n+###|\n+---|$)/i)
    if (qualMatch)
      required_qualifications_skills = qualMatch[1].split('\n').map((l) => l.replace(/^[-*•\d.]+\s*/, '').trim()).filter((l) => l.length > 1 && l.length < 50)
  }

  const prefMatch = content.match(/###\s*⭐?\s*Preferred[^\n]*\n+([\s\S]*?)(?=\n+###|\n+---|$)/i)
  let good_to_have: string[] = []
  if (prefMatch)
    good_to_have = prefMatch[1].split('\n').map((l) => l.replace(/^[-*•\d.]+\s*/, '').trim()).filter((l) => l.length > 1)

  return { title, location, experience, description, key_responsibilities, required_qualifications_skills, good_to_have }
}

function JDActionBar({ content, ctaText }: { content: string; ctaText?: string }) {
  const [copied, setCopied] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      toast.success('Job Description copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    } catch { toast.error('Could not copy to clipboard') }
  }

  const handleApplyToForm = () => {
    try {
      const parsedJD = parseMarkdownJD(content)
      sessionStorage.setItem('copilot_prefilled_jd', JSON.stringify(parsedJD))
      window.dispatchEvent(new CustomEvent('copilot-apply-jd', { detail: parsedJD }))
      const role = useAuthStore.getState().user?.role
      const basePath = role === 'admin' ? '/hiring/admin' : '/hiring/recruiter'
      const targetPath = `${basePath}/jobs/new`
      if (window.location.pathname.includes('/jobs/new')) {
        toast.success('✨ Job Description applied to form!')
      } else {
        toast.success('✨ Opening Job Form with prefilled JD...')
        window.history.pushState({}, '', targetPath)
        window.dispatchEvent(new PopStateEvent('popstate', { state: {} }))
      }
    } catch (err) { toast.error('Failed to apply JD to form') }
  }

  const handleDownloadPdf = async () => {
    setIsExporting(true)
    try {
      const parsedJD = parseMarkdownJD(content)
      const res = await aiApi.exportJDPDF({
        title: parsedJD.title || 'Job Description',
        location: parsedJD.location || 'Remote',
        experience: parsedJD.experience || '2-4 Years',
        key_responsibilities: parsedJD.key_responsibilities || [],
        required_qualifications_skills: parsedJD.required_qualifications_skills || [],
        good_to_have: parsedJD.good_to_have || [],
        description: parsedJD.description || content.slice(0, 400),
      })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `JD_${(parsedJD.title || 'Job_Description').replace(/\s+/g, '_')}.pdf`
      document.body.appendChild(link); link.click(); link.remove()
      URL.revokeObjectURL(url)
      toast.success('JD PDF downloaded!')
    } catch { toast.error('Failed to download JD PDF') } finally { setIsExporting(false) }
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <button
        onClick={handleApplyToForm}
        className="inline-flex items-center gap-1.5 rounded-hb-lg px-4 py-2 text-hb-sm font-semibold transition-all hover:opacity-90"
        style={{ background: 'var(--hb-grad-diag)', color: 'rgb(var(--hb-on-brand))', boxShadow: 'var(--hb-sh-1)' }}
      >
        <Sparkles size={14} />{ctaText || 'Save & Apply to Form'}<ArrowRight size={13} />
      </button>
      <button
        onClick={handleCopy}
        className="inline-flex items-center gap-1.5 rounded-hb-lg border border-hb-border bg-hb-surface px-4 py-2 text-hb-sm font-medium text-hb-text transition-all hover:bg-hb-surface-2"
      >
        {copied ? <Check size={13} className="text-hb-success" /> : <Copy size={13} />}
        {copied ? 'Copied!' : 'Copy JD'}
      </button>
      <button
        onClick={handleDownloadPdf}
        disabled={isExporting}
        className="inline-flex items-center gap-1.5 rounded-hb-lg border border-hb-border bg-hb-surface px-4 py-2 text-hb-sm font-medium text-hb-text transition-all hover:bg-hb-surface-2 disabled:opacity-60"
      >
        <FileDown size={13} />{isExporting ? 'Exporting...' : 'PDF'}
      </button>
    </div>
  )
}

// ── Bot message content ───────────────────────────────────────────────────────
export function BotMessageContent({
  content,
  onSend,
  onViewProfile,
}: {
  content: string
  onSend?: (msg: string) => void
  onViewProfile?: (candidate: CandidateCardData) => void
}) {
  // Strip CTA and suggestion markers
  const ctaMatch = content.match(/\[CTA_BUTTON:(.*?)\]/)
  const ctaButtonText = ctaMatch ? ctaMatch[1] : ''
  let cleanContent = content.replace(/\[CTA_BUTTON:.*?\]/g, '').trim()
  cleanContent = cleanContent.replace(/\n*\[PENDING_TOOL:.*?\]/g, '').trim()

  const suggestionGroups = Array.from(cleanContent.matchAll(/\[SUGGEST:(.*?)\]/g)).map((m) =>
    m[1].split('|').map((s) => s.trim()).filter(Boolean),
  )
  if (suggestionGroups.length > 0) cleanContent = cleanContent.replace(/\[SUGGEST:.*?\]/g, '').trim()

  const isJD =
    cleanContent.includes('Role Overview') ||
    cleanContent.includes('Key Responsibilities') ||
    cleanContent.includes('Required Qualifications') ||
    cleanContent.includes('**Position:**') ||
    (ctaButtonText && ctaButtonText.toLowerCase().includes('job'))

  const hasCandidateCards = cleanContent.includes('👤')
  const parts = hasCandidateCards ? cleanContent.split(/\n\n---\n\n|\n---\n/) : [cleanContent]

  const renderSuggestions = () =>
    suggestionGroups.length > 0 ? (
      <div className="mt-3 flex flex-col gap-1.5">
        {suggestionGroups.map((group, gi) => (
          <div key={gi} className="flex flex-wrap gap-1.5">
            {group.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => onSend?.(label)}
                className="rounded-hb-full border border-hb-border bg-hb-surface px-3 py-1.5 text-hb-xs font-medium text-hb-cyan transition-colors hover:border-hb-cyan/50 hover:bg-hb-cyan/10"
              >
                {label}
              </button>
            ))}
          </div>
        ))}
      </div>
    ) : null

  if (parts.length <= 1) {
    return (
      <div className="flex w-full flex-col items-start">
        <div className="copilot-markdown w-full">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleanContent}</ReactMarkdown>
        </div>
        {isJD ? (
          <JDActionBar content={cleanContent} ctaText={ctaButtonText || 'Save JD & Apply to Form'} />
        ) : ctaButtonText ? (
          <button
            onClick={() => {
              const role = useAuthStore.getState().user?.role
              const basePath = role === 'admin' ? '/hiring/admin' : '/hiring/recruiter'
              window.history.pushState({}, '', `${basePath}/jobs/new`)
              window.dispatchEvent(new PopStateEvent('popstate', { state: {} }))
            }}
            className="mt-3 inline-flex items-center gap-1.5 rounded-hb-lg px-4 py-2 text-hb-sm font-semibold"
            style={{ background: 'var(--hb-grad-diag)', color: 'rgb(var(--hb-on-brand))' }}
          >
            <span>✨</span> {ctaButtonText} <ArrowRight size={13} />
          </button>
        ) : null}
        {renderSuggestions()}
      </div>
    )
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-3.5">
      {parts.map((part, idx) => {
        const candidate = parseCandidateCard(part)
        if (candidate) return <CandidateCard key={idx} candidate={candidate} onViewProfile={onViewProfile} />
        const trimmedPart = part.trim()
        if (!trimmedPart) return null
        return (
          <div key={idx} className="copilot-markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{trimmedPart}</ReactMarkdown>
          </div>
        )
      })}
      {isJD && <JDActionBar content={cleanContent} ctaText={ctaButtonText || 'Save JD & Apply to Form'} />}
      {renderSuggestions()}
    </div>
  )
}

