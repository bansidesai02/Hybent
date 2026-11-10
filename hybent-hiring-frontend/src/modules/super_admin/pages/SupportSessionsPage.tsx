import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { Headset } from 'lucide-react'

import { superAdminApi, type SupportSessionRow } from '@/api/superAdmin'
import { Badge, Button, Card, type Column, ConfirmDialog, DataTable, PageHeader, Pagination, Tabs } from '@/components/hb'
import { formatDateTime, timeAgo } from '@/utils/formatters'

/** Every support session (impersonation): who, as whom, why, and ending live ones. */

type Filter = 'active' | 'all' | 'ended'
const PAGE_SIZE = 50

const END_REASON: Record<string, string> = {
  exit: 'Exited',
  expired: 'Time ran out',
  replaced: 'Replaced by a new session',
  ended_by_admin: 'Ended from this page',
}

export default function SupportSessionsPage() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Filter>('active')
  const [page, setPage] = useState(1)
  const [ending, setEnding] = useState<SupportSessionRow | null>(null)

  useEffect(() => setPage(1), [tab])

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin', 'impersonations', tab, page],
    queryFn: () => superAdminApi.getImpersonations({ status: tab, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    placeholderData: (prev) => prev,
    refetchInterval: tab === 'active' ? 30_000 : false,
  })

  const end = useMutation({
    mutationFn: (id: string) => superAdminApi.endImpersonation(id),
    onSuccess: () => {
      toast.success('Session ended. Its access stopped at once.')
      setEnding(null)
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'impersonations'] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Could not end the session.'),
  })

  const columns: Array<Column<SupportSessionRow>> = [
    {
      key: 'as',
      header: 'Signed in as',
      cardTitle: true,
      cell: (s) => (
        <span className="min-w-0">
          <span className="block truncate text-hb-sm font-semibold text-hb-text">{s.target?.full_name ?? '—'}</span>
          <span className="block truncate text-hb-xs text-hb-muted">
            {s.target?.email} · {s.target?.role}
            {s.organization ? ` · ${s.organization}` : ''}
          </span>
        </span>
      ),
    },
    { key: 'by', header: 'By', width: '190px', cell: (s) => <span className="truncate text-hb-sm text-hb-muted">{s.super_admin_email ?? '—'}</span> },
    { key: 'reason', header: 'Reason', cell: (s) => <span className="line-clamp-2 text-hb-sm text-hb-text">{s.reason}</span> },
    {
      key: 'mode',
      header: 'Access',
      width: '120px',
      cell: (s) => <Badge tone={s.allow_changes ? 'warning' : 'neutral'}>{s.allow_changes ? 'Can change' : 'View only'}</Badge>,
    },
    { key: 'changes', header: 'Changes', width: '90px', cell: (s) => <span className="text-hb-sm text-hb-muted">{s.changes ?? '—'}</span> },
    {
      key: 'when',
      header: 'Started',
      width: '150px',
      cell: (s) => (
        <span className="text-hb-sm text-hb-muted" title={formatDateTime(s.started_at)}>
          {timeAgo(s.started_at)}
          {s.status === 'active' && s.expires_at && <span className="block text-hb-xs">ends {formatDateTime(s.expires_at)}</span>}
          {s.status === 'ended' && s.end_reason && <span className="block text-hb-xs">{END_REASON[s.end_reason] ?? s.end_reason}</span>}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '110px',
      cell: (s) =>
        s.status === 'active' ? (
          <Button size="sm" variant="danger" onClick={(e: any) => { e.stopPropagation?.(); setEnding(s) }}>
            End now
          </Button>
        ) : (
          <Badge tone="neutral">{s.status === 'unknown' ? 'Not tracked' : 'Ended'}</Badge>
        ),
    },
  ]

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Platform"
        title="Support sessions"
        description={`Every time a super admin signs in as a user. Sessions end on their own after ${data?.minutes ?? 30} minutes; end one early here and its access stops at once.`}
      />
      <Tabs<Filter>
        aria-label="Filter support sessions"
        value={tab}
        onChange={setTab}
        className="mb-hb-4"
        items={[
          { value: 'active', label: 'Active now' },
          { value: 'all', label: 'All' },
          { value: 'ended', label: 'Ended' },
        ]}
      />
      <Card padding="none">
        <DataTable
          columns={columns}
          rows={data?.sessions ?? []}
          rowKey={(s) => s.id}
          loading={isLoading}
          caption="Support sessions"
          empty={{
            icon: <Headset />,
            title: tab === 'active' ? 'No one is in a support session' : 'No support sessions yet',
            description: 'Start one from All users → Sign in as.',
            size: 'page',
          }}
        />
        <Pagination page={page} pages={Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE))} total={data?.total ?? 0} limit={PAGE_SIZE} onPage={setPage} noun="sessions" asCardFooter />
      </Card>
      <ConfirmDialog
        open={!!ending}
        onClose={() => setEnding(null)}
        onConfirm={() => ending && end.mutate(ending.id)}
        loading={end.isPending}
        title="End this support session?"
        description={ending ? `${ending.super_admin_email} is signed in as ${ending.target?.email}. Their access stops at once.` : undefined}
        confirmLabel="End session"
        destructive
      />
    </div>
  )
}
