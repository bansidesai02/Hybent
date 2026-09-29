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
 * Turns one resume experience entry's raw `duration` string (as parsed
 * verbatim off the resume, e.g. "June 2024 - June 2026", "Jan 2020 - Present",
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
    // Fractional years carry months: "2.5 Years" is 2 years 6 months.
    const total =
      Math.round((explicitYears ? parseFloat(explicitYears[1]) : 0) * 12) +
      Math.round(explicitMonths ? parseFloat(explicitMonths[1]) : 0)
    return formatYearsMonths(Math.floor(total / 12), total % 12)
  }

  // Otherwise, parse it as a date range: "<start> - <end>".
  const totalMonths = monthsInDateRange(raw)
  if (totalMonths == null) return null

  return formatYearsMonths(Math.floor(totalMonths / 12), totalMonths % 12)
}

/* One date inside a resume duration string. Resumes write these many ways:
   "Jan 2020", "January, 2020", "Apr - 2021", "Sept2020", "06/2024", "2019". */
const DATE_TOKEN =
  /\b(?:(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?[\s,.'\u2019/-]*((?:19|20)\d{2})|(0?[1-9]|1[0-2])\s*[/.-]\s*((?:19|20)\d{2})|((?:19|20)\d{2}))\b/gi
const ONGOING = /\b(present|current|currently|now|today|till date|to date|ongoing)\b/i

/**
 * Inclusive month count of a "<start> - <end>" duration, or null when fewer
 * than two dates can be read. An end of "Present"/"Current" is this month. A
 * bare year has no month: as a start it counts from January, as an end
 * through December. Kept in step with `_months_in_date_range` in
 * app/services/ai/resume_parser.py, which computes the candidate's total.
 */
function monthsInDateRange(raw: string): number | null {
  const now = new Date()
  const normalized = raw.replace(
    ONGOING,
    `${now.toLocaleString('en-US', { month: 'short' })} ${now.getFullYear()}`
  )

  const dates: { year: number; month: number | null }[] = []
  for (const m of normalized.matchAll(DATE_TOKEN)) {
    if (m[1]) dates.push({ year: parseInt(m[2], 10), month: MONTH_MAP[m[1].slice(0, 3).toLowerCase()] })
    else if (m[3]) dates.push({ year: parseInt(m[4], 10), month: parseInt(m[3], 10) })
    else dates.push({ year: parseInt(m[5], 10), month: null })
  }
  if (dates.length < 2) return null

  const start = dates[0]
  const end = dates[dates.length - 1]
  const months = (end.year - start.year) * 12 + ((end.month ?? 12) - (start.month ?? 1)) + 1
  return Number.isFinite(months) && months > 0 ? months : null
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
