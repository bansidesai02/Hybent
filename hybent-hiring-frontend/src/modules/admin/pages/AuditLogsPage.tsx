import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ClipboardList, X } from 'lucide-react'

import { adminApi } from '@/api/admin'
import { formatDateTime } from '@/utils/formatters'
import {
  Avatar,
  Badge,
  type BadgeTone,
  Button,
  Card,
  type Column,
  DataTable,
  FilterChips,
  Input,
  PageHeader,
  Pagination,
  Toolbar,
  ToolbarSearch,
} from '@/components/hb'

/**
 * Every action taken in the organisation, newest first.
 *
 * Rebuilt on the design system in phase 9. The old page carried seventeen
 * hardcoded colours: thirteen in `ACTION_STYLE` (one per action) and four in
 * `ROLE_STYLE` (one per role), each painting a pill background, a pill text
 * colour, a filter chip and — via two `onMouseEnter`/`onMouseLeave` handlers
 * that wrote to `element.style` directly — a row border and box-shadow on
 * hover. Thirteen colours for thirteen actions is a legend nobody can hold in
 * their head, and it put amber (the product's warning colour) on "Rescheduled"
 * and blue (info) on "Edited", neither of which is a warning or a notice.
 *
 * What a reader actually scans an audit log for is *destructive* rows. So the
 * tone map below is three entries, not thirteen: something was created,
 * something was destroyed, or something changed. The action itself is named in
 * the pill, which is what tells you it was a reschedule rather than a cancel.
 */

/** The only distinction worth a colour: was this additive or destructive? */
const ACTION_TONE: Record<string, BadgeTone> = {
  CREATE: 'success',
  INVITE: 'success',
  LOGIN: 'success',
  DELETE: 'error',
  CANCEL: 'error',
}

const ACTION_LABEL: Record<string, string> = {
  CREATE: 'Created',
  UPDATE: 'Edited',
  UPDATE_STAGE: 'Stage change',
  SCHEDULE: 'Scheduled',
  RESCHEDULE: 'Rescheduled',
  CANCEL: 'Cancelled',
  DELETE: 'Deleted',
  INVITE: 'Invited',
  ADD_COMMENT: 'Comment added',
  LOGIN: 'Login',
  LOGOUT: 'Logout',
  OFFER_SENT: 'Offer sent',
  OFFER_RESPONDED: 'Offer response',
}

const ACTION_FILTERS = [
  'CREATE',
  'UPDATE',
  'UPDATE_STAGE',
  'SCHEDULE',
  'RESCHEDULE',
  'CANCEL',
  'DELETE',
  'ADD_COMMENT',
  'INVITE',
  'OFFER_SENT',
] as const

const RESOURCE_FILTERS = [
  'job',
  'candidate',
  'interview',
  'offer',
  'hr_note',
  'comment',
  'user',
] as const

const titleise = (s: string) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : '—'

// ─── Human-readable description builder ──────────────────────────────────────
function buildDescription(log: any): string {
  const d = log.details || {}
  const rt = log.resource_type || ''
  const action = log.action || ''

  const name = d.candidate || d.name || d.title || d.position || ''
  const fields = Array.isArray(d.fields) ? d.fields.join(', ') : ''

  switch (action) {
    case 'CREATE':
      if (rt === 'candidate') return `Added candidate — ${name}`
      if (rt === 'job') return `Created job — ${name}`
      if (rt === 'offer') return `Created offer — ${name}`
      return `Created ${rt}${name ? ` — ${name}` : ''}`

    case 'UPDATE':
      if (rt === 'candidate') return `Edited candidate — ${name}${fields ? ` (${fields})` : ''}`
      if (rt === 'job') return `Updated job — ${name}${fields ? ` (${fields})` : ''}`
      if (rt === 'interview') return `Updated interview — ${d.title || ''}${name ? ` with ${name}` : ''}`
      if (rt === 'offer') return `Updated offer — ${name}${fields ? ` (${fields})` : ''}`
      return `Updated ${rt}${name ? ` — ${name}` : ''}`

    case 'UPDATE_STAGE':
      return `Moved ${d.name || 'candidate'} from ${d.from || '?'} to ${d.to || '?'}`

    case 'SCHEDULE':
      return `Scheduled interview — ${d.title || ''}${name ? ` with ${name}` : ''}`

    case 'RESCHEDULE':
      return `Rescheduled interview — ${d.title || ''}${name ? ` with ${name}` : ''}`

    case 'CANCEL':
      return `Cancelled interview — ${d.title || ''}${name ? ` with ${name}` : ''}${d.reason ? ` (${d.reason})` : ''}`

    case 'DELETE':
      if (rt === 'candidate') return `Deleted candidate — ${d.name || d.email || ''}`
      if (rt === 'job') return `Deleted job — ${d.title || ''}`
      if (rt === 'offer') return `Revoked offer — ${d.position || ''}`
      return `Deleted ${rt}${name ? ` — ${name}` : ''}`

    case 'ADD_COMMENT':
      if (rt === 'hr_note') return `Updated HR confidential note for ${d.candidate || 'candidate'}`
      if (rt === 'comment') return `Added comment for ${d.candidate || 'candidate'}`
      return `Comment added`

    case 'INVITE':
      return `Invited candidate — ${d.name || d.email || ''}`

    case 'OFFER_SENT':
      return `Offer sent — ${d.position || ''}`

    case 'OFFER_RESPONDED':
      return `Offer ${d.status || 'responded'} — ${d.position || ''}`

    case 'LOGIN': return 'Logged in'
    case 'LOGOUT': return 'Logged out'

    default:
      if (name) return `${action} on ${rt} — ${name}`
      return `${action} on ${rt}`
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AuditLogsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const resourceId = searchParams.get('resource_id')

  const [page, setPage] = useState(1)
  const [action, setAction] = useState<string | null>(null)
  const [resourceType, setResourceType] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  /* The old bar needed an explicit "Go" (or Enter) because every keystroke
     would otherwise have hit the API. Debouncing buys the live-search feel
     without the request storm, and drops the button the rest of the product
     does not have. */
  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 350)
    return () => clearTimeout(id)
  }, [searchInput])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['audit-logs', page, action, resourceType, resourceId, search, dateFrom, dateTo],
    queryFn: () =>
      adminApi.auditLogs({
        page, limit: 20,
        action: action || undefined,
        resource_type: resourceType || undefined,
        resource_id: resourceId || undefined,
        search: search || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      }).then(r => r.data),
  })

  const handleClearFilters = () => {
    setAction(null); setResourceType(null); setSearch(''); setSearchInput(''); setDateFrom(''); setDateTo(''); setPage(1)
    if (resourceId) {
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('resource_id')
      setSearchParams(newParams)
    }
  }

  const hasActiveFilters = Boolean(
    action || resourceType || search || dateFrom || dateTo || resourceId
  )

  const columns: Array<Column<any>> = [
    {
      key: 'action',
      header: 'Action',
      width: '150px',
      cell: (log) => (
        <Badge tone={ACTION_TONE[log.action] ?? 'neutral'}>
          {ACTION_LABEL[log.action] ?? log.action}
        </Badge>
      ),
    },
    {
      key: 'resource',
      header: 'Resource',
      width: '120px',
      cell: (log) => <span className="text-hb-muted">{titleise(log.resource_type || '')}</span>,
    },
    {
      key: 'description',
      header: 'Description',
      cardTitle: true,
      cell: (log) => {
        const description = buildDescription(log)
        return (
          <span className="block truncate text-hb-text" title={description}>
            {description}
          </span>
        )
      },
    },
    {
      key: 'user',
      header: 'Edited by',
      width: '220px',
      cell: (log) =>
        log.user_name ? (
          <span className="flex min-w-0 items-center gap-2">
            <Avatar name={log.user_name} size="sm" />
            <span className="min-w-0 flex-1 truncate text-hb-muted">{log.user_name}</span>
            {log.user_role && <Badge>{titleise(log.user_role)}</Badge>}
          </span>
        ) : (
          <span className="italic text-hb-dim">System</span>
        ),
    },
    {
      key: 'when',
      header: 'When',
      width: '160px',
      cell: (log) => <span className="text-hb-muted">{formatDateTime(log.created_at)}</span>,
    },
  ]

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Admin"
        title="Audit logs"
        description="A complete history of every action taken in your organisation."
        actions={
          <>
            {data && <Badge tone="info">{data.total} total</Badge>}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={handleClearFilters}>
                Clear filters
              </Button>
            )}
          </>
        }
      />

      <Toolbar>
        <ToolbarSearch
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search by user name…"
          aria-label="Search audit logs by user name"
        />
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
          aria-label="Filter from date"
          fieldClassName="w-auto"
        />
        <span aria-hidden className="text-hb-sm text-hb-dim">
          to
        </span>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
          aria-label="Filter to date"
          fieldClassName="w-auto"
        />
      </Toolbar>

      <div className="mb-hb-4 space-y-2">
        <FilterChips
          options={ACTION_FILTERS.map((a) => ({ value: a, label: ACTION_LABEL[a] ?? a }))}
          value={action as (typeof ACTION_FILTERS)[number] | null}
          onChange={(next) => { setAction(next); setPage(1) }}
          allLabel="All actions"
        />
        <FilterChips
          options={RESOURCE_FILTERS.map((r) => ({ value: r, label: titleise(r) }))}
          value={resourceType as (typeof RESOURCE_FILTERS)[number] | null}
          onChange={(next) => { setResourceType(next); setPage(1) }}
          allLabel="All resources"
        />
      </div>

      {isError ? (
        <div
          role="alert"
          className="rounded-hb-md border border-hb-error/25 bg-hb-error/8 p-4 text-hb-sm text-hb-error"
        >
          Failed to load audit logs.
        </div>
      ) : (
        <Card padding="none">
          <DataTable
            columns={columns}
            rows={data?.items ?? []}
            rowKey={(log) => log.id}
            loading={isLoading}
            caption="Audit log of actions taken in this organisation"
            empty={{
              icon: <ClipboardList />,
              title: 'No audit logs found',
              description: hasActiveFilters
                ? 'Try adjusting your filters.'
                : 'Actions will be logged here automatically.',
              size: 'page',
              ...(hasActiveFilters
                ? { action: { label: 'Clear filters', onClick: handleClearFilters } }
                : {}),
            }}
          />

          {data && (
            <Pagination
              page={data.page}
              pages={data.pages}
              total={data.total}
              limit={data.limit}
              onPage={setPage}
              noun="log entries"
            />
          )}
        </Card>
      )}
    </div>
  )
}
