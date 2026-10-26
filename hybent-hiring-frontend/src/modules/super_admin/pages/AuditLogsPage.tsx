import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { Download, FileText, ShieldCheck } from 'lucide-react'

import { superAdminApi, type AuditLogParams } from '@/api/superAdmin'
import { useDebounce } from '@/components/chatbot/useDebounce'
import {
  Badge,
  Button,
  Card,
  type Column,
  DataTable,
  Input,
  PageHeader,
  Pagination,
  Select,
  TabPanel,
  Tabs,
  Toolbar,
  ToolbarSearch,
  ToolbarFilters,
} from '@/components/hb'
import { formatDateTime } from '@/utils/formatters'
import LoginEventsTable from '../components/LoginEventsTable'

/**
 * The platform security trail, in two parts:
 *
 * - Admin actions: what super admins did (clients, users, billing, settings,
 *   impersonation). Every filter runs on the server over the whole trail, and
 *   the same filters drive the CSV export (which is itself audited).
 * - Sign-ins: every recorded sign-in attempt, successful or not.
 *
 * The action cell renders as plain text: it interpolates client names and
 * user emails, so it must never go through `dangerouslySetInnerHTML`.
 */

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All categories' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'client', label: 'Client changes' },
  { value: 'user', label: 'User changes' },
  { value: 'billing', label: 'Billing & credits' },
  { value: 'settings', label: 'Settings & flags' },
]

const PAGE_SIZE = 50

type Tab = 'actions' | 'logins'

/** `yyyy-mm-dd` from a date input → ISO bounds covering that whole local day. */
const startOfDay = (d: string) => (d ? new Date(`${d}T00:00:00`).toISOString() : undefined)
const endOfDay = (d: string) => (d ? new Date(`${d}T23:59:59.999`).toISOString() : undefined)

export default function AuditLogsPage() {
  const [tab, setTab] = useState<Tab>('actions')

  const [filterClient, setFilterClient] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [filterModule, setFilterModule] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)

  const [loginOutcome, setLoginOutcome] = useState('all')
  const [loginPage, setLoginPage] = useState(1)

  const search = useDebounce(searchQuery.trim(), 300)

  const filters: AuditLogParams = {
    category: filterType !== 'all' ? filterType : undefined,
    module: filterModule !== 'all' ? filterModule : undefined,
    organization_id: filterClient !== 'all' ? filterClient : undefined,
    q: search || undefined,
    date_from: startOfDay(dateFrom),
    date_to: endOfDay(dateTo),
  }

  const { data: logsResponse, isLoading, isError, refetch } = useQuery({
    queryKey: ['super-admin', 'audit-logs', filters, page],
    queryFn: () => superAdminApi.getAuditLogs({ ...filters, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    enabled: tab === 'actions',
    placeholderData: (prev) => prev,
  })

  const { data: loginsResponse, isLoading: loginsLoading } = useQuery({
    queryKey: ['super-admin', 'login-events', filterClient, loginOutcome, search, dateFrom, dateTo, loginPage],
    queryFn: () =>
      superAdminApi.getLoginEvents({
        organization_id: filters.organization_id,
        outcome: loginOutcome,
        q: search || undefined,
        date_from: filters.date_from,
        date_to: filters.date_to,
        limit: PAGE_SIZE,
        offset: (loginPage - 1) * PAGE_SIZE,
      }),
    enabled: tab === 'logins',
    placeholderData: (prev) => prev,
  })

  const { data: clients } = useQuery({
    queryKey: ['super-admin', 'clients'],
    queryFn: () => superAdminApi.getClients(),
  })

  useEffect(() => {
    setPage(1)
    setLoginPage(1)
  }, [filterClient, filterType, filterModule, dateFrom, dateTo, search, loginOutcome])

  const clearAll = () => {
    setSearchQuery('')
    setFilterClient('all')
    setFilterType('all')
    setFilterModule('all')
    setDateFrom('')
    setDateTo('')
    setLoginOutcome('all')
  }

  const exportCsv = async () => {
    setExporting(true)
    try {
      const blob = await superAdminApi.exportAuditLogs(filters)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `hybent-audit-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Export downloaded')
    } catch (err: any) {
      toast.error(err.message || 'Export failed.')
    } finally {
      setExporting(false)
    }
  }

  const logs = logsResponse?.logs ?? []
  const totalCount = logsResponse?.total || 0
  const loginTotal = loginsResponse?.total || 0
  const filtersActive =
    [filterClient, filterType, filterModule].filter((f) => f !== 'all').length + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0)

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
          <span className="min-w-0 text-hb-sm font-semibold text-hb-text">{log.action}</span>
        </span>
      ),
    },
    {
      key: 'module',
      header: 'Area',
      width: '160px',
      cell: (log) => (
        <Badge tone={log.type === 'impersonation' ? 'warning' : 'neutral'}>{log.module}</Badge>
      ),
    },
    {
      key: 'actor',
      header: 'Actor',
      width: '200px',
      cell: (log) => <span className="truncate text-hb-muted">{log.actor}</span>,
    },
    {
      key: 'ip',
      header: 'IP',
      width: '130px',
      cell: (log) => <span className="font-mono text-hb-xs text-hb-muted">{log.ip_address ?? '—'}</span>,
    },
    {
      key: 'time',
      header: 'When',
      width: '180px',
      cell: (log) => <span className="font-mono text-hb-xs text-hb-muted">{formatDateTime(log.created_at)}</span>,
    },
  ]

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Platform"
        title="Audit logs"
        description="What super admins changed across every tenant, and every recorded sign-in attempt."
        actions={
          tab === 'actions' ? (
            <>
              {!isLoading && <Badge tone="info">{totalCount} entries</Badge>}
              <Button
                variant="ghost"
                icon={<Download size={14} />}
                onClick={exportCsv}
                loading={exporting}
                disabled={!totalCount}
              >
                Export CSV
              </Button>
            </>
          ) : (
            <Badge tone="info">{loginTotal} attempts</Badge>
          )
        }
      />

      <Tabs<Tab>
        aria-label="Audit sections"
        value={tab}
        onChange={setTab}
        className="mb-hb-4"
        items={[
          { value: 'actions', label: 'Admin actions' },
          { value: 'logins', label: 'Sign-ins' },
        ]}
      />

      <Toolbar>
        <ToolbarSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={tab === 'actions' ? 'Search actions or actors…' : 'Search by email…'}
          aria-label={tab === 'actions' ? 'Search audit log actions and actors' : 'Search sign-ins by email'}
        />
        <ToolbarFilters activeCount={filtersActive + (loginOutcome !== 'all' ? 1 : 0)} onReset={clearAll}>
          <Select
            options={[
              { value: 'all', label: 'All clients' },
              ...(clients ?? []).map((c) => ({ value: c.id, label: c.name })),
            ]}
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
            aria-label="Filter by tenant"
            fieldClassName="w-auto"
          />
          {tab === 'actions' ? (
            <>
              <Select
                options={CATEGORY_OPTIONS}
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                aria-label="Filter by category"
                fieldClassName="w-auto"
              />
              <Select
                options={[
                  { value: 'all', label: 'All areas' },
                  ...((logsResponse?.modules ?? []) as string[]).map((m) => ({ value: m, label: m })),
                ]}
                value={filterModule}
                onChange={(e) => setFilterModule(e.target.value)}
                aria-label="Filter by area"
                fieldClassName="w-auto"
              />
            </>
          ) : (
            <Select
              options={[
                { value: 'all', label: 'Any outcome' },
                { value: 'success', label: 'Successful' },
                { value: 'failure', label: 'Failed' },
              ]}
              value={loginOutcome}
              onChange={(e) => setLoginOutcome(e.target.value)}
              aria-label="Filter by outcome"
              fieldClassName="w-auto"
            />
          )}
          <Input
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label="From date"
            fieldClassName="w-auto"
          />
          <Input
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label="To date"
            fieldClassName="w-auto"
          />
        </ToolbarFilters>
      </Toolbar>

      <TabPanel value="actions" active={tab === 'actions'}>
        <Card padding="none">
          <DataTable
            columns={columns}
            rows={logs}
            rowKey={(log) => log.id}
            loading={isLoading}
            caption="Platform-wide administrative audit trail"
            empty={
              isError
                ? {
                    icon: <FileText />,
                    title: 'Could not load audit logs',
                    description: 'The server did not respond as expected.',
                    size: 'page',
                    action: { label: 'Retry', onClick: () => refetch() },
                  }
                : {
                    icon: <FileText />,
                    title: 'No audit logs found',
                    description: 'Try relaxing the search or filters.',
                    size: 'page',
                    action: searchQuery || filtersActive ? { label: 'Clear filters', onClick: clearAll } : undefined,
                  }
            }
          />
          <Pagination
            page={page}
            pages={Math.max(1, Math.ceil(totalCount / PAGE_SIZE))}
            total={totalCount}
            limit={PAGE_SIZE}
            onPage={setPage}
            noun="log entries"
            asCardFooter
          />
        </Card>
      </TabPanel>

      <TabPanel value="logins" active={tab === 'logins'}>
        <Card padding="none">
          <LoginEventsTable
            events={loginsResponse?.events ?? []}
            loading={loginsLoading}
            showOrganization
            caption="Sign-in attempts across the platform"
          />
          <Pagination
            page={loginPage}
            pages={Math.max(1, Math.ceil(loginTotal / PAGE_SIZE))}
            total={loginTotal}
            limit={PAGE_SIZE}
            onPage={setLoginPage}
            noun="attempts"
            asCardFooter
          />
        </Card>
      </TabPanel>
    </div>
  )
}
