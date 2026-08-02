import { format, formatDistanceToNow } from 'date-fns'

// Helper to ensure dates from API are treated as UTC if they lack a timezone
function safeParseDate(date: string | null | undefined): Date | null {
  if (!date) return null
  const cleaned = date.includes('T') ? date : date.replace(' ', 'T')
  const withZ = (cleaned.endsWith('Z') || cleaned.includes('+')) ? cleaned : cleaned + 'Z'
  const d = new Date(withZ)
  return isNaN(d.getTime()) ? new Date(date) : d
}

export function formatDate(date: string | null | undefined, fmt = 'MMM d, yyyy'): string {
  const d = safeParseDate(date)
  if (!d) return '—'
  return format(d, fmt)
}

export function formatCandidateDate(candidate: { import_row_date?: string | null; created_at?: string | null }, fmt = 'MMM d, yyyy'): string {
  if (candidate.import_row_date) {
    let dateStr = candidate.import_row_date.trim()
    // Strip time suffix like "00:00:00"
    dateStr = dateStr.replace(/\s+\d{2}:\d{2}:\d{2}.*$/, '')
    try {
      // Clean DD-MM-YYYY to YYYY-MM-DD for standard browser parsing
      let cleanedDate = dateStr
      if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(dateStr)) {
        const parts = dateStr.split(/[-/]/)
        cleanedDate = `${parts[2]}-${parts[1]}-${parts[0]}`
      }
      const d = new Date(cleanedDate)
      if (!isNaN(d.getTime())) {
        return format(d, fmt)
      }
    } catch (e) {}
    return dateStr
  }
  return formatDate(candidate.created_at, fmt)
}

export function formatDateTime(date: string | null | undefined): string {
  const d = safeParseDate(date)
  if (!d) return '—'
  return format(d, 'MMM d, yyyy h:mm a')
}

export function timeAgo(date: string | null | undefined): string {
  const d = safeParseDate(date)
  if (!d) return '—'
  return formatDistanceToNow(d, { addSuffix: true })
}

export function formatSalary(min?: number | null, max?: number | null, currency = 'USD'): string {
  if (!min && !max) return '—'
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)
  if (min && max) return `${fmt(min)} – ${fmt(max)}`
  if (min) return `${fmt(min)}+`
  return `Up to ${fmt(max!)}`
}

export function formatScore(score: number | null | undefined): string {
  if (score == null) return '—'
  return `${Math.round(score)}%`
}

/**
 * The three score bands, as token classes.
 *
 * Same thresholds `ScoreRing`, `Meter` and `ScoreDistribution` use, so a match
 * score reads identically wherever it appears. Was Tailwind's own emerald /
 * amber / red with `dark:` counterparts that stopped applying when the product
 * went light-only.
 */
export function scoreColor(score: number | null | undefined): string {
  if (score == null) return 'text-hb-dim'
  if (score >= 80) return 'text-hb-success'
  if (score >= 60) return 'text-hb-warning'
  return 'text-hb-error'
}

export function stageLabel(stage: string): string {
  return stage.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
}

export function roleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1)
}
