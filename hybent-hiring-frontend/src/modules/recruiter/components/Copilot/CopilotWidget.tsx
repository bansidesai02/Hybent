import { useRef, useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { useNavigate, useLocation } from 'react-router-dom'
import { useCopilotStore } from '@/store/useCopilotStore'
import { useMessageStore } from '@/store/messageStore'
import { useAuthStore } from '@/store/authStore'
import { copilotApi } from '@/api/copilot'
import { aiApi } from '@/api/ai'
import { useQueryClient } from '@tanstack/react-query'
import type { ConversationSummary } from '@/api/copilot'
import { candidatesApi } from '@/api/candidates'
import { useCopilotConversations } from './useCopilotConversations'
import { CopilotSteps } from './CopilotSteps'
import { CopilotMarkdown } from './CopilotMarkdown'
import type { Candidate } from '@/types'
import { ArrowRight, Banknote, Check, Clock, Copy, FileDown, Mail, MapPin, Save, Sparkles, Star } from 'lucide-react'
import { Avatar, Badge, Button, Card } from '@/components/hb'

/* â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   On the Hybent design system.

   This object is the widget's entire visual identity â€” the 2,000 lines below it
   are speech recognition, dragging and streaming, and are untouched. Every value
   here used to come from the old product palette: the launcher was a
   violetâ†’pink orb, message bubbles were `--violet`â†’`--violet-mid`, and the
   waveform was drawn in `#EC4899`/`#8B5CF6`. None of those colours exist in
   Hybent. They are now the brand gradient and the `--hb-*` tokens, so the
   copilot reads as part of the product rather than as a widget bolted onto it.

   Kept as a style object rather than moved to classes because the widget is
   dragged, resized and animated from script, which reads and writes these
   values directly.
   ---------------------------------------------------------------------------- */
const s: Record<string, React.CSSProperties> = {
  fab: { position: 'fixed', bottom: 'max(80px, calc(var(--hb-mobile-nav) + 16px))', right: 'min(28px, 4vw)', width: '56px', height: '56px', borderRadius: '50%', background: 'var(--hb-grad-diag)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 34px -14px rgb(76 111 255 / .55)', zIndex: 9999, transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease', color: 'rgb(var(--hb-on-brand))', fontSize: '24px' },
  panel: { position: 'fixed', bottom: 'max(150px, calc(var(--hb-mobile-nav) + 86px))', right: 'min(28px, 4vw)', width: '400px', maxWidth: 'calc(100vw - min(56px, 8vw))', height: '600px', maxHeight: 'min(calc(100vh - 120px), calc(100dvh - max(150px, calc(var(--hb-mobile-nav) + 86px)) - 64px))', borderRadius: 'var(--hb-r-lg)', background: 'rgb(var(--hb-elevated))', border: '1px solid var(--hb-border)', boxShadow: 'var(--hb-sh-3)', display: 'flex', flexDirection: 'column', zIndex: 9998, overflow: 'hidden', animation: 'copilotSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)' },
  header: { padding: '18px 22px', background: 'rgb(var(--hb-surface))', borderBottom: '1px solid var(--hb-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  headerTitle: { color: 'rgb(var(--hb-text))', fontFamily: 'var(--hb-f-display)', fontWeight: 600, fontSize: '17px', display: 'flex', alignItems: 'center', gap: '10px' },
  headerActions: { display: 'flex', gap: '8px' },
  iconBtn: { background: 'rgb(var(--hb-surface-2))', border: '1px solid var(--hb-border)', borderRadius: 'var(--hb-r-sm)', color: 'rgb(var(--hb-muted))', cursor: 'pointer', padding: '6px', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  messages: { flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px' },
  userBubble: { background: 'var(--hb-grad-diag)', color: 'rgb(var(--hb-on-brand))', fontWeight: 500, borderRadius: '18px 18px 4px 18px', padding: '12px 16px', fontSize: '14px', lineHeight: 1.5, boxShadow: 'var(--hb-sh-1)', width: '100%', boxSizing: 'border-box', wordBreak: 'break-word' },
  botBubble: { background: 'rgb(var(--hb-surface-2))', color: 'rgb(var(--hb-text))', borderRadius: '18px 18px 18px 4px', padding: '14px 18px', fontSize: '14px', lineHeight: 1.6, border: '1px solid var(--hb-border)', boxShadow: 'var(--hb-sh-1)', width: '100%', boxSizing: 'border-box', wordBreak: 'break-word', overflow: 'hidden', minWidth: 0 },
  thinkingBubble: { background: 'rgb(var(--hb-surface-2))', borderRadius: '18px 18px 18px 4px', padding: '14px 18px', border: '1px solid var(--hb-border)', display: 'flex', alignItems: 'center', gap: '6px' },
  footer: { padding: '14px 16px', borderTop: '1px solid var(--hb-border)', display: 'flex', gap: '6px', alignItems: 'flex-end', flexShrink: 0, background: 'rgb(var(--hb-surface))' },
  input: { flex: 1, background: 'rgb(var(--hb-surface))', border: '1px solid var(--hb-border)', borderRadius: 'var(--hb-r-sm)', color: 'rgb(var(--hb-text))', fontSize: '14px', padding: '10px 14px', resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.4, maxHeight: '120px', overflowY: 'auto', transition: 'all 0.2s ease' },
  sendBtn: { background: 'var(--hb-grad-diag)', border: 'none', borderRadius: 'var(--hb-r-sm)', color: 'rgb(var(--hb-on-brand))', cursor: 'pointer', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease', flexShrink: 0, boxShadow: 'var(--hb-sh-1)' },
  emptyState: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '32px 24px', textAlign: 'center' },
  /* The site's `.grad-text`, inline â€” the launcher's own glyph is the one place
     in the panel the full gradient is allowed to shout. */
  emptyIcon: { fontSize: '48px', background: 'var(--hb-grad)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  emptyTitle: { color: 'rgb(var(--hb-text))', fontFamily: 'var(--hb-f-display)', fontWeight: 600, fontSize: '19px' },
  emptySubtitle: { color: 'rgb(var(--hb-muted))', fontSize: '14px', lineHeight: 1.6 },
  promptGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', width: '100%', marginTop: '16px' },
  promptCard: { background: 'rgb(var(--hb-surface-2))', border: '1px solid var(--hb-border)', borderRadius: 'var(--hb-r-sm)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px', cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)', textAlign: 'left' },
  promptCardIcon: { fontSize: '20px' },
  promptCardTitle: { color: 'rgb(var(--hb-text))', fontSize: '13px', fontWeight: 600 },
  promptCardText: { color: 'rgb(var(--hb-muted))', fontSize: '12px', lineHeight: 1.4 },
  // History panel
  historyPanel: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  historyHeader: { padding: '16px 22px', borderBottom: '1px solid var(--hb-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  historyTitle: { color: 'rgb(var(--hb-text))', fontFamily: 'var(--hb-f-display)', fontWeight: 600, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' },
  newChatBtn: { background: 'var(--hb-grad-diag)', border: 'none', borderRadius: 'var(--hb-r-full)', color: 'rgb(var(--hb-on-brand))', cursor: 'pointer', padding: '7px 14px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s ease' },
  historyList: { flex: 1, overflowY: 'auto', padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: '8px' },
  /* The site's mono label â€” 10px at .16em, not a bolded 11px sans. */
  historyGroup: { color: 'rgb(var(--hb-dim))', fontFamily: 'var(--hb-f-mono)', fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.16em', padding: '8px 0 4px' },
  historyItem: { background: 'rgb(var(--hb-surface-2))', border: '1px solid var(--hb-border)', borderRadius: 'var(--hb-r-sm)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', transition: 'all 0.2s ease' },
  historyItemTitle: { flex: 1, color: 'rgb(var(--hb-text))', fontSize: '13px', lineHeight: 1.4, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  historyItemDate: { color: 'rgb(var(--hb-dim))', fontFamily: 'var(--hb-f-mono)', fontSize: '10px', flexShrink: 0 },
  historyDeleteBtn: { background: 'transparent', border: 'none', color: 'rgb(var(--hb-muted))', cursor: 'pointer', padding: '4px', borderRadius: 'var(--hb-r-xs)', display: 'flex', flexShrink: 0, transition: 'all 0.2s ease', opacity: 0.6 },
  historyEmpty: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgb(var(--hb-muted))', fontSize: '14px', gap: '12px' },
  backBtn: { background: 'transparent', border: 'none', color: 'rgb(var(--hb-muted))', cursor: 'pointer', padding: '4px', borderRadius: 'var(--hb-r-xs)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', transition: 'all 0.2s ease' },
  loadingRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', color: 'rgb(var(--hb-muted))', fontSize: '14px' },
  micBtn: { background: 'rgb(var(--hb-surface-2))', border: '1px solid var(--hb-border)', borderRadius: 'var(--hb-r-sm)', color: 'rgb(var(--hb-muted))', cursor: 'pointer', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease', flexShrink: 0 },
  micBtnActive: { background: 'rgb(var(--hb-error) / .1)', border: '1px solid rgb(var(--hb-error))', color: 'rgb(var(--hb-error))', animation: 'micPulse 1.5s infinite ease-in-out' },
  // Skill chips container — needs maxWidth to prevent overflow
  skillsContainer: { display: 'flex', flexWrap: 'wrap' as const, gap: '4px', borderTop: '1px solid var(--hb-border)', paddingTop: '8px', maxWidth: '100%', overflow: 'hidden' },
}

const EXAMPLE_PROMPTS = [
  { icon: '🔍', title: 'Search Talent', prompt: 'Show React developers with 3+ years experience' },
  { icon: '📊', title: 'Analytics', prompt: 'Give me a hiring overview' },
  { icon: '📅', title: 'Interviews', prompt: "What interviews are scheduled today?" },
  { icon: '⚡', title: 'Pipeline', prompt: 'Show candidates in technical round' },
]

// Stopwords for candidate name suggestions — intentionally EXCLUDES tech skill names
// (react, python, etc.) so that "schedule interview for React developer Amit" suggests "Amit"
const COPILOT_STOPWORDS = [
  // English common words
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further',
  'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how',
  'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'me', 'more', 'most', 'my', 'myself',
  'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they',
  'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with',
  'you', 'your', 'yours', 'yourself', 'yourselves',
  // Conversational / Greetings
  'hello', 'hi', 'hey', 'please', 'thanks', 'thank', 'ok', 'okay', 'yes', 'no', 'yeah', 'yep',
  // Recruiter filler words (NOT tech skills — those are search terms)
  'candidate', 'candidates', 'profile', 'profiles', 'resume', 'resumes', 'cv',
  'job', 'jobs', 'vacancy', 'open', 'role', 'roles',
  'experience', 'exp', 'year', 'years', 'month', 'months',
  'ctc', 'salary', 'lpa', 'lakh', 'lakhs', 'expected', 'current',
  'notice', 'period', 'days', 'immediate', 'joiner', 'joiners',
  'location', 'city', 'live', 'living', 'added', 'week', 'today', 'yesterday',
  'pipeline', 'stage', 'status', 'applied', 'screening',
  'interview', 'interviews', 'interviewer', 'interviewers', 'panel', 'meeting', 'schedule', 'scheduler',
  'technical', 'practical', 'round', 'rounds',
  'feedback', 'scorecard', 'scorecards',
  'offer', 'offered', 'hired', 'rejected', 'reject',
  'developer', 'developers', 'engineer', 'engineers',
  // Hinglish / Hindi filler words
  'mein', 'hai', 'ke', 'ka', 'ki', 'ko', 'se', 'aur', 'bhi', 'toh',
  'hi', 'ho', 'tha', 'thi', 'the', 'karo', 'do', 'kar',
  'raha', 'rahi', 'rahe', 'gaya', 'gayi', 'gaye', 'hua', 'hue', 'hui',
  'hain', 'par', 'pe', 'ek', 'ne', 'kiya', 'liye', 'kya',
  'hu', 'hoon', 'aap', 'tum', 'main', 'hum', 'ye', 'wo', 'yeh', 'woh',
  'isse', 'usse', 'na', 'kuch', 'hoga', 'hogi', 'honge',
  'thaa', 'dhundo', 'nikalo', 'dikhao', 'db', 'show', 'find', 'list', 'search'
]

// ——— SVG Icons —————————————————————————————————————————————————————————————
const SendIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
const TrashIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
const CloseIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
const HistoryIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
const BackIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
const MinimizeIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
const MaximizeIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="2"/><line x1="9" y1="17" x2="15" y2="17"/></svg>
const PlusIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
const MicIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>

// ——— Date grouping helper —————————————————————————————————————————————————
function groupConversationsByDate(convs: ConversationSummary[]) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const weekAgo = new Date(today.getTime() - 7 * 86400000)

  const groups: Record<string, ConversationSummary[]> = {
    Today: [], Yesterday: [], 'This Week': [], Older: [],
  }
  for (const c of convs) {
    const d = new Date(c.updated_at)
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    if (day >= today) groups['Today'].push(c)
    else if (day >= yesterday) groups['Yesterday'].push(c)
    else if (day >= weekAgo) groups['This Week'].push(c)
    else groups['Older'].push(c)
  }
  return groups
}

interface CandidateCardData {
  name: string
  email?: string
  title?: string
  location?: string
  experience?: string
  skills?: string
  notice?: string
  stage?: string
  salary?: string
}

function CandidateCard({ candidate, onViewProfile }: { candidate: CandidateCardData; onViewProfile?: (candidate: CandidateCardData) => void }) {
  const initials = candidate.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  /* The copilot's own status→colour map, the last of the fifty-six the audit
     found. It now reads the same tokens `StatusPill` does, so a stage in a chat
     bubble matches the same stage in the candidates table. Kept local rather
     than swapped for `StatusPill` itself because the value arriving here is
     free text from the model ("Stage: Technical Round"), not an API enum. */
  const getStageStyle = (stageText?: string): React.CSSProperties => {
    const text = (stageText || '').toLowerCase()
    const tone = (token: string): React.CSSProperties => ({
      background: `rgb(var(${token}) / .10)`,
      color: `rgb(var(${token}))`,
      border: `1px solid rgb(var(${token}) / .30)`,
    })

    if (text.includes('applied')) return tone('--hb-blue')
    if (text.includes('screening')) return tone('--hb-warning')
    if (text.includes('technical') || text.includes('practical') || text.includes('interview')) {
      return tone('--hb-violet')
    }
    if (text.includes('offered') || text.includes('hired')) return tone('--hb-success')
    if (text.includes('rejected')) return tone('--hb-error')

    return {
      background: 'rgb(var(--hb-surface-2))',
      color: 'rgb(var(--hb-muted))',
      border: '1px solid var(--hb-border)',
    }
  }

  /* Facts arrive from the model as pre-formatted strings, so they are listed
     rather than mapped to fields. The emoji they used to be prefixed with are
     gone — lucide glyphs match the rest of the product and, unlike emoji, are
     not read aloud as "envelope" before every address. */
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
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onViewProfile(candidate)
              }
            }
          : undefined
      }
    >
      <div className="flex items-center gap-3">
        <Avatar name={candidate.name} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-hb-body font-semibold text-hb-text">{candidate.name}</p>
          {candidate.title && (
            <p className="truncate text-hb-xs text-hb-muted">{candidate.title}</p>
          )}
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
          {candidate.skills
            .replace('Skills:', '')
            .split(',')
            .map((skill) => skill.trim())
            .filter(Boolean)
            .map((skill) => (
              <li key={skill}>
                <Badge>{skill}</Badge>
              </li>
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
          ) : (
            <span />
          )}
          {onViewProfile && (
            <Button
              size="sm"
              trailingIcon={<ArrowRight size={13} />}
              onClick={(e) => {
                e.stopPropagation()
                onViewProfile(candidate)
              }}
            >
              View profile
            </Button>
          )}
        </div>
      )}
    </Card>
  )
}

function parseMarkdownJD(content: string) {
  // Title
  let title = ''
  const titleMatch =
    content.match(/##\s+([^\n]+)/) ||
    content.match(/#\s+([^\n]+)/) ||
    content.match(/\*\*Position:\*\*\s*([^\n]+)/i) ||
    content.match(/Job Title:\s*([^\n]+)/i)
  if (titleMatch) {
    title = titleMatch[1].replace(/[*#]/g, '').trim()
  }

  // Location
  let location = 'Hybrid / Remote'
  const locMatch = content.match(/\*\*Location(?:\s*\/\s*Work\s*Mode)?:\*\*\s*([^\n]+)/i)
  if (locMatch) {
    location = locMatch[1].replace(/[*]/g, '').trim()
  }

  // Experience
  let experience = '2-4 Years'
  const expMatch = content.match(/\*\*Experience(?:\s*Level)?:\*\*\s*([^\n]+)/i)
  if (expMatch) {
    experience = expMatch[1].replace(/[*]/g, '').trim()
  }

  // Role Overview / Description
  let description = ''
  const descMatch = content.match(/###\s*📌?\s*Role Overview\s*\n+([\s\S]*?)(?=\n+###|\n+---|$)/i)
  if (descMatch) {
    description = descMatch[1].trim()
  } else {
    description = content.replace(/^#+.*$/gm, '').replace(/\[CTA_BUTTON:.*?\]/g, '').trim()
  }

  // Key Responsibilities
  const respMatch = content.match(/###\s*🎯?\s*Key Responsibilities\s*\n+([\s\S]*?)(?=\n+###|\n+---|$)/i)
  let key_responsibilities: string[] = []
  if (respMatch) {
    key_responsibilities = respMatch[1]
      .split('\n')
      .map((l) => l.replace(/^[-*•\d.]+\s*/, '').trim())
      .filter((l) => l.length > 2)
  }

  // 🔑 Core Skills — short comma-separated keywords (preferred, new section)
  let required_qualifications_skills: string[] = []
  const coreSkillsMatch = content.match(/###\s*🔑?\s*Core Skills\s*\n+([\s\S]*?)(?=\n+###|\n+---|$)/i)
  if (coreSkillsMatch) {
    // The section has comma-separated keywords on one or more lines
    const rawSkills = coreSkillsMatch[1].replace(/^[-*•]+\s*/gm, '').trim()
    required_qualifications_skills = rawSkills
      .split(/[,\n]/)
      .map((s) => s.replace(/[*_`]/g, '').trim())
      .filter((s) => s.length > 0 && s.length < 50) // only short keywords
  } else {
    // Fallback: old "Required Qualifications & Core Skills" section — filter to short items only
    const qualMatch =
      content.match(/###\s*🛠️?\s*Required Qualifications[^\n]*\n+([\s\S]*?)(?=\n+###|\n+---|$)/i) ||
      content.match(/###\s*Required Skills[^\n]*\n+([\s\S]*?)(?=\n+###|\n+---|$)/i)
    if (qualMatch) {
      required_qualifications_skills = qualMatch[1]
        .split('\n')
        .map((l) => l.replace(/^[-*•\d.]+\s*/, '').trim())
        .filter((l) => l.length > 1 && l.length < 50) // only short phrases, skip full sentences
    }
  }

  // Preferred / Good to Have
  const prefMatch = content.match(/###\s*⭐?\s*Preferred[^\n]*\n+([\s\S]*?)(?=\n+###|\n+---|$)/i)
  let good_to_have: string[] = []
  if (prefMatch) {
    good_to_have = prefMatch[1]
      .split('\n')
      .map((l) => l.replace(/^[-*•\d.]+\s*/, '').trim())
      .filter((l) => l.length > 1)
  }

  return {
    title,
    location,
    experience,
    description,
    key_responsibilities,
    required_qualifications_skills,
    good_to_have,
  }
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
    } catch {
      toast.error('Could not copy to clipboard')
    }
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
        if (window.history && window.history.pushState) {
          window.history.pushState({}, '', targetPath)
          window.dispatchEvent(new PopStateEvent('popstate', { state: {} }))
        } else {
          window.location.href = targetPath
        }
      }
    } catch (err) {
      console.error('Apply JD error:', err)
      toast.error('Failed to apply JD to form')
    }
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
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      toast.success('JD PDF downloaded!')
    } catch (err) {
      console.error('PDF export error:', err)
      toast.error('Failed to download JD PDF')
    } finally {
      setIsExporting(false)
    }
  }

  const buttonLabel = ctaText || 'Save & Apply to Form'

  return (
    <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        <button
          onClick={handleApplyToForm}
          style={{
            background: 'var(--hb-grad-diag)',
            border: 'none',
            borderRadius: '10px',
            color: 'rgb(var(--hb-on-brand))',
            cursor: 'pointer',
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            boxShadow: 'var(--hb-sh-1)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.92'
            e.currentTarget.style.transform = 'translateY(-1px)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1'
            e.currentTarget.style.transform = 'none'
          }}
        >
          <Sparkles size={15} />
          <span>{buttonLabel}</span>
          <ArrowRight size={14} />
        </button>

        <button
          onClick={handleCopy}
          style={{
            background: 'rgb(var(--hb-surface))',
            border: '1px solid var(--hb-border)',
            borderRadius: '10px',
            color: 'rgb(var(--hb-text))',
            cursor: 'pointer',
            padding: '9px 14px',
            fontSize: '12px',
            fontWeight: 500,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease',
          }}
          title="Copy full Job Description"
        >
          {copied ? <Check size={14} color="rgb(var(--hb-success))" /> : <Copy size={14} />}
          <span>{copied ? 'Copied!' : 'Copy JD'}</span>
        </button>

        <button
          onClick={handleDownloadPdf}
          disabled={isExporting}
          style={{
            background: 'rgb(var(--hb-surface))',
            border: '1px solid var(--hb-border)',
            borderRadius: '10px',
            color: 'rgb(var(--hb-text))',
            cursor: isExporting ? 'wait' : 'pointer',
            padding: '9px 14px',
            fontSize: '12px',
            fontWeight: 500,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease',
            opacity: isExporting ? 0.6 : 1,
          }}
          title="Download formatted PDF"
        >
          <FileDown size={14} />
          <span>{isExporting ? 'Exporting...' : 'PDF'}</span>
        </button>
      </div>
    </div>
  )
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// ——— Main Widget ——————————————————————————————————————————————————————————
export function CopilotWidget() {
  const {
    isOpen, toggle, close, isThinking, setThinking,
    messages, addMessage, setMessages, startNewConversation,
    conversationId, setConversationId, pageContext,
  } = useCopilotStore()

  const { activeChatRecipient } = useMessageStore()
  const navigate = useNavigate()
  const location = useLocation()
  const isCopilotPage = location.pathname.includes('/copilot')

  const queryClient = useQueryClient()

  // ── Shared conversation list (shared React Query cache with CopilotPage) ──
  const {
    conversations,
    grouped,
    isLoading: historyLoading,
    convLoading,
    refetch: refetchConversations,
    loadConversation: loadConversationFromHook,
    deleteConversation,
    deletingConvId,
    deleteAll,
    clearingAll,
    scheduleRefetchForNewTitle,
  } = useCopilotConversations()

  const [input, setInput] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [audioError, setAudioError] = useState<string | null>(null)

  const [sttStatus, setSttStatus] = useState<'idle' | 'listening' | 'refining' | 'ready'>('idle')
  const [liveTranscript, setLiveTranscript] = useState('')
  const [isSpeechSupported, setIsSpeechSupported] = useState(false)
  const recognitionRef = useRef<any>(null)
  const stopRecordingRef = useRef<() => void>(() => {})

  const [candidateSuggestions, setCandidateSuggestions] = useState<{ candidate: any; matchedWord: string }[]>([])
  const updateSuggestionsRef = useRef<(val: string) => void>(() => {})
  const suggestTimeoutRef = useRef<any>(null)

  // Search database candidates for matches based on input keywords
  const updateSuggestions = useCallback((val: string) => {
    if (suggestTimeoutRef.current) {
      clearTimeout(suggestTimeoutRef.current)
    }

    if (!val || val.trim().length < 2) {
      setCandidateSuggestions([])
      return
    }

    suggestTimeoutRef.current = setTimeout(async () => {
      const words = val.split(/\s+/)
        .map(w => w.replace(/[^a-zA-Z]/g, '').trim())
        .filter(w => w.length >= 2 && !COPILOT_STOPWORDS.includes(w.toLowerCase()))
        
      if (words.length === 0) {
        setCandidateSuggestions([])
        return
      }

      try {
        const allSuggestions: { candidate: any; matchedWord: string }[] = []
        const seenIds = new Set<string>()

        // Query the DB suggest endpoint for the last 2 non-stopword words
        const targetWords = words.slice(-2)

        for (const w of targetWords) {
          const res = await candidatesApi.suggest(w)
          const items = res.data || []
          
          for (const item of items) {
            const nameLower = item.full_name.toLowerCase()
            const wordLower = w.toLowerCase()
            
            // Strict prefix match on candidate name words
            const nameWords = nameLower.split(/\s+/)
            const isPrefixMatch = nameWords.some((nw: string) => nw.startsWith(wordLower))
            
            if (isPrefixMatch) {
              if (!seenIds.has(item.id)) {
                seenIds.add(item.id)
                allSuggestions.push({
                  candidate: item,
                  matchedWord: w
                })
              }
            }
          }
        }
        
        setCandidateSuggestions(allSuggestions.slice(0, 5))
      } catch (err) {
        console.error('Error fetching suggestions:', err)
        setCandidateSuggestions([])
      }
    }, 250)
  }, [])

  const applySuggestion = useCallback((candidateName: string, matchedWord: string) => {
    setInput(prev => {
      // Split the input into tokens including whitespaces and punctuation.
      const tokens = prev.split(/(\s+)/);

      // Find the index of the token that matches matchedWord (case-insensitive)
      let matchedIdx = -1;
      for (let i = 0; i < tokens.length; i++) {
        const cleanToken = tokens[i].replace(/[^a-zA-Z]/g, '').toLowerCase();
        if (cleanToken === matchedWord.toLowerCase()) {
          matchedIdx = i;
          break;
        }
      }
      
      if (matchedIdx === -1) {
        // Fallback: simple replace
        return prev.replace(new RegExp(matchedWord, 'gi'), candidateName);
      }
      
      // Expand left and right to include consecutive non-stopword tokens
      const isNonStopword = (str: string) => {
        const clean = str.replace(/[^a-zA-Z]/g, '').trim();
        if (clean.length < 2) return false;
        return !COPILOT_STOPWORDS.includes(clean.toLowerCase());
      };
      
      let startIdx = matchedIdx;
      while (startIdx > 0) {
        const prevToken = tokens[startIdx - 1];
        if (prevToken.trim() === '') {
          if (startIdx - 2 >= 0 && isNonStopword(tokens[startIdx - 2])) {
            startIdx -= 2;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      
      let endIdx = matchedIdx;
      while (endIdx < tokens.length - 1) {
        const nextToken = tokens[endIdx + 1];
        if (nextToken.trim() === '') {
          if (endIdx + 2 < tokens.length && isNonStopword(tokens[endIdx + 2])) {
            endIdx += 2;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      
      // Replace tokens from startIdx to endIdx with candidateName
      tokens.splice(startIdx, endIdx - startIdx + 1, candidateName);
      const next = tokens.join('');
      inputRef.current = next;
      return next;
    });
    setCandidateSuggestions([]);
  }, []);

  // Sync updateSuggestions reference for mount useEffect
  useEffect(() => {
    updateSuggestionsRef.current = updateSuggestions
  }, [updateSuggestions])

  const [position, setPosition] = useState<{ x: number; y: number } | null>(() => {
    try {
      const saved = sessionStorage.getItem('hybent_hiring_copilot_pos')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [fabPosition, setFabPosition] = useState<{ x: number; y: number } | null>(() => {
    try {
      const saved = sessionStorage.getItem('hybent_hiring_copilot_fab_pos')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [isDragging, setIsDragging] = useState(false)
  const [isFabDragging, setIsFabDragging] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)

  const messagesRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const inputRef = useRef('')
  const interruptedByTypingRef = useRef(false)

  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const timerIntervalRef = useRef<number | null>(null)

  const dragStartRef = useRef<{ mouseX: number; mouseY: number; widgetX: number; widgetY: number } | null>(null)
  const headerRef = useRef<HTMLDivElement>(null)

  // Ensure everything stops on unmount and initialize SpeechRecognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      setIsSpeechSupported(true)
      
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-IN'
      
      let silenceTimer: number | null = null
      
      recognition.onresult = (event: any) => {
        if (silenceTimer) {
          window.clearTimeout(silenceTimer)
          silenceTimer = null
        }
        
        let interimTranscript = ''
        let finalTranscript = ''
        
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript
          } else {
            interimTranscript += transcript
          }
        }
        
        const fullTranscript = (recognitionRef.current.accumulated || '') + finalTranscript + interimTranscript
        setLiveTranscript(fullTranscript)
        setInput(fullTranscript)
        inputRef.current = fullTranscript
        updateSuggestionsRef.current(fullTranscript)
        
        if (finalTranscript) {
          recognitionRef.current.accumulated = (recognitionRef.current.accumulated || '') + finalTranscript
        }
        
        // VAD (Voice Activity Detection) - Auto stop after 2.2 seconds of silence
        silenceTimer = window.setTimeout(() => {
          if (recognitionRef.current && recognitionRef.current.isListening) {
            stopRecordingRef.current()
          }
        }, 2200)
      }
      
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        if (event.error === 'not-allowed') {
          setAudioError('Microphone permission denied. Please allow mic access in your browser settings.')
          setSttStatus('idle')
          setIsRecording(false)
        }
      }
      
      recognition.onend = () => {
        if (recognitionRef.current && recognitionRef.current.isListening) {
          recognitionRef.current.isListening = false
          setIsRecording(false)
        }
      }
      
      recognitionRef.current = recognition
      recognitionRef.current.accumulated = ''
      recognitionRef.current.isListening = false
    }

    return () => {
      if (suggestTimeoutRef.current) {
        clearTimeout(suggestTimeoutRef.current)
      }
      abortRef.current?.abort()
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
      if (recognitionRef.current && recognitionRef.current.isListening) {
        try {
          recognitionRef.current.stop()
        } catch {}
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close()
      }
    }
  }, [])

  // Auto-scroll
  // Scroll the message list only — scrollIntoView would also scroll the
  // shell's overflow-hidden ancestors behind the popup.
  useEffect(() => {
    const el = messagesRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, isThinking, isTranscribing])

  const keepInBounds = useCallback((pos: { x: number; y: number } | null, minimized: boolean) => {
    if (!pos) return
    const panelEl = headerRef.current?.parentElement
    if (!panelEl) return

    const rect = panelEl.getBoundingClientRect()
    // Check bounds against expanded height (600px) even if minimized to prevent offscreen maximize
    const height = Math.max(rect.height || 600, minimized ? 600 : 0)
    const width = rect.width || 400

    const w = window.innerWidth
    const h = window.innerHeight

    const maxX = Math.max(10, w - width - 10)
    const maxY = Math.max(10, h - height - 10)

    let newX = Math.max(10, Math.min(pos.x, maxX))
    let newY = Math.max(10, Math.min(pos.y, maxY))

    if (newX !== pos.x || newY !== pos.y) {
      const nextPos = { x: newX, y: newY }
      setPosition(nextPos)
      sessionStorage.setItem('hybent_hiring_copilot_pos', JSON.stringify(nextPos))
    }
  }, [])

  const keepFabInBounds = useCallback((pos: { x: number; y: number } | null) => {
    if (!pos) return
    const w = window.innerWidth
    const h = window.innerHeight

    const maxX = Math.max(10, w - 56 - 10)
    const maxY = Math.max(10, h - 56 - 10)

    let newX = Math.max(10, Math.min(pos.x, maxX))
    let newY = Math.max(10, Math.min(pos.y, maxY))

    if (newX !== pos.x || newY !== pos.y) {
      const nextPos = { x: newX, y: newY }
      setFabPosition(nextPos)
      sessionStorage.setItem('hybent_hiring_copilot_fab_pos', JSON.stringify(nextPos))
    }
  }, [])

  useEffect(() => {
    if (!position || !isOpen) return
    const timer = setTimeout(() => {
      keepInBounds(position, isMinimized)
    }, 50)
    return () => clearTimeout(timer)
  }, [isOpen, isMinimized, position, keepInBounds])

  useEffect(() => {
    if (!fabPosition) return
    const timer = setTimeout(() => {
      keepFabInBounds(fabPosition)
    }, 50)
    return () => clearTimeout(timer)
  }, [fabPosition, keepFabInBounds])

  useEffect(() => {
    const handleResize = () => {
      keepInBounds(position, isMinimized)
      keepFabInBounds(fabPosition)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [position, isMinimized, keepInBounds, fabPosition, keepFabInBounds])

  const openHistory = useCallback(() => {
    setHistoryOpen(true)
    refetchConversations()
  }, [refetchConversations])

  // Wrap hook's loadConversation so it also closes the history panel
  const loadConversation = useCallback(async (id: string) => {
    await loadConversationFromHook(id)
    setHistoryOpen(false)
  }, [loadConversationFromHook])

  // Restore messages on mount/reload if conversationId is active but messages are cached empty
  useEffect(() => {
    if (conversationId && messages.length === 0) {
      loadConversationFromHook(conversationId)
    }
  }, [conversationId, messages.length, loadConversationFromHook])

  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const handleClearAll = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowClearConfirm(true)
  }, [])

  const confirmClearAll = useCallback(async () => {
    // Empty the open thread right away rather than after the server replies.
    useCopilotStore.getState().startNewConversation()
    setShowClearConfirm(false)
    await deleteAll()
  }, [deleteAll])

  const [pendingApproval, setPendingApproval] = useState<any>(null)

  // Textarea auto-resize
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    inputRef.current = e.target.value
    updateSuggestions(e.target.value)

    // Stop recording immediately and cancel refinements if typing
    if (isRecording) {
      interruptedByTypingRef.current = true
      if (recognitionRef.current) {
        recognitionRef.current.interruptedByTyping = true
      }
      stopRecording()
    }

    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  // Send message
  const handleSend = useCallback(async (text?: string, approvedToolCall?: any) => {
    const isApproval = !!approvedToolCall
    // Use textarea DOM value as ground truth (always current regardless of how text was set)
    // Fall back to inputRef then empty string
    const currentValue = textareaRef.current?.value ?? inputRef.current
    const msg = text !== undefined ? text.trim() : currentValue.trim()

    if (!msg && !isApproval) return
    if (isThinking) return

    const historySnapshot = useCopilotStore.getState().messages
    const activeConvId = useCopilotStore.getState().conversationId
    const wasNewConversation = !activeConvId

    addMessage({ role: 'user', content: isApproval ? '👍 Action Approved' : msg })

    if (!isApproval) {
      setInput('')
      inputRef.current = ''
      setCandidateSuggestions([])
      if (textareaRef.current) {
        textareaRef.current.value = ''
        textareaRef.current.style.height = 'auto'
      }
    }

    setThinking(true)
    setPendingApproval(null)

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      let messageAdded = false

      await copilotApi.chatStream(
        isApproval ? 'User approved the action. Please proceed.' : msg,
        historySnapshot.slice(-10),
        pageContext ?? undefined,
        activeConvId,
        approvedToolCall,
        controller.signal,
        {
          onMeta: (data) => {
            if (data.conversation_id) {
              setConversationId(data.conversation_id)
              if (wasNewConversation) scheduleRefetchForNewTitle()
            }
          },
          onChunk: (content) => {
            if (!messageAdded) {
              messageAdded = true
              setThinking(false)
              addMessage({ role: 'assistant', content: '' })
            }
            useCopilotStore.getState().updateLastMessageContent(content)
          },
          onStep: (step) => {
            if (!messageAdded) {
              messageAdded = true
              setThinking(false)
              addMessage({ role: 'assistant', content: '' })
            }
            useCopilotStore.getState().upsertLastMessageStep(step)
          },
          onApproval: (data) => {
            if (!messageAdded) {
              messageAdded = true
              setThinking(false)
              addMessage({ role: 'assistant', content: data.reply || 'I need your approval to proceed.' })
            }
            if (data.pending_tool_call) {
              setPendingApproval(data.pending_tool_call)
            }
          },
          onDone: () => {
            if (!messageAdded) {
              setThinking(false)
            }
            if (isApproval) {
              queryClient.invalidateQueries({ queryKey: ['candidates_pipeline'] })
              queryClient.invalidateQueries({ queryKey: ['candidates'] })
              queryClient.invalidateQueries({ queryKey: ['interviews'] })
              queryClient.invalidateQueries({ queryKey: ['recent-activities'] })
              queryClient.invalidateQueries({ queryKey: ['analytics-overview'] })
              queryClient.invalidateQueries({ queryKey: ['candidates-for-schedule'] })
            }
          },
          onError: (err) => {
            if (controller.signal.aborted) return
            const errMsg = err?.message || 'Sorry, I encountered an error. Please try again.'
            if (!messageAdded) {
              messageAdded = true
              setThinking(false)
              addMessage({ role: 'assistant', content: `⚠️ ${errMsg}` })
            } else {
              useCopilotStore.getState().updateLastMessageContent(`\n\n⚠️ ${errMsg}`)
            }
          }
        }
      )

    } finally {
      setThinking(false)
      useCopilotStore.getState().finishLastMessageSteps()
      // Re-focus textarea so user can immediately type the next message
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [isThinking, pageContext, addMessage, setThinking, setConversationId, queryClient, scheduleRefetchForNewTitle])

  // ——— Focus management —————————————————————————————————————————————————
  // Auto-focus textarea when STT finishes and transcript is ready to send
  useEffect(() => {
    if (sttStatus === 'ready') {
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [sttStatus])

  // Auto-focus textarea when copilot panel opens
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => textareaRef.current?.focus(), 150)
    }
  }, [isOpen, isMinimized])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      e.stopPropagation()
      handleSend()
    }
  }, [handleSend])

  // Recording Logic
  const getSupportedMimeType = (): string => {
    const preferred = 'audio/webm;codecs=opus'
    if (MediaRecorder.isTypeSupported(preferred)) return preferred
    if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm'
    // Fallback to default
    return ''
  }

  const drawWaveform = () => {
    if (!analyserRef.current || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const analyser = analyserRef.current
    
    // We want frequency data
    analyser.fftSize = 64
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    
    const draw = () => {
      if (!canvasRef.current) return
      animationFrameRef.current = requestAnimationFrame(draw)
      
      analyser.getByteFrequencyData(dataArray)
      
      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)
      
      const centerY = h / 2
      
      // Draw 16 bars with rounded corners, symmetric
      const barCount = 16
      const barWidth = 4
      const gap = 3
      const startX = (w - (barCount * barWidth + (barCount - 1) * gap)) / 2
      
      for (let i = 0; i < barCount; i++) {
        const dataIdx = Math.floor((i / barCount) * bufferLength)
        const value = dataArray[dataIdx] || 0
        const percent = value / 255
        const barHeight = Math.max(3, percent * (h - 6))
        
        const x = startX + i * (barWidth + gap)
        const y = centerY - barHeight / 2
        
        /* The brand gradient's own stops. Canvas cannot read a CSS custom
           property, so these are the literal values behind `--hb-grad` — the
           one place in the product where a hex is unavoidable. Previously
           pink→violet→pink, neither of which is a Hybent colour. */
        const grad = ctx.createLinearGradient(x, y, x, y + barHeight)
        grad.addColorStop(0, '#22CFFF')   // cyan
        grad.addColorStop(0.5, '#4C6FFF') // blue
        grad.addColorStop(1, '#A855F7')   // violet

        ctx.fillStyle = grad
        
        ctx.beginPath()
        if (ctx.roundRect) {
          ctx.roundRect(x, y, barWidth, barHeight, 2)
        } else {
          ctx.rect(x, y, barWidth, barHeight)
        }
        ctx.fill()
      }
    }
    
    draw()
  }

  const startStandardAudioRecording = useCallback(async () => {
    setAudioError(null)
    try {
      if (typeof MediaRecorder === 'undefined') {
        setAudioError('Audio recording is not supported by your browser.')
        return
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true
        }
      })
      streamRef.current = stream
      
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (AudioCtx) {
        const audioCtx = new AudioCtx()
        const analyser = audioCtx.createAnalyser()
        const source = audioCtx.createMediaStreamSource(stream)
        source.connect(analyser)
        
        audioContextRef.current = audioCtx
        analyserRef.current = analyser
      }
      
      const mimeType = getSupportedMimeType()
      const options = mimeType ? { mimeType } : undefined
      const recorder = new MediaRecorder(stream, options as any)
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current)
          timerIntervalRef.current = null
        }
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
          animationFrameRef.current = null
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop())
          streamRef.current = null
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close()
          audioContextRef.current = null
        }

        if (interruptedByTypingRef.current) {
          interruptedByTypingRef.current = false
          setSttStatus('idle')
          return
        }

        const mime = getSupportedMimeType() || 'audio/webm'
        const audioBlob = new Blob(audioChunksRef.current, { type: mime })
        
        if (audioBlob.size === 0) return
        
        setIsTranscribing(true)
        try {
          const res = await copilotApi.transcribe(audioBlob)
          const text = res.data.text.trim()
          if (text) {
            setSttStatus('refining')
            const cleanRes = await copilotApi.cleanTranscript(text)
            const cleanedText = cleanRes.data.text.trim() || text
            setInput(cleanedText)
            inputRef.current = cleanedText
            setLiveTranscript(cleanedText)
            setSttStatus('ready')
          } else {
            setAudioError('No speech detected. Please speak clearly.')
          }
        } catch (err: any) {
          const detail = err?.response?.data?.message || err?.message || 'Unknown error'
          console.error('Transcription error:', err?.response?.data || err)
          setAudioError(`Transcription failed: ${detail}`)
        } finally {
          setIsTranscribing(false)
        }
      }

      recorder.start()
      setIsRecording(true)

      setTimeout(() => {
        if (analyserRef.current) {
          drawWaveform()
        }
      }, 50)
      
      setRecordingSeconds(0)
      timerIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 59) {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
              mediaRecorderRef.current.stop()
            }
            setIsRecording(false)
            return 60
          }
          return prev + 1
        })
      }, 1000)

    } catch (err: any) {
      console.error('Microphone access error:', err)
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setAudioError('Microphone permission denied. Please allow mic access in your settings.')
      } else {
        setAudioError('Could not access microphone. Ensure it is connected and not in use.')
      }
    }
  }, [])

  const stopStandardAudioRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
  }, [])

  const startSpeechRecognition = useCallback(() => {
    setAudioError(null)
    setLiveTranscript('')
    if (recognitionRef.current) {
      recognitionRef.current.accumulated = ''
      recognitionRef.current.isListening = true
      try {
        recognitionRef.current.start()
        setIsRecording(true)
        setSttStatus('listening')
      } catch (err: any) {
        console.error('Failed to start speech recognition:', err)
        startStandardAudioRecording()
      }
    } else {
      startStandardAudioRecording()
    }
  }, [isSpeechSupported, startStandardAudioRecording])

  const stopSpeechRecognition = useCallback(async () => {
    if (recognitionRef.current) {
      if (recognitionRef.current.isListening) {
        recognitionRef.current.isListening = false
        try {
          recognitionRef.current.stop()
        } catch (err) {
          console.error(err)
        }
      }
    }
    
    setIsRecording(false)

    if (recognitionRef.current && recognitionRef.current.interruptedByTyping) {
      recognitionRef.current.interruptedByTyping = false
      interruptedByTypingRef.current = false
      setSttStatus('idle')
      return
    }
    if (interruptedByTypingRef.current) {
      interruptedByTypingRef.current = false
      setSttStatus('idle')
      return
    }

    // Process the live transcript
    const rawText = recognitionRef.current ? recognitionRef.current.accumulated : ''
    if (!rawText.trim()) {
      setSttStatus('idle')
      return
    }
    
    setSttStatus('refining')
    try {
      const res = await copilotApi.cleanTranscript(rawText)
      const refinedText = res.data.text.trim()
      if (refinedText) {
        setInput(refinedText)
        inputRef.current = refinedText
        setLiveTranscript(refinedText)
        setSttStatus('ready')
      } else {
        setSttStatus('idle')
        setAudioError('Could not process speech. Please try again.')
      }
    } catch (err: any) {
      console.error('Refinement failed:', err)
      setInput(rawText)
      inputRef.current = rawText
      setLiveTranscript(rawText)
      setSttStatus('ready')
    }
  }, [])

  const startRecording = useCallback(() => {
    if (isSpeechSupported) {
      startSpeechRecognition()
    } else {
      startStandardAudioRecording()
    }
  }, [isSpeechSupported, startSpeechRecognition, startStandardAudioRecording])

  const stopRecording = useCallback(() => {
    if (isSpeechSupported) {
      stopSpeechRecognition()
    } else {
      stopStandardAudioRecording()
    }
  }, [isSpeechSupported, stopSpeechRecognition, stopStandardAudioRecording])

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }, [isRecording, startRecording, stopRecording])

  // Update the ref whenever stopRecording changes to break circular useEffect deps
  useEffect(() => {
    stopRecordingRef.current = stopRecording
  }, [stopRecording])

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  // Drag-and-drop mouse move handler
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return // Left click only
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('a') || target.closest('input') || target.closest('textarea') || target.closest('.c-icon-btn')) {
      return
    }

    const panelEl = headerRef.current?.parentElement
    if (!panelEl) return

    const rect = panelEl.getBoundingClientRect()
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      widgetX: rect.left,
      widgetY: rect.top,
    }

    setIsDragging(true)
    document.body.style.userSelect = 'none'

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragStartRef.current) return
      const deltaX = moveEvent.clientX - dragStartRef.current.mouseX
      const deltaY = moveEvent.clientY - dragStartRef.current.mouseY

      let newX = dragStartRef.current.widgetX + deltaX
      let newY = dragStartRef.current.widgetY + deltaY

      const w = window.innerWidth
      const h = window.innerHeight
      newX = Math.max(10, Math.min(newX, w - rect.width - 10))
      newY = Math.max(10, Math.min(newY, h - rect.height - 10))

      const nextPos = { x: newX, y: newY }
      setPosition(nextPos)
      sessionStorage.setItem('hybent_hiring_copilot_pos', JSON.stringify(nextPos))
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  // Drag-and-drop touch move handler
  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('a') || target.closest('input') || target.closest('textarea') || target.closest('.c-icon-btn')) {
      return
    }

    const panelEl = headerRef.current?.parentElement
    if (!panelEl) return

    const rect = panelEl.getBoundingClientRect()
    const touch = e.touches[0]
    dragStartRef.current = {
      mouseX: touch.clientX,
      mouseY: touch.clientY,
      widgetX: rect.left,
      widgetY: rect.top,
    }

    setIsDragging(true)
    document.body.style.userSelect = 'none'

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (!dragStartRef.current) return
      const t = moveEvent.touches[0]
      const deltaX = t.clientX - dragStartRef.current.mouseX
      const deltaY = t.clientY - dragStartRef.current.mouseY

      let newX = dragStartRef.current.widgetX + deltaX
      let newY = dragStartRef.current.widgetY + deltaY

      const w = window.innerWidth
      const h = window.innerHeight
      newX = Math.max(10, Math.min(newX, w - rect.width - 10))
      newY = Math.max(10, Math.min(newY, h - rect.height - 10))

      const nextPos = { x: newX, y: newY }
      setPosition(nextPos)
      sessionStorage.setItem('hybent_hiring_copilot_pos', JSON.stringify(nextPos))
    }

    const handleTouchEnd = () => {
      setIsDragging(false)
      document.body.style.userSelect = ''
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
    }

    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleTouchEnd)
  }

  const fabDragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number; moved: boolean } | null>(null)

  const handleFabMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return // Left click only
    e.preventDefault()

    const fabEl = e.currentTarget as HTMLElement
    const rect = fabEl.getBoundingClientRect()
    
    fabDragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: rect.left,
      startY: rect.top,
      moved: false,
    }

    setIsFabDragging(true)
    document.body.style.userSelect = 'none'

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!fabDragStartRef.current) return
      const deltaX = moveEvent.clientX - fabDragStartRef.current.mouseX
      const deltaY = moveEvent.clientY - fabDragStartRef.current.mouseY

      if (Math.hypot(deltaX, deltaY) > 5) {
        fabDragStartRef.current.moved = true
      }

      let newX = fabDragStartRef.current.startX + deltaX
      let newY = fabDragStartRef.current.startY + deltaY

      const w = window.innerWidth
      const h = window.innerHeight
      
      newX = Math.max(10, Math.min(newX, w - rect.width - 10))
      newY = Math.max(10, Math.min(newY, h - rect.height - 10))

      const nextPos = { x: newX, y: newY }
      setFabPosition(nextPos)
      sessionStorage.setItem('hybent_hiring_copilot_fab_pos', JSON.stringify(nextPos))
    }

    const handleMouseUp = () => {
      setIsFabDragging(false)
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)

      if (fabDragStartRef.current && !fabDragStartRef.current.moved) {
        toggle()
      }
      fabDragStartRef.current = null
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const handleFabTouchStart = (e: React.TouchEvent) => {
    const fabEl = e.currentTarget as HTMLElement
    const rect = fabEl.getBoundingClientRect()
    const touch = e.touches[0]
    
    fabDragStartRef.current = {
      mouseX: touch.clientX,
      mouseY: touch.clientY,
      startX: rect.left,
      startY: rect.top,
      moved: false,
    }

    setIsFabDragging(true)
    document.body.style.userSelect = 'none'

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (!fabDragStartRef.current) return
      const t = moveEvent.touches[0]
      const deltaX = t.clientX - fabDragStartRef.current.mouseX
      const deltaY = t.clientY - fabDragStartRef.current.mouseY

      if (Math.hypot(deltaX, deltaY) > 5) {
        fabDragStartRef.current.moved = true
      }

      let newX = fabDragStartRef.current.startX + deltaX
      let newY = fabDragStartRef.current.startY + deltaY

      const w = window.innerWidth
      const h = window.innerHeight
      newX = Math.max(10, Math.min(newX, w - rect.width - 10))
      newY = Math.max(10, Math.min(newY, h - rect.height - 10))

      const nextPos = { x: newX, y: newY }
      setFabPosition(nextPos)
      sessionStorage.setItem('hybent_hiring_copilot_fab_pos', JSON.stringify(nextPos))
    }

    const handleTouchEnd = () => {
      setIsFabDragging(false)
      document.body.style.userSelect = ''
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)

      if (fabDragStartRef.current && !fabDragStartRef.current.moved) {
        toggle()
      }
      fabDragStartRef.current = null
    }

    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleTouchEnd)
  }

  const parseCandidateCard = (text: string): CandidateCardData | null => {
    if (!text.includes('👤')) return null
    // search_users' team-member blocks use the same 👤 name line but a
    // "🔑 Role:" field candidates never have — a team member isn't a
    // candidate, has no profile page, and offering a "View profile" button
    // for one is at best a dead link, at worst a navigation to the wrong
    // record when a team member and a candidate happen to share a name.
    if (text.includes('🔑')) return null
    const lines = text.split('\n')
    const card: CandidateCardData = { name: '' }
    
    for (const line of lines) {
      const trimmed = line.trim()
      
      if (trimmed.includes('👤')) {
        const match = trimmed.match(/👤\s*(.*)/)
        if (match) {
          card.name = match[1].replace(/\*\*/g, '').trim()
        }
      } else if (trimmed.includes('📧')) {
        const match = trimmed.match(/📧\s*(.*)/)
        if (match) card.email = match[1].replace(/\*\*/g, '').trim()
      } else if (trimmed.includes('💼')) {
        const match = trimmed.match(/💼\s*(.*)/)
        if (match) card.title = match[1].replace(/\*\*/g, '').trim()
      } else if (trimmed.includes('📍')) {
        const match = trimmed.match(/📍\s*(.*)/)
        if (match) card.location = match[1].replace(/\*\*/g, '').trim()
      } else if (trimmed.includes('⭐')) {
        const match = trimmed.match(/⭐\s*(.*)/)
        if (match) card.experience = match[1].replace(/\*\*/g, '').trim()
      } else if (trimmed.includes('🛠️')) {
        const match = trimmed.match(/🛠️\s*(.*)/)
        if (match) card.skills = match[1].replace(/\*\*/g, '').trim()
      } else if (trimmed.includes('⏳')) {
        const match = trimmed.match(/⏳\s*(.*)/)
        if (match) card.notice = match[1].replace(/\*\*/g, '').trim()
      } else if (trimmed.includes('📌')) {
        const match = trimmed.match(/📌\s*(.*)/)
        if (match) card.stage = match[1].replace(/\*\*/g, '').trim()
      } else if (trimmed.includes('💰')) {
        const match = trimmed.match(/💰\s*(.*)/)
        if (match) card.salary = match[1].replace(/\*\*/g, '').trim()
      }
    }
    
    return card.name ? card : null
  }

  const navigateToCandidate = useCallback((candidateId: string) => {
    const role = useAuthStore.getState().user?.role
    const basePath = role === 'admin' ? '/hiring/admin' : '/hiring/recruiter'
    // ?openId=<id> is the same deep link the pre-screening review flow already
    // uses to land directly on a candidate's profile — CandidatesPage picks
    // it up in a useEffect and opens the profile overlay for that id.
    const path = `${basePath}/candidates?openId=${encodeURIComponent(candidateId)}`
    if (window.history && window.history.pushState) {
      window.history.pushState({}, '', path)
      window.dispatchEvent(new PopStateEvent('popstate', { state: {} }))
    } else {
      window.location.href = path
    }
  }, [])

  // Cards from the Copilot carry a name (and an email on detailed cards), so
  // opening a profile means resolving that to an id first via the suggest
  // endpoint, then deep-linking with ?openId=<id>. Match on email first, then
  // the exact name including its capitalisation — "YASH DESAI" and
  // "Yash Desai" can be two different records — and never guess between two
  // candidates who share a name.
  const handleViewProfile = useCallback(async (card: CandidateCardData) => {
    const name = card.name
    try {
      const res = await candidatesApi.suggest(name)
      const items: Array<{ id: string; full_name?: string; email?: string }> = res.data || []
      if (items.length === 0) {
        toast.error(`Couldn't find "${name}" — try searching for them manually.`)
        return
      }
      const byEmail = card.email
        ? items.filter((c) => c.email?.toLowerCase() === card.email!.toLowerCase())
        : []
      const sameCase = items.filter((c) => c.full_name === name)
      const anyCase = items.filter((c) => c.full_name?.toLowerCase() === name.toLowerCase())
      const match =
        byEmail.length === 1 ? byEmail[0]
        : sameCase.length === 1 ? sameCase[0]
        : anyCase.length === 1 ? anyCase[0]
        : anyCase.length === 0 && items.length === 1 ? items[0]
        : null
      if (!match) {
        toast.error(`More than one candidate is named "${name}" — open the right one from the Candidates page.`)
        return
      }
      navigateToCandidate(match.id)
    } catch (err) {
      console.error('View profile error:', err)
      toast.error("Could not open that candidate's profile.")
    }
  }, [navigateToCandidate])

  const renderBotMessageContent = (content: string) => {
    // Check for CTA_BUTTON
    const ctaMatch = content.match(/\[CTA_BUTTON:(.*?)\]/)
    let ctaButtonText = ''
    let cleanContent = content
    if (ctaMatch) {
      ctaButtonText = ctaMatch[1]
      cleanContent = content.replace(/\[CTA_BUTTON:.*?\]/g, '').trim()
    }

    // [PENDING_TOOL:name] — a backend-only marker (COPILOT_SYSTEM_PROMPT §5)
    // that tells the *next* turn a short reply like "Technical Round" is
    // continuing this write-tool clarification, not a fresh question. Purely
    // for the backend's own history parsing — never shown to the recruiter.
    cleanContent = cleanContent.replace(/\n*\[PENDING_TOOL:.*?\]/g, '').trim()

    // [SUGGEST:label one|label two] — the Copilot's next-action suggestions
    // (see COPILOT_SYSTEM_PROMPT §7). Rendered as chips; clicking one sends
    // its label as the next message, same as the onboarding prompt cards do.
    // A reply can carry more than one group (e.g. interview stage AND
    // interviewer choices) — each becomes its own row so it's clear they're
    // separate decisions, not one flat list to pick one item out of.
    const suggestionGroups = Array.from(cleanContent.matchAll(/\[SUGGEST:(.*?)\]/g)).map((m) =>
      m[1].split('|').map((s) => s.trim()).filter(Boolean)
    )
    if (suggestionGroups.length > 0) {
      cleanContent = cleanContent.replace(/\[SUGGEST:.*?\]/g, '').trim()
    }

    const renderSuggestions = () =>
      suggestionGroups.length > 0 ? (
        <div className="mt-2.5 flex flex-col gap-1.5">
          {suggestionGroups.map((group, gi) => (
            <div key={gi} className="flex flex-wrap gap-1.5">
              {group.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleSend(label)}
                  className="rounded-hb-full border border-hb-border bg-hb-surface px-3 py-1.5 text-hb-xs font-medium text-hb-cyan transition-colors duration-hb hover:border-hb-cyan/50 hover:bg-hb-cyan/10"
                >
                  {label}
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null

    const isJD =
      cleanContent.includes('Role Overview') ||
      cleanContent.includes('Key Responsibilities') ||
      cleanContent.includes('Required Qualifications') ||
      cleanContent.includes('**Position:**') ||
      (ctaButtonText && ctaButtonText.toLowerCase().includes('job')) ||
      (ctaButtonText && ctaButtonText.toLowerCase().includes('jd'))

    // Split on horizontal rule dividers between candidate cards ONLY if candidate cards exist
    const hasCandidateCards = cleanContent.includes('👤')
    const parts = hasCandidateCards ? cleanContent.split(/\n\n---\n\n|\n---\n/) : [cleanContent]

    const handleCtaClick = () => {
      try {
        const role = useAuthStore.getState().user?.role
        const basePath = role === 'admin' ? '/hiring/admin' : '/hiring/recruiter'
        const path = `${basePath}/jobs/new`
        if (window.history && window.history.pushState) {
          window.history.pushState({}, '', path)
          window.dispatchEvent(new PopStateEvent('popstate', { state: {} }))
        } else {
          window.location.href = path
        }
      } catch (err) {
        console.error('CTA redirect error:', err)
      }
    }

    const renderGenericCta = () => {
      if (!ctaButtonText) return null
      return (
        <button
          onClick={handleCtaClick}
          style={{
            marginTop: '12px',
            background: 'var(--hb-grad-diag)',
            border: 'none',
            borderRadius: '10px',
            color: 'rgb(var(--hb-on-brand))',
            cursor: 'pointer',
            padding: '10px 20px',
            fontSize: '13px',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: 'var(--hb-sh-1)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none' }}
        >
          <span>✨</span> {ctaButtonText} <span>→</span>
        </button>
      )
    }

    if (parts.length <= 1) {
      return (
        <div className="flex w-full flex-col items-start">
          <div className="w-full min-w-0">
            <CopilotMarkdown>{cleanContent}</CopilotMarkdown>
          </div>
          {isJD ? (
            <JDActionBar content={cleanContent} ctaText={ctaButtonText || 'Save JD & Apply to Form'} />
          ) : (
            renderGenericCta()
          )}
          {renderSuggestions()}
        </div>
      )
    }

    return (
      <div className="flex w-full min-w-0 flex-col gap-3.5">
        {parts.map((part, idx) => {
          const candidate = parseCandidateCard(part)
          if (candidate) {
            return <CandidateCard key={idx} candidate={candidate} onViewProfile={handleViewProfile} />
          }
          const trimmedPart = part.trim()
          if (!trimmedPart) return null
          return (
            <CopilotMarkdown key={idx}>{trimmedPart}</CopilotMarkdown>
          )
        })}
        {isJD ? (
          <JDActionBar content={cleanContent} ctaText={ctaButtonText || 'Save JD & Apply to Form'} />
        ) : (
          renderGenericCta()
        )}
        {renderSuggestions()}
      </div>
    )
  }

  const handleNewChat = () => {
    startNewConversation()
    setHistoryOpen(false)
  }

  const dragStyle: React.CSSProperties = position
    ? { left: `${position.x}px`, top: `${position.y}px`, bottom: 'auto', right: 'auto' }
    : fabPosition
      ? (() => {
          const w = window.innerWidth
          const h = window.innerHeight
          let panelX = fabPosition.x + 28 - 200
          let panelY = fabPosition.y - 600 - 15
          if (panelY < 10) {
            panelY = fabPosition.y + 56 + 15
          }
          panelX = Math.max(10, Math.min(panelX, w - 400 - 10))
          panelY = Math.max(10, Math.min(panelY, h - 600 - 10))
          return { left: `${panelX}px`, top: `${panelY}px`, bottom: 'auto', right: 'auto' }
        })()
      : {}

  const fabDragStyle: React.CSSProperties = fabPosition
    ? { left: `${fabPosition.x}px`, top: `${fabPosition.y}px`, bottom: 'auto', right: 'auto' }
    : {}

  const minimizeStyle: React.CSSProperties = isMinimized
    ? { height: '56px', maxHeight: '56px', overflow: 'hidden' }
    : {}

  if (activeChatRecipient || isCopilotPage) {
    return null
  }

  // `grouped` comes from useCopilotConversations hook above

  return (
    <>
      <style>{`
        @keyframes copilotSlideUp { from { opacity:0; transform:translateY(20px) scale(0.95); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes copilotDot { 0%,80%,100% { transform:translateY(0); opacity:0.3; } 40% { transform:translateY(-4px); opacity:1; background:rgb(var(--hb-magenta)); } }
        .c-dot { display:inline-block; width:6px; height:6px; border-radius:50%; background:rgb(var(--hb-blue)); animation:copilotDot 1.2s infinite ease-in-out; }
        .c-dot:nth-child(2){animation-delay:0.2s;} .c-dot:nth-child(3){animation-delay:0.4s;}
        .c-fab:hover { transform:scale(1.08) translateY(-4px) !important; box-shadow:var(--hb-sh-2) !important; }
        .c-icon-btn:hover { background:rgb(var(--hb-surface-2)) !important; color:rgb(var(--hb-text)) !important; }
        .c-send:hover { opacity:0.9; transform:scale(1.05); }
        .c-send:disabled { background:rgb(var(--hb-surface)) !important; color:rgb(var(--hb-muted)) !important; box-shadow:none !important; transform:none !important; cursor:not-allowed !important; }
        .c-card:hover { background:rgb(var(--hb-surface-2)) !important; border-color:rgb(var(--hb-blue)) !important; transform:translateY(-2px); }
        .c-input:focus { border-color:rgb(var(--hb-blue)) !important; box-shadow:0 0 0 3px rgb(var(--hb-surface-2)) !important; }
        .c-hist-item:hover { background:rgb(var(--hb-surface-2)) !important; border-color:rgb(var(--hb-blue)) !important; }
        .c-hist-del:hover { opacity:1 !important; color:rgb(var(--hb-magenta)) !important; }
        .c-clear-all:hover { opacity:0.8; color:rgb(var(--hb-magenta)) !important; text-shadow: 0 0 4px rgb(var(--hb-magenta) / .2); }
        .c-new-chat:hover { opacity:0.9; transform:scale(1.02); }
        .c-back:hover { color:rgb(var(--hb-text)) !important; }
        .c-messages::-webkit-scrollbar,.c-hist-list::-webkit-scrollbar { width:5px; }
        .c-messages::-webkit-scrollbar-track,.c-hist-list::-webkit-scrollbar-track { background:transparent; }
        .c-messages::-webkit-scrollbar-thumb,.c-hist-list::-webkit-scrollbar-thumb { background:rgb(var(--hb-blue) / .35); border-radius:10px; }
        .c-bot p{margin:0 0 10px 0;} .c-bot p:last-child{margin:0;} .c-bot ul,.c-bot ol{margin:6px 0 10px 20px;padding:0;} .c-bot li{margin:4px 0;}
        .c-bot strong{color:rgb(var(--hb-text));font-weight:600;}
        .c-bot code{background:rgb(var(--hb-surface-2));border-radius:6px;padding:2px 6px;font-size:13px;font-family:ui-monospace,monospace;color:rgb(var(--hb-magenta));border:1px solid var(--hb-border);}
        .c-bot pre{background:rgb(var(--hb-surface-2));padding:12px;border-radius:8px;overflow-x:auto;margin:10px 0;border:1px solid var(--hb-border);}
        .c-bot pre code{background:transparent;border:none;padding:0;color:rgb(var(--hb-text));}
        @keyframes micPulse { 0% { transform: scale(1); box-shadow: 0 0 0 0 rgb(var(--hb-error) / .4); } 70% { transform: scale(1.1); box-shadow: 0 0 0 10px rgb(var(--hb-error) / 0); } 100% { transform: scale(1); box-shadow: 0 0 0 0 rgb(var(--hb-error) / 0); } }
        @keyframes recordBlink { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
        .c-blink { animation: recordBlink 1.5s infinite ease-in-out; }
      `}</style>

      {/* FAB */}
      <button 
        className="c-fab" 
        style={{
          ...s.fab,
          ...fabDragStyle,
          transition: isFabDragging ? 'none' : s.fab.transition,
          cursor: isFabDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          WebkitUserSelect: 'none'
        }} 
        onMouseDown={handleFabMouseDown}
        onTouchStart={handleFabTouchStart}
        aria-label="Open AI Copilot"
      >
        {isOpen ? <CloseIcon /> : '✦'}
      </button>

      {/* Panel */}
      {isOpen && (
        <div 
          style={{ 
            ...s.panel, 
            ...dragStyle, 
            ...minimizeStyle,
            boxShadow: isDragging ? '0 20px 40px rgba(0,0,0,0.25)' : s.panel.boxShadow,
            transition: isDragging ? 'none' : 'box-shadow 0.3s ease, height 0.3s ease, max-height 0.3s ease',
            overflow: isMinimized ? 'hidden' : 'hidden',
          }} 
          role="dialog" 
          aria-label="AI Copilot"
        >
          {/* Header */}
          <div 
            ref={headerRef}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            style={{ 
              ...s.header, 
              cursor: isDragging ? 'grabbing' : 'grab',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              minHeight: '56px',
            }}
          >
            {historyOpen ? (
              <>
                <button className="c-back" style={s.backBtn} onClick={() => setHistoryOpen(false)}>
                  <BackIcon /> Back
                </button>
                <button className="c-new-chat" style={s.newChatBtn} onClick={handleNewChat}>
                  <PlusIcon /> New Chat
                </button>
              </>
            ) : (
              <>
                <div style={s.headerTitle}>
                  <span className="hb-grad-text text-[18px]">✦</span>
                  <span>Recruiter Copilot</span>
                  {isThinking && <span className="text-hb-xs font-normal text-hb-blue/40">thinking...</span>}
                </div>
                <div style={s.headerActions}>
                  <button
                    className="c-icon-btn"
                    style={s.iconBtn}
                    title="Open in full page"
                    onClick={() => {
                      const role = useAuthStore.getState().user?.role
                      const base = role === 'admin' ? '/hiring/admin' : '/hiring/recruiter'
                      const dest = conversationId ? `${base}/copilot/${conversationId}` : `${base}/copilot`
                      navigate(dest)
                      close()
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M10 14L21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                  </button>
                  <button className="c-icon-btn" style={s.iconBtn} onClick={openHistory} title="Chat history"><HistoryIcon /></button>
                  <button className="c-icon-btn" style={s.iconBtn} onClick={handleNewChat} title="New chat"><PlusIcon /></button>
                  <button className="c-icon-btn" style={s.iconBtn} onClick={close} title="Close"><CloseIcon /></button>
                </div>
              </>
            )}
          </div>

          {!isMinimized && (
            <>
              {/* History Panel */}
              {historyOpen ? (
                <div style={s.historyPanel}>
                  {/* Global Clear All button */}
                  {conversations.length > 0 && !historyLoading && !convLoading && (
                    <div className="flex justify-end px-6 pt-2">
                      <button
                        className="c-clear-all"
                        onClick={handleClearAll}
                        style={{
                          background: 'transparent', border: 'none', color: 'rgb(var(--hb-muted))',
                          cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                          display: 'flex', alignItems: 'center', gap: '4px',
                          padding: '4px 8px', borderRadius: '6px', transition: 'all 0.2s ease'
                        }}
                      >
                        🗑️ Clear All History
                      </button>
                    </div>
                  )}
                  {historyLoading || convLoading ? (
                    <div style={s.loadingRow}>
                      <span className="c-dot" /><span className="c-dot" /><span className="c-dot" />
                    </div>
                  ) : conversations.length === 0 ? (
                    <div style={s.historyEmpty}>
                      <span className="text-[36px]">🕒</span>
                      <div>No past conversations yet.</div>
                      <div className="text-hb-xs opacity-70">Your chats will appear here.</div>
                    </div>
                  ) : (
                    <div className="c-hist-list" style={s.historyList}>
                      {Object.entries(grouped).map(([group, items]) =>
                        items.length === 0 ? null : (
                          <div key={group}>
                            <div style={{
                              ...s.historyGroup,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}>
                              <span>{group}</span>
                              {group.toLowerCase() === 'today' && (
                                <button
                                  className="c-clear-all"
                                  onClick={handleClearAll}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'rgb(var(--hb-magenta))',
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    transition: 'all 0.2s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                  }}
                                >
                                  Clear All
                                </button>
                              )}
                            </div>
                            {items.map((conv) => (
                              <div
                                key={conv.id}
                                className="c-hist-item"
                                style={{ ...s.historyItem, borderColor: conv.id === conversationId ? 'rgb(var(--hb-blue))' : undefined }}
                                onClick={() => loadConversation(conv.id)}
                              >
                                <div style={s.historyItemTitle} title={conv.title}>{conv.title}</div>
                                <div style={s.historyItemDate}>{fmtTime(conv.updated_at)}</div>
                                <button
                                  className="c-hist-del"
                                  style={{ ...s.historyDeleteBtn, opacity: deletingConvId ? 0.6 : 1 }}
                                  disabled={!!deletingConvId}
                                  onClick={(e) => deleteConversation(e, conv.id)}
                                  title="Delete"
                                >
                                  {deletingConvId === conv.id ? <span className="c-dot" /> : <TrashIcon />}
                                </button>
                              </div>
                            ))}
                          </div>
                        )
                      )}

                      {/* Custom Delete Confirmation Overlay */}
                      {showClearConfirm && (
                        <div style={{
                          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          zIndex: 10001, padding: '20px',
                        }}>
                          <div style={{
                            background: 'rgb(var(--hb-surface-2))', border: '1px solid rgb(var(--hb-blue) / .35)', borderRadius: '12px',
                            padding: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', maxWidth: '280px', width: '100%', textAlign: 'center'
                          }}>
                            <h4 className="mb-2.5 text-hb-body text-hb-text">Delete All History?</h4>
                            <p className="mb-5 text-hb-sm text-hb-muted">This action cannot be undone and will permanently delete all chat history.</p>
                            <div className="flex gap-2.5">
                              <button
                                onClick={() => setShowClearConfirm(false)}
                                disabled={clearingAll}
                                style={{ flex: 1, padding: '8px', background: 'rgb(var(--hb-surface-2))', color: 'rgb(var(--hb-text))', border: '1px solid var(--hb-border)', borderRadius: '6px', cursor: clearingAll ? 'not-allowed' : 'pointer', fontWeight: 500, opacity: clearingAll ? 0.6 : 1 }}
                              >
                                Cancel
                              </button>
                              <button
                                onClick={confirmClearAll}
                                disabled={clearingAll}
                                style={{ flex: 1, padding: '8px', background: 'rgb(var(--hb-error))', color: 'white', border: 'none', borderRadius: '6px', cursor: clearingAll ? 'not-allowed' : 'pointer', fontWeight: 500, opacity: clearingAll ? 0.7 : 1 }}
                              >
                                {clearingAll ? 'Deleting…' : 'Delete All'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Chat Messages */}
                  <div ref={messagesRef} className="c-messages" style={s.messages}>
                    {convLoading ? (
                      <div style={{ ...s.loadingRow, flex: 1 }}>
                        <span className="c-dot" />&nbsp;<span className="c-dot" />&nbsp;<span className="c-dot" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div style={s.emptyState}>
                        <div style={s.emptyIcon}>✦</div>
                        <div style={s.emptyTitle}>Your Recruiter AI Copilot</div>
                        <div style={s.emptySubtitle}>Ask me anything — candidates, jobs, interviews, offers, or pipeline stats.</div>
                        <div style={s.promptGrid}>
                          {EXAMPLE_PROMPTS.map((item) => (
                            <button key={item.title} className="c-card" style={s.promptCard} onClick={() => handleSend(item.prompt)}>
                              <div style={s.promptCardIcon}>{item.icon}</div>
                              <div style={s.promptCardTitle}>{item.title}</div>
                              <div style={s.promptCardText}>{item.prompt}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <>
                        {messages.map((msg) => (
                          <div 
                            key={msg.id} 
                            style={{ 
                              display: 'flex', 
                              gap: '10px', 
                              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', 
                              maxWidth: msg.role === 'user' ? '85%' : '100%',
                              width: msg.role === 'user' ? 'auto' : '100%',
                              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', 
                              alignItems: 'flex-start',
                              minWidth: 0,
                            }}
                          >
                            {/* Avatar */}
                            {msg.role === 'user' ? (
                              <div style={{ 
                                width: '32px', 
                                height: '32px', 
                                borderRadius: '50%', 
                                background: 'rgb(var(--hb-blue) / .35)', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                fontSize: '11px', 
                                fontWeight: 700, 
                                color: 'rgb(var(--hb-blue))', 
                                flexShrink: 0, 
                                border: '1px solid rgb(var(--hb-blue) / .35)'
                              }}>
                                HR
                              </div>
                            ) : (
                              <div style={{ 
                                width: '32px', 
                                height: '32px', 
                                borderRadius: '50%', 
                                background: 'var(--hb-grad-diag)', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                color: 'rgb(var(--hb-on-brand))',
                                fontSize: '14px', 
                                flexShrink: 0 
                              }}>
                                ✦
                              </div>
                            )}
                            
                            {/* Bubble */}
                            <div style={msg.role === 'user' ? s.userBubble : s.botBubble}>
                              {msg.role === 'user' ? (
                                msg.content
                              ) : (
                                <>
                                  <CopilotSteps
                                    steps={msg.steps}
                                    startedAt={msg.startedAt}
                                    finishedAt={msg.finishedAt}
                                    hasContent={!!msg.content}
                                  />
                                  {msg.content && renderBotMessageContent(msg.content)}
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                        {isThinking && (
                          <div style={{ display: 'flex', gap: '10px', alignSelf: 'flex-start', maxWidth: '85%', alignItems: 'flex-start', width: '100%' }}>
                            <div style={{ 
                              width: '32px', 
                              height: '32px', 
                              borderRadius: '50%', 
                              background: 'var(--hb-grad-diag)', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              color: 'rgb(var(--hb-on-brand))',
                              fontSize: '14px', 
                              flexShrink: 0 
                            }}>
                              ✦
                            </div>
                            <div style={s.thinkingBubble}>
                              <span className="c-dot" /><span className="c-dot" /><span className="c-dot" />
                            </div>
                          </div>
                        )}
                        {isTranscribing && (
                          <div style={{ display: 'flex', gap: '10px', alignSelf: 'flex-start', maxWidth: '85%', alignItems: 'flex-start', width: '100%' }}>
                            <div style={{ 
                              width: '32px', 
                              height: '32px', 
                              borderRadius: '50%', 
                              background: 'var(--hb-grad-diag)', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              color: 'rgb(var(--hb-on-brand))',
                              fontSize: '14px', 
                              flexShrink: 0 
                            }}>
                              ✦
                            </div>
                            <div style={{ ...s.thinkingBubble, background: 'rgb(var(--hb-blue) / .05)', borderColor: 'rgb(var(--hb-blue) / .35)' }}>
                              <span className="c-dot" style={{ animationDelay: '0s' }} /><span className="c-dot" style={{ animationDelay: '0.2s' }} /><span className="c-dot" style={{ animationDelay: '0.4s' }} />
                              <span className="ml-1.5 text-hb-sm font-medium text-hb-blue">Transcribing voice...</span>
                            </div>
                          </div>
                        )}
                        {pendingApproval && (
                          <div className="my-1 rounded-hb-md border border-hb-blue/35 bg-hb-blue/[0.04] p-3.5">
                            <div className="mb-2 flex items-center gap-1.5 text-hb-sm font-bold text-hb-text">
                              <span>⚠️</span>
                              <span>Approval Required: {(pendingApproval.name as string).replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</span>
                            </div>
                            <div className="mb-3 text-hb-xs text-hb-muted">
                              Review the action below and confirm to proceed.
                            </div>
                            <div style={{
                              fontSize: '12px', color: 'rgb(var(--hb-muted))', marginBottom: '16px',
                              background: 'rgb(var(--hb-surface))', padding: '10px 12px', borderRadius: '8px',
                              display: 'flex', flexDirection: 'column', gap: '6px',
                              border: '1px solid var(--hb-border)'
                            }}>
                              {Object.entries(pendingApproval.args).map(([k, v]) => (
                                <div key={k} className="flex items-start gap-2">
                                  <span className="min-w-[120px] shrink-0 font-semibold text-hb-text">
                                    {k.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}:
                                  </span>
                                  <span style={{ color: 'rgb(var(--hb-text))', wordBreak: 'break-word' }}>{String(v)}</span>
                                </div>
                              ))}
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={() => handleSend(undefined, pendingApproval)}
                                style={{
                                  flex: 1, padding: '9px', background: 'var(--hb-grad-diag)',
                                  color: 'rgb(var(--hb-on-brand))', border: 'none', borderRadius: '8px', cursor: 'pointer',
                                  fontWeight: 600, fontSize: '13px', transition: 'opacity 0.2s ease'
                                }}
                                disabled={isThinking}
                                onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.88' }}
                                onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
                              >
                                ✓ Approve
                              </button>
                              <button
                                onClick={() => setPendingApproval(null)}
                                style={{
                                  flex: 1, padding: '9px', background: 'transparent',
                                  border: '1px solid var(--hb-border)', color: 'rgb(var(--hb-text))',
                                  borderRadius: '8px', cursor: 'pointer', fontWeight: 500, fontSize: '13px'
                                }}
                                disabled={isThinking}
                              >
                                ✕ Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Audio Error Banner */}
                  {audioError && (
                    <div style={{
                      padding: '10px 16px',
                      background: 'rgb(var(--hb-error) / .08)',
                      borderTop: '1px solid rgb(var(--hb-error) / .15)',
                      borderBottom: '1px solid rgb(var(--hb-error) / .15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px'
                    }}>
                      <span style={{ fontSize: '13px', color: 'rgb(var(--hb-error))', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
                        ⚠️ {audioError}
                      </span>
                      <button 
                        onClick={() => setAudioError(null)}
                        style={{ background: 'transparent', border: 'none', color: 'rgb(var(--hb-error))', cursor: 'pointer', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}
                      >
                        Dismiss
                      </button>
                    </div>
                  )}

                  {/* Candidate suggestions chips */}
                  {candidateSuggestions.length > 0 && (
                    <div style={{
                      padding: '8px 16px',
                      background: 'rgb(var(--hb-surface-2))',
                      borderTop: '1px solid var(--hb-border)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px',
                      alignItems: 'center'
                    }}>
                      <span style={{ fontSize: '11px', color: 'rgb(var(--hb-muted))', fontWeight: 600 }}>Did you mean:</span>
                      {candidateSuggestions.map((item, idx) => (
                        <button
                          key={`${item.candidate.id}-${idx}`}
                          onClick={() => applySuggestion(item.candidate.full_name, item.matchedWord)}
                          style={{
                            background: 'rgb(var(--hb-surface-2))',
                            border: '1px solid var(--hb-border)',
                            borderRadius: '12px',
                            padding: '4px 10px',
                            fontSize: '12px',
                            color: 'rgb(var(--hb-text))',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'rgb(var(--hb-blue))'
                            e.currentTarget.style.background = 'rgb(var(--hb-surface-2))'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--hb-border)'
                            e.currentTarget.style.background = 'rgb(var(--hb-surface-2))'
                          }}
                        >
                          👤 {item.candidate.full_name}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Input Footer */}
                  <div style={s.footer}>
                    <button
                      className="c-mic"
                      style={{ ...s.micBtn, ...(isRecording ? s.micBtnActive : {}) }}
                      onClick={toggleRecording}
                      disabled={isThinking || isTranscribing || sttStatus === 'refining'}
                      title={isRecording ? "Stop Recording" : "Voice Command"}
                    >
                      <MicIcon />
                    </button>
                    
                    {isRecording && !isSpeechSupported ? (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', background: 'rgb(var(--hb-surface))', border: '1px solid var(--hb-border)', borderRadius: '14px', height: '42px', boxSizing: 'border-box' }}>
                        <div style={{ color: 'rgb(var(--hb-error))', fontSize: '12px', fontWeight: 600, fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <span className="c-blink" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'rgb(var(--hb-error))', display: 'inline-block' }} />
                          {formatTimer(recordingSeconds)}
                        </div>
                        <canvas
                          ref={canvasRef}
                          width="180"
                          height="24"
                          style={{ flex: 1, height: '24px', background: 'transparent' }}
                        />
                      </div>
                    ) : (
                      <div style={{ flex: 1, position: 'relative' }}>
                        <textarea
                          ref={textareaRef}
                          className="c-input"
                          style={s.input}
                          placeholder={
                            isTranscribing
                              ? 'Transcribing voice...'
                              : sttStatus === 'listening'
                                ? 'Listening… speak now'
                                : sttStatus === 'refining'
                                  ? 'Refining transcript…'
                                  : sttStatus === 'ready'
                                    ? 'Review & press Enter to send'
                                    : 'How can I help you?'
                          }
                          value={input}
                          rows={1}
                          onChange={handleInputChange}
                          onKeyDown={handleKeyDown}
                          disabled={isThinking || isTranscribing || sttStatus === 'refining'}
                        />
                        {sttStatus === 'ready' && (
                          <div style={{
                            position: 'absolute', bottom: '-18px', left: '4px',
                            fontSize: '10px', color: 'rgb(var(--hb-blue))', fontWeight: 600, opacity: 0.85
                          }}>
                            Press Enter to send
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      className="c-send"
                      style={{
                        ...s.sendBtn,
                        background: isRecording ? 'rgb(var(--hb-error))' : s.sendBtn.background
                      }}
                      onClick={isRecording ? stopRecording : () => handleSend()}
                      disabled={isThinking || isTranscribing || sttStatus === 'refining' || (!input.trim() && !isRecording)}
                      title={isRecording ? "Stop and Transcribe" : "Send"}
                    >
                      {isRecording ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="4" y="4" width="16" height="16" rx="2" />
                        </svg>
                      ) : (
                        <SendIcon />
                      )}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </>
  )
}
