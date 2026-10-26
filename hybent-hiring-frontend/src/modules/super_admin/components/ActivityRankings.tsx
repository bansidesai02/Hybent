import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Activity } from 'lucide-react'

import { superAdminApi, type OrgActivityRow } from '@/api/superAdmin'
import { Avatar, Badge, Card, CardHeader, type Column, DataTable, Select, type SortDirection } from '@/components/hb'
import { formatDate, formatDateTime, timeAgo } from '@/utils/formatters'

/**
 * Which organizations are using the platform, and which have gone quiet.
 *
 * Counts come from recorded data only: successful sign-ins (login_events,
 * recorded from when tracking began), actions in each organization's own
 * activity log, candidates added and interviews scheduled in the window.
 * The default order is a plain sum of those four; any column re-sorts.
 */

const WINDOWS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
]

export default function ActivityRankings() {
  const navigate = useNavigate()
  const [days, setDays] = useState('30')
  const [sort, setSort] = useState<{ key: string; direction: SortDirection }>({ key: 'score', direction: 'desc' })

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin', 'activity', days],
    queryFn: () => superAdminApi.getActivity(Number(days)),
  })

  const rows = useMemo(() => {
    const list = [...(data?.organizations ?? [])]
    const key = sort.key as keyof OrgActivityRow
    const dir = sort.direction === 'asc' ? 1 : -1
    list.sort((a, b) => {
      const av = a[key] ?? ''
      const bv = b[key] ?? ''
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return a.name.localeCompare(b.name)
    })
    return list
  }, [data, sort])

  const num = (key: keyof OrgActivityRow, header: string) => ({
    key,
    header,
    width: '110px',
    align: 'right' as const,
    sortable: true,
    cell: (r: OrgActivityRow) => <span className="tabular-nums text-hb-sm text-hb-text">{r[key] as number}</span>,
  })

  const columns: Array<Column<OrgActivityRow>> = [
    {
      key: 'name',
      header: 'Organization',
      cardTitle: true,
      sortable: true,
      cell: (r) => (
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-hb-sm font-semibold text-hb-text">{r.name}</span>
          {!r.is_active && <Badge tone="error">Suspended</Badge>}
        </span>
      ),
    },
    num('logins', 'Sign-ins'),
    num('active_users', 'Active users'),
    num('actions', 'Actions'),
    num('candidates_added', 'Candidates'),
    num('interviews_scheduled', 'Interviews'),
    {
      key: 'last_login',
      header: 'Last sign-in',
      width: '140px',
      sortable: true,
      cell: (r) =>
        r.last_login ? (
          <span className="text-hb-sm text-hb-muted" title={formatDateTime(r.last_login)}>
            {timeAgo(r.last_login)}
          </span>
        ) : (
          <span className="text-hb-sm text-hb-dim">Never</span>
        ),
    },
  ]

  return (
    <div className="grid gap-hb-5 lg:grid-cols-3">
      <Card padding="none" className="lg:col-span-2">
        <div className="p-hb-5 pb-0">
          <CardHeader
            title={
              <span className="inline-flex items-center gap-2">
                <Activity size={17} aria-hidden className="text-hb-cyan" />
                Organization activity
              </span>
            }
            subtitle={
              data?.login_tracking_since
                ? `Sign-ins counted since tracking began on ${formatDate(data.login_tracking_since)}.`
                : 'Sign-in tracking has no data yet; sign-in counts start at zero.'
            }
            action={
              <Select
                options={WINDOWS}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                aria-label="Activity window"
                fieldClassName="w-auto"
              />
            }
          />
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.organization_id}
          loading={isLoading}
          sort={sort}
          onSortChange={setSort}
          onRowClick={(r) => navigate(`/hiring/super-admin/clients/${r.organization_id}`)}
          caption="Activity per organization in the selected window"
          empty={{ icon: <Activity />, title: 'No organizations yet', description: 'Clients appear here once created.' }}
        />
      </Card>

      <Card padding="loose">
        <CardHeader title="Recently signed in" subtitle="The ten most recent sign-ins." />
        {data?.recent_users?.length ? (
          <ul className="space-y-3">
            {data.recent_users.map((u) => (
              <li key={u.id} className="flex min-w-0 items-center gap-2.5">
                <Avatar name={u.full_name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-hb-sm font-semibold text-hb-text">{u.full_name}</span>
                  <span className="block truncate text-hb-xs text-hb-muted">
                    {u.client ?? 'System'} · {u.role}
                  </span>
                </span>
                <span className="shrink-0 text-hb-xs text-hb-muted" title={formatDateTime(u.last_login)}>
                  {timeAgo(u.last_login)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-hb-sm text-hb-muted">{isLoading ? 'Loading…' : 'Nobody has signed in yet.'}</p>
        )}
      </Card>
    </div>
  )
}
