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

/**
 * The candidates table's "Exp" column. Backend now always sets
 * `experience_years` (a labeled string like "1.5 Years"/"6 Months") together
 * with `years_experience`, but this still guards older records that only have
 * the bare float — blindly appending "y" to a value under 1 is what used to
 * render a resume's one ambiguous internship line as "0.1y".
 */
export function formatExperience(candidate: {
  experience_years?: string | null
  years_experience?: number | null
  relevant_experience?: string | null
}): string {
  if (candidate.experience_years) return candidate.experience_years
  if (candidate.years_experience != null) {
    const years = candidate.years_experience
    if (years < 1) {
      const months = Math.round(years * 12)
      return months > 0 ? `${months} ${months === 1 ? 'Month' : 'Months'}` : '—'
    }
    return `${years}y`
  }
  return candidate.relevant_experience || '—'
}

const MONTH_MAP: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

/**
 * Turns one résumé experience entry's raw `duration` string (as parsed
 * verbatim off the résumé, e.g. "June 2024 - June 2026", "Jan 2020 - Present",
 * "3 years 2 months") into a compact badge: "X Year Y Month" when the role
 * ran a year or more, just "Y Month" under a year (no "0 Year" prefix), or
 * null when nothing parseable is there — mirrors the same duration parsing
 * app.services.ai.resume_parser.calculate_years_from_experience does on the
 * backend for the candidate's *total* experience, but per role here.
 */
export function formatExperienceDuration(duration: string | null | undefined): string | null {
  if (!duration) return null
  const raw = duration.trim()
  if (!raw) return null

  // Explicit "X years Y months" already stated on the resume — trust it directly.
  const explicitYears = raw.match(/(\d+(?:\.\d+)?)\s*(?:yr|year)s?/i)
  const explicitMonths = raw.match(/(\d+(?:\.\d+)?)\s*(?:mo|month)s?/i)
  if (explicitYears || explicitMonths) {
    const y = explicitYears ? Math.floor(parseFloat(explicitYears[1])) : 0
    const m = explicitMonths ? Math.round(parseFloat(explicitMonths[1])) : 0
    return formatYearsMonths(y, m)
  }

  // Otherwise, parse it as a date range: "<start> - <end>", end possibly "Present"/"Current"/"Now".
  const now = new Date()
  const normalized = raw.replace(/\b(present|current|now)\b/i, `${now.toLocaleString('en-US', { month: 'short' })} ${now.getFullYear()}`)

  // Month and year are sometimes run together with no space, e.g. "Jan2025".
  const tokens = normalized.match(/([A-Za-z]{3,})[a-z]*\.?\s*((?:19|20)\d{2})/gi)
  if (!tokens || tokens.length < 2) return null

  const parsed = tokens.map((t) => {
    const m = t.match(/([A-Za-z]{3,})[a-z]*\.?\s*((?:19|20)\d{2})/i)!
    const monthKey = m[1].slice(0, 3).toLowerCase()
    return { month: MONTH_MAP[monthKey] ?? 1, year: parseInt(m[2], 10) }
  })

  const start = parsed[0]
  const end = parsed[parsed.length - 1]
  const totalMonths = (end.year - start.year) * 12 + (end.month - start.month) + 1
  if (!Number.isFinite(totalMonths) || totalMonths <= 0) return null

  return formatYearsMonths(Math.floor(totalMonths / 12), totalMonths % 12)
}

function formatYearsMonths(years: number, months: number): string | null {
  if (years <= 0 && months <= 0) return null
  if (years <= 0) return `${months} Month`
  return months > 0 ? `${years} Year ${months} Month` : `${years} Year`
}

export function stageLabel(stage: string): string {
  return stage.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
}

export function roleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1)
}
