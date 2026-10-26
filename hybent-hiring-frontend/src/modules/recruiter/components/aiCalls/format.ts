import type { Money } from '@/api/voiceCalls'

/** Labels for the pre-screen answers (Spec §5.5 fields + job-specific ones). */
export const ANSWER_LABEL: Record<string, string> = {
  total_experience_years: 'Total experience',
  relevant_experience_years: 'Relevant experience',
  current_company: 'Current company',
  current_role: 'Current role',
  responsibilities_summary: 'Responsibilities',
  key_skills: 'Key skills',
  current_ctc: 'Current CTC',
  expected_ctc: 'Expected CTC',
  notice_period_days: 'Notice period',
  notice_negotiable: 'Notice negotiable',
  location: 'Location / relocation',
  reason_for_change: 'Reason for change',
}

/** Shown in this order; anything else (job-specific questions) follows. */
export const ANSWER_ORDER = Object.keys(ANSWER_LABEL)

/** Which raw-answer key a parsed answer came from (notice_period -> notice_period_days). */
export const RAW_KEY: Record<string, string> = { notice_period_days: 'notice_period', notice_negotiable: 'notice_period' }

export function answerLabel(field: string): string {
  return ANSWER_LABEL[field] ?? field.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

function isMoney(v: unknown): v is Money {
  return typeof v === 'object' && v !== null && 'value' in v && 'currency' in v
}

export function formatMoney(m: Money): string {
  if (m.currency === 'INR') return `₹${(m.value / 100_000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} LPA`
  return `${m.currency} ${m.value.toLocaleString()}`
}

/** A parsed answer as text, or null for UNCLEAR / DECLINED_TO_SHARE (shown as a badge). */
export function formatAnswer(field: string, value: unknown): string | null {
  if (value === 'UNCLEAR' || value === 'DECLINED_TO_SHARE' || value == null) return null
  if (isMoney(value)) return formatMoney(value)
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'number') {
    if (field.endsWith('_years')) return `${value} yr${value === 1 ? '' : 's'}`
    if (field === 'notice_period_days') return value === 0 ? 'Immediate' : `${value} days`
    return String(value)
  }
  return String(value)
}

export const COMMUNICATION_DIMENSIONS: Array<[string, string]> = [
  ['clarity', 'Clarity'],
  ['fluency', 'Fluency'],
  ['vocabulary_grammar', 'Vocabulary & grammar'],
  ['relevance', 'Relevance'],
  ['confidence_score', 'Confidence'],
  ['listening', 'Listening'],
]

export function scoreTone(score: number): 'success' | 'warning' | 'error' {
  return score >= 4 ? 'success' : score >= 3 ? 'warning' : 'error'
}

export function errorMessage(err: any, fallback: string): string {
  return err?.response?.data?.message || err?.response?.data?.detail || fallback
}
