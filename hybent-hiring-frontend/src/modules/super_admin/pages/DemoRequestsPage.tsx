import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { CalendarCheck, Mail } from 'lucide-react'

import api from '@/api/axios'
import { useDebounce } from '@/components/chatbot/useDebounce'
import {
  Badge,
  Card,
  type Column,
  DataTable,
  Dialog,
  PageHeader,
  Pagination,
  Select,
  Tabs,
  Textarea,
  Toolbar,
  ToolbarSearch,
} from '@/components/hb'
import { formatDateTime, timeAgo } from '@/utils/formatters'

/**
 * Free demo requests from hybent.com/register. They used to exist only as an
 * email to info@; now each is kept here (and pushed to super admins' phones)
 * so it can be followed up and tracked to a result.
 */

type Status = 'new' | 'contacted' | 'converted' | 'closed'

interface DemoRequest {
  id: string
  first_name: string
  last_name: string
  work_email: string
  company_name: string
  team_size: string | null
  monthly_hires: string | null
  hiring_challenge: string | null
  status: Status
  notes: string | null
  email_sent: boolean
  created_at: string
}

const STATUS: Record<Status, { label: string; tone: 'info' | 'warning' | 'success' | 'neutral' }> = {
  new: { label: 'New', tone: 'info' },
  contacted: { label: 'Contacted', tone: 'warning' },
  converted: { label: 'Converted', tone: 'success' },
  closed: { label: 'Closed', tone: 'neutral' },
}

const PAGE_SIZE = 50

export default function DemoRequestsPage() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'all' | Status>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<DemoRequest | null>(null)
  const [notes, setNotes] = useState('')
  const q = useDebounce(search.trim(), 300)

  useEffect(() => setPage(1), [tab, q])

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin', 'demo-requests', tab, q, page],
    queryFn: () =>
      api
        .get<{ requests: DemoRequest[]; total: number; counts: Record<Status, number> }>('/v1/super-admin/demo-requests', {
          params: { status: tab, q: q || undefined, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
        })
        .then((r) => r.data),
    placeholderData: (prev) => prev,
  })

  const update = useMutation({
    mutationFn: (p: { id: string; status?: Status; notes?: string }) =>
      api.patch<DemoRequest>(`/v1/super-admin/demo-requests/${p.id}`, { status: p.status, notes: p.notes }).then((r) => r.data),
    onSuccess: (saved) => {
      toast.success('Saved')
      setOpen((cur) => (cur && cur.id === saved.id ? saved : cur))
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'demo-requests'] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || err.message || 'Could not save.'),
  })

  const counts = data?.counts
  const columns: Array<Column<DemoRequest>> = [
    {
      key: 'who',
      header: 'Requested by',
      cardTitle: true,
      cell: (d) => (
        <span className="min-w-0">
          <span className="block truncate text-hb-sm font-semibold text-hb-text">
            {d.first_name} {d.last_name}
          </span>
          <span className="block truncate text-hb-xs text-hb-muted">{d.work_email}</span>
        </span>
      ),
    },
    { key: 'company', header: 'Company', width: '200px', cell: (d) => <span className="truncate text-hb-text">{d.company_name}</span> },
    {
      key: 'size',
      header: 'Team · hires/month',
      width: '170px',
      cell: (d) => <span className="text-hb-sm text-hb-muted">{[d.team_size, d.monthly_hires].filter(Boolean).join(' · ') || '—'}</span>,
    },
    { key: 'status', header: 'Status', width: '120px', cell: (d) => <Badge tone={STATUS[d.status].tone}>{STATUS[d.status].label}</Badge> },
    {
      key: 'when',
      header: 'Received',
      width: '140px',
      cell: (d) => (
        <span className="text-hb-sm text-hb-muted" title={formatDateTime(d.created_at)}>
          {timeAgo(d.created_at)}
        </span>
      ),
    },
  ]

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Growth"
        title="Demo requests"
        description="Free demo requests from hybent.com. New ones also arrive as a phone notification if you've turned it on in Settings."
        actions={counts ? <Badge tone="info">{counts.new} new</Badge> : undefined}
      />

      <Tabs<'all' | Status>
        aria-label="Filter demo requests by status"
        value={tab}
        onChange={setTab}
        className="mb-hb-4"
        items={[
          { value: 'all', label: 'All' },
          ...(Object.keys(STATUS) as Status[]).map((s) => ({ value: s, label: STATUS[s].label, count: counts?.[s] })),
        ]}
      />

      <Toolbar>
        <ToolbarSearch value={search} onChange={setSearch} placeholder="Search name, email or company…" aria-label="Search demo requests" />
      </Toolbar>

      <Card padding="none">
        <DataTable
          columns={columns}
          rows={data?.requests ?? []}
          rowKey={(d) => d.id}
          loading={isLoading}
          onRowClick={(d) => {
            setOpen(d)
            setNotes(d.notes ?? '')
          }}
          caption="Demo requests from hybent.com"
          empty={{
            icon: <CalendarCheck />,
            title: 'No demo requests yet',
            description: 'Requests sent from hybent.com/register appear here as they arrive.',
            size: 'page',
          }}
        />
        <Pagination
          page={page}
          pages={Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE))}
          total={data?.total ?? 0}
          limit={PAGE_SIZE}
          onPage={setPage}
          noun="requests"
          asCardFooter
        />
      </Card>

      <Dialog
        open={!!open}
        onClose={() => setOpen(null)}
        title={open ? `${open.first_name} ${open.last_name} · ${open.company_name}` : ''}
        description={open ? `Received ${formatDateTime(open.created_at)}${open.email_sent ? '' : ' · the email to info@ failed'}` : undefined}
        size="lg"
      >
        {open && (
          <div className="space-y-hb-4">
            <dl className="grid gap-2.5 sm:grid-cols-3">
              <div>
                <dt className="font-mono text-hb-label uppercase text-hb-dim">Email</dt>
                <dd>
                  <a className="inline-flex items-center gap-1 text-hb-sm font-semibold text-hb-cyan" href={`mailto:${open.work_email}`}>
                    <Mail size={13} aria-hidden /> {open.work_email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="font-mono text-hb-label uppercase text-hb-dim">Team size</dt>
                <dd className="text-hb-sm text-hb-text">{open.team_size || '—'}</dd>
              </div>
              <div>
                <dt className="font-mono text-hb-label uppercase text-hb-dim">Hires per month</dt>
                <dd className="text-hb-sm text-hb-text">{open.monthly_hires || '—'}</dd>
              </div>
            </dl>
            {open.hiring_challenge && (
              <div>
                <p className="font-mono text-hb-label uppercase text-hb-dim">Hiring challenge</p>
                <p className="whitespace-pre-wrap text-hb-sm text-hb-text">{open.hiring_challenge}</p>
              </div>
            )}
            <Select
              label="Status"
              value={open.status}
              onChange={(e) => update.mutate({ id: open.id, status: e.target.value as Status })}
              options={(Object.keys(STATUS) as Status[]).map((s) => ({ value: s, label: STATUS[s].label }))}
            />
            <Textarea label="Notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Called on Monday, follow up next week…" />
            <button
              type="button"
              className="text-hb-sm font-semibold text-hb-cyan disabled:opacity-50"
              disabled={update.isPending || notes === (open.notes ?? '')}
              onClick={() => update.mutate({ id: open.id, notes })}
            >
              Save notes
            </button>
          </div>
        )}
      </Dialog>
    </div>
  )
}
