import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  Award,
  Briefcase,
  Building2,
  CalendarDays,
  CreditCard,
  Plus,
  ShieldCheck,
  TriangleAlert,
  UserCheck,
  Users,
} from 'lucide-react'

import { superAdminApi } from '@/api/superAdmin'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  type Column,
  DataTable,
  EmptyState,
  Meter,
  PageHeader,
  Skeleton,
  SkeletonStats,
  StatCard,
  StatGrid,
} from '@/components/hb'

/**
 * The platform operator's landing page.
 *
 * Rebuilt on the design system in phase 9. Two defects fixed on the way:
 *
 * - The audit-log snippet rendered `log.action` through
 *   `dangerouslySetInnerHTML`. That field is a plain string column on
 *   `SuperAdminAuditLog` — no markup is intended — and the strings interpolate
 *   client names and user emails, so any HTML a tenant could get into one of
 *   those fields would execute in the highest-privilege console in the
 *   product. It renders as text now.
 * - Two of the six navigations dropped the `/hiring` prefix the workspace is
 *   mounted under (`/super-admin/clients`, from the limit alert and from a
 *   table row), so clicking either landed the operator on the marketing
 *   homepage.
 *
 * The eight metric tiles used eight `GlassIcon` accent variants and the role
 * chart gave each of the four roles its own bar colour. The role is named
 * beside its bar and the metric beneath its figure; the colour was decoration
 * that read as a legend.
 */

/** Plan prices are USD (hybent.com/pricing). */
const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(val)

interface ClientRow {
  id: string
  name: string
  slug: string
  plan: string
  status: string
  users_count: number
  users_limit: number
  jobs_count: number
  jobs_limit: number
}

const STATUS_TONE: Record<string, 'success' | 'info' | 'error'> = {
  active: 'success',
  pending: 'info',
}

export default function DashboardPage() {
  const navigate = useNavigate()

  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['super-admin', 'dashboard'],
    queryFn: () => superAdminApi.getDashboard(),
  })

  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ['super-admin', 'clients'],
    queryFn: () => superAdminApi.getClients(),
  })

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ['super-admin', 'audit-logs'],
    queryFn: () => superAdminApi.getAuditLogs(),
  })

  const { data: health } = useQuery({
    queryKey: ['super-admin', 'health'],
    queryFn: () => superAdminApi.getHealth(),
  })

  const clientLimitAlerts = useMemo(() => {
    if (!clients) return []
    return clients.filter((c) => {
      const userRatio = c.users_count / c.users_limit
      const jobRatio = c.jobs_count / c.jobs_limit
      return (userRatio >= 0.85 || jobRatio >= 0.85) && c.status === 'active'
    })
  }, [clients])

  const roleDistribution = useMemo(() => {
    if (!dashboard?.role_distribution) return []
    const dist = dashboard.role_distribution
    const total = Object.values(dist).reduce((acc: number, val) => acc + (val as number), 0) || 1

    return (['admin', 'recruiter', 'interviewer', 'candidate'] as const).map((key) => ({
      name: key.charAt(0).toUpperCase() + key.slice(1),
      count: (dist as any)[key] || 0,
      percentage: Math.round((((dist as any)[key] || 0) / total) * 100),
    }))
  }, [dashboard])

  /* Both call sites used to push `/super-admin/clients` — no `/hiring` prefix,
     and carrying a `selectedClientId` in router state that `ClientsPage` never
     reads. The tenant already has a detail route. */
  const openClient = (id: string) => navigate(`/hiring/super-admin/clients/${id}`)

  const clientColumns: Array<Column<ClientRow>> = [
    {
      key: 'name',
      header: 'Client',
      cardTitle: true,
      cell: (c) => (
        <span className="flex items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-hb-sm bg-hb-grad font-mono text-hb-micro font-bold text-white">
            {c.name.substring(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-hb-sm font-semibold text-hb-text">{c.name}</span>
            <span className="block truncate text-hb-xs text-hb-muted">{c.slug}.hybent.com</span>
          </span>
        </span>
      ),
    },
    { key: 'plan', header: 'Plan', width: '110px', cell: (c) => <Badge>{c.plan}</Badge> },
    {
      key: 'users',
      header: 'Users',
      width: '90px',
      align: 'center',
      cell: (c) => <span className="font-mono tabular-nums text-hb-muted">{c.users_count}</span>,
    },
    {
      key: 'jobs',
      header: 'Jobs',
      width: '90px',
      align: 'center',
      cell: (c) => <span className="font-mono tabular-nums text-hb-muted">{c.jobs_count}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      width: '110px',
      cell: (c) => (
        <Badge tone={STATUS_TONE[c.status] ?? 'error'}>{c.status}</Badge>
      ),
    },
  ]

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Platform"
        title="Super admin"
        description="Tenants, operations and system health across the whole Hybent platform."
        actions={
          <Button
            icon={<Plus size={15} />}
            onClick={() =>
              navigate('/hiring/super-admin/clients', { state: { openWizard: true } })
            }
          >
            Add client
          </Button>
        }
      />

      <div className="space-y-hb-6">
        {clientLimitAlerts.length > 0 && (
          <ul className="space-y-2">
            {clientLimitAlerts.map((client) => (
              <li
                key={client.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-hb-md border border-hb-warning/25 bg-hb-warning/8 p-4"
              >
                <p className="flex min-w-0 items-start gap-2.5 text-hb-sm text-hb-text">
                  <TriangleAlert size={17} aria-hidden className="mt-0.5 shrink-0 text-hb-warning" />
                  <span>
                    <strong className="font-semibold">{client.name}</strong> is approaching their
                    resource limit — users {client.users_count}/{client.users_limit}, jobs{' '}
                    {client.jobs_count}/{client.jobs_limit}.
                  </span>
                </p>
                <Button size="sm" variant="ghost" onClick={() => openClient(client.id)}>
                  Manage limits
                </Button>
              </li>
            ))}
          </ul>
        )}

        {dashboardLoading ? (
          <SkeletonStats />
        ) : (
          <StatGrid>
            <StatCard
              label="Total clients"
              value={dashboard?.total_clients ?? 0}
              icon={<Building2 />}
            />
            <StatCard label="Total users" value={dashboard?.total_users ?? 0} icon={<Users />} />
            <StatCard label="Active jobs" value={dashboard?.total_jobs ?? 0} icon={<Briefcase />} />
            <StatCard
              label="Monthly recurring revenue"
              value={formatCurrency(dashboard?.total_mrr ?? 0)}
              icon={<CreditCard />}
            />
            <StatCard
              label="Total candidates"
              value={dashboard?.total_candidates ?? 0}
              icon={<UserCheck />}
            />
            <StatCard
              label="Total interviews"
              value={dashboard?.total_interviews ?? 0}
              icon={<CalendarDays />}
            />
            <StatCard label="Total offers" value={dashboard?.total_offers ?? 0} icon={<Award />} />
            <StatCard
              label="API / AI usage"
              value={dashboard?.api_usage ?? 0}
              icon={<Activity />}
            />
          </StatGrid>
        )}

        <div className="grid gap-hb-5 lg:grid-cols-3">
          <Card padding="loose" className="lg:col-span-2">
            <CardHeader
              title="Recent clients"
              subtitle="The four most recently onboarded tenants."
              action={
                <Button variant="ghost" size="sm" to="/hiring/super-admin/clients">
                  All clients
                </Button>
              }
            />
            <DataTable
              columns={clientColumns}
              rows={((clients ?? []) as ClientRow[]).slice(0, 4)}
              rowKey={(c) => c.id}
              loading={clientsLoading}
              onRowClick={(c) => openClient(c.id)}
              caption="Recently onboarded clients"
              empty={{
                icon: <Building2 />,
                title: 'No clients onboarded yet',
                description: 'Add your first tenant to get started.',
                action: {
                  label: 'Add client',
                  onClick: () =>
                    navigate('/hiring/super-admin/clients', { state: { openWizard: true } }),
                },
              }}
            />
          </Card>

          <div className="space-y-hb-5">
            <Card padding="loose">
              <CardHeader title="Users by role" />
              <div className="space-y-hb-3">
                {roleDistribution.map((role) => (
                  <Meter
                    key={role.name}
                    value={role.percentage}
                    label={role.name}
                    valueLabel={`${role.count} (${role.percentage}%)`}
                  />
                ))}
              </div>
            </Card>

            <Card padding="loose">
              <CardHeader title="Platform status" />
              <dl className="grid grid-cols-2 gap-2.5">
                {[
                  { label: 'API uptime', value: health?.api_uptime || '99.9%' },
                  { label: 'Avg latency', value: health?.avg_latency || '340ms' },
                  {
                    label: 'Errors (24h)',
                    value: health?.errors_24h ?? 0,
                    /* The only figure here with a verdict attached: any error
                       in the last day is worth an operator's attention. */
                    alarming: (health?.errors_24h ?? 0) > 0,
                  },
                  { label: 'DB queries/s', value: health?.db_queries_sec ?? 0 },
                ].map((tile) => (
                  <div
                    key={tile.label}
                    className={`rounded-hb-md border p-3 ${
                      tile.alarming
                        ? 'border-hb-error/25 bg-hb-error/8'
                        : 'border-hb-border bg-hb-surface-2'
                    }`}
                  >
                    <dt className="font-mono text-hb-label uppercase text-hb-dim">{tile.label}</dt>
                    <dd
                      className={`mt-1 font-display text-hb-h3 ${
                        tile.alarming ? 'text-hb-error' : 'text-hb-text'
                      }`}
                    >
                      {tile.value}
                    </dd>
                  </div>
                ))}
              </dl>
              <Button
                variant="ghost"
                size="sm"
                to="/hiring/super-admin/health"
                className="mt-hb-4 w-full"
              >
                Monitor health
              </Button>
            </Card>
          </div>
        </div>

        <Card padding="loose">
          <CardHeader
            title="Recent administrative actions"
            action={
              <Button variant="ghost" size="sm" to="/hiring/super-admin/audit">
                Audit log
              </Button>
            }
          />

          {logsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((n) => (
                <Skeleton key={n} className="h-12 w-full" rounded="md" />
              ))}
            </div>
          ) : logs?.logs?.length ? (
            <ul>
              {logs.logs.slice(0, 5).map((log: any, index: number) => (
                <li
                  key={index}
                  className="flex items-start gap-3.5 border-b border-hb-border py-3 last:border-0"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-hb-border bg-hb-surface-2 text-hb-cyan">
                    <ShieldCheck size={14} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    {/* `log.action` is a plain string column. It used to be
                        piped through `dangerouslySetInnerHTML`. */}
                    <p className="text-hb-sm text-hb-text">
                      <strong className="font-semibold">{log.actor}</strong>: {log.action}
                    </p>
                    <p className="mt-0.5 text-hb-xs text-hb-muted">
                      {log.client} · {log.time}
                    </p>
                  </div>
                  {log.type === 'impersonation' && <Badge tone="warning">Impersonation</Badge>}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<ShieldCheck />}
              title="No recent audit logs"
              description="Administrative actions will appear here as they happen."
            />
          )}
        </Card>
      </div>
    </div>
  )
}
