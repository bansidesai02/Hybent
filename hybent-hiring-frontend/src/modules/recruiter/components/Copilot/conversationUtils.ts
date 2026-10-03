import toast from 'react-hot-toast'
import { candidatesApi } from '@/api/candidates'
import { useAuthStore } from '@/store/authStore'
import type { ConversationSummary } from '@/api/copilot'

// ── Example prompts shown on empty state ──────────────────────────────────────
export const EXAMPLE_PROMPTS = [
  { icon: '🔍', title: 'Search Talent', prompt: 'Show React developers with 3+ years experience' },
  { icon: '📊', title: 'Analytics', prompt: 'Give me a hiring overview' },
  { icon: '📅', title: 'Interviews', prompt: "What interviews are scheduled today?" },
  { icon: '⚡', title: 'Pipeline', prompt: 'Show candidates in technical round' },
]

// ── Stopwords for candidate name suggestions ──────────────────────────────────
export const COPILOT_STOPWORDS = [
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further',
  'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how',
  'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'me', 'more', 'most', 'my', 'myself',
  'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they',
  'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with',
  'you', 'your', 'yours', 'yourself', 'yourselves',
  'hello', 'hi', 'hey', 'please', 'thanks', 'thank', 'ok', 'okay', 'yes', 'no', 'yeah', 'yep',
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
  'mein', 'hai', 'ke', 'ka', 'ki', 'ko', 'se', 'aur', 'bhi', 'toh',
  'hi', 'ho', 'tha', 'thi', 'the', 'karo', 'do', 'kar',
  'raha', 'rahi', 'rahe', 'gaya', 'gayi', 'gaye', 'hua', 'hue', 'hui',
  'hain', 'par', 'pe', 'ek', 'ne', 'kiya', 'liye', 'kya',
  'hu', 'hoon', 'aap', 'tum', 'main', 'hum', 'ye', 'wo', 'yeh', 'woh',
  'isse', 'usse', 'na', 'kuch', 'hoga', 'hogi', 'honge',
  'thaa', 'dhundo', 'nikalo', 'dikhao', 'db', 'show', 'find', 'list', 'search',
]

// ── CandidateCard data shape ──────────────────────────────────────────────────
export interface CandidateCardData {
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

// ── Date grouping ─────────────────────────────────────────────────────────────
export function groupConversationsByDate(
  convs: ConversationSummary[],
): Record<string, ConversationSummary[]> {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const weekAgo = new Date(today.getTime() - 7 * 86400000)

  const groups: Record<string, ConversationSummary[]> = {
    Today: [],
    Yesterday: [],
    'This Week': [],
    Older: [],
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

// ── Date formatter ────────────────────────────────────────────────────────────
export function fmtTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// ── Parse a single candidate card block ──────────────────────────────────────
export function parseCandidateCard(block: string): CandidateCardData | null {
  if (!block.includes('👤')) return null
  const lines = block.split('\n')
  const card: CandidateCardData = { name: '' }

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.includes('👤')) {
      const match = trimmed.match(/👤\s*\*?\*?([^*\n]+)\*?\*?/)
      if (match) card.name = match[1].trim()
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

// ── Navigate to candidate profile via name/email lookup ───────────────────────
export async function resolveAndNavigateToCandidateProfile(card: CandidateCardData): Promise<void> {
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
      byEmail.length === 1
        ? byEmail[0]
        : sameCase.length === 1
          ? sameCase[0]
          : anyCase.length === 1
            ? anyCase[0]
            : anyCase.length === 0 && items.length === 1
              ? items[0]
              : null

    if (!match) {
      toast.error(`More than one candidate is named "${name}" — open the right one from the Candidates page.`)
      return
    }

    const role = useAuthStore.getState().user?.role
    const basePath = role === 'admin' ? '/hiring/admin' : '/hiring/recruiter'
    const path = `${basePath}/candidates?openId=${encodeURIComponent(match.id)}`
    window.history.pushState({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }))
  } catch {
    toast.error("Could not open that candidate's profile.")
  }
}
