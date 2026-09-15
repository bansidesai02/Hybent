import { useCallback, useEffect, useMemo, useState } from 'react'
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
  Link as LinkIcon,
  List as ListIcon,
  Phone,
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
  EmptyState,
  FilterChips,
  Label,
  Meter,
  PageHeader,
  Pagination,
  Select,
  Skeleton,
  StatusPill,
  Tabs,
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
 *   popover, none of it reachable by keyboard. It is now one
 *   `<input type="time">`, which is keyboard- and screen-reader-correct for
 *   free and renders as the platform time picker on a phone.
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

const ITEMS_PER_PAGE = 5

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

/* ── Calendar ───────────────────────────────────────────────────────────────── */

function MonthCalendar({
  interviews,
  selectedDate,
  onSelectDate,
}: {
  interviews: Interview[]
  selectedDate: Date | null
  onSelectDate: (d: Date) => void
}) {
  const [viewDate, setViewDate] = useState(() => new Date())
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const today = new Date()

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
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  /* Scheduled wins, then completed, then no-show — the most actionable state
     for that day is what the dot should report. */
  const dotClass = (statuses: InterviewStatus[]) => {
    if (statuses.includes('scheduled')) return 'bg-hb-blue'
    if (statuses.includes('completed')) return 'bg-hb-success'
    if (statuses.includes('no_show')) return 'bg-hb-warning'
    return 'bg-hb-error'
  }

  const navButton =
    'grid h-8 w-8 place-items-center rounded-hb-full border border-hb-border bg-hb-surface text-hb-muted transition-colors duration-hb hover:border-hb-border-strong hover:text-hb-text focus-visible:outline-none focus-visible:shadow-hb-ring'

  return (
    <div>
      <div className="mb-hb-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          aria-label="Previous month"
          className={navButton}
        >
          <ChevronLeft size={16} aria-hidden />
        </button>
        <span className="font-display text-hb-h3 text-hb-text">
          {MONTHS[month]} {year}
        </span>
        <button
          type="button"
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          aria-label="Next month"
          className={navButton}
        >
          <ChevronRight size={16} aria-hidden />
        </button>
      </div>

      <div className="mb-1.5 grid grid-cols-7">
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

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDay }, (_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const dayDate = new Date(year, month, day)
          const statuses = byDate[`${year}-${month}-${day}`]
          const isToday =
            today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
          const isSelected =
            selectedDate?.getFullYear() === year &&
            selectedDate?.getMonth() === month &&
            selectedDate?.getDate() === day
          const isPast = dayDate < todayMidnight

          return (
            <button
              key={day}
              type="button"
              disabled={isPast}
              aria-pressed={isSelected}
              aria-label={dayDate.toDateString()}
              onClick={() => onSelectDate(dayDate)}
              className={
                'relative grid aspect-square place-items-center rounded-hb-sm border text-hb-sm transition-colors duration-hb focus-visible:outline-none focus-visible:shadow-hb-ring disabled:cursor-not-allowed disabled:opacity-35 ' +
                (isSelected
                  ? 'border-hb-blue/50 bg-hb-blue/12 font-semibold text-hb-blue'
                  : isToday
                    ? 'border-hb-border-strong bg-hb-surface-2 font-semibold text-hb-text'
                    : 'border-transparent text-hb-muted hover:bg-hb-surface-2 hover:text-hb-text')
              }
            >
              {day}
              {statuses && (
                <span
                  aria-hidden
                  className={`absolute bottom-1.5 h-1 w-1 rounded-full ${dotClass(statuses)}`}
                />
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-hb-4 flex flex-wrap gap-3 border-t border-hb-border pt-hb-3">
        {[
          ['bg-hb-blue', 'Scheduled'],
          ['bg-hb-success', 'Completed'],
          ['bg-hb-warning', 'No show'],
          ['bg-hb-error', 'Cancelled'],
        ].map(([cls, label]) => (
          <span key={label} className="flex items-center gap-1.5 text-hb-xs text-hb-muted">
            <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${cls}`} />
            {label}
          </span>
        ))}
      </div>
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
  selectedDate: Date | null
}) {
  const slotStatus = useCallback(
    (time: string): 'available' | 'scheduled' | 'past' => {
      if (!selectedDate) return 'available'
      const [h, m] = time.split(':').map(Number)
      const slot = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        h,
        m
      )

      const taken = interviews.some((iv) => {
        if (iv.status === 'cancelled') return false
        const start = parseISO(iv.scheduled_at)
        const end = new Date(start.getTime() + (iv.duration_minutes || 60) * 60_000)
        return slot >= start && slot < end
      })
      if (taken) return 'scheduled'

      /* One minute of grace, so the slot you are clicking does not become
         "past" mid-click. */
      if (slot.getTime() < Date.now() - 60_000) return 'past'
      return 'available'
    },
    [selectedDate, interviews]
  )

  /* Move off an unavailable slot when the date changes. */
  useEffect(() => {
    if (!selectedDate) return
    if (selected && slotStatus(selected) === 'available') return
    const firstFree = SLOTS.find((s) => slotStatus(s) === 'available')
    if (firstFree) onSelect(firstFree)
  }, [selectedDate, selected, slotStatus, onSelect])

  const selectedStatus = selected ? slotStatus(selected) : 'available'

  return (
    <div className="space-y-hb-4">
      <div>
        <p className="mb-2 font-mono text-hb-label uppercase text-hb-dim">Available slots</p>
        <div className="grid grid-cols-3 gap-1.5">
          {SLOTS.map((s) => {
            const status = slotStatus(s)
            const blocked = status !== 'available'
            const active = selected === s
            return (
              <button
                key={s}
                type="button"
                disabled={blocked}
                onClick={() => onSelect(s)}
                aria-pressed={active}
                className={
                  'flex flex-col items-center gap-0.5 rounded-hb-sm border px-2 py-2 text-hb-sm transition-colors duration-hb focus-visible:outline-none focus-visible:shadow-hb-ring disabled:cursor-not-allowed ' +
                  (active
                    ? 'border-hb-blue/50 bg-hb-blue/10 font-semibold text-hb-blue'
                    : blocked
                      ? 'border-hb-border bg-hb-surface-2 text-hb-dim'
                      : 'border-hb-border bg-hb-surface text-hb-muted hover:border-hb-border-strong hover:text-hb-text')
                }
              >
                {formatSlot(s)}
                {blocked && (
                  <span className="font-mono text-hb-micro uppercase">
                    {status === 'scheduled' ? 'Booked' : 'Past'}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="border-t border-dashed border-hb-border pt-hb-4">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Label htmlFor="custom-time">Or pick any time</Label>
            <input
              id="custom-time"
              type="time"
              step={300}
              value={selected || '09:00'}
              onChange={(e) => onSelect(e.target.value)}
              className="mt-2 h-[42px] w-full rounded-hb-sm border border-hb-border bg-hb-surface px-[13px] font-body text-hb-body text-hb-text transition-[border-color,box-shadow] duration-hb ease-hb focus:border-hb-blue/60 focus:shadow-hb-ring focus:outline-none"
            />
          </div>
          <Badge tone="info" className="mb-2.5">
            {formatSlot(selected || '09:00')}
          </Badge>
        </div>

        {selected && selectedStatus !== 'available' && (
          <p role="alert" className="mt-2 text-hb-xs font-medium text-hb-error">
            That time is {selectedStatus === 'scheduled' ? 'already booked' : 'in the past'}.
          </p>
        )}
      </div>
    </div>
  )
}

/* ── Schedule form ──────────────────────────────────────────────────────────── */

const scheduleSchema = z.object({
  candidate_id: z.string().min(1, 'Choose a candidate'),
  panelist_ids: z.array(z.string()).min(1, 'Choose at least one interviewer'),
  title: z.string().min(2, 'Choose an interview stage'),
  scheduled_at: z.string().min(1, 'Pick a date and time'),
  duration_minutes: z.coerce.number().int().min(15).default(60),
  notes: z.string().optional(),
})
type ScheduleForm = z.infer<typeof scheduleSchema>

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

function ScheduleFormCard({
  preselectedCandidateId,
  selectedDate,
  selectedTime,
  onScheduled,
}: {
  preselectedCandidateId?: string | null
  selectedDate: Date | null
  selectedTime: string
  onScheduled: () => void
}) {
  const queryClient = useQueryClient()
  const {
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ScheduleForm>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      duration_minutes: 60,
      scheduled_at: '',
      panelist_ids: [],
      title: 'Technical Round',
      candidate_id: preselectedCandidateId || '',
    },
  })

  /* The calendar and slot picker own the date and time; the form mirrors them. */
  useEffect(() => {
    if (!selectedDate || !selectedTime) return
    const [hh, mm] = selectedTime.split(':')
    const target = new Date(selectedDate)
    target.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0)
    setValue('scheduled_at', target.toISOString())
  }, [selectedDate, selectedTime, setValue])

  useEffect(() => {
    if (preselectedCandidateId) setValue('candidate_id', preselectedCandidateId)
  }, [preselectedCandidateId, setValue])

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => adminApi.listUsers().then((r: any) => r.data),
  })
  const interviewers = (users ?? []).filter((u: any) => u.role === 'interviewer')

  const { data: candidates = [] } = useQuery({
    queryKey: ['candidates-for-schedule'],
    queryFn: () => candidatesApi.list({ limit: 100 }).then((r: any) => r.data.items),
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] })
      queryClient.invalidateQueries({ queryKey: ['candidates_pipeline'] })
      queryClient.invalidateQueries({ queryKey: ['candidates-for-schedule'] })
      queryClient.invalidateQueries({ queryKey: ['recent-activities'] })
      onScheduled()
      reset({
        duration_minutes: 60,
        scheduled_at: '',
        panelist_ids: [],
        title: 'Technical Round',
        candidate_id: '',
      })
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message || 'Failed to schedule the interview'),
  })

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-hb-4">
      <Controller
        name="title"
        control={control}
        render={({ field }) => (
          <Select
            {...field}
            label="Interview stage"
            required
            error={errors.title?.message}
            placeholder="Select a stage…"
            options={SCHEDULE_TITLES.map((t) => ({ value: t.value, label: t.value }))}
          />
        )}
      />

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

      {errors.scheduled_at && (
        <p role="alert" className="text-hb-xs font-medium text-hb-error">
          {errors.scheduled_at.message}
        </p>
      )}

      <Button type="submit" fullWidth loading={isSubmitting || mutation.isPending}>
        Schedule interview
      </Button>
    </form>
  )
}

/* ── Interview card ─────────────────────────────────────────────────────────── */

function InterviewRow({
  interview,
  scorecardOpen,
  completing,
  onCancel,
  onComplete,
  onToggleScorecard,
}: {
  interview: Interview
  scorecardOpen: boolean
  /** True while this row's own "Complete" mutation is in flight. */
  completing: boolean
  onCancel: () => void
  onComplete: () => void
  onToggleScorecard: () => void
}) {
  const d = parseISO(interview.scheduled_at)

  return (
    <Card padding="default">
      <div className="flex flex-col gap-hb-4 sm:flex-row">
        <div className="shrink-0 sm:w-[68px]">
          <p className="font-display text-hb-h3 text-hb-text">
            {d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
          </p>
          <p className="font-mono text-hb-micro uppercase text-hb-dim">
            {d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
          </p>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Avatar name={interview.candidate_name || 'Candidate'} size="sm" />
            <span className="min-w-0">
              <span className="block truncate text-hb-body font-semibold text-hb-text">
                {interview.candidate_name || 'Unnamed candidate'}
              </span>
              <span className="block truncate text-hb-xs text-hb-muted">{interview.title}</span>
            </span>
            <StatusPill status={interview.status} />
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-hb-xs text-hb-muted">
            <span className="inline-flex items-center gap-1.5 capitalize">
              {TYPE_ICON[interview.interview_type] ?? <ClipboardList size={13} />}
              {interview.interview_type.replace(/_/g, ' ')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock size={12} aria-hidden />
              {interview.duration_minutes}m
            </span>
            {interview.meeting_link && (
              <a
                href={interview.meeting_link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-semibold text-hb-cyan transition-colors duration-hb hover:text-hb-text"
              >
                <LinkIcon size={12} aria-hidden />
                Meeting link
              </a>
            )}
          </div>

          {interview.panelists && interview.panelists.length > 0 && (
            <ul className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {interview.panelists.map((p) => (
                <li key={p.id}>
                  <span className="inline-flex items-center gap-1.5 rounded-hb-full border border-hb-border bg-hb-surface-2 py-0.5 pl-1 pr-2.5">
                    <Avatar name={p.user_name || 'Panelist'} size="xs" />
                    <span className="text-hb-xs text-hb-muted">{p.user_name}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-start gap-2 border-t border-hb-border pt-hb-3 sm:flex-col sm:border-0 sm:pt-0">
          {interview.status === 'scheduled' && (
            <>
              <AddToCalendarDropdown interview={interview} />
              <Button size="sm" variant="ghost" loading={completing} onClick={onComplete}>
                Complete
              </Button>
              <Button size="sm" variant="quiet" onClick={onCancel}>
                Cancel
              </Button>
            </>
          )}
          {interview.status === 'completed' && interview.application_id && (
            <Button size="sm" variant="ghost" onClick={onToggleScorecard}>
              {scorecardOpen ? 'Hide scores' : 'Scores'}
            </Button>
          )}
        </div>
      </div>

      {scorecardOpen && interview.application_id && (
        <Scorecards applicationId={interview.application_id} />
      )}
    </Card>
  )
}

/* ── Page ───────────────────────────────────────────────────────────────────── */

export default function InterviewsListPage() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const preselectedCandidateId = searchParams.get('candidateId')

  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())
  const [selectedTime, setSelectedTime] = useState('')
  const [cancelTarget, setCancelTarget] = useState<Interview | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [openScorecard, setOpenScorecard] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<InterviewStatus | null>(null)
  const [mobileTab, setMobileTab] = useState<'schedule' | 'interviews'>('schedule')
  const [page, setPage] = useState(1)

  const { data: interviews, isLoading } = useQuery({
    queryKey: ['interviews'],
    queryFn: () => interviewsApi.list().then((r: any) => r.data),
  })

  const filtered = useMemo(() => {
    if (!interviews) return []
    return interviews.filter((iv: Interview) => {
      if (statusFilter && iv.status !== statusFilter) return false
      if (selectedDate) {
        const d = parseISO(iv.scheduled_at)
        if (
          d.getFullYear() !== selectedDate.getFullYear() ||
          d.getMonth() !== selectedDate.getMonth() ||
          d.getDate() !== selectedDate.getDate()
        ) {
          return false
        }
      }
      return true
    })
  }, [interviews, statusFilter, selectedDate])

  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)

  useEffect(() => {
    setPage(1)
  }, [statusFilter, selectedDate])

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

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Schedule"
        title="Schedule"
        description="Conflict-free booking, with meeting links generated automatically."
        actions={
          user?.is_calendar_connected ? (
            <Badge tone="success" dot="pulse">
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
          )
        }
      />

      {/* Below lg the two columns stack, so they become tabs instead. */}
      <div className="mb-hb-4 lg:hidden">
        <Tabs
          items={[
            { value: 'schedule' as const, label: <><CalendarDays size={14} aria-hidden /> Schedule</> },
            { value: 'interviews' as const, label: <><ListIcon size={14} aria-hidden /> Interviews</>, count: filtered.length },
          ]}
          value={mobileTab}
          onChange={setMobileTab}
          aria-label="Scheduling view"
        />
      </div>

      <div className="grid gap-hb-6 lg:grid-cols-[360px_1fr]">
        <div className={`space-y-hb-4 ${mobileTab === 'schedule' ? '' : 'hidden'} lg:block`}>
          <Card padding="loose">
            <MonthCalendar
              interviews={interviews ?? []}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
          </Card>

          <Card padding="loose">
            <h2 className="font-display text-hb-h3 text-hb-text">Quick schedule</h2>
            <p className="mb-hb-4 mt-1 text-hb-sm text-hb-muted">
              Booking for{' '}
              {selectedDate?.toLocaleDateString('en-US', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </p>

            <TimeSlots
              selected={selectedTime}
              onSelect={setSelectedTime}
              interviews={interviews ?? []}
              selectedDate={selectedDate}
            />

            <div className="mt-hb-5 border-t border-hb-border pt-hb-5">
              <ScheduleFormCard
                preselectedCandidateId={preselectedCandidateId}
                selectedDate={selectedDate}
                selectedTime={selectedTime}
                onScheduled={() => toast.success('Interview scheduled')}
              />
            </div>
          </Card>
        </div>

        <div className={`${mobileTab === 'interviews' ? '' : 'hidden'} lg:block`}>
          <div className="mb-hb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-hb-h3 text-hb-text">
              {selectedDate
                ? selectedDate.toLocaleDateString('en-US', { day: 'numeric', month: 'long' })
                : 'All interviews'}
            </h2>
            <FilterChips
              options={[
                { value: 'scheduled' as InterviewStatus, label: 'Scheduled' },
                { value: 'completed' as InterviewStatus, label: 'Completed' },
                { value: 'cancelled' as InterviewStatus, label: 'Cancelled' },
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          </div>

          <div className="space-y-hb-3">
            {isLoading ? (
              Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-32 w-full" rounded="md" />
              ))
            ) : filtered.length === 0 ? (
              <Card padding="none">
                <EmptyState
                  tone="no-results"
                  icon={<CalendarDays />}
                  title="Nothing on this day"
                  description="Pick another date in the calendar, or schedule a new interview."
                />
              </Card>
            ) : (
              <>
                {paginated.map((iv: Interview) => (
                  <InterviewRow
                    key={iv.id}
                    interview={iv}
                    scorecardOpen={openScorecard === iv.id}
                    completing={statusMutation.isPending && statusMutation.variables?.id === iv.id}
                    onCancel={() => setCancelTarget(iv)}
                    onComplete={() => {
                      if (!statusMutation.isPending) {
                        statusMutation.mutate({ id: iv.id, status: 'completed' })
                      }
                    }}
                    onToggleScorecard={() =>
                      setOpenScorecard(openScorecard === iv.id ? null : iv.id)
                    }
                  />
                ))}

                <Pagination
                  page={page}
                  pages={totalPages}
                  total={filtered.length}
                  limit={ITEMS_PER_PAGE}
                  onPage={setPage}
                  noun="interviews"
                />
              </>
            )}
          </div>
        </div>
      </div>

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
