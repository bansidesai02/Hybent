import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { AlertTriangle, FileWarning, Mail, RotateCcw, Smartphone } from 'lucide-react'

import api from '@/api/axios'
import { useDebounce } from '@/components/chatbot/useDebounce'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  type Column,
  DataTable,
  PageHeader,
  Pagination,
  Select,
  Tabs,
  Toolbar,
  ToolbarSearch,
} from '@/components/hb'
import { formatDateTime, timeAgo } from '@/utils/formatters'

/**
 * Everything that used to need server logs: which emails went out, what
 * crashed, which imports failed, and which phones get notifications.
 *
 * History starts when this page shipped; nothing earlier was recorded.
 */

type Tab = 'emails' | 'errors' | 'imports' | 'phones'

const PAGE_SIZE = 50
const errorText = (err: any, fallback: string) => err?.response?.data?.message || err?.message || fallback
const When = ({ at }: { at: string | null }) =>
  at ? (
    <span className="text-hb-sm text-hb-muted" title={formatDateTime(at)}>
      {timeAgo(at)}
    </span>
  ) : (
    <span className="text-hb-sm text-hb-dim">Never</span>
  )

function useAction(invalidate: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (url: string) => api.post<any>(url).then((r) => r.data),
    onSuccess: (data: any) => {
      toast.success(data?.message || 'Done')
      queryClient.invalidateQueries({ queryKey: ['super-admin', invalidate] })
    },
    onError: (err: any) => toast.error(errorText(err, 'That did not work.')),
  })
}

function EmailsTab() {
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const q = useDebounce(search.trim(), 300)
  useEffect(() => setPage(1), [status, q])
  const action = useAction('email-logs')

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin', 'email-logs', status, q, page],
    queryFn: () =>
      api
        .get<any>('/v1/super-admin/email-logs', {
          params: { status, q: q || undefined, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
        })
        .then((r) => r.data),
    placeholderData: (prev) => prev,
  })

  const tone: Record<string, 'success' | 'error' | 'info'> = { sent: 'success', failed: 'error', resent: 'info' }
  const columns: Array<Column<any>> = [
    {
      key: 'subject',
      header: 'Email',
      cardTitle: true,
      cell: (e) => (
        <span className="min-w-0">
          <span className="block truncate text-hb-sm font-semibold text-hb-text">{e.subject}</span>
          <span className="block truncate text-hb-xs text-hb-muted">{e.to}</span>
          {e.error && <span className="block text-hb-xs text-hb-error">{e.error}</span>}
        </span>
      ),
    },
    { key: 'status', header: 'Status', width: '100px', cell: (e) => <Badge tone={tone[e.status]}>{e.status}</Badge> },
    { key: 'provider', header: 'Sent with', width: '120px', cell: (e) => <span className="truncate text-hb-sm text-hb-muted">{e.provider ?? '—'}</span> },
    { key: 'when', header: 'When', width: '130px', cell: (e) => <When at={e.created_at} /> },
    {
      key: 'actions',
      header: '',
      width: '100px',
      align: 'right',
      cell: (e) =>
        e.can_resend ? (
          <Button size="sm" variant="ghost" loading={action.isPending} onClick={() => action.mutate(`/v1/super-admin/email-logs/${e.id}/resend`)}>
            Resend
          </Button>
        ) : e.status === 'failed' ? (
          <span className="text-hb-xs text-hb-dim" title="It held a one-time link. Send a new one from where it started.">
            Send anew
          </span>
        ) : null,
    },
  ]

  return (
    <>
      <Toolbar>
        <ToolbarSearch value={search} onChange={setSearch} placeholder="Search recipient or subject…" aria-label="Search emails" />
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
          fieldClassName="w-auto"
          options={[
            { value: 'all', label: 'All' },
            { value: 'failed', label: `Failed (${data?.counts?.failed ?? 0})` },
            { value: 'sent', label: 'Sent' },
            { value: 'resent', label: 'Resent' },
          ]}
        />
      </Toolbar>
      <Card padding="none">
        <DataTable
          columns={columns}
          rows={data?.emails ?? []}
          rowKey={(e) => e.id}
          loading={isLoading}
          caption="Emails the platform tried to send"
          empty={{ icon: <Mail />, title: 'No emails recorded', description: 'Emails appear here as they are sent.' }}
        />
        <Pagination page={page} pages={Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE))} total={data?.total ?? 0} limit={PAGE_SIZE} onPage={setPage} noun="emails" asCardFooter />
      </Card>
    </>
  )
}

function ErrorsTab() {
  const [status, setStatus] = useState('open')
  const action = useAction('errors')
  const { data, isLoading } = useQuery({
    queryKey: ['super-admin', 'errors', status],
    queryFn: () => api.get<any>('/v1/super-admin/errors', { params: { status, limit: 100 } }).then((r) => r.data),
  })

  const columns: Array<Column<any>> = [
    {
      key: 'source',
      header: 'What failed',
      cardTitle: true,
      cell: (e) => (
        <span className="min-w-0">
          <span className="block truncate font-mono text-hb-xs font-semibold text-hb-text">{e.source}</span>
          <span className="block break-words text-hb-xs text-hb-error">{e.error}</span>
        </span>
      ),
    },
    { key: 'kind', header: 'Type', width: '90px', cell: (e) => <Badge>{e.kind === 'task' ? 'Job' : 'API'}</Badge> },
    { key: 'count', header: 'Times', width: '70px', cell: (e) => <span className="text-hb-sm text-hb-text">{e.count}</span> },
    { key: 'last', header: 'Last seen', width: '130px', cell: (e) => <When at={e.last_seen_at} /> },
    {
      key: 'actions',
      header: '',
      width: '170px',
      align: 'right',
      cell: (e) =>
        e.status === 'open' ? (
          <span className="flex justify-end gap-1.5">
            {e.can_retry && (
              <Button size="sm" variant="ghost" icon={<RotateCcw size={13} />} loading={action.isPending} onClick={() => action.mutate(`/v1/super-admin/errors/${e.id}/retry`)}>
                Retry
              </Button>
            )}
            <Button size="sm" variant="quiet" onClick={() => action.mutate(`/v1/super-admin/errors/${e.id}/resolve`)}>
              Done
            </Button>
          </span>
        ) : null,
    },
  ]

  return (
    <>
      <Toolbar>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
          fieldClassName="w-auto"
          options={[
            { value: 'open', label: 'Open' },
            { value: 'resolved', label: 'Resolved' },
            { value: 'all', label: 'All' },
          ]}
        />
      </Toolbar>
      <Card padding="none">
        <DataTable
          columns={columns}
          rows={data?.errors ?? []}
          rowKey={(e) => e.id}
          loading={isLoading}
          caption="Crashed requests and failed background jobs"
          empty={{ icon: <AlertTriangle />, title: 'Nothing is failing', description: 'Crashed requests and failed background jobs appear here.' }}
        />
      </Card>
    </>
  )
}

function ImportsTab() {
  const action = useAction('failed-imports')
  const { data, isLoading } = useQuery({
    queryKey: ['super-admin', 'failed-imports'],
    queryFn: () => api.get<any>('/v1/super-admin/failed-imports').then((r) => r.data),
  })

  const inboxColumns: Array<Column<any>> = [
    {
      key: 'subject',
      header: 'Email',
      cardTitle: true,
      cell: (m) => (
        <span className="min-w-0">
          <span className="block truncate text-hb-sm font-semibold text-hb-text">{m.subject || '(no subject)'}</span>
          <span className="block truncate text-hb-xs text-hb-muted">{m.from}</span>
          {m.error && <span className="block text-hb-xs text-hb-error">{m.error}</span>}
        </span>
      ),
    },
    { key: 'org', header: 'Client', width: '170px', cell: (m) => <span className="truncate text-hb-muted">{m.organization}</span> },
    { key: 'when', header: 'When', width: '130px', cell: (m) => <When at={m.created_at} /> },
    {
      key: 'actions',
      header: '',
      width: '100px',
      align: 'right',
      cell: (m) => (
        <Button size="sm" variant="ghost" loading={action.isPending} onClick={() => action.mutate(`/v1/super-admin/failed-imports/inbox/${m.id}/retry`)}>
          Retry
        </Button>
      ),
    },
  ]
  const sheetColumns: Array<Column<any>> = [
    { key: 'file', header: 'File', cardTitle: true, cell: (b) => <span className="truncate text-hb-sm font-semibold text-hb-text">{b.file_name}</span> },
    { key: 'org', header: 'Client', width: '170px', cell: (b) => <span className="truncate text-hb-muted">{b.organization}</span> },
    { key: 'rows', header: 'Failed rows', width: '130px', cell: (b) => <span className="text-hb-sm text-hb-error">{b.failed_count} of {b.total_rows}</span> },
    { key: 'when', header: 'When', width: '130px', cell: (b) => <When at={b.created_at} /> },
  ]

  return (
    <div className="space-y-hb-5">
      <Card padding="none">
        <div className="p-hb-5 pb-0"><CardHeader title="Resumes from email" subtitle="Retry puts it back in line for the next inbox run." /></div>
        <DataTable columns={inboxColumns} rows={data?.inbox ?? []} rowKey={(m) => m.id} loading={isLoading} caption="Resume emails that failed" empty={{ icon: <FileWarning />, title: 'No failed resume emails', description: 'Nothing to retry.' }} />
      </Card>
      <Card padding="none">
        <div className="p-hb-5 pb-0"><CardHeader title="Spreadsheet imports" subtitle="Failed rows are fixed and re-uploaded by the client." /></div>
        <DataTable columns={sheetColumns} rows={data?.sheets ?? []} rowKey={(b) => b.id} loading={isLoading} caption="Spreadsheet imports with failed rows" empty={{ icon: <FileWarning />, title: 'No failed rows', description: 'Every import went through.' }} />
      </Card>
    </div>
  )
}

function PhonesTab() {
  const action = useAction('push-devices')
  const { data, isLoading } = useQuery({
    queryKey: ['super-admin', 'push-devices'],
    queryFn: () => api.get<any>('/v1/super-admin/push-devices').then((r) => r.data),
  })

  const columns: Array<Column<any>> = [
    {
      key: 'user',
      header: 'Account',
      cardTitle: true,
      cell: (d) => (
        <span className="min-w-0">
          <span className="block truncate text-hb-sm font-semibold text-hb-text">{d.full_name}</span>
          <span className="block truncate text-hb-xs text-hb-muted">{d.email}</span>
        </span>
      ),
    },
    { key: 'org', header: 'Client', width: '170px', cell: (d) => <span className="truncate text-hb-muted">{d.organization ?? '—'}</span> },
    { key: 'device', header: 'Device', width: '120px', cell: (d) => <span className="text-hb-sm text-hb-muted">{/iphone|ipad/i.test(d.user_agent ?? '') ? 'iPhone' : /android/i.test(d.user_agent ?? '') ? 'Android' : 'Computer'}</span> },
    { key: 'sent', header: 'Last delivered', width: '130px', cell: (d) => <When at={d.last_sent_at} /> },
    {
      key: 'actions',
      header: '',
      width: '110px',
      align: 'right',
      cell: (d) => (
        <Button size="sm" variant="ghost" loading={action.isPending} onClick={() => action.mutate(`/v1/super-admin/users/${d.user_id}/test-push`)}>
          Send test
        </Button>
      ),
    },
  ]

  return (
    <Card padding="none">
      <DataTable
        columns={columns}
        rows={data?.devices ?? []}
        rowKey={(d) => d.id}
        loading={isLoading}
        caption="Devices with phone notifications on"
        empty={{ icon: <Smartphone />, title: 'No devices turned on', description: 'A device appears here after its user taps Turn on in Settings.' }}
      />
    </Card>
  )
}

export default function OperationsPage() {
  const [tab, setTab] = useState<Tab>('emails')
  return (
    <div className="pb-hb-10">
      <PageHeader eyebrow="Platform" title="Operations" description="Emails, errors, failed imports and phones. Recorded from when this page went live." />
      <Tabs<Tab>
        aria-label="Operations sections"
        value={tab}
        onChange={setTab}
        className="mb-hb-4"
        items={[
          { value: 'emails', label: 'Emails' },
          { value: 'errors', label: 'Errors & jobs' },
          { value: 'imports', label: 'Failed imports' },
          { value: 'phones', label: 'Phones' },
        ]}
      />
      {tab === 'emails' && <EmailsTab />}
      {tab === 'errors' && <ErrorsTab />}
      {tab === 'imports' && <ImportsTab />}
      {tab === 'phones' && <PhonesTab />}
    </div>
  )
}
