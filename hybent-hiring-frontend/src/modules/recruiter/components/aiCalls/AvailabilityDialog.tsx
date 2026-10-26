import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { adminApi } from '@/api/admin'
import {
  VOICE_CALLS_KEY,
  formatWhen,
  voiceCallsApi,
  type AvailabilityRequest,
} from '@/api/voiceCalls'
import { Badge, Button, Checkbox, Dialog, Input, Select, Skeleton } from '@/components/hb'

import { errorMessage } from './format'

/**
 * Availability check (Spec §6): the AI Agent calls the candidate and books a
 * slot from HR's window, minus the interviewers' existing interviews. The
 * slot is locked during the call, so it can't be double-booked, and the
 * interview + reminders are created when the candidate confirms.
 */

function isoDate(d: Date): string {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

const MODES = [
  { value: 'VIDEO', label: 'Video call' },
  { value: 'PHONE', label: 'Phone call' },
  { value: 'IN_PERSON', label: 'In person' },
]

export function AvailabilityDialog({
  candidate,
  onClose,
}: {
  candidate: { id: string; full_name: string }
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const tomorrow = useMemo(() => new Date(Date.now() + 86_400_000), [])
  const [round, setRound] = useState('Technical Round 1')
  const [mode, setMode] = useState<AvailabilityRequest['mode']>('VIDEO')
  const [duration, setDuration] = useState(45)
  const [location, setLocation] = useState('')
  const [panelists, setPanelists] = useState<Set<string>>(new Set())
  const [fromDate, setFromDate] = useState(isoDate(tomorrow))
  const [toDate, setToDate] = useState(isoDate(new Date(tomorrow.getTime() + 4 * 86_400_000)))
  const [dayStart, setDayStart] = useState('10:00')
  const [dayEnd, setDayEnd] = useState('18:00')
  const [weekdaysOnly, setWeekdaysOnly] = useState(true)

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => adminApi.listUsers().then((r: any) => r.data),
  })
  const interviewers: Array<{ id: string; full_name: string; role: string }> = (users ?? []).filter(
    (u: any) => u.is_active !== false && ['interviewer', 'admin', 'recruiter'].includes(u.role),
  )

  const request: AvailabilityRequest = {
    candidate_id: candidate.id,
    round: round.trim(),
    mode,
    duration_min: duration,
    location: mode === 'IN_PERSON' ? location.trim() || null : null,
    panelists: [...panelists].map((id, i) => ({ user_id: id, role: i === 0 ? 'lead' : 'panelist' })),
    window: { from_date: fromDate, to_date: toDate, day_start: dayStart, day_end: dayEnd, weekdays_only: weekdaysOnly },
  }
  const ready = request.round.length >= 2 && fromDate && toDate && fromDate <= toDate && dayStart < dayEnd

  const { data: preview, isFetching: previewing } = useQuery({
    queryKey: ['voice-availability-preview', JSON.stringify(request)],
    queryFn: () => voiceCallsApi.previewSlots(request).then((r) => r.data),
    enabled: !!ready,
    staleTime: 30_000,
  })
  const slots = preview?.slots ?? []

  const start = useMutation({
    mutationFn: () => voiceCallsApi.startAvailability(request),
    onSuccess: () => {
      toast.success('Availability call scheduled')
      queryClient.invalidateQueries({ queryKey: VOICE_CALLS_KEY })
      onClose()
    },
    onError: (err) => toast.error(errorMessage(err, "Couldn't schedule the call")),
  })

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      title="Check availability"
      description={`The Hybent AI Agent will call ${candidate.full_name}, offer these slots and book the one they confirm. You'll get the confirmation and reminders are set up automatically.`}
      footer={
        <>
          <Button variant="quiet" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" loading={start.isPending} disabled={!ready || slots.length === 0} onClick={() => start.mutate()}>
            Schedule call
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-hb-4 pb-2">
        <div className="grid gap-hb-3 sm:grid-cols-3">
          <Input label="Round" value={round} maxLength={120} onChange={(e) => setRound(e.target.value)} fieldClassName="sm:col-span-3" />
          <Select label="Mode" options={MODES} value={mode} onChange={(e) => setMode(e.target.value as AvailabilityRequest['mode'])} />
          <Select label="Length" value={String(duration)}
                  options={[30, 45, 60, 90].map((m) => ({ value: String(m), label: `${m} minutes` }))}
                  onChange={(e) => setDuration(Number(e.target.value))} />
          {mode === 'IN_PERSON' && (
            <Input label="Venue" value={location} maxLength={255} placeholder="Office address" onChange={(e) => setLocation(e.target.value)} />
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-hb-label uppercase text-hb-dim">Interviewers</span>
          {usersLoading ? (
            <Skeleton className="h-10 w-full" rounded="md" />
          ) : (
            <div className="flex max-h-32 flex-col gap-1 overflow-y-auto rounded-hb-sm border border-hb-border p-2">
              {interviewers.map((u) => (
                <Checkbox key={u.id}
                          label={<span>{u.full_name} <span className="text-hb-dim">· {u.role}</span></span>}
                          checked={panelists.has(u.id)}
                          onChange={(e) => setPanelists((s) => {
                            const next = new Set(s)
                            if (e.target.checked) next.add(u.id)
                            else next.delete(u.id)
                            return next
                          })} />
              ))}
            </div>
          )}
          <span className="text-hb-xs text-hb-dim">Slots that clash with their interviews are left out.</span>
        </div>

        <div className="grid gap-hb-3 sm:grid-cols-4">
          <Input label="From" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <Input label="To" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          <Input label="Daily from" type="time" value={dayStart} onChange={(e) => setDayStart(e.target.value)} />
          <Input label="Daily to" type="time" value={dayEnd} onChange={(e) => setDayEnd(e.target.value)} />
        </div>
        <Checkbox label="Weekdays only" checked={weekdaysOnly} onChange={(e) => setWeekdaysOnly(e.target.checked)} />

        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-hb-label uppercase text-hb-dim">
            Open slots {preview && `· ${slots.length}${slots.length === 20 ? '+' : ''}`}
          </span>
          {previewing && !preview ? (
            <Skeleton className="h-10 w-full" rounded="md" />
          ) : slots.length ? (
            <div className="flex flex-wrap gap-1.5">
              {slots.slice(0, 8).map((s) => <Badge key={s}>{formatWhen(s)}</Badge>)}
              {slots.length > 8 && <span className="text-hb-xs text-hb-dim">+{slots.length - 8} more</span>}
            </div>
          ) : (
            <p className="text-hb-sm text-hb-error">No free slots in this window. Widen the dates or hours.</p>
          )}
        </div>
      </div>
    </Dialog>
  )
}
