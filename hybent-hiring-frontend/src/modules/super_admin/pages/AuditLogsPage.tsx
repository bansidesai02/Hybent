import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, ShieldCheck } from 'lucide-react'

import { superAdminApi } from '@/api/superAdmin'
import {
  Badge,
  Card,
  type Column,
  DataTable,
  PageHeader,
  Pagination,
  Select,
  Toolbar,
  ToolbarSearch,
} from '@/components/hb'

/**
 * The platform security trail: impersonation sessions, billing adjustments,
 * user changes and flag edits, across every tenant.
 *
 * Rebuilt on the design system in phase 9. The important fix is not visual:
 * the action cell rendered `log.action` through `dangerouslySetInnerHTML`.
 * That field is a plain string column on `SuperAdminAuditLog` and the strings
 * interpolate client names and user emails, so any markup a tenant could get
 * into one of those fields would have executed here — on the screen that
 * exists specifically to be trustworthy. It renders as text now. (The super
 * admin dashboard had the same sink in its log snippet.)
 *
 * Known limitation, unchanged: the search box filters the current page of 50
 * rows in the browser. The client and category filters are server-side.
 */

const TYPE_OPTIONS = [
  { value: 'all', label: 'All actions' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'billing', label: 'Billing' },
  { value: 'user', label: 'User changes' },
  { value: 'job', label: 'Job postings' },
]

const PAGE_SIZE = 50

export default function AuditLogsPage() {
  const [filterClient, setFilterClient] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)

  const { data: logsResponse, isLoading } = useQuery({
    queryKey: ['super-admin', 'audit-logs', filterClient, filterType, page],
    queryFn: () =>
      superAdminApi.getAuditLogs({
        client: filterClient !== 'all' ? filterClient : undefined,
        category: filterType !== 'all' ? filterType : undefined,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      }),
  })

  const { data: clients } = useQuery({
    queryKey: ['super-admin', 'clients'],
    queryFn: () => superAdminApi.getClients(),
  })

  useEffect(() => { setPage(1) }, [filterClient, filterType])

  const filteredLogs = useMemo(() => {
    const list = logsResponse?.logs || []
    if (!searchQuery.trim()) return list
    const q = searchQuery.toLowerCase()
    return list.filter(
      (l: any) =>
        l.action?.toLowerCase().includes(q) ||
        l.actor?.toLowerCase().includes(q) ||
        l.client?.toLowerCase().includes(q)
    )
  }, [logsResponse, searchQuery])

  const totalCount = logsResponse?.total || 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const columns: Array<Column<any>> = [
    {
      key: 'action',
      header: 'Action',
      cardTitle: true,
      cell: (log) => (
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-hb-border bg-hb-surface-2 text-hb-cyan">
            <ShieldCheck size={14} aria-hidden />
          </span>
          {/* Plain text. This was `dangerouslySetInnerHTML`. */}
          <span className="min-w-0 text-hb-sm font-semibold text-hb-text">{log.action}</span>
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Category',
      width: '150px',
      cell: (log) => (
        <Badge tone={log.type === 'impersonation' ? 'warning' : 'neutral'}>
          {log.type === 'impersonation' ? 'Impersonation' : 'User'}
        </Badge>
      ),
    },
    {
      key: 'client',
      header: 'Tenant',
      width: '180px',
      cell: (log) => <span className="text-hb-muted">{log.client}</span>,
    },
    {
      key: 'actor',
      header: 'Actor',
      width: '200px',
      cell: (log) => <span className="truncate text-hb-muted">{log.actor}</span>,
    },
    {
      key: 'time',
      header: 'When',
      width: '180px',
      cell: (log) => <span className="font-mono text-hb-xs text-hb-muted">{log.time}</span>,
    },
  ]

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Platform"
        title="Audit logs"
        description="Impersonation sessions, user actions, billing adjustments and flag changes across every tenant."
        actions={!isLoading ? <Badge tone="info">{totalCount} entries</Badge> : undefined}
      />

      <Toolbar>
        <ToolbarSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search this page…"
          aria-label="Search log entries on the current page"
        />
        <Select
          options={[
            { value: 'all', label: 'All clients' },
            ...(clients ?? []).map((c) => ({ value: c.name, label: c.name })),
          ]}
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
          aria-label="Filter by tenant"
          fieldClassName="w-auto"
        />
        <Select
          options={TYPE_OPTIONS}
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          aria-label="Filter by category"
          fieldClassName="w-auto"
        />
      </Toolbar>

      <Card padding="none">
        <DataTable
          columns={columns}
          rows={filteredLogs}
          rowKey={(_log, i) => i}
          loading={isLoading}
          caption="Platform-wide administrative audit trail"
          empty={{
            icon: <FileText />,
            title: 'No audit logs found',
            description: 'Try relaxing the search or filters.',
            size: 'page',
            action:
              searchQuery || filterClient !== 'all' || filterType !== 'all'
                ? {
                    label: 'Clear filters',
                    onClick: () => {
                      setSearchQuery('')
                      setFilterClient('all')
                      setFilterType('all')
                    },
                  }
                : undefined,
          }}
        />

        <Pagination
          page={page}
          pages={totalPages}
          total={totalCount}
          limit={PAGE_SIZE}
          onPage={setPage}
          noun="log entries"
          asCardFooter
        />
      </Card>
    </div>
  )
}
