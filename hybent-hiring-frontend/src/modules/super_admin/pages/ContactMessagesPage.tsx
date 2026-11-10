import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { Mail, MessageSquare } from 'lucide-react'

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

/** Messages from hybent.com/contact, kept for follow-up. Saved from when this page went live. */

type Status = 'new' | 'replied' | 'closed'

interface ContactMessage {
  id: string
  topic: string
  name: string
  email: string
  phone: string | null
  company: string | null
  location: string | null
  message: string
  status: Status
  notes: string | null
  created_at: string
}

const STATUS: Record<Status, { label: string; tone: 'info' | 'success' | 'neutral' }> = {
  new: { label: 'New', tone: 'info' },
  replied: { label: 'Replied', tone: 'success' },
  closed: { label: 'Closed', tone: 'neutral' },
}

const PAGE_SIZE = 50

export default function ContactMessagesPage() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'all' | Status>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<ContactMessage | null>(null)
  const [notes, setNotes] = useState('')
  const q = useDebounce(search.trim(), 300)

  useEffect(() => setPage(1), [tab, q])

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin', 'contact-messages', tab, q, page],
    queryFn: () =>
      api
        .get<{ messages: ContactMessage[]; total: number; counts: Partial<Record<Status, number>> }>('/v1/super-admin/contact-messages', {
          params: { status: tab, q: q || undefined, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
        })
        .then((r) => r.data),
    placeholderData: (prev) => prev,
  })

  const update = useMutation({
    mutationFn: (p: { id: string; status?: Status; notes?: string }) =>
      api.patch<ContactMessage>(`/v1/super-admin/contact-messages/${p.id}`, { status: p.status, notes: p.notes }).then((r) => r.data),
    onSuccess: (saved) => {
      toast.success('Saved')
      setOpen((cur) => (cur && cur.id === saved.id ? saved : cur))
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'contact-messages'] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || err.message || 'Could not save.'),
  })

  const columns: Array<Column<ContactMessage>> = [
    {
      key: 'who',
      header: 'From',
      cardTitle: true,
      cell: (m) => (
        <span className="min-w-0">
          <span className="block truncate text-hb-sm font-semibold text-hb-text">{m.name}</span>
          <span className="block truncate text-hb-xs text-hb-muted">{m.email}</span>
        </span>
      ),
    },
    { key: 'company', header: 'Company', width: '170px', cell: (m) => <span className="truncate text-hb-text">{m.company ?? '—'}</span> },
    { key: 'topic', header: 'Topic', width: '130px', cell: (m) => <span className="text-hb-sm text-hb-muted">{m.topic}</span> },
    { key: 'status', header: 'Status', width: '110px', cell: (m) => <Badge tone={STATUS[m.status].tone}>{STATUS[m.status].label}</Badge> },
    { key: 'when', header: 'Received', width: '130px', cell: (m) => <span className="text-hb-sm text-hb-muted" title={formatDateTime(m.created_at)}>{timeAgo(m.created_at)}</span> },
  ]

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Growth"
        title="Contact messages"
        description="Messages from the contact form on hybent.com."
        actions={data ? <Badge tone="info">{data.counts.new ?? 0} new</Badge> : undefined}
      />

      <Tabs<'all' | Status>
        aria-label="Filter messages by status"
        value={tab}
        onChange={setTab}
        className="mb-hb-4"
        items={[
          { value: 'all', label: 'All' },
          ...(Object.keys(STATUS) as Status[]).map((s) => ({ value: s, label: STATUS[s].label, count: data?.counts[s] ?? 0 })),
        ]}
      />

      <Toolbar>
        <ToolbarSearch value={search} onChange={setSearch} placeholder="Search name, email or company…" aria-label="Search contact messages" />
      </Toolbar>

      <Card padding="none">
        <DataTable
          columns={columns}
          rows={data?.messages ?? []}
          rowKey={(m) => m.id}
          loading={isLoading}
          onRowClick={(m) => {
            setOpen(m)
            setNotes(m.notes ?? '')
          }}
          caption="Messages from the hybent.com contact form"
          empty={{ icon: <MessageSquare />, title: 'No messages yet', description: 'New messages from hybent.com/contact appear here.', size: 'page' }}
        />
        <Pagination page={page} pages={Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE))} total={data?.total ?? 0} limit={PAGE_SIZE} onPage={setPage} noun="messages" asCardFooter />
      </Card>

      <Dialog
        open={!!open}
        onClose={() => setOpen(null)}
        title={open ? `${open.name}${open.company ? ` · ${open.company}` : ''}` : ''}
        description={open ? `${open.topic} · ${formatDateTime(open.created_at)}` : undefined}
        size="lg"
      >
        {open && (
          <div className="space-y-hb-4">
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-hb-sm">
              <a className="inline-flex items-center gap-1 font-semibold text-hb-cyan" href={`mailto:${open.email}`}>
                <Mail size={13} aria-hidden /> {open.email}
              </a>
              {open.phone && <a className="font-semibold text-hb-cyan" href={`tel:${open.phone}`}>{open.phone}</a>}
              {open.location && <span className="text-hb-muted">{open.location}</span>}
            </p>
            <p className="whitespace-pre-wrap text-hb-sm text-hb-text">{open.message}</p>
            <Select
              label="Status"
              value={open.status}
              onChange={(e) => update.mutate({ id: open.id, status: e.target.value as Status })}
              options={(Object.keys(STATUS) as Status[]).map((s) => ({ value: s, label: STATUS[s].label }))}
            />
            <Textarea label="Notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
