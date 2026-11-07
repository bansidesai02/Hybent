import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { demoApi, demoError } from '@/api/demo'
import { SiteSelect } from './SiteSelect'
import type { DemoBooking } from '@/api/demo'

/**
 * Calendly-style booking: pick a day on the month calendar, pick a time (in the
 * visitor's own time zone), fill in a short form, done. In "reschedule" mode it
 * moves an existing booking instead (no form).
 */

const COMMON_TZ = [
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'Europe/Berlin',
  'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Australia/Sydney',
]
const TEAM_SIZES = ['1–10', '11–50', '51–200', '201–1,000', '1,000+'].map((v) => ({ value: v, label: `${v} employees` }))
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const detectTz = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } catch { return 'UTC' }
}
/** YYYY-MM-DD of an instant, in a time zone. */
const dayKey = (d: Date, tz: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
const timeLabel = (d: Date, tz: string) => d.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' })
const longDate = (d: Date, tz: string) => d.toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric' })
const tzLabel = (tz: string) => {
  try {
    const off = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
      .formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value
    const city = (tz.split('/').pop() || tz).replace(/_/g, ' ').replace('Calcutta', 'Kolkata')
    return `${city} (${off})`
  } catch { return tz }
}

type Props =
  | { mode: 'book'; onDone?: (b: DemoBooking) => void }
  | { mode: 'reschedule'; token: string; current: DemoBooking; onDone?: (b: DemoBooking) => void }

export function DemoScheduler(props: Props) {
  const [tz, setTz] = useState(detectTz)
  const [slots, setSlots] = useState<Date[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [day, setDay] = useState<string | null>(null)
  const [slot, setSlot] = useState<Date | null>(null)
  const [step, setStep] = useState<'pick' | 'details' | 'done'>('pick')
  const [month, setMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1) })
  const [form, setForm] = useState({ name: '', email: '', company: '', team_size: '', phone: '', notes: '', website: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [booked, setBooked] = useState<DemoBooking | null>(null)
  const openedAt = useRef(Date.now())
  const exclude = props.mode === 'reschedule' ? props.token : undefined

  const load = () => {
    setSlots(null)
    setLoadError('')
    demoApi.slots(exclude)
      .then((d) => setSlots(d.slots.map((s) => new Date(s))))
      .catch((e) => setLoadError(demoError(e, 'We could not load open times. Please refresh.')))
  }
  useEffect(load, [exclude])

  // Open times grouped by day, in the chosen time zone.
  const byDay = useMemo(() => {
    const m = new Map<string, Date[]>()
    for (const s of slots ?? []) {
      const k = dayKey(s, tz)
      m.set(k, [...(m.get(k) ?? []), s])
    }
    return m
  }, [slots, tz])

  // Jump to the first month with an opening and pick nothing yet.
  useEffect(() => {
    if (!slots?.length) return
    const first = slots[0]
    const [y, mo] = dayKey(first, tz).split('-').map(Number)
    setMonth(new Date(y, mo - 1, 1))
  }, [slots, tz])

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const lead = (first.getDay() + 6) % 7
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
    const out: (string | null)[] = Array(lead).fill(null)
    for (let d = 1; d <= days; d++) {
      out.push(`${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    }
    return out
  }, [month])

  const lastKey = slots?.length ? dayKey(slots[slots.length - 1], tz) : null
  const canPrev = month > new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const canNext = !!lastKey && `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}` < lastKey.slice(0, 7)
  const times = day ? byDay.get(day) ?? [] : []
  const tzOptions = COMMON_TZ.includes(tz) ? COMMON_TZ : [tz, ...COMMON_TZ]

  const choose = (s: Date) => {
    setSlot(s)
    setError('')
    if (props.mode === 'reschedule') return
    setStep('details')
  }

  const finish = (b: DemoBooking) => {
    setBooked(b)
    setStep('done')
    props.onDone?.(b)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!slot) return
    setBusy(true)
    setError('')
    try {
      finish(await demoApi.book({
        ...form, team_size: form.team_size || undefined, phone: form.phone || undefined, notes: form.notes || undefined,
        start_at: slot.toISOString(), timezone: tz, elapsed_ms: Date.now() - openedAt.current,
      }))
    } catch (err) {
      const msg = demoError(err)
      setError(msg)
      if (msg.includes('just booked')) { setStep('pick'); setSlot(null); load() }
    } finally {
      setBusy(false)
    }
  }

  const move = async () => {
    if (!slot || props.mode !== 'reschedule') return
    setBusy(true)
    setError('')
    try {
      finish(await demoApi.reschedule(props.token, slot.toISOString()))
    } catch (err) {
      setError(demoError(err))
      setSlot(null)
      load()
    } finally {
      setBusy(false)
    }
  }

  // ── Done ──
  if (step === 'done' && booked) {
    const start = new Date(booked.start_at)
    const end = new Date(start.getTime() + booked.duration_minutes * 60000)
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('Hybent Hiring demo')}&dates=${fmt(start)}/${fmt(end)}&details=${encodeURIComponent(booked.meet_link ? `Join: ${booked.meet_link}` : '')}&location=${encodeURIComponent(booked.meet_link || 'Google Meet')}`
    return (
      <div className="ds-done">
        <span className="ds-done__tick" aria-hidden="true">✓</span>
        <h2 className="h-md">{props.mode === 'reschedule' ? 'Your demo has moved' : 'You’re booked!'}</h2>
        <p className="ds-done__when">
          <b>{longDate(start, tz)}</b><br />{timeLabel(start, tz)} – {timeLabel(end, tz)} · {tzLabel(tz)}
        </p>
        <p className="ds-done__note">
          {booked.meet_link
            ? <>A confirmation with the Google Meet link is on its way to <b>{booked.email}</b>.</>
            : <>A confirmation is on its way to <b>{booked.email}</b>. We’ll send the Google Meet link before the call.</>}
        </p>
        <div className="ds-done__actions">
          {booked.meet_link && <a className="btn btn-primary" href={booked.meet_link} target="_blank" rel="noreferrer">Google Meet link</a>}
          <a className="btn btn-ghost" href={gcal} target="_blank" rel="noreferrer">Add to Google Calendar</a>
        </div>
      </div>
    )
  }

  // ── Details ──
  if (step === 'details' && slot) {
    const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))
    return (
      <form className="ds-form" onSubmit={submit} noValidate={false}>
        <button type="button" className="ds-back" onClick={() => setStep('pick')}>← Back</button>
        <div className="ds-picked">
          <span className="ds-picked__dot" aria-hidden="true" />
          <span><b>{longDate(slot, tz)}</b> · {timeLabel(slot, tz)} – {timeLabel(new Date(slot.getTime() + 30 * 60000), tz)}<small>{tzLabel(tz)} · 30 min · Google Meet</small></span>
        </div>
        <div className="grid g2 ds-grid">
          <div className="field"><label htmlFor="ds-name">Full name *</label>
            <input id="ds-name" required minLength={2} value={form.name} onChange={set('name')} placeholder="Ananya Shah" autoComplete="name" /></div>
          <div className="field"><label htmlFor="ds-email">Email *</label>
            <input id="ds-email" type="email" required value={form.email} onChange={set('email')} placeholder="ananya@company.com" autoComplete="email" /></div>
          <div className="field"><label htmlFor="ds-company">Company *</label>
            <input id="ds-company" required minLength={2} value={form.company} onChange={set('company')} placeholder="Company name" autoComplete="organization" /></div>
          <div className="field"><label htmlFor="ds-size">Team size</label>
            <SiteSelect id="ds-size" value={form.team_size} options={TEAM_SIZES}
              onChange={(v) => setForm((f) => ({ ...f, team_size: v }))} /></div>
        </div>
        <div className="field"><label htmlFor="ds-phone">Phone (optional)</label>
          <input id="ds-phone" type="tel" value={form.phone} onChange={set('phone')} placeholder="+91 98765 43210" autoComplete="tel" /></div>
        <div className="field"><label htmlFor="ds-notes">What would you like to see? (optional)</label>
          <textarea id="ds-notes" rows={3} value={form.notes} onChange={set('notes')} placeholder="e.g. AI screening for engineering roles, the Recruiter Copilot…" /></div>
        <input className="ds-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={set('website')} />
        {error && <p className="ds-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-lg ds-submit" type="submit" disabled={busy}>
          {busy ? 'Booking…' : 'Book demo'}
        </button>
        <p className="form-note">You’ll get a calendar invite and a Google Meet link by email. Reschedule or cancel any time from that email.</p>
      </form>
    )
  }

  // ── Pick a day and a time ──
  return (
    <div className="ds-pick">
      <div className="ds-cal">
        <div className="ds-cal__head">
          <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} disabled={!canPrev} aria-label="Previous month">‹</button>
          <b>{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</b>
          <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} disabled={!canNext} aria-label="Next month">›</button>
        </div>
        <div className="ds-cal__grid">
          {WEEKDAYS.map((w) => <span key={w} className="ds-cal__wd">{w}</span>)}
          {cells.map((k, i) => {
            if (!k) return <span key={`x${i}`} />
            const open = byDay.has(k)
            return (
              <button key={k} type="button" disabled={!open}
                className={`ds-cal__day${open ? ' is-open' : ''}${day === k ? ' is-on' : ''}`}
                onClick={() => { setDay(k); setSlot(null) }}>
                {Number(k.slice(8))}
              </button>
            )
          })}
        </div>
        <label className="ds-tz">
          <span>Time zone</span>
          <select value={tz} onChange={(e) => { setTz(e.target.value); setDay(null); setSlot(null) }}>
            {tzOptions.map((z) => <option key={z} value={z}>{tzLabel(z)}</option>)}
          </select>
        </label>
      </div>

      <div className="ds-times">
        {loadError ? <p className="ds-error">{loadError}</p>
          : !slots ? <p className="ds-muted">Loading open times…</p>
          : !day ? <p className="ds-muted">{slots.length ? 'Pick a day to see open times.' : 'No open times right now. Please email info@hybent.com.'}</p>
          : (
            <>
              <p className="ds-times__day">{longDate(times[0], tz)}</p>
              <div className="ds-times__list">
                {times.map((s) => {
                  const on = slot?.getTime() === s.getTime()
                  return (
                    <div key={s.toISOString()} className={`ds-time${on ? ' is-on' : ''}`}>
                      <button type="button" onClick={() => setSlot(s)}>{timeLabel(s, tz)}</button>
                      {on && (
                        <button type="button" className="ds-time__next" disabled={busy}
                          onClick={() => (props.mode === 'reschedule' ? move() : choose(s))}>
                          {props.mode === 'reschedule' ? (busy ? 'Moving…' : 'Confirm') : 'Next'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        {error && step === 'pick' && <p className="ds-error" role="alert">{error}</p>}
      </div>
    </div>
  )
}
