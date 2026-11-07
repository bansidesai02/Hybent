import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { CalendarClock, Mail, Video } from 'lucide-react'

import { demoApi, demoError } from '@/api/demo'
import { authApi } from '@/api/auth'
import type { DemoAdminItem } from '@/api/demo'
import { useDebounce } from '@/components/chatbot/useDebounce'
import { Badge, Button, Card, type Column, DataTable, Dialog, Input, PageHeader, Select, Tabs, Textarea, Toolbar, ToolbarSearch } from '@/components/hb'
import { formatDateTime } from '@/utils/formatters'

/** Demos booked from hybent.com/book-demo (app/routers/demos.py). */

type When = 'upcoming' | 'past' | 'all'
type Status = DemoAdminItem['status']

const STATUS: Record<Status, { label: string; tone: 'info' | 'success' | 'warning' | 'neutral' }> = {
  booked: { label: 'Booked', tone: 'info' },
  completed: { label: 'Completed', tone: 'success' },
  no_show: { label: 'No-show', tone: 'warning' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
}

const ist = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function DemoBookingsPage() {
  const queryClient = useQueryClient()
  const [when, setWhen] = useState<When>('upcoming')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<DemoAdminItem | null>(null)
  const [notes, setNotes] = useState('')
  const [link, setLink] = useState('')
  const q = useDebounce(search.trim(), 300)

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin', 'demos', when, q],
    queryFn: () => demoApi.list({ when, search: q || undefined }),
    placeholderData: (prev) => prev,
  })

  const calendar = useQuery({ queryKey: ['super-admin', 'demos', 'calendar'], queryFn: demoApi.calendar })
  const [connecting, setConnecting] = useState(false)
  const connectCalendar = async () => {
    setConnecting(true)
    try {
      const res = await authApi.connectCalendar()
      const url = (res.data as { auth_url?: string })?.auth_url
      if (url) window.location.href = url
      else throw new Error('No sign-in link')
    } catch (err) {
      toast.error(demoError(err, 'Google Calendar is not set up on the server.'))
      setConnecting(false)
    }
  }
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get('calendar') === 'connected') {
      toast.success('Google Calendar connected. New demos get a Meet link automatically.')
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  const update = useMutation({
    mutationFn: (p: { id: string; status?: string; admin_notes?: string }) => demoApi.update(p.id, p),
    onSuccess: (saved) => {
      toast.success('Saved')
      setOpen((cur) => (cur && cur.id === saved.id ? saved : cur))
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'demos'] })
    },
    onError: (err) => toast.error(demoError(err, 'Could not save.')),
  })

  const sendLink = useMutation({
    mutationFn: (p: { id: string; link: string }) => demoApi.sendLink(p.id, p.link),
    onSuccess: (saved) => {
      toast.success(`Link sent to ${saved.email}`)
      setOpen(saved)
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'demos'] })
    },
    onError: (err) => toast.error(demoError(err, 'Could not send the link.')),
  })

  const columns: Array<Column<DemoAdminItem>> = [
    {
      key: 'when', header: 'When (IST)', width: '190px', cardTitle: true,
      cell: (d) => <span className="text-hb-sm font-semibold text-hb-text">{ist(d.start_at)}</span>,
    },
    {
      key: 'who', header: 'Booked by',
      cell: (d) => (
        <span className="min-w-0">
          <span className="block truncate text-hb-sm font-semibold text-hb-text">{d.name}</span>
          <span className="block truncate text-hb-xs text-hb-muted">{d.email}</span>
        </span>
      ),
    },
    { key: 'company', header: 'Company', width: '200px', cell: (d) => <span className="truncate text-hb-text">{d.company}</span> },
    { key: 'status', header: 'Status', width: '120px', cell: (d) => <Badge tone={STATUS[d.status].tone}>{STATUS[d.status].label}</Badge> },
    {
      key: 'meet', header: 'Meet', width: '90px',
      cell: (d) => d.meet_link && d.status === 'booked'
        ? <a className="inline-flex items-center gap-1 text-hb-sm font-semibold text-hb-cyan" href={d.meet_link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}><Video size={14} aria-hidden /> Join</a>
        : <span className="text-hb-muted">—</span>,
    },
  ]

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Growth"
        title="Demo bookings"
        description="Demos booked from hybent.com/book-demo. Each one is on the host calendar with a Google Meet link; visitors get reminders a day and an hour before."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {calendar.data?.connected
              ? <Badge tone="success">Calendar: {calendar.data.account}</Badge>
              : calendar.data && <Button size="sm" onClick={connectCalendar} disabled={connecting}>{connecting ? 'Opening Google…' : 'Connect Google Calendar'}</Button>}
            {data?.counts?.booked ? <Badge tone="info">{data.counts.booked} booked</Badge> : null}
          </div>
        }
      />

      <Tabs<When>
        aria-label="Filter demo bookings"
        value={when}
        onChange={setWhen}
        className="mb-hb-4"
        items={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }, { value: 'all', label: 'All' }]}
      />

      <Toolbar>
        <ToolbarSearch value={search} onChange={setSearch} placeholder="Search name, email or company…" aria-label="Search demo bookings" />
      </Toolbar>

      <Card padding="none">
        <DataTable
          columns={columns}
          rows={data?.items ?? []}
          rowKey={(d) => d.id}
          loading={isLoading}
          onRowClick={(d) => { setOpen(d); setNotes(d.admin_notes ?? ''); setLink(d.meet_link ?? '') }}
          caption="Demo bookings"
          empty={{ icon: <CalendarClock />, title: 'No demos here yet', description: 'Bookings from hybent.com/book-demo appear here.', size: 'page' }}
        />
      </Card>

      <Dialog
        open={!!open}
        onClose={() => setOpen(null)}
        title={open ? `${open.name} · ${open.company}` : ''}
        description={open ? `${ist(open.start_at)} IST · booked ${formatDateTime(open.created_at)}` : undefined}
        size="lg"
      >
        {open && (
          <div className="space-y-hb-4">
            <dl className="grid gap-2.5 sm:grid-cols-3">
              <div>
                <dt className="text-hb-xs font-semibold text-hb-dim">Email</dt>
                <dd><a className="inline-flex items-center gap-1 text-hb-sm font-semibold text-hb-cyan" href={`mailto:${open.email}`}><Mail size={13} aria-hidden /> {open.email}</a></dd>
              </div>
              <div><dt className="text-hb-xs font-semibold text-hb-dim">Team size</dt><dd className="text-hb-sm text-hb-text">{open.team_size || '—'}</dd></div>
              <div><dt className="text-hb-xs font-semibold text-hb-dim">Phone</dt><dd className="text-hb-sm text-hb-text">{open.phone || '—'}</dd></div>
              <div><dt className="text-hb-xs font-semibold text-hb-dim">Their time zone</dt><dd className="text-hb-sm text-hb-text">{open.timezone}</dd></div>
              <div className="sm:col-span-2"><dt className="text-hb-xs font-semibold text-hb-dim">Meet</dt>
                <dd className="text-hb-sm">{open.meet_link ? <a className="text-hb-cyan" href={open.meet_link} target="_blank" rel="noreferrer">{open.meet_link}</a> : '—'}</dd></div>
            </dl>
            {open.status === 'booked' && (
              <div className="rounded-hb-md border border-hb-border p-hb-3">
                <p className="mb-2 text-hb-sm font-semibold text-hb-text">Send the meeting link</p>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[240px] flex-1">
                    <Input aria-label="Meeting link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/abc-defg-hij" />
                  </div>
                  <Button
                    disabled={sendLink.isPending || !link.trim().startsWith('https://')}
                    onClick={() => sendLink.mutate({ id: open.id, link: link.trim() })}
                  >
                    {sendLink.isPending ? 'Sending…' : open.meet_link ? 'Send again' : 'Send link'}
                  </Button>
                </div>
                <p className="mt-1.5 text-hb-xs text-hb-muted">Google Meet, Zoom or Teams. {open.name} gets it by email with the time and a calendar link.</p>
              </div>
            )}
            {open.notes && (
              <div>
                <p className="text-hb-xs font-semibold text-hb-dim">Wants to see</p>
                <p className="whitespace-pre-wrap text-hb-sm text-hb-text">{open.notes}</p>
              </div>
            )}
            <Select
              label="Status"
              value={open.status}
              onChange={(e) => {
                const s = e.target.value as Status
                if (s === 'cancelled' && !window.confirm('Cancel this demo? The visitor gets an email and the calendar event is removed.')) return
                update.mutate({ id: open.id, status: s })
              }}
              options={(Object.keys(STATUS) as Status[]).map((s) => ({ value: s, label: STATUS[s].label }))}
            />
            <Textarea label="Notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Interested in Pro, follow up Monday…" />
            <button
              type="button"
              className="text-hb-sm font-semibold text-hb-cyan disabled:opacity-50"
              disabled={update.isPending || notes === (open.admin_notes ?? '')}
              onClick={() => update.mutate({ id: open.id, admin_notes: notes })}
            >
              Save notes
            </button>
          </div>
        )}
      </Dialog>
    </div>
  )
}
