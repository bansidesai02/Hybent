import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import {
  Activity,
  Briefcase,
  Building2,
  CalendarDays,
  CreditCard,
  FileUp,
  Pause,
  Play,
  ShieldCheck,
  ToggleLeft,
  Trash2,
  TriangleAlert,
  UserCheck,
  Users,
} from 'lucide-react'

import { superAdminApi, type ClientMember } from '@/api/superAdmin'
import { useAuthStore } from '@/store/authStore'
import { beginSupportSession } from '@/utils/impersonation'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  type Column,
  ConfirmDialog,
  DataTable,
  Dialog,
  EmptyState,
  Input,
  Meter,
  PageHeader,
  Select,
  Skeleton,
  StatCard,
  StatGrid,
  Switch,
  TabPanel,
  Tabs,
} from '@/components/hb'
import { formatDate, formatDateTime, timeAgo } from '@/utils/formatters'
import LoginEventsTable from '../components/LoginEventsTable'

/**
 * One tenant: who is in it and when they last signed in, what it has hired
 * with, what happened in it recently, and the controls that can take it
 * offline.
 *
 * Fixed while moving to the /overview endpoint:
 * - Members came from GET /users, whose response is `{users, total}`; the page
 *   handed that object to the table as if it were the list, so the member
 *   table never showed anyone and "Impersonate" always said the organization
 *   was empty. Members were also matched by organization *name*, so two
 *   clients with the same name shared one list.
 * - "Interviews booked" read `interviews_count`, which the API never sent.
 * - The suspend/activate button keyed off the subscription status, so an
 *   active client with no plan ("pending") offered "Activate". It keys off
 *   whether the organization is active now.
 */

const FLAG_INFO: Record<string, { title: string; desc: string }> = {
  ai: { title: 'AI scoring engine', desc: 'AI screening and scoring of candidates.' },
  bulk: { title: 'Bulk candidate import', desc: 'Sheet upload parser support.' },
  analytics: { title: 'Report export', desc: 'Excel/CSV report downloads.' },
  copilot: { title: 'Hybent Copilot', desc: 'The AI recruiting assistant (page and floating widget).' },
  usage_logs: { title: 'AI usage history', desc: 'Consumption history log (model, tokens, credits) on the AI Credits page.' },
  ai_calls: { title: 'AI Calls (Hybent AI Agent)', desc: 'Phone pre-screens, availability checks and interview reminders.' },
}

type Tab = 'overview' | 'members' | 'activity' | 'logins' | 'imports' | 'settings'

/** Plan prices are USD (hybent.com/pricing). */
const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(val)

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super admin',
  admin: 'Admin',
  recruiter: 'Recruiter',
  interviewer: 'Interviewer',
  candidate: 'Candidate',
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user: currentLoggedUser } = useAuthStore()

  const [tab, setTab] = useState<Tab>('overview')
  const [impersonateTarget, setImpersonateTarget] = useState<ClientMember | null>(null)
  const [impersonateReason, setImpersonateReason] = useState('')
  const [allowChanges, setAllowChanges] = useState(false)
  const [confirmToggle, setConfirmToggle] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const {
    data: overview,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['super-admin', 'client-overview', id],
    queryFn: () => superAdminApi.getClientOverview(id!),
    enabled: !!id,
    retry: (count, err: any) => err?.response?.status !== 404 && count < 2,
  })

  const { data: flags, isLoading: flagsLoading } = useQuery({
    queryKey: ['super-admin', 'flags', id],
    queryFn: () => superAdminApi.getClientFlags(id!),
    enabled: !!id,
  })

  const { data: planFeatures } = useQuery({
    queryKey: ['super-admin', 'plan-features', id],
    queryFn: () => superAdminApi.getClientPlanFeatures(id!),
    enabled: !!id,
  })
  // Copilot on a plan without it (Standard): asked to confirm, then forced.
  const [forceCopilot, setForceCopilot] = useState(false)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['super-admin', 'client-overview', id] })
    queryClient.invalidateQueries({ queryKey: ['super-admin', 'clients'] })
    queryClient.invalidateQueries({ queryKey: ['super-admin', 'dashboard'] })
  }

  const updateFlagsMutation = useMutation({
    mutationFn: ({ flags: updatedFlags, force = false }: { flags: Record<string, boolean>; force?: boolean }) =>
      superAdminApi.updateClientFlags(id!, updatedFlags, force),
    onSuccess: (_res, vars) => {
      toast.success(vars.force ? 'Copilot force-enabled for this client' : 'Feature flag overrides updated')
      setForceCopilot(false)
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'flags', id] })
      invalidate()
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message || err.message || 'Failed to update feature flag overrides.'),
  })

  const isActive = overview?.organization.is_active ?? false

  const toggleStatusMutation = useMutation({
    mutationFn: () => (isActive ? superAdminApi.suspendClient(id!) : superAdminApi.activateClient(id!)),
    onSuccess: () => {
      toast.success(isActive ? 'Client suspended' : 'Client activated')
      invalidate()
      setConfirmToggle(false)
    },
    onError: (err: any) => toast.error(err.message || 'Failed to change client status.'),
  })

  const deleteClientMutation = useMutation({
    mutationFn: () => superAdminApi.deleteClient(id!),
    onSuccess: () => {
      toast.success('Client permanently deleted')
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'clients'] })
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'dashboard'] })
      navigate('/hiring/super-admin/clients')
    },
    onError: (err: any) => toast.error(err.message || 'Failed to delete client.'),
  })

  const closeImpersonate = () => {
    setImpersonateTarget(null)
    setImpersonateReason('')
    setAllowChanges(false)
  }

  const impersonateMutation = useMutation({
    mutationFn: ({ userId, reason, allow }: { userId: string; reason: string; allow: boolean }) =>
      superAdminApi.impersonateUser(userId, reason, allow),
    onSuccess: (data) => {
      if (!currentLoggedUser) return
      toast.success(data.session.allow_changes ? 'Support session started' : 'Support session started (view only)')
      beginSupportSession(data, currentLoggedUser, `/hiring/super-admin/clients/${id}`)
      closeImpersonate()
      queryClient.clear()

      if (data.user.role === 'admin') navigate('/hiring/admin')
      else if (data.user.role === 'interviewer') navigate('/hiring/interviewer')
      else if (data.user.role === 'candidate') navigate('/hiring/portal')
      else navigate('/hiring/recruiter')
    },
    onError: (err: any) => toast.error(err.response?.data?.message || err.message || 'Could not start the support session.'),
  })

  /** Who can be impersonated: active, and never another super admin (the API refuses both). */
  const impersonatable = useMemo(
    () => (overview?.members ?? []).filter((m) => m.is_active && m.role !== 'super_admin'),
    [overview],
  )

  if (isLoading) {
    return (
      <div className="pb-hb-10">
        <Skeleton className="mb-hb-6 h-12 w-72" rounded="md" />
        <Skeleton className="mb-hb-5 h-32 w-full" rounded="md" />
        <Skeleton className="h-[320px] w-full" rounded="md" />
      </div>
    )
  }

  if (isError || !overview) {
    const notFound = (error as any)?.response?.status === 404
    return (
      <div className="pb-hb-10">
        <Card padding="none">
          <EmptyState
            icon={<Building2 />}
            title={notFound ? 'Client not found' : 'Could not load this client'}
            description={
              notFound
                ? 'This tenant may have been deleted, or the link is out of date.'
                : 'The server did not respond as expected. Try again in a moment.'
            }
            size="page"
            action={
              notFound
                ? { label: 'Back to clients', onClick: () => navigate('/hiring/super-admin/clients') }
                : { label: 'Retry', onClick: () => refetch() }
            }
          />
        </Card>
      </div>
    )
  }

  const { organization: org, subscription, hiring, member_counts: counts } = overview
  const protectedOrg = org.is_platform_org

  const memberColumns: Array<Column<ClientMember>> = [
    {
      key: 'user',
      header: 'Member',
      cardTitle: true,
      cell: (u) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <Avatar name={u.full_name} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-hb-sm font-semibold text-hb-text">{u.full_name}</span>
            <span className="block truncate text-hb-xs text-hb-muted">{u.email}</span>
          </span>
        </span>
      ),
    },
    { key: 'role', header: 'Role', width: '130px', cell: (u) => <Badge>{ROLE_LABEL[u.role] ?? u.role}</Badge> },
    {
      key: 'status',
      header: 'Status',
      width: '110px',
      cell: (u) => <Badge tone={u.is_active ? 'success' : 'error'}>{u.is_active ? 'Active' : 'Suspended'}</Badge>,
    },
    {
      key: 'last_login',
      header: 'Last sign-in',
      width: '170px',
      cell: (u) =>
        u.last_login ? (
          <span className="text-hb-sm text-hb-text" title={formatDateTime(u.last_login)}>
            {timeAgo(u.last_login)}
          </span>
        ) : (
          <span className="text-hb-sm text-hb-dim">Never</span>
        ),
    },
    {
      key: 'created_at',
      header: 'Joined',
      width: '120px',
      cell: (u) => <span className="text-hb-sm text-hb-muted">{formatDate(u.created_at)}</span>,
    },
    {
      key: 'actions',
      header: '',
      width: '130px',
      align: 'right',
      hideOnCard: true,
      cell: (u) =>
        u.is_active && u.role !== 'super_admin' ? (
          <Button size="sm" variant="ghost" onClick={() => setImpersonateTarget(u)}>
            Impersonate
          </Button>
        ) : null,
    },
  ]

  const failedImports = overview.imports.filter((b) => b.failed_count > 0).length

  return (
    <div className="pb-hb-10">
      <PageHeader
        breadcrumbs={[{ label: 'Clients', to: '/hiring/super-admin/clients' }, { label: org.name }]}
        eyebrow={`${org.slug}.hybent.com`}
        title={org.name}
        description={[org.industry, org.size && `${org.size} employees`, `Created ${formatDate(org.created_at)}`]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <>
            <Badge tone={isActive ? 'success' : 'error'}>{isActive ? 'Active' : 'Suspended'}</Badge>
            <Button
              variant="ghost"
              icon={<UserCheck size={15} />}
              onClick={() => {
                if (impersonatable.length > 0) setImpersonateTarget(impersonatable[0])
                else toast.error('No active member in this organisation can be impersonated.')
              }}
            >
              Impersonate
            </Button>
          </>
        }
      />

      <Tabs<Tab>
        aria-label="Client sections"
        value={tab}
        onChange={setTab}
        className="mb-hb-5"
        items={[
          { value: 'overview', label: 'Overview' },
          { value: 'members', label: 'Members', count: overview.members.length },
          { value: 'activity', label: 'Activity' },
          { value: 'logins', label: 'Sign-ins' },
          { value: 'imports', label: 'Imports', count: overview.imports.length },
          { value: 'settings', label: 'Settings' },
        ]}
      />

      <TabPanel value="overview" active={tab === 'overview'}>
        <div className="space-y-hb-5">
          <StatGrid>
            <StatCard
              label="Members"
              value={
                <>
                  {overview.members.length}
                  {subscription && <span className="text-hb-body text-hb-dim"> / {subscription.seats_limit} seats</span>}
                </>
              }
              icon={<Users />}
            />
            <StatCard
              label="Jobs"
              value={
                <>
                  {hiring.jobs}
                  <span className="text-hb-body text-hb-dim"> ({hiring.open_jobs} open)</span>
                </>
              }
              icon={<Briefcase />}
            />
            <StatCard label="Interviews" value={hiring.interviews} icon={<CalendarDays />} />
            <StatCard
              label="MRR contribution"
              value={subscription ? formatCurrency(subscription.mrr) : '—'}
              icon={<CreditCard />}
            />
          </StatGrid>

          <div className="grid gap-hb-5 lg:grid-cols-2">
            <Card padding="loose">
              <CardHeader title="Members" subtitle="Account status and sign-in coverage." />
              <dl className="grid grid-cols-3 gap-2.5">
                <Fact label="Active" value={counts.active} />
                <Fact label="Suspended" value={counts.suspended} alarming={counts.suspended > 0} />
                <Fact label="Never signed in" value={counts.never_signed_in} />
              </dl>
              <dl className="mt-hb-4 grid grid-cols-2 gap-2.5">
                <Fact label="Last sign-in" value={overview.last_login ? timeAgo(overview.last_login) : 'Never'} />
                <Fact
                  label="Last recorded activity"
                  value={overview.last_activity_at ? timeAgo(overview.last_activity_at) : 'None recorded'}
                />
              </dl>
            </Card>

            <Card padding="loose">
              <CardHeader title="Hiring data" subtitle="Excludes deleted jobs and candidates." />
              <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                <Fact label="Candidates" value={hiring.candidates} />
                <Fact label="New candidates (30d)" value={hiring.candidates_30d} />
                <Fact label="Applications" value={hiring.applications} />
                <Fact label="Interviews (30d)" value={hiring.interviews_30d} />
                <Fact label="Imports with failures" value={failedImports} alarming={failedImports > 0} />
              </dl>
            </Card>
          </div>

          <Card padding="loose">
            <CardHeader title="Subscription" />
            {subscription ? (
              <>
                <dl className="mb-hb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <Fact label="Plan" value={subscription.plan} />
                  <Fact label="Status" value={subscription.status} />
                  <Fact label="Trial ends" value={subscription.trial_end ? formatDate(subscription.trial_end) : '—'} />
                  <Fact
                    label="Period ends"
                    value={subscription.current_period_end ? formatDate(subscription.current_period_end) : '—'}
                  />
                </dl>
                <div className="grid gap-hb-4 sm:grid-cols-2">
                  <Meter
                    value={overview.members.filter((m) => m.is_active && ['admin', 'recruiter'].includes(m.role)).length}
                    max={subscription.seats_limit}
                    tone="auto"
                    label="Paid seats (active admins + recruiters)"
                  />
                  <Meter value={hiring.jobs} max={subscription.max_jobs} tone="auto" label="Jobs vs plan limit" />
                </div>
              </>
            ) : (
              <p className="text-hb-sm text-hb-muted">No subscription on record for this client.</p>
            )}
          </Card>
        </div>
      </TabPanel>

      <TabPanel value="members" active={tab === 'members'}>
        <Card padding="none">
          <DataTable
            columns={memberColumns}
            rows={overview.members}
            rowKey={(u) => u.id}
            caption={`Members of ${org.name}`}
            empty={{
              icon: <Users />,
              title: 'No members in this organisation',
              description: 'Invite an administrator to get the tenant started.',
            }}
          />
        </Card>
        <p className="mt-hb-3 text-hb-xs text-hb-muted">
          To suspend a member or reset their password, use{' '}
          <button
            type="button"
            className="font-semibold text-hb-cyan underline-offset-2 hover:underline"
            onClick={() => navigate(`/hiring/super-admin/users?organization_id=${org.id}`)}
          >
            Users
          </button>
          .
        </p>
      </TabPanel>

      <TabPanel value="activity" active={tab === 'activity'}>
        <Card padding="none">
          <DataTable
            columns={[
              {
                key: 'action',
                header: 'Action',
                cardTitle: true,
                cell: (a) => (
                  <span className="text-hb-sm text-hb-text">
                    {a.action} <span className="text-hb-muted">· {a.resource_type}</span>
                  </span>
                ),
              },
              {
                key: 'actor',
                header: 'By',
                width: '220px',
                cell: (a) => (
                  <span className="min-w-0 text-hb-muted">
                    <span className="block truncate">{a.actor ?? 'System'}</span>
                    {a.impersonated_by && (
                      <span className="block truncate text-hb-xs text-hb-warning">
                        via support session by {a.impersonated_by}
                      </span>
                    )}
                  </span>
                ),
              },
              {
                key: 'when',
                header: 'When',
                width: '190px',
                cell: (a) => <span className="font-mono text-hb-xs text-hb-muted">{formatDateTime(a.created_at)}</span>,
              },
            ]}
            rows={overview.activity}
            rowKey={(a) => a.id}
            caption={`Recent activity in ${org.name}`}
            empty={{
              icon: <Activity />,
              title: 'No activity recorded',
              description: "Actions inside this organization's workspace appear here as they happen.",
            }}
          />
        </Card>
        <p className="mt-hb-3 text-hb-xs text-hb-muted">The 50 most recent actions from the organization's own activity log.</p>
      </TabPanel>

      <TabPanel value="logins" active={tab === 'logins'}>
        <Card padding="none">
          <LoginEventsTable events={overview.logins} caption={`Sign-in attempts for ${org.name}`} />
        </Card>
        <p className="mt-hb-3 text-hb-xs text-hb-muted">The 50 most recent attempts by this organization's members.</p>
      </TabPanel>

      <TabPanel value="imports" active={tab === 'imports'}>
        <Card padding="none">
          <DataTable
            columns={[
              {
                key: 'file',
                header: 'File',
                cardTitle: true,
                cell: (b) => <span className="truncate text-hb-sm font-semibold text-hb-text">{b.file_name}</span>,
              },
              { key: 'status', header: 'Status', width: '120px', cell: (b) => <Badge>{b.status}</Badge> },
              {
                key: 'rows',
                header: 'Rows',
                width: '260px',
                cell: (b) => (
                  <span className="text-hb-sm text-hb-muted">
                    {b.success_count} added · {b.duplicate_count} duplicate ·{' '}
                    <span className={b.failed_count > 0 ? 'font-semibold text-hb-error' : undefined}>
                      {b.failed_count} failed
                    </span>{' '}
                    of {b.total_rows}
                  </span>
                ),
              },
              {
                key: 'when',
                header: 'When',
                width: '190px',
                cell: (b) => <span className="font-mono text-hb-xs text-hb-muted">{formatDateTime(b.created_at)}</span>,
              },
            ]}
            rows={overview.imports}
            rowKey={(b) => b.id}
            caption={`Bulk imports for ${org.name}`}
            empty={{ icon: <FileUp />, title: 'No bulk imports', description: 'Spreadsheet imports appear here.' }}
          />
        </Card>
      </TabPanel>

      <TabPanel value="settings" active={tab === 'settings'}>
        <div className="grid gap-hb-5 lg:grid-cols-2">
          <Card padding="loose">
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <ToggleLeft size={17} aria-hidden className="text-hb-cyan" />
                  Feature overrides
                </span>
              }
              subtitle="Applies to this client only."
            />

            {flagsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((n) => (
                  <Skeleton key={n} className="h-8 w-full" rounded="md" />
                ))}
              </div>
            ) : flags ? (
              <div className="divide-y divide-hb-border">
                {/* AI Calls is always offered: it's off until switched on per client. */}
                {Object.entries({ ai_calls: false, ...flags }).map(([key, val]) => {
                  const info = FLAG_INFO[key] ?? { title: key, desc: 'Platform toggle override.' }
                  const all = { ai_calls: false, ...flags } as Record<string, boolean>
                  // The Copilot is Pro-only: on Standard it's switched on only by force.
                  const lockedCopilot = key === 'copilot' && planFeatures?.copilot_in_plan === false
                  return (
                    <div key={key} className="py-3.5 first:pt-0 last:pb-0">
                      <Switch
                        label={
                          lockedCopilot ? (
                            <span className="inline-flex flex-wrap items-center gap-2">
                              {info.title}
                              <Badge tone="brand">Pro feature</Badge>
                              {val && <Badge tone="warning">Forced on</Badge>}
                            </span>
                          ) : info.title
                        }
                        description={
                          lockedCopilot
                            ? `${info.desc} Not in the ${planFeatures?.plan_name ?? 'current'} plan${val ? '; turned on by force.' : '. Turning it on needs a force-enable.'}`
                            : info.desc
                        }
                        checked={Boolean(val)}
                        disabled={updateFlagsMutation.isPending}
                        onChange={(next) => {
                          if (lockedCopilot && next) {
                            setForceCopilot(true)
                            return
                          }
                          updateFlagsMutation.mutate({ flags: { ...all, [key]: next } })
                        }}
                      />
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState
                icon={<ToggleLeft />}
                title="No feature flags"
                description="This tenant inherits every platform default."
              />
            )}
          </Card>

          <Card padding="loose" className="border-hb-error/25 bg-hb-error/[0.04]">
            <h3 className="mb-2 inline-flex items-center gap-2 font-display text-hb-h3 text-hb-error">
              <TriangleAlert size={17} aria-hidden />
              Danger zone
            </h3>
            {protectedOrg ? (
              <p className="text-hb-xs leading-relaxed text-hb-muted">
                This organization holds super admin accounts, so it can't be suspended or deleted.
              </p>
            ) : (
              <>
                <p className="mb-hb-4 text-hb-xs leading-relaxed text-hb-muted">
                  Suspension blocks every sign-in for this tenant and ends their sessions. Deletion removes the
                  organisation and all of its data, and cannot be undone.
                </p>
                <div className="flex flex-wrap gap-2.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={isActive ? <Pause size={14} /> : <Play size={14} />}
                    onClick={() => setConfirmToggle(true)}
                    className="flex-1"
                  >
                    {isActive ? 'Suspend' : 'Activate'}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<Trash2 size={14} />}
                    onClick={() => setConfirmDelete(true)}
                    className="flex-1"
                  >
                    Delete
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      </TabPanel>

      {/* ── Impersonation ─────────────────────────────────────────────────── */}
      <Dialog
        open={!!impersonateTarget}
        onClose={closeImpersonate}
        title="Start a support session"
        description="You'll see the workspace exactly as this person does, for 30 minutes at most."
        size="md"
        closeOnOverlayClick={false}
        footer={
          <>
            <Button variant="quiet" size="sm" onClick={closeImpersonate} disabled={impersonateMutation.isPending}>
              Cancel
            </Button>
            <Button
              size="sm"
              icon={<UserCheck size={14} />}
              loading={impersonateMutation.isPending}
              onClick={() => {
                if (!impersonateReason.trim()) {
                  toast.error('A reason is required to start an impersonation session.')
                  return
                }
                impersonateMutation.mutate({
                  userId: impersonateTarget!.id,
                  reason: impersonateReason.trim(),
                  allow: allowChanges,
                })
              }}
            >
              Start session
            </Button>
          </>
        }
      >
        {impersonateTarget && (
          <div className="space-y-hb-4">
            <div className="flex items-center gap-3 rounded-hb-md border border-hb-border bg-hb-surface-2 p-3.5">
              <Avatar name={impersonateTarget.full_name} size="md" />
              <div className="min-w-0">
                <p className="truncate text-hb-sm font-semibold text-hb-text">{impersonateTarget.full_name}</p>
                <p className="truncate text-hb-xs text-hb-muted">
                  {impersonateTarget.email} · {ROLE_LABEL[impersonateTarget.role] ?? impersonateTarget.role}
                </p>
              </div>
            </div>

            <Switch
              label="Allow changes"
              description={
                allowChanges
                  ? "You can edit this organization's data as this person. Every change is recorded in the audit log under your name."
                  : 'View only: you can look around, but nothing can be changed. Recommended unless the fix needs an edit.'
              }
              checked={allowChanges}
              onChange={setAllowChanges}
            />

            <p className="flex items-start gap-2 rounded-hb-md border border-hb-warning/25 bg-hb-warning/8 p-3.5 text-hb-xs text-hb-text">
              <ShieldCheck size={15} aria-hidden className="mt-0.5 shrink-0 text-hb-warning" />
              The session, its reason and when it ends are recorded under your account. It ends when you click
              End session, after 30 minutes, or when another super admin ends it.
            </p>

            {impersonatable.length > 1 && (
              <Select
                label="Target user"
                value={impersonateTarget.id}
                onChange={(e) => {
                  const u = impersonatable.find((x) => x.id === e.target.value)
                  if (u) setImpersonateTarget(u)
                }}
                options={impersonatable.map((u) => ({
                  value: u.id,
                  label: `${u.full_name} (${ROLE_LABEL[u.role] ?? u.role} · ${u.email})`,
                }))}
              />
            )}

            <Input
              label="Reason"
              required
              value={impersonateReason}
              onChange={(e) => setImpersonateReason(e.target.value)}
              placeholder="e.g. Debugging the scoring engine on the candidate panel"
            />
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={forceCopilot}
        onClose={() => setForceCopilot(false)}
        onConfirm={() =>
          flags && updateFlagsMutation.mutate({ flags: { ai_calls: false, ...flags, copilot: true }, force: true })
        }
        title="Force-enable the Copilot?"
        description={`The Copilot is a Pro feature and ${org?.name ?? 'this client'} is on the ${planFeatures?.plan_name ?? 'Standard'} plan. Turning it on gives them a Pro feature without the Pro plan. Their Copilot use still spends their AI credits. This is recorded in the audit log.`}
        confirmLabel="Force-enable Copilot"
        loading={updateFlagsMutation.isPending}
      />

      <ConfirmDialog
        open={confirmToggle}
        onClose={() => setConfirmToggle(false)}
        onConfirm={() => toggleStatusMutation.mutate()}
        title={isActive ? 'Suspend this client?' : 'Activate this client?'}
        description={
          isActive
            ? `${org.name} will be blocked from signing in and signed out until you reactivate them. Their data is untouched.`
            : `${org.name} will regain access to the platform immediately.`
        }
        confirmLabel={isActive ? 'Suspend' : 'Activate'}
        destructive={isActive}
        loading={toggleStatusMutation.isPending}
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => deleteClientMutation.mutate()}
        title={`Permanently delete ${org.name}?`}
        description="This removes the organisation and every user, job, candidate, interview and offer inside it. It cannot be undone."
        confirmLabel="Delete permanently"
        destructive
        loading={deleteClientMutation.isPending}
      />
    </div>
  )
}

function Fact({ label, value, alarming }: { label: string; value: React.ReactNode; alarming?: boolean }) {
  return (
    <div
      className={`rounded-hb-md border p-3 ${
        alarming ? 'border-hb-error/25 bg-hb-error/8' : 'border-hb-border bg-hb-surface-2'
      }`}
    >
      <dt className="font-mono text-hb-label uppercase text-hb-dim">{label}</dt>
      <dd className={`mt-1 text-hb-body font-semibold ${alarming ? 'text-hb-error' : 'text-hb-text'}`}>{value}</dd>
    </div>
  )
}
