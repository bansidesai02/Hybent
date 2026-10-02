import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import {
  Building2,
  CalendarCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Laptop,
  Phone,
  Plus,
  Star,
  Trophy,
  User,
  Video,
} from 'lucide-react'

import { useAuthStore } from '@/store/authStore'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { authApi } from '@/api/auth'
import { interviewsApi } from '@/api/interviews'
import { candidatesApi } from '@/api/candidates'
import { scorecardsApi } from '@/api/scorecards'
import { adminApi } from '@/api/admin'
import { formatDate } from '@/utils/formatters'
import type { Interview, InterviewStatus, InterviewType, Scorecard } from '@/types'
import { AddToCalendarDropdown } from '@/components/calendar/AddToCalendarDropdown'
import {
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  Drawer,
  EmptyState,
  Label,
  Meter,
  PageHeader,
  Select,
  Skeleton,
  StatusPill,
  Textarea,
  type BadgeTone,
} from '@/components/hb'

/**
 * Interview scheduling.
 *
 * Rebuilt on the design system in phase 6. Two components were replaced rather
 * than restyled:
 *
 * - `CustomNumberSelector` — 86 lines building an hour picker, a minute picker
 *   and an AM/PM toggle out of `<div onClick>` inside a `position:absolute`
 *   popover, none of it reachable by keyboard. It became `<input type="time">`,
 *   keyboard- and screen-reader-correct for free — but its dropdown is the
 *   browser's own time-spinner and cannot be restyled (square corners on
 *   Windows/Chrome, off-brand everywhere). `TimePicker` below replaces it
 *   with a `combobox`/`listbox` pair built on the same markup pattern as the
 *   "Available slots" grid: fully keyboard-navigable (arrows, Home/End,
 *   Enter, Escape) and styled with the design system's own tokens.
 * - `MultiSelectPanelists` — a fake `<select>` built from divs. It is now a
 *   real `fieldset` of checkboxes. Interviewer lists are short; a popover was
 *   buying nothing and costing every keyboard user the control.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const TYPE_ICON: Record<string, React.ReactNode> = {
  phone: <Phone size={13} />,
  video: <Video size={13} />,
  technical: <Laptop size={13} />,
  onsite: <Building2 size={13} />,
  hr: <User size={13} />,
  final: <Trophy size={13} />,
}

const RECOMMENDATION: Record<string, { label: string; tone: BadgeTone }> = {
  strong_yes: { label: 'Strong hire', tone: 'success' },
  yes: { label: 'Hire', tone: 'success' },
  maybe: { label: 'Maybe', tone: 'warning' },
  no: { label: 'No hire', tone: 'error' },
  strong_no: { label: 'Strong no', tone: 'error' },
}

/** The interview stages a recruiter can book, and the type each maps to. */
const SCHEDULE_TITLES: Array<{ value: string; type: InterviewType }> = [
  { value: 'Technical Round', type: 'technical' as InterviewType },
  { value: 'Practical Round', type: 'technical' as InterviewType },
  { value: 'HR Round', type: 'hr' as InterviewType },
  { value: 'Management Round', type: 'hr' as InterviewType },
  { value: 'Techno-Functional Round', type: 'technical' as InterviewType },
  { value: 'Final Round', type: 'final' as InterviewType },
]

const SLOTS = [
  '09:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00',
]

/**
 * Parses an API timestamp as UTC.
 *
 * The backend sometimes omits the `Z` and sometimes uses a space instead of
 * `T`; without this the browser reads the value as local time and every
 * interview shifts by the timezone offset.
 */
function parseISO(iso: string) {
  if (!iso) return new Date()
  const cleaned = iso.includes('T') ? iso : iso.replace(' ', 'T')
  const withZ = cleaned.endsWith('Z') || cleaned.includes('+') ? cleaned : `${cleaned}Z`
  return new Date(withZ)
}

function formatSlot(time: string) {
  const [hh, mm] = time.split(':')
  const h = parseInt(hh, 10)
  return `${h % 12 || 12}:${mm} ${h >= 12 ? 'PM' : 'AM'}`
}

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1) // 1..12
const MINUTES_5 = Array.from({ length: 12 }, (_, i) => i * 5) // 0,5,…,55
const PERIODS = ['AM', 'PM'] as const

function to12Hour(value: string) {
  const [hh, mm] = value.split(':').map(Number)
  const period = hh >= 12 ? 'PM' : 'AM'
  const hour = hh % 12 || 12
  return { hour, minute: mm, period: period as 'AM' | 'PM' }
}

function to24Hour(hour: number, minute: number, period: 'AM' | 'PM') {
  const hh = period === 'AM' ? hour % 12 : (hour % 12) + 12
  return `${String(hh).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/** One column of a spinner: a vertically-scrolling listbox with roving focus. */
function SpinnerColumn<T extends string | number>({
  label,
  options,
  value,
  format,
  onSelect,
}: {
  label: string
  options: readonly T[]
  value: T
  format: (v: T) => string
  onSelect: (v: T) => void
}) {
  const listRef = useRef<HTMLUListElement>(null)
  const activeIndex = Math.max(0, options.indexOf(value))

  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      onSelect(options[Math.min(activeIndex + 1, options.length - 1)])
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      onSelect(options[Math.max(activeIndex - 1, 0)])
    } else if (e.key === 'Home') {
      e.preventDefault()
      onSelect(options[0])
    } else if (e.key === 'End') {
      e.preventDefault()
      onSelect(options[options.length - 1])
    }
  }

  return (
    <ul
      ref={listRef}
      role="listbox"
      aria-label={label}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="max-h-[180px] w-16 shrink-0 overflow-y-auto rounded-hb-sm border border-hb-border bg-hb-surface p-1 focus:outline-none focus-visible:shadow-hb-ring"
    >
      {options.map((opt) => (
        <li
          key={opt}
          role="option"
          aria-selected={opt === value}
          onMouseDown={(e) => {
            e.preventDefault()
            onSelect(opt)
          }}
          className={
            'cursor-pointer rounded-hb-xs px-2 py-1.5 text-center text-hb-sm transition-colors duration-hb ' +
            (opt === value ? 'bg-hb-blue/10 font-semibold text-hb-blue' : 'text-hb-muted hover:bg-hb-surface-2')
          }
        >
          {format(opt)}
        </li>
      ))}
    </ul>
  )
}

/**
 * A custom replacement for `<input type="time">`.
 *
 * The native input is keyboard- and screen-reader-correct (see the phase-6
 * note above), but its popup is the OS's own time-spinner and cannot be
 * restyled — square corners on Windows/Chrome regardless of the rest of the
 * design system. This rebuilds the same hour / minute / AM-PM layout the
 * pre-phase-6 `CustomNumberSelector` had, but as real `listbox`/`option`
 * markup (arrow-key, Home/End and click all work, and each column is a
 * proper accessible widget) styled with the design system's own tokens.
 */
function TimePicker({ id, value, onChange }: { id: string; value: string; onChange: (time: string) => void }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const { hour, minute, period } = to12Hour(value)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const setHour = (h: number) => onChange(to24Hour(h, minute, period))
  const setMinute = (m: number) => onChange(to24Hour(hour, m, period))
  const setPeriod = (p: 'AM' | 'PM') => onChange(to24Hour(hour, minute, p))

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen(true)
          }
        }}
        className="mt-2 flex h-[42px] w-full items-center justify-between rounded-hb-sm border border-hb-border bg-hb-surface px-[13px] font-body text-hb-body text-hb-text transition-[border-color,box-shadow] duration-hb ease-hb focus:border-hb-blue/60 focus:shadow-hb-ring focus:outline-none"
      >
        <span>{formatSlot(value)}</span>
        <Clock size={16} className="text-hb-dim" aria-hidden />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 flex gap-2 rounded-hb-sm border border-hb-border bg-hb-elevated p-2 shadow-hb-card">
          <SpinnerColumn label="Hour" options={HOURS_12} value={hour} format={(h) => String(h)} onSelect={setHour} />
          <SpinnerColumn
            label="Minute"
            options={MINUTES_5}
            value={minute}
            format={(m) => String(m).padStart(2, '0')}
            onSelect={setMinute}
          />
          <div role="radiogroup" aria-label="AM or PM" className="flex shrink-0 flex-col gap-1 self-start">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={p === period}
                onClick={() => setPeriod(p)}
                className={
                  'rounded-hb-xs border px-3 py-1.5 text-hb-sm font-semibold transition-colors duration-hb focus:outline-none focus-visible:shadow-hb-ring ' +
                  (p === period
                    ? 'border-hb-blue/50 bg-hb-blue/10 text-hb-blue'
                    : 'border-hb-border bg-hb-surface text-hb-muted hover:text-hb-text')
                }
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Scorecards ─────────────────────────────────────────────────────────────── */

function StarRow({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={12}
          aria-hidden
          className={s <= value ? 'fill-hb-warning text-hb-warning' : 'text-hb-dim opacity-35'}
        />
      ))}
      <span className="ml-1 font-mono text-hb-micro text-hb-muted">{value}/5</span>
    </span>
  )
}

function Scorecards({ applicationId }: { applicationId: string }) {
  const { data: scorecards, isLoading } = useQuery({
    queryKey: ['scorecards', 'application', applicationId],
    queryFn: () => scorecardsApi.getForApplication(applicationId).then((r: any) => r.data),
  })

  if (isLoading) {
    return <Skeleton className="mt-hb-4 h-24 w-full" rounded="md" />
  }

  if (!scorecards?.length) {
    return (
      <p className="mt-hb-4 border-t border-hb-border pt-hb-4 text-center text-hb-sm text-hb-muted">
        No scorecards submitted yet.
      </p>
    )
  }

  return (
    <div className="mt-hb-4 border-t border-hb-border pt-hb-4">
      <p className="mb-2.5 font-mono text-hb-label uppercase text-hb-dim">
        Scorecards ({scorecards.length})
      </p>
      <div className="space-y-2.5">
        {scorecards.map((sc: Scorecard) => {
          const rec = RECOMMENDATION[sc.recommendation]
          const criteria =
            ((sc as any).criteria || (sc.criteria_scores as any)?.criteria || sc.criteria_scores) ?? []

          return (
            <div
              key={sc.id}
              className="rounded-hb-sm border border-hb-border bg-hb-surface-2 p-3.5"
            >
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={sc.submitted_by_name ?? 'Reviewer'} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-hb-sm font-semibold text-hb-text">
                      {sc.submitted_by_name ?? 'Reviewer'}
                    </span>
                    <span className="block font-mono text-hb-micro text-hb-dim">
                      {formatDate(sc.submitted_at)}
                    </span>
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <StarRow value={sc.overall_rating} />
                  {rec && <Badge tone={rec.tone}>{rec.label}</Badge>}
                </span>
              </div>

              {criteria.length > 0 && (
                <div className="mb-2 grid gap-2 sm:grid-cols-2">
                  {criteria.map((c: any) => (
                    <Meter
                      key={c.criterion}
                      label={c.criterion}
                      value={c.score}
                      max={5}
                      size="xs"
                      valueLabel={`${c.score}/5`}
                    />
                  ))}
                </div>
              )}

              {sc.summary && (
                <p className="text-hb-sm italic leading-relaxed text-hb-muted">“{sc.summary}”</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Day helpers ────────────────────────────────────────────────────────────── */

/** First and last hour the day timeline always shows; interviews outside widen it. */
const DAY_START = 9
const DAY_END = 21
/** Height of one hour on the timeline, in px. */
const HOUR_H = 64
/** Free time on the grid is offered in half-hour steps. */
const SLOT_H = HOUR_H / 2

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  )
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

/** Sunday of the week `d` is in — the calendar's weeks start on Sunday too. */
function startOfWeek(d: Date) {
  return addDays(startOfDay(d), -d.getDay())
}

function formatTime(d: Date) {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function intervalOf(iv: Interview) {
  const start = parseISO(iv.scheduled_at)
  return { start, end: new Date(start.getTime() + (iv.duration_minutes || 60) * 60_000) }
}

/**
 * Whether `time` on `date` can be booked. One rule for the slot grid, the
 * timeline's free rows and the drawer's submit button, so they cannot disagree.
 */
function slotState(date: Date, time: string, interviews: Interview[]): 'available' | 'scheduled' | 'past' {
  const [h, m] = time.split(':').map(Number)
  const slot = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m)

  const taken = interviews.some((iv) => {
    if (iv.status === 'cancelled') return false
    const { start, end } = intervalOf(iv)
    return slot >= start && slot < end
  })
  if (taken) return 'scheduled'

  /* One minute of grace, so the slot you are clicking does not become "past"
     mid-click. */
  if (slot.getTime() < Date.now() - 60_000) return 'past'
  return 'available'
}

/** "Live now", "In 25 min", "Tomorrow, 10:00 AM"… for the Next up card. */
function untilLabel(start: Date, end: Date, now: Date) {
  if (now >= start && now < end) return 'Live now'
  const mins = Math.max(1, Math.round((start.getTime() - now.getTime()) / 60_000))
  if (mins < 60) return `In ${mins} min`
  if (sameDay(start, now)) {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m ? `In ${h} h ${m} min` : `In ${h} h`
  }
  if (sameDay(start, addDays(now, 1))) return `Tomorrow, ${formatTime(start)}`
  return `${start.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}, ${formatTime(start)}`
}

/** The current time, ticking every 30 s — drives the now-line and the countdown. */
function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(t)
  }, [])
  return now
}

/* ── Calendar ───────────────────────────────────────────────────────────────── */

/**
 * Month grid. Past days stay selectable — the timeline shows what happened on
 * them — and only booking is limited to the future, in the drawer.
 */
function MonthCalendar({
  interviews,
  selectedDate,
  onSelectDate,
}: {
  interviews: Interview[]
  selectedDate: Date
  onSelectDate: (d: Date) => void
}) {
  const [viewDate, setViewDate] = useState(() => new Date())
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const today = new Date()

  /* Follow the selection when it moves to another month from elsewhere — the
     Today button, the day arrows. */
  useEffect(() => {
    if (selectedDate.getFullYear() !== year || selectedDate.getMonth() !== month) {
      setViewDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  const byDate = useMemo(() => {
    const map: Record<string, InterviewStatus[]> = {}
    for (const iv of interviews) {
      if (iv.status === 'cancelled') continue
      const d = parseISO(iv.scheduled_at)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      ;(map[key] ??= []).push(iv.status)
    }
    return map
  }, [interviews])

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayMidnight = startOfDay(today)

  /* Scheduled wins, then completed, then no-show — the most actionable state
     for that day is what the dot should report. */
  const dotClass = (statuses: InterviewStatus[]) => {
    if (statuses.includes('scheduled')) return 'bg-hb-blue'
    if (statuses.includes('completed')) return 'bg-hb-success'
    if (statuses.includes('no_show')) return 'bg-hb-warning'
    return 'bg-hb-error'
  }

  const navButton =
    'grid h-8 w-8 place-items-center rounded-hb-full text-hb-muted transition-colors duration-hb hover:bg-hb-surface-2 hover:text-hb-text focus-visible:outline-none focus-visible:shadow-hb-ring'

  return (
    <div>
      <div className="mb-hb-3 flex items-center justify-between gap-2">
        <span className="font-display text-hb-body font-semibold text-hb-text">
          {MONTHS[month]} {year}
        </span>
        <span className="flex items-center">
          <button
            type="button"
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
            aria-label="Previous month"
            className={navButton}
          >
            <ChevronLeft size={16} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            aria-label="Next month"
            className={navButton}
          >
            <ChevronRight size={16} aria-hidden />
          </button>
        </span>
      </div>

      <div className="mb-1 grid grid-cols-7">
        {WEEK_DAYS.map((d) => (
          <abbr
            key={d}
            title={d}
            className="text-center font-mono text-hb-micro uppercase text-hb-dim no-underline"
          >
            {d[0]}
          </abbr>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: firstDay }, (_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const dayDate = new Date(year, month, day)
          const statuses = byDate[`${year}-${month}-${day}`]
          const isToday = sameDay(dayDate, today)
          const isSelected = sameDay(dayDate, selectedDate)
          const isPast = dayDate < todayMidnight

          return (
            <button
              key={day}
              type="button"
              aria-pressed={isSelected}
              aria-current={isToday ? 'date' : undefined}
              aria-label={dayDate.toDateString()}
              onClick={() => onSelectDate(dayDate)}
              className={
                'relative grid aspect-square place-items-center rounded-hb-full text-hb-sm tabular-nums transition-colors duration-hb focus-visible:outline-none focus-visible:shadow-hb-ring ' +
                (isSelected
                  ? 'bg-hb-grad font-semibold text-hb-on-brand'
                  : isToday
                    ? 'font-semibold text-hb-blue ring-1 ring-inset ring-hb-blue/40 hover:bg-hb-blue/5'
                    : isPast
                      ? 'text-hb-dim hover:bg-hb-surface-2'
                      : 'text-hb-muted hover:bg-hb-surface-2 hover:text-hb-text')
              }
            >
              {day}
              {statuses && (
                <span
                  aria-hidden
                  className={
                    'absolute bottom-1 h-1 w-1 rounded-full ' +
                    (isSelected ? 'bg-hb-on-brand' : dotClass(statuses))
                  }
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * One week as a row of days — the calendar on small screens, and the date
 * picker in the schedule drawer. `minDate` disables the days before it.
 */
function DateStrip({
  value,
  onChange,
  interviews,
  minDate,
}: {
  value: Date
  onChange: (d: Date) => void
  interviews: Interview[]
  minDate?: Date
}) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(value))
  const today = new Date()

  useEffect(() => {
    const ws = startOfWeek(value)
    if (ws.getTime() !== weekStart.getTime()) setWeekStart(ws)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const busy = useMemo(() => {
    const set = new Set<string>()
    for (const iv of interviews) {
      if (iv.status === 'cancelled') continue
      set.add(startOfDay(parseISO(iv.scheduled_at)).toDateString())
    }
    return set
  }, [interviews])

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const canGoBack = !minDate || weekStart > startOfDay(minDate)

  const arrow =
    'grid h-8 w-8 shrink-0 place-items-center rounded-hb-full text-hb-muted transition-colors duration-hb hover:bg-hb-surface-2 hover:text-hb-text focus-visible:outline-none focus-visible:shadow-hb-ring disabled:opacity-35 disabled:hover:bg-transparent'

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Previous week"
        disabled={!canGoBack}
        onClick={() => setWeekStart(addDays(weekStart, -7))}
        className={arrow}
      >
        <ChevronLeft size={16} aria-hidden />
      </button>
      <div className="grid flex-1 grid-cols-7 gap-1">
        {days.map((d) => {
          const selected = sameDay(d, value)
          const disabled = !!minDate && d < startOfDay(minDate)
          return (
            <button
              key={d.toDateString()}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              aria-label={d.toDateString()}
              onClick={() => onChange(d)}
              className={
                'relative flex flex-col items-center gap-0.5 rounded-hb-sm py-1.5 transition-colors duration-hb focus-visible:outline-none focus-visible:shadow-hb-ring disabled:cursor-not-allowed disabled:opacity-35 ' +
                (selected
                  ? 'bg-hb-grad text-hb-on-brand'
                  : sameDay(d, today)
                    ? 'text-hb-blue ring-1 ring-inset ring-hb-blue/40'
                    : 'text-hb-muted hover:bg-hb-surface-2 hover:text-hb-text')
              }
            >
              <span className="font-mono text-hb-micro uppercase opacity-80">
                {WEEK_DAYS[d.getDay()][0]}
              </span>
              <span className="text-hb-sm font-semibold tabular-nums">{d.getDate()}</span>
              <span
                aria-hidden
                className={
                  'h-1 w-1 rounded-full ' +
                  (busy.has(d.toDateString())
                    ? selected
                      ? 'bg-hb-on-brand'
                      : 'bg-hb-blue'
                    : 'bg-transparent')
                }
              />
            </button>
          )
        })}
      </div>
      <button
        type="button"
        aria-label="Next week"
        onClick={() => setWeekStart(addDays(weekStart, 7))}
        className={arrow}
      >
        <ChevronRight size={16} aria-hidden />
      </button>
    </div>
  )
}

/* ── Time slots ─────────────────────────────────────────────────────────────── */

function TimeSlots({
  selected,
  onSelect,
  interviews,
  selectedDate,
}: {
  selected: string
  onSelect: (time: string) => void
  interviews: Interview[]
  selectedDate: Date
}) {
  const stateOf = useCallback(
    (time: string) => slotState(selectedDate, time, interviews),
    [selectedDate, interviews]
  )

  /* Move off an unavailable slot when the date changes. */
  useEffect(() => {
    if (selected && stateOf(selected) === 'available') return
    const firstFree = SLOTS.find((s) => stateOf(s) === 'available')
    if (firstFree) onSelect(firstFree)
  }, [selectedDate, selected, stateOf, onSelect])

  const selectedStatus = selected ? stateOf(selected) : 'available'

  return (
    <div className="space-y-hb-3">
      <div className="grid grid-cols-4 gap-1.5">
        {SLOTS.map((s) => {
          const status = stateOf(s)
          const blocked = status !== 'available'
          const active = selected === s
          return (
            <button
              key={s}
              type="button"
              disabled={blocked}
              onClick={() => onSelect(s)}
              aria-pressed={active}
              title={blocked ? (status === 'scheduled' ? 'Booked' : 'Past') : undefined}
              className={
                'rounded-hb-sm border px-1 py-2 text-hb-sm tabular-nums transition-colors duration-hb focus-visible:outline-none focus-visible:shadow-hb-ring disabled:cursor-not-allowed ' +
                (active
                  ? 'border-transparent bg-hb-grad font-semibold text-hb-on-brand'
                  : blocked
                    ? 'border-hb-border bg-hb-surface-2 text-hb-dim line-through'
                    : 'border-hb-border bg-hb-surface text-hb-muted hover:border-hb-blue/40 hover:text-hb-text')
              }
            >
              {formatSlot(s)}
            </button>
          )
        })}
      </div>

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Label htmlFor="custom-time">Or pick any time</Label>
          <TimePicker id="custom-time" value={selected || '09:00'} onChange={onSelect} />
        </div>
      </div>

      {selected && selectedStatus !== 'available' && (
        <p role="alert" className="text-hb-xs font-medium text-hb-error">
          That time is {selectedStatus === 'scheduled' ? 'already booked' : 'in the past'}.
        </p>
      )}
    </div>
  )
}

/* ── Schedule drawer ────────────────────────────────────────────────────────── */

const scheduleSchema = z.object({
  candidate_id: z.string().min(1, 'Choose a candidate'),
  panelist_ids: z.array(z.string()).min(1, 'Choose at least one interviewer'),
  title: z.string().min(2, 'Choose an interview stage'),
  scheduled_at: z.string().min(1, 'Pick a date and time'),
  duration_minutes: z.coerce.number().int().min(15).default(60),
  notes: z.string().optional(),
})
type ScheduleForm = z.infer<typeof scheduleSchema>

const DURATIONS = [30, 45, 60, 90]

/** A real fieldset of checkboxes, in place of the div-built fake select. */
function PanelistPicker({
  value,
  onChange,
  options,
  error,
}: {
  value: string[]
  onChange: (next: string[]) => void
  options: Array<{ value: string; label: string }>
  error?: string
}) {
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])

  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 block font-mono text-hb-label uppercase text-hb-dim">
        Interviewers <span className="text-hb-error">*</span>
      </legend>

      {options.length === 0 ? (
        <p className="text-hb-sm text-hb-muted">
          No interviewers on the team yet. Invite one from Team management.
        </p>
      ) : (
        <div className="max-h-[168px] space-y-2 overflow-y-auto rounded-hb-sm border border-hb-border bg-hb-surface p-3">
          {options.map((o) => (
            <Checkbox
              key={o.value}
              label={o.label}
              checked={value.includes(o.value)}
              onChange={() => toggle(o.value)}
            />
          ))}
        </div>
      )}

      {/* The first person picked leads the panel — worth saying, since the API
          assigns the `lead` role by position. */}
      {value.length > 1 && (
        <p className="text-hb-xs text-hb-muted">The first interviewer selected leads the panel.</p>
      )}

      {error && (
        <p role="alert" className="text-hb-xs font-medium text-hb-error">
          {error}
        </p>
      )}
    </fieldset>
  )
}

/**
 * Booking, in a side panel. Opened from the header button or straight from a
 * free row on the timeline, with that date and time already set.
 */
function ScheduleDrawer({
  open,
  onClose,
  initialDate,
  initialTime,
  preselectedCandidateId,
  interviews,
  onScheduled,
}: {
  open: boolean
  onClose: () => void
  initialDate: Date
  initialTime: string
  preselectedCandidateId?: string | null
  interviews: Interview[]
  onScheduled: (when: Date) => void
}) {
  const queryClient = useQueryClient()
  const formId = 'schedule-interview-form'
  const [date, setDate] = useState(initialDate)
  const [time, setTime] = useState(initialTime)

  const blankForm = (): ScheduleForm => ({
    duration_minutes: 60,
    scheduled_at: '',
    panelist_ids: [],
    title: 'Technical Round',
    candidate_id: preselectedCandidateId || '',
  })

  const {
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ScheduleForm>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: blankForm(),
  })

  /* Each opening starts from where it was opened. */
  useEffect(() => {
    if (!open) return
    setDate(initialDate)
    setTime(initialTime)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  /* The date strip and slot grid own the date and time; the form mirrors them. */
  useEffect(() => {
    if (!time) return
    const [hh, mm] = time.split(':')
    const target = new Date(date)
    target.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0)
    setValue('scheduled_at', target.toISOString())
  }, [date, time, setValue])

  useEffect(() => {
    if (preselectedCandidateId) setValue('candidate_id', preselectedCandidateId)
  }, [preselectedCandidateId, setValue])

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => adminApi.listUsers().then((r: any) => r.data),
    enabled: open,
  })
  const interviewers = (users ?? []).filter((u: any) => u.role === 'interviewer')

  const { data: candidates = [] } = useQuery({
    queryKey: ['candidates-for-schedule'],
    queryFn: () => candidatesApi.list({ limit: 100 }).then((r: any) => r.data.items),
    enabled: open,
  })

  const mutation = useMutation({
    mutationFn: (form: ScheduleForm) => {
      const stage = SCHEDULE_TITLES.find((t) => t.value === form.title)
      if (!stage) return Promise.reject(new Error('Pick an interview stage'))

      return interviewsApi.create({
        candidate_id: form.candidate_id,
        title: form.title,
        application_id: '',
        interview_type: stage.type,
        scheduled_at: form.scheduled_at,
        duration_minutes: form.duration_minutes,
        notes: form.notes,
        panelist_ids: form.panelist_ids.map((id, i) => ({
          user_id: id,
          role: i === 0 ? 'lead' : 'panelist',
        })),
      })
    },
    onSuccess: (_res, form) => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] })
      queryClient.invalidateQueries({ queryKey: ['candidates_pipeline'] })
      queryClient.invalidateQueries({ queryKey: ['candidates-for-schedule'] })
      queryClient.invalidateQueries({ queryKey: ['recent-activities'] })
      onScheduled(new Date(form.scheduled_at))
      reset({ ...blankForm(), candidate_id: '' })
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message || 'Failed to schedule the interview'),
  })

  const blocked = !time || slotState(date, time, interviews) !== 'available'

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Schedule interview"
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            disabled={blocked}
            loading={isSubmitting || mutation.isPending}
          >
            Schedule
          </Button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={handleSubmit((d) => mutation.mutate(d))}
        className="space-y-hb-5"
      >
        <section className="space-y-hb-3">
          <p className="font-mono text-hb-label uppercase text-hb-dim">
            {date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <DateStrip value={date} onChange={setDate} interviews={interviews} minDate={new Date()} />
          <TimeSlots selected={time} onSelect={setTime} interviews={interviews} selectedDate={date} />
          {errors.scheduled_at && (
            <p role="alert" className="text-hb-xs font-medium text-hb-error">
              {errors.scheduled_at.message}
            </p>
          )}
        </section>

        <div className="grid gap-hb-4 border-t border-hb-border pt-hb-5 sm:grid-cols-[1fr_120px]">
          <Controller
            name="title"
            control={control}
            render={({ field }) => (
              <Select
                {...field}
                label="Stage"
                required
                error={errors.title?.message}
                options={SCHEDULE_TITLES.map((t) => ({ value: t.value, label: t.value }))}
              />
            )}
          />
          <Controller
            name="duration_minutes"
            control={control}
            render={({ field }) => (
              <Select
                {...field}
                value={String(field.value)}
                label="Duration"
                options={DURATIONS.map((m) => ({ value: String(m), label: `${m} min` }))}
              />
            )}
          />
        </div>

        <Controller
          name="candidate_id"
          control={control}
          render={({ field }) => (
            <Select
              {...field}
              label="Candidate"
              required
              error={errors.candidate_id?.message}
              placeholder="Select a candidate…"
              options={candidates.map((c: any) => ({ value: c.id, label: c.full_name }))}
            />
          )}
        />

        <Controller
          name="panelist_ids"
          control={control}
          render={({ field }) => (
            <PanelistPicker
              value={field.value ?? []}
              onChange={field.onChange}
              options={interviewers.map((u: any) => ({ value: u.id, label: u.full_name }))}
              error={errors.panelist_ids?.message}
            />
          )}
        />
      </form>
    </Drawer>
  )
}

/* ── Time grid (day and week views) ─────────────────────────────────────────── */

type Placed = { iv: Interview; start: Date; end: Date; col: number; cols: number }

/**
 * Lays a day's interviews out side by side where they overlap: each cluster
 * of overlapping interviews splits the width into as many columns as it needs.
 */
function layoutDay(items: Interview[]): Placed[] {
  const sorted = items
    .map((iv) => ({ iv, ...intervalOf(iv) }))
    .sort((a, b) => a.start.getTime() - b.start.getTime())

  const out: Placed[] = []
  let cluster: Placed[] = []
  let clusterEnd = 0

  const flush = () => {
    const cols = Math.max(...cluster.map((p) => p.col)) + 1
    cluster.forEach((p) => (p.cols = cols))
    cluster = []
    clusterEnd = 0
  }

  for (const it of sorted) {
    if (cluster.length && it.start.getTime() >= clusterEnd) flush()
    const used = new Set(cluster.filter((p) => p.end > it.start).map((p) => p.col))
    let col = 0
    while (used.has(col)) col++
    const placed: Placed = { ...it, col, cols: 1 }
    cluster.push(placed)
    out.push(placed)
    clusterEnd = Math.max(clusterEnd, it.end.getTime())
  }
  if (cluster.length) flush()
  return out
}

/** The hours a set of interviews needs: the working day, widened to fit anything outside it. */
function hourRange(items: Interview[]) {
  let first = DAY_START
  let last = DAY_END
  for (const iv of items) {
    const { start, end } = intervalOf(iv)
    first = Math.min(first, start.getHours())
    last = Math.max(last, sameDay(start, end) ? Math.ceil(end.getHours() + end.getMinutes() / 60) : 24)
  }
  return { first, last: Math.min(24, last) }
}

function hoursBetween(first: number, last: number) {
  return Array.from({ length: last - first }, (_, i) => first + i)
}

const BLOCK_TONE: Record<string, string> = {
  scheduled: 'border-l-hb-blue bg-hb-surface',
  completed: 'border-l-hb-success bg-hb-success/5',
  no_show: 'border-l-hb-warning bg-hb-warning/5',
  cancelled: 'border-l-hb-error bg-hb-surface-2',
}

const STATUS_DOT: Record<string, string> = {
  scheduled: 'bg-hb-blue',
  completed: 'bg-hb-success',
  no_show: 'bg-hb-warning',
  cancelled: 'bg-hb-error',
}

function InterviewBlock({
  placed,
  now,
  compact,
  onOpen,
  style,
}: {
  placed: Placed
  now: Date
  /** Week columns are narrow: name and time only. */
  compact?: boolean
  onOpen: () => void
  style: React.CSSProperties
}) {
  const { iv, start, end } = placed
  const live = iv.status === 'scheduled' && now >= start && now < end
  const minutes = (end.getTime() - start.getTime()) / 60_000
  const roomy = !compact && minutes >= 45 && placed.cols < 3
  const cancelled = iv.status === 'cancelled'

  return (
    <button
      type="button"
      onClick={onOpen}
      style={style}
      title={`${iv.candidate_name || 'Unnamed candidate'} · ${iv.title} · ${formatTime(start)} – ${formatTime(end)}`}
      className={
        'pointer-events-auto absolute flex flex-col overflow-hidden rounded-hb-sm border border-l-[3px] border-hb-border text-left shadow-hb-1 transition-[box-shadow,transform] duration-hb ease-hb hover:z-[3] hover:-translate-y-px hover:shadow-hb-2 focus-visible:z-[3] focus-visible:outline-none focus-visible:shadow-hb-ring ' +
        (compact ? 'px-2 py-1 ' : 'px-3 py-2 ') +
        (BLOCK_TONE[iv.status] ?? BLOCK_TONE.scheduled)
      }
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {live && <span aria-hidden className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-hb-error" />}
        <span
          className={
            'truncate font-semibold text-hb-text ' +
            (compact ? 'text-hb-xs ' : 'text-hb-sm ') +
            (cancelled ? 'line-through opacity-60' : '')
          }
        >
          {iv.candidate_name || 'Unnamed candidate'}
        </span>
        {live && !compact && (
          <Badge tone="error" className="shrink-0">
            Live
          </Badge>
        )}
      </span>
      <span className={'truncate text-hb-muted ' + (compact ? 'text-hb-micro' : 'text-hb-xs')}>
        {compact ? formatTime(start) : `${iv.title} · ${formatTime(start)} – ${formatTime(end)}`}
      </span>
      {roomy && iv.panelists?.length > 0 && (
        <span className="mt-auto flex items-center pt-1.5">
          {iv.panelists.slice(0, 4).map((p, i) => (
            <span key={p.id} className={i ? '-ml-1.5' : ''}>
              <Avatar name={p.user_name || 'Panelist'} size="xs" className="ring-2 ring-hb-surface" />
            </span>
          ))}
          {iv.panelists.length > 4 && (
            <span className="ml-1.5 text-hb-micro text-hb-dim">+{iv.panelists.length - 4}</span>
          )}
        </span>
      )}
    </button>
  )
}

/** Hour labels down the left of the time grid, each centred on its line. */
function HourGutter({ first, last }: { first: number; last: number }) {
  return (
    <div aria-hidden className="relative w-14 shrink-0" style={{ height: (last - first) * HOUR_H }}>
      {hoursBetween(first, last).map((h, i) => (
        <span
          key={h}
          className="absolute right-3 -translate-y-1/2 font-mono text-hb-micro text-hb-dim"
          style={{ top: i * HOUR_H }}
        >
          {formatSlot(`${String(h).padStart(2, '0')}:00`).replace(':00', '')}
        </span>
      ))}
    </div>
  )
}

/** The half-hour start times between two hours: "09:00", "09:30", … */
function halfHours(first: number, last: number) {
  return hoursBetween(first, last).flatMap((h) => {
    const hh = String(h).padStart(2, '0')
    return [`${hh}:00`, `${hh}:30`]
  })
}

/**
 * One day on the time grid. Free time is offered in half-hour steps: hover
 * anywhere free and it shows the time a click would book ("Schedule at
 * 10:30 AM"). The day's interviews sit over it at their time and length.
 * Time already gone — a past day, or today above the now-line — is shaded,
 * so it is clear why nothing there responds.
 */
function DayColumn({
  date,
  items,
  allInterviews,
  now,
  first,
  last,
  compact,
  onSlot,
  onOpen,
}: {
  date: Date
  /** The day's interviews that pass the status filter. */
  items: Interview[]
  /** Everything, so a filtered-out interview still blocks its slot. */
  allInterviews: Interview[]
  now: Date
  first: number
  last: number
  compact?: boolean
  onSlot: (date: Date, time: string) => void
  onOpen: (iv: Interview) => void
}) {
  const placed = useMemo(() => layoutDay(items), [items])
  const hours = hoursBetween(first, last)
  const height = hours.length * HOUR_H
  const offset = (d: Date) => ((d.getHours() - first) * 60 + d.getMinutes()) * (HOUR_H / 60)
  const isToday = sameDay(date, now)
  const showNow = isToday && now.getHours() >= first && now.getHours() < last
  const elapsed =
    startOfDay(date) < startOfDay(now)
      ? height
      : isToday
        ? Math.min(height, Math.max(0, offset(now)))
        : 0

  return (
    <div className="relative" style={{ height }}>
      {hours.map((h, i) => (
        <div
          key={h}
          aria-hidden
          className="absolute inset-x-0 border-t border-hb-border"
          style={{ top: i * HOUR_H }}
        />
      ))}

      {elapsed > 0 && (
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 bg-hb-surface-2/70"
          style={{ height: elapsed }}
        />
      )}

      {halfHours(first, last).map((time, i) =>
        slotState(date, time, allInterviews) === 'available' ? (
          <button
            key={time}
            type="button"
            aria-label={`Schedule on ${date.toDateString()} at ${formatSlot(time)}`}
            onClick={() => onSlot(date, time)}
            style={{ top: i * SLOT_H + 1, height: SLOT_H - 2 }}
            className={
              'absolute inset-x-1 flex items-center gap-1 rounded-hb-sm border border-dashed border-transparent text-hb-xs font-semibold text-transparent transition-colors duration-hb hover:border-hb-blue/40 hover:bg-hb-blue/5 hover:text-hb-blue focus-visible:border-hb-blue/40 focus-visible:bg-hb-blue/5 focus-visible:text-hb-blue focus-visible:outline-none ' +
              (compact ? 'px-1.5' : 'px-2.5')
            }
          >
            <Plus size={12} aria-hidden className="shrink-0" />
            <span className="truncate">
              {compact ? formatSlot(time).replace(':00', '') : `Schedule at ${formatSlot(time)}`}
            </span>
          </button>
        ) : null
      )}

      {/* Interviews float over the rows; the layer lets clicks through to the
          free-slot buttons underneath, and only the blocks catch them. */}
      <div className="pointer-events-none absolute inset-0">
        {placed.map((p) => {
          const height = Math.max(
            ((p.end.getTime() - p.start.getTime()) / 3_600_000) * HOUR_H - 4,
            compact ? 36 : 44
          )
          return (
            <InterviewBlock
              key={p.iv.id}
              placed={p}
              now={now}
              compact={compact}
              onOpen={() => onOpen(p.iv)}
              style={{
                top: offset(p.start) + 2,
                height,
                left: `calc(${(p.col / p.cols) * 100}% + ${compact ? 2 : 4}px)`,
                width: `calc(${100 / p.cols}% - ${compact ? 4 : 8}px)`,
              }}
            />
          )
        })}

        {showNow && (
          <div
            aria-hidden
            className="absolute inset-x-0 z-[4] border-t-2 border-hb-error"
            style={{ top: offset(now) }}
          >
            <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-hb-error" />
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Calendar views ─────────────────────────────────────────────────────────── */

type CalendarView = 'day' | 'week' | 'month'

const VIEWS: CalendarView[] = ['day', 'week', 'month']
const VIEW_KEY = 'hb.schedule.view'

function ViewSwitch({ value, onChange }: { value: CalendarView; onChange: (v: CalendarView) => void }) {
  return (
    <div
      role="group"
      aria-label="Calendar view"
      className="inline-flex rounded-hb-full border border-hb-border bg-hb-surface-2 p-0.5"
    >
      {VIEWS.map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={
            'h-8 rounded-hb-full px-3.5 text-hb-sm capitalize transition-colors duration-hb focus-visible:outline-none focus-visible:shadow-hb-ring ' +
            (value === v
              ? 'bg-hb-grad font-semibold text-hb-on-brand'
              : 'text-hb-muted hover:text-hb-text')
          }
        >
          {v}
        </button>
      ))}
    </div>
  )
}

function DayView({
  date,
  items,
  allInterviews,
  now,
  onSlot,
  onOpen,
}: {
  date: Date
  items: Interview[]
  allInterviews: Interview[]
  now: Date
  onSlot: (date: Date, time: string) => void
  onOpen: (iv: Interview) => void
}) {
  const { first, last } = hourRange(items)
  /* Late in the day every slot has passed and the grid offers nothing to
     hover — say so, and point at tomorrow, rather than look broken. */
  const noRoomToday =
    sameDay(date, now) &&
    !halfHours(first, last).some((t) => slotState(date, t, allInterviews) === 'available')

  return (
    <div className="px-2 pb-4 pt-4 sm:px-4">
      {noRoomToday && (
        <div className="mb-hb-4 flex flex-wrap items-center justify-between gap-3 rounded-hb-sm border border-hb-border bg-hb-surface-2 px-3.5 py-2.5">
          <p className="text-hb-sm text-hb-muted">No free time left today.</p>
          <Button variant="ghost" size="sm" onClick={() => onSlot(addDays(date, 1), '')}>
            Book tomorrow
          </Button>
        </div>
      )}
      <div className="flex">
        <HourGutter first={first} last={last} />
        <div className="min-w-0 flex-1">
          <DayColumn
            date={date}
            items={items}
            allInterviews={allInterviews}
            now={now}
            first={first}
            last={last}
            onSlot={onSlot}
            onOpen={onOpen}
          />
        </div>
      </div>
    </div>
  )
}

function WeekView({
  weekStart,
  items,
  allInterviews,
  now,
  onSlot,
  onOpen,
  onPickDay,
}: {
  weekStart: Date
  items: Interview[]
  allInterviews: Interview[]
  now: Date
  onSlot: (date: Date, time: string) => void
  onOpen: (iv: Interview) => void
  onPickDay: (d: Date) => void
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const byDay = useMemo(
    () => days.map((d) => items.filter((iv) => sameDay(parseISO(iv.scheduled_at), d))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, weekStart.getTime()]
  )
  const { first, last } = hourRange(items)

  return (
    /* Seven columns need room; on a phone the week scrolls sideways rather
       than squeezing each day to a sliver. */
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="flex border-b border-hb-border pr-2 sm:pr-4">
          <div className="w-14 shrink-0 sm:ml-4" />
          {days.map((d) => {
            const today = sameDay(d, now)
            return (
              <button
                key={d.toDateString()}
                type="button"
                onClick={() => onPickDay(d)}
                aria-label={`Open ${d.toDateString()}`}
                className="flex flex-1 flex-col items-center gap-1 border-l border-hb-border py-2.5 transition-colors duration-hb hover:bg-hb-surface-2 focus-visible:outline-none focus-visible:shadow-hb-ring"
              >
                <span className="font-mono text-hb-micro uppercase text-hb-dim">{WEEK_DAYS[d.getDay()]}</span>
                <span
                  className={
                    'grid h-7 w-7 place-items-center rounded-full text-hb-sm font-semibold tabular-nums ' +
                    (today ? 'bg-hb-grad text-hb-on-brand' : 'text-hb-text')
                  }
                >
                  {d.getDate()}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex pb-4 pr-2 pt-4 sm:pr-4">
          <div className="sm:ml-4">
            <HourGutter first={first} last={last} />
          </div>
          {days.map((d, i) => (
            <div key={d.toDateString()} className="min-w-0 flex-1 border-l border-hb-border">
              <DayColumn
                date={d}
                items={byDay[i]}
                allInterviews={allInterviews}
                now={now}
                first={first}
                last={last}
                compact
                onSlot={onSlot}
                onOpen={onOpen}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Up to this many interviews show in a month cell before "+N more". */
const MONTH_CELL_MAX = 3

function MonthView({
  month,
  items,
  allInterviews,
  now,
  onPickDay,
  onOpen,
  onSchedule,
}: {
  month: Date
  items: Interview[]
  /** Everything, so a filtered-out interview still blocks today's slots. */
  allInterviews: Interview[]
  now: Date
  onPickDay: (d: Date) => void
  onOpen: (iv: Interview) => void
  onSchedule: (d: Date) => void
}) {
  const todayStart = startOfDay(now)
  /* Today can only be booked while it still has a free slot. */
  const todayHasRoom = SLOTS.some((s) => slotState(now, s, allInterviews) === 'available')
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1)
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const gridStart = startOfWeek(firstOfMonth)
  const weeks = Math.ceil((daysInMonth + firstOfMonth.getDay()) / 7)
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i))

  const byDay = useMemo(() => {
    const map = new Map<string, Array<{ iv: Interview; start: Date }>>()
    for (const iv of items) {
      const start = parseISO(iv.scheduled_at)
      const key = start.toDateString()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push({ iv, start })
    }
    map.forEach((list) => list.sort((a, b) => a.start.getTime() - b.start.getTime()))
    return map
  }, [items])

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-hb-border">
        {WEEK_DAYS.map((d) => (
          <abbr
            key={d}
            title={d}
            className="py-2.5 text-center font-mono text-hb-micro uppercase text-hb-dim no-underline"
          >
            {d}
          </abbr>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const list = byDay.get(d.toDateString()) ?? []
          const inMonth = d.getMonth() === month.getMonth()
          const today = sameDay(d, now)
          const bookable = d > todayStart || (today && todayHasRoom)
          return (
            <div
              key={d.toDateString()}
              className={
                'relative min-h-[76px] p-1.5 sm:min-h-[116px] ' +
                (i % 7 ? 'border-l border-hb-border ' : '') +
                (i < cells.length - 7 ? 'border-b border-hb-border ' : '') +
                (inMonth ? '' : 'bg-hb-surface-2/60')
              }
            >
              {/* The empty part of a day is a target of its own. With a
                  pointer, hovering shows "+ Schedule" and a click books that
                  day; on a phone, where nothing can be hovered, a tap opens
                  the day instead. The cell's content sits above and lets the
                  pointer through except on its own buttons. */}
              <button
                type="button"
                tabIndex={-1}
                aria-hidden
                onClick={() => onPickDay(d)}
                className="absolute inset-0 sm:hidden"
              />
              {bookable && (
                <button
                  type="button"
                  onClick={() => onSchedule(d)}
                  aria-label={`Schedule on ${d.toDateString()}`}
                  className="absolute inset-0 hidden items-start justify-end p-2.5 text-hb-xs font-semibold text-transparent transition-colors duration-hb hover:bg-hb-blue/5 hover:text-hb-blue focus-visible:bg-hb-blue/5 focus-visible:text-hb-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-hb-blue/40 sm:flex"
                >
                  <span className="inline-flex items-center gap-1">
                    <Plus size={12} aria-hidden />
                    <span className="hidden lg:inline">Schedule</span>
                  </span>
                </button>
              )}

              <div className="pointer-events-none relative">
                <button
                  type="button"
                  onClick={() => onPickDay(d)}
                  aria-label={`Open ${d.toDateString()}${list.length ? `, ${list.length} interviews` : ''}`}
                  className={
                    'pointer-events-auto grid h-7 w-7 place-items-center rounded-full text-hb-sm tabular-nums transition-colors duration-hb focus-visible:outline-none focus-visible:shadow-hb-ring ' +
                    (today
                      ? 'bg-hb-grad font-semibold text-hb-on-brand'
                      : inMonth
                        ? 'text-hb-text hover:bg-hb-surface-2'
                        : 'text-hb-dim hover:bg-hb-surface-2')
                  }
                >
                  {d.getDate()}
                </button>

                {/* Phones get a count; there is no room for names. */}
                {list.length > 0 && (
                  <span className="mt-1 block px-1 text-hb-micro font-semibold text-hb-blue sm:hidden">
                    {list.length}
                  </span>
                )}

                <ul className="mt-1 hidden space-y-0.5 sm:block">
                  {list.slice(0, MONTH_CELL_MAX).map(({ iv, start }) => (
                    <li key={iv.id}>
                      <button
                        type="button"
                        onClick={() => onOpen(iv)}
                        title={`${iv.candidate_name || 'Unnamed candidate'} · ${iv.title} · ${formatTime(start)}`}
                        className="pointer-events-auto flex w-full items-center gap-1.5 rounded-hb-xs px-1.5 py-0.5 text-left text-hb-xs transition-colors duration-hb hover:bg-hb-surface-2 focus-visible:outline-none focus-visible:shadow-hb-ring"
                      >
                        <span
                          aria-hidden
                          className={'h-1.5 w-1.5 shrink-0 rounded-full ' + (STATUS_DOT[iv.status] ?? 'bg-hb-blue')}
                        />
                        <span className="shrink-0 tabular-nums text-hb-dim">
                          {formatTime(start).replace(':00', '').replace(' ', '').toLowerCase()}
                        </span>
                        <span
                          className={
                            'min-w-0 truncate text-hb-text ' +
                            (iv.status === 'cancelled' ? 'line-through opacity-60' : '')
                          }
                        >
                          {iv.candidate_name || 'Unnamed'}
                        </span>
                      </button>
                    </li>
                  ))}
                  {list.length > MONTH_CELL_MAX && (
                    <li>
                      <button
                        type="button"
                        onClick={() => onPickDay(d)}
                        className="pointer-events-auto rounded-hb-xs px-1.5 text-hb-xs font-semibold text-hb-blue hover:underline focus-visible:outline-none focus-visible:shadow-hb-ring"
                      >
                        +{list.length - MONTH_CELL_MAX} more
                      </button>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Summary strip ──────────────────────────────────────────────────────────── */

/**
 * Next interview and the week's counts, as one slim strip above the calendar.
 * It sat under the month grid as a card, where on a laptop screen it fell
 * below the fold.
 */
function SummaryStrip({
  interviews,
  now,
  onOpen,
}: {
  interviews: Interview[]
  now: Date
  onOpen: (iv: Interview) => void
}) {
  const next = useMemo(
    () =>
      interviews
        .filter((iv) => iv.status === 'scheduled')
        .map((iv) => ({ iv, ...intervalOf(iv) }))
        .filter((x) => x.end > now)
        .sort((a, b) => a.start.getTime() - b.start.getTime())[0],
    [interviews, now]
  )

  const stats = useMemo(() => {
    const weekStart = startOfWeek(now)
    const weekEnd = addDays(weekStart, 7)
    let today = 0
    let week = 0
    let upcoming = 0
    for (const iv of interviews) {
      if (iv.status === 'cancelled') continue
      const { start } = intervalOf(iv)
      if (sameDay(start, now)) today++
      if (start >= weekStart && start < weekEnd) week++
      if (iv.status === 'scheduled' && start > now) upcoming++
    }
    return [
      { label: 'Today', value: today },
      { label: 'This week', value: week },
      { label: 'Upcoming', value: upcoming },
    ]
  }, [interviews, now])

  const live = next && now >= next.start

  return (
    <Card padding="none" className="mb-hb-6 flex flex-col overflow-hidden sm:flex-row sm:items-stretch">
      <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 sm:px-5">
        {next ? (
          <>
            <button
              type="button"
              onClick={() => onOpen(next.iv)}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-hb-sm text-left focus-visible:outline-none focus-visible:shadow-hb-ring"
            >
              <Avatar name={next.iv.candidate_name || 'Candidate'} size="md" />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-x-2">
                  <span className="font-mono text-hb-label uppercase text-hb-dim">Next up</span>
                  <span
                    className={
                      'inline-flex items-center gap-1.5 text-hb-xs font-semibold ' +
                      (live ? 'text-hb-error' : 'text-hb-cyan')
                    }
                  >
                    {live && <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-hb-error" />}
                    {untilLabel(next.start, next.end, now)}
                  </span>
                </span>
                <span className="block truncate text-hb-body font-semibold text-hb-text">
                  {next.iv.candidate_name || 'Unnamed candidate'}
                </span>
                <span className="block truncate text-hb-xs text-hb-muted">
                  {next.iv.title} · {formatTime(next.start)}
                </span>
              </span>
            </button>
            {next.iv.meeting_link && (
              <Button
                href={next.iv.meeting_link}
                target="_blank"
                rel="noreferrer"
                size="sm"
                icon={<Video size={14} />}
                className="shrink-0"
              >
                Join
              </Button>
            )}
          </>
        ) : (
          <p className="text-hb-sm text-hb-muted">
            <span className="mr-2 font-mono text-hb-label uppercase text-hb-dim">Next up</span>
            Nothing booked.
          </p>
        )}
      </div>

      <dl className="grid grid-cols-3 border-t border-hb-border sm:w-[340px] sm:border-l sm:border-t-0">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={'flex flex-col-reverse items-center justify-center px-3 py-3 ' + (i ? 'border-l border-hb-border' : '')}
          >
            <dt className="text-hb-xs text-hb-muted">{s.label}</dt>
            <dd className="font-display text-hb-h3 tabular-nums text-hb-text">{s.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

/* ── Interview drawer ───────────────────────────────────────────────────────── */

function InterviewDrawer({
  interview,
  onClose,
  completing,
  onComplete,
  onCancel,
}: {
  interview: Interview | null
  onClose: () => void
  /** True while this interview's own "Complete" mutation is in flight. */
  completing: boolean
  onComplete: () => void
  onCancel: () => void
}) {
  /* Keep the last interview while the drawer animates out. */
  const [shown, setShown] = useState(interview)
  useEffect(() => {
    if (interview) setShown(interview)
  }, [interview])

  const iv = interview ?? shown
  if (!iv) return null
  const { start, end } = intervalOf(iv)

  const facts = [
    {
      label: 'Date',
      value: start.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' }),
    },
    { label: 'Time', value: `${formatTime(start)} – ${formatTime(end)}` },
    {
      label: 'Type',
      value: (
        <span className="inline-flex items-center gap-1.5 capitalize">
          {TYPE_ICON[iv.interview_type] ?? <ClipboardList size={13} />}
          {iv.interview_type.replace(/_/g, ' ')}
        </span>
      ),
    },
    { label: 'Duration', value: `${iv.duration_minutes} min` },
  ]

  return (
    <Drawer
      open={!!interview}
      onClose={onClose}
      title={iv.candidate_name || 'Unnamed candidate'}
      description={iv.title}
      footer={
        iv.status === 'scheduled' ? (
          <>
            <Button variant="quiet" onClick={onCancel}>
              Cancel interview
            </Button>
            <Button variant="ghost" loading={completing} onClick={onComplete}>
              Mark complete
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="space-y-hb-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={iv.status} />
        </div>

        <dl className="grid grid-cols-2 gap-hb-3">
          {facts.map((f) => (
            <div key={f.label} className="rounded-hb-sm border border-hb-border bg-hb-surface-2 px-3.5 py-2.5">
              <dt className="font-mono text-hb-label uppercase text-hb-dim">{f.label}</dt>
              <dd className="mt-1 text-hb-sm font-semibold text-hb-text">{f.value}</dd>
            </div>
          ))}
        </dl>

        {/* In the body rather than the footer: the calendar menu opens
            downwards and would fall off the bottom of the screen. */}
        {iv.status === 'scheduled' && (
          <div className="flex items-center gap-2">
            {iv.meeting_link && (
              <Button
                href={iv.meeting_link}
                target="_blank"
                rel="noreferrer"
                icon={<Video size={15} />}
                className="flex-1"
              >
                Join meeting
              </Button>
            )}
            <AddToCalendarDropdown interview={iv} />
          </div>
        )}

        {iv.panelists?.length > 0 && (
          <div>
            <p className="mb-2 font-mono text-hb-label uppercase text-hb-dim">Panel</p>
            <ul className="space-y-2">
              {iv.panelists.map((p) => (
                <li key={p.id} className="flex items-center gap-2.5">
                  <Avatar name={p.user_name || 'Panelist'} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-hb-sm font-semibold text-hb-text">
                      {p.user_name}
                    </span>
                    {p.user_email && (
                      <span className="block truncate text-hb-xs text-hb-muted">{p.user_email}</span>
                    )}
                  </span>
                  {p.role === 'lead' && <Badge tone="info">Lead</Badge>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {iv.notes && (
          <div>
            <p className="mb-1.5 font-mono text-hb-label uppercase text-hb-dim">Notes</p>
            <p className="whitespace-pre-wrap text-hb-sm leading-relaxed text-hb-muted">{iv.notes}</p>
          </div>
        )}

        {iv.status === 'completed' && iv.application_id && (
          <Scorecards applicationId={iv.application_id} />
        )}
      </div>
    </Drawer>
  )
}

/* ── Page ───────────────────────────────────────────────────────────────────── */

export default function InterviewsListPage() {
  const { user, setUser } = useAuthStore()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const preselectedCandidateId = searchParams.get('candidateId')
  const now = useNow()

  /* Landing spot for the Google Calendar OAuth callback redirect
     (`GET /v1/calendar/callback` in the backend) — it appends `success` or
     `error` and sends the browser back here. Report it, then drop the param
     and refresh the user so the "Calendar synced" badge above reflects it
     without a manual reload. */
  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    if (!success && !error) return

    if (success === 'calendar_connected') {
      toast.success('Google Calendar connected')
      authApi.me().then((res) => setUser(res.data)).catch(() => {})
    } else if (error === 'calendar_auth_failed') {
      toast.error('Could not connect your calendar')
    }

    const next = new URLSearchParams(searchParams)
    next.delete('success')
    next.delete('error')
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()))
  const [statusFilter, setStatusFilter] = useState<InterviewStatus | ''>('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Interview | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [booking, setBooking] = useState<{ date: Date; time: string } | null>(null)

  /* The chosen view is a per-viewer convenience, so it lives in the browser. */
  const [view, setView] = useState<CalendarView>(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY) as CalendarView | null
      return saved && VIEWS.includes(saved) ? saved : 'day'
    } catch {
      return 'day'
    }
  })
  const changeView = (v: CalendarView) => {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* Storage blocked: the view just will not be remembered. */
    }
  }
  /* A day picked from the week or month view opens it in the day view. */
  const pickDay = (d: Date) => {
    setSelectedDate(startOfDay(d))
    changeView('day')
  }

  const { data: interviews, isLoading } = useQuery({
    queryKey: ['interviews'],
    queryFn: () => interviewsApi.list().then((r: any) => r.data),
  })
  const all: Interview[] = interviews ?? []

  const filtered = useMemo(
    () => (statusFilter ? all.filter((iv) => iv.status === statusFilter) : all),
    [all, statusFilter]
  )

  const weekStart = startOfWeek(selectedDate)

  const dayItems = useMemo(
    () => filtered.filter((iv) => sameDay(parseISO(iv.scheduled_at), selectedDate)),
    [filtered, selectedDate]
  )

  const weekItems = useMemo(() => {
    const end = addDays(weekStart, 7)
    return filtered.filter((iv) => {
      const d = parseISO(iv.scheduled_at)
      return d >= weekStart && d < end
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, weekStart.getTime()])

  /* Derived from the list rather than held, so the drawer reflects a status
     change as soon as the list refetches. */
  const openInterview = openId ? (all.find((iv) => iv.id === openId) ?? null) : null
  const openDetails = (iv: Interview) => setOpenId(iv.id)

  /* Booking starts on the given day (the selected one by default), or today
     if that day is past. */
  const openBooking = (date: Date = selectedDate, time = '') => {
    const today = startOfDay(new Date())
    setBooking({ date: date < today ? today : startOfDay(date), time })
  }

  /* Arriving with `?candidateId=` (from a candidate's profile) means "book this
     person" — open the drawer straight away. */
  useEffect(() => {
    if (preselectedCandidateId) openBooking()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      interviewsApi.cancel(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] })
      queryClient.invalidateQueries({ queryKey: ['candidates_pipeline'] })
      toast.success('Interview cancelled')
      setCancelTarget(null)
      setCancelReason('')
    },
    onError: () => toast.error('Failed to cancel the interview'),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: InterviewStatus }) =>
      interviewsApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] })
      toast.success('Interview updated')
    },
    onError: () => toast.error('Failed to update the interview'),
  })

  const [connectCalendar, connectingCalendar] = useAsyncAction(async () => {
    try {
      const res = await authApi.connectCalendar()
      window.location.href = res.data.auth_url
    } catch {
      toast.error('Could not connect your calendar')
    }
  })

  const isPastDay = selectedDate < startOfDay(now)

  const rangeTitle =
    view === 'day'
      ? selectedDate.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })
      : view === 'week'
        ? `${weekStart.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} – ${addDays(weekStart, 6).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`
        : `${MONTHS[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`

  /* Whether the range on screen already contains today — the Today button
     only shows when it would move somewhere. */
  const showingNow =
    view === 'day'
      ? sameDay(selectedDate, now)
      : view === 'week'
        ? sameDay(weekStart, startOfWeek(now))
        : selectedDate.getMonth() === now.getMonth() && selectedDate.getFullYear() === now.getFullYear()

  const step = (dir: 1 | -1) =>
    setSelectedDate(
      view === 'day'
        ? addDays(selectedDate, dir)
        : view === 'week'
          ? addDays(selectedDate, 7 * dir)
          : new Date(selectedDate.getFullYear(), selectedDate.getMonth() + dir, 1)
    )

  const dayNav =
    'grid h-8 w-8 place-items-center rounded-hb-full border border-hb-border text-hb-muted transition-colors duration-hb hover:border-hb-border-strong hover:text-hb-text focus-visible:outline-none focus-visible:shadow-hb-ring'

  return (
    <div className="pb-hb-10">
      <PageHeader
        title="Schedule"
        description="Book interviews and keep the day on track."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {user?.is_calendar_connected ? (
              <Badge tone="success" dot>
                Calendar synced
              </Badge>
            ) : (
              <Button
                variant="ghost"
                icon={<CalendarCheck size={16} />}
                loading={connectingCalendar}
                onClick={() => connectCalendar()}
              >
                Connect Google Calendar
              </Button>
            )}
            <Button icon={<Plus size={16} />} onClick={() => openBooking()}>
              Schedule interview
            </Button>
          </div>
        }
      />

      <SummaryStrip interviews={all} now={now} onOpen={openDetails} />

      <div
        className={
          'grid items-start gap-hb-6 ' + (view === 'month' ? '' : 'lg:grid-cols-[280px_minmax(0,1fr)]')
        }
      >
        {/* The month view is its own month grid, so the mini calendar steps aside. */}
        {view !== 'month' && (
          <Card padding="loose" className="hidden lg:block">
            <MonthCalendar interviews={all} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          </Card>
        )}

        <Card padding="none" className="min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-hb-border px-4 py-3.5 sm:px-5">
            <span className="flex items-center gap-1">
              <button
                type="button"
                aria-label={`Previous ${view}`}
                onClick={() => step(-1)}
                className={dayNav}
              >
                <ChevronLeft size={16} aria-hidden />
              </button>
              <button
                type="button"
                aria-label={`Next ${view}`}
                onClick={() => step(1)}
                className={dayNav}
              >
                <ChevronRight size={16} aria-hidden />
              </button>
            </span>
            <h2 className="font-display text-hb-h3 text-hb-text">{rangeTitle}</h2>
            {!showingNow && (
              <Button variant="quiet" size="sm" onClick={() => setSelectedDate(startOfDay(new Date()))}>
                Today
              </Button>
            )}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <ViewSwitch value={view} onChange={changeView} />
              <div className="w-[150px]">
                <Select
                  aria-label="Filter by status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as InterviewStatus | '')}
                  options={[
                    { value: '', label: 'All statuses' },
                    { value: 'scheduled', label: 'Scheduled' },
                    { value: 'completed', label: 'Completed' },
                    { value: 'no_show', label: 'No show' },
                    { value: 'cancelled', label: 'Cancelled' },
                  ]}
                />
              </div>
            </div>
          </div>

          {view === 'day' && (
            <div className="border-b border-hb-border px-3 py-3 lg:hidden">
              <DateStrip value={selectedDate} onChange={setSelectedDate} interviews={all} />
            </div>
          )}

          {isLoading ? (
            <div className="p-4 sm:p-5">
              <Skeleton className="h-[480px] w-full" rounded="md" />
            </div>
          ) : view === 'month' ? (
            <MonthView
              month={selectedDate}
              items={filtered}
              allInterviews={all}
              now={now}
              onPickDay={pickDay}
              onOpen={openDetails}
              onSchedule={(d) => openBooking(d)}
            />
          ) : view === 'week' ? (
            <WeekView
              weekStart={weekStart}
              items={weekItems}
              allInterviews={all}
              now={now}
              onSlot={openBooking}
              onOpen={openDetails}
              onPickDay={pickDay}
            />
          ) : isPastDay && dayItems.length === 0 ? (
            <div className="p-4 sm:p-5">
              <EmptyState
                tone="no-results"
                icon={<CalendarDays />}
                title="No interviews on this day"
                action={{ label: 'Go to today', onClick: () => setSelectedDate(startOfDay(new Date())) }}
              />
            </div>
          ) : (
            <DayView
              date={selectedDate}
              items={dayItems}
              allInterviews={all}
              now={now}
              onSlot={openBooking}
              onOpen={openDetails}
            />
          )}
        </Card>
      </div>

      <ScheduleDrawer
        open={!!booking}
        onClose={() => setBooking(null)}
        initialDate={booking?.date ?? startOfDay(new Date())}
        initialTime={booking?.time ?? ''}
        preselectedCandidateId={preselectedCandidateId}
        interviews={all}
        onScheduled={(when) => {
          toast.success('Interview scheduled')
          setBooking(null)
          setSelectedDate(startOfDay(when))
        }}
      />

      <InterviewDrawer
        interview={openInterview}
        onClose={() => setOpenId(null)}
        completing={statusMutation.isPending && statusMutation.variables?.id === openInterview?.id}
        onComplete={() => {
          if (openInterview && !statusMutation.isPending) {
            statusMutation.mutate({ id: openInterview.id, status: 'completed' })
          }
        }}
        onCancel={() => {
          if (!openInterview) return
          setCancelTarget(openInterview)
          setOpenId(null)
        }}
      />

      {/* A plain ConfirmDialog cannot carry the reason field, so this is a
          Dialog with the same shape. */}
      <Dialog
        open={!!cancelTarget}
        onClose={() => {
          setCancelTarget(null)
          setCancelReason('')
        }}
        size="sm"
        closeOnOverlayClick={false}
        title="Cancel this interview?"
        description={`${cancelTarget?.candidate_name} and every interviewer on the panel will be notified.`}
        footer={
          <>
            <Button
              variant="quiet"
              size="sm"
              onClick={() => {
                setCancelTarget(null)
                setCancelReason('')
              }}
              disabled={cancelMutation.isPending}
            >
              Keep it
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={cancelMutation.isPending}
              onClick={() =>
                cancelTarget && cancelMutation.mutate({ id: cancelTarget.id, reason: cancelReason })
              }
            >
              Cancel interview
            </Button>
          </>
        }
      >
        <div className="pb-2">
          <Textarea
            label="Reason"
            description="Optional. Included in the notification."
            rows={3}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="e.g. Candidate withdrew, rescheduling needed…"
          />
        </div>
      </Dialog>
    </div>
  )
}
