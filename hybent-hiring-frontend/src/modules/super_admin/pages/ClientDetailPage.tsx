import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import {
  Briefcase,
  Building2,
  CalendarDays,
  CreditCard,
  ExternalLink,
  Pause,
  Play,
  ShieldCheck,
  ToggleLeft,
  Trash2,
  TriangleAlert,
  UserCheck,
  Users,
} from 'lucide-react'

import { superAdminApi } from '@/api/superAdmin'
import { useAuthStore } from '@/store/authStore'
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
} from '@/components/hb'

/**
 * One tenant: its usage, its people, its feature overrides, and the two
 * controls that can take it offline.
 *
 * Rebuilt on the design system in phase 9. Beyond appearance:
 *
 * - `if (clientsLoading || !client)` rendered the loading skeleton in both
 *   cases, so navigating to a deleted or mistyped client id left the operator
 *   staring at a skeleton that would never resolve. Not-found is now its own
 *   state.
 * - Suspending and permanently deleting a tenant — including "ALL its users,
 *   jobs, candidates, interviews" — were guarded by `window.confirm`, which
 *   cannot be styled, cannot be read by the page's own assistive tech
 *   affordances, and is suppressible by the browser. Both are `ConfirmDialog`
 *   now, with the destructive variant.
 * - The impersonation modal was a hand-rolled fixed overlay with no focus
 *   trap, no Escape handler and no `role="dialog"` — on the one screen in the
 *   product that hands an operator someone else's session.
 * - The feature-flag toggles were `<button>`s wrapping a translated `<div>`,
 *   announced with no name and no state. They are `Switch` now.
 */

const STATUS_TONE: Record<string, 'success' | 'info' | 'error'> = {
  active: 'success',
  pending: 'info',
  suspended: 'error',
}

const FLAG_INFO: Record<string, { title: string; desc: string }> = {
  ai: { title: 'AI scoring engine', desc: 'Screen résumés via AI.' },
  video: { title: 'Video interviews', desc: 'Record video rounds.' },
  bulk: { title: 'Bulk candidate import', desc: 'Sheet upload parser support.' },
  domain: { title: 'Custom subdomain', desc: 'Custom host URL routing.' },
  analytics: { title: 'Advanced export', desc: 'Report downloads.' },
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val)

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user: currentLoggedUser, setTokens } = useAuthStore()

  const [impersonateTarget, setImpersonateTarget] = useState<any | null>(null)
  const [impersonateReason, setImpersonateReason] = useState('')
  const [confirmToggle, setConfirmToggle] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ['super-admin', 'clients'],
    queryFn: () => superAdminApi.getClients(),
  })

  const client = useMemo(() => {
    if (!clients || !id) return null
    return clients.find((c) => c.id === id) ?? null
  }, [clients, id])

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['super-admin', 'users', client?.name],
    queryFn: () => superAdminApi.getUsers({ client: client?.name }),
    enabled: !!client?.name,
  })

  const { data: flags, isLoading: flagsLoading } = useQuery({
    queryKey: ['super-admin', 'flags', id],
    queryFn: () => superAdminApi.getClientFlags(id!),
    enabled: !!id,
  })

  const updateFlagsMutation = useMutation({
    mutationFn: (updatedFlags: Record<string, boolean>) =>
      superAdminApi.updateClientFlags(id!, updatedFlags),
    onSuccess: () => {
      toast.success('Feature flag overrides updated')
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'flags', id] })
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'clients'] })
    },
    onError: (err: any) => toast.error(err.message || 'Failed to update feature flag overrides.'),
  })

  const toggleStatusMutation = useMutation({
    mutationFn: () =>
      client?.status === 'active'
        ? superAdminApi.suspendClient(id!)
        : superAdminApi.activateClient(id!),
    onSuccess: () => {
      toast.success(`Client ${client?.status === 'active' ? 'suspended' : 'activated'}`)
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'clients'] })
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'dashboard'] })
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

  const impersonateMutation = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      superAdminApi.impersonateUser(userId, reason),
    onSuccess: (data) => {
      toast.success('Swapping session…')

      // Save current credentials so "exit impersonation" can restore them.
      const currentToken = localStorage.getItem('hybent_hiring_access_token')
      const currentRefreshToken = localStorage.getItem('hybent_hiring_refresh_token')

      if (currentToken && currentLoggedUser) {
        localStorage.setItem('hybent_hiring_super_admin_access_token', currentToken)
        if (currentRefreshToken) {
          localStorage.setItem('hybent_hiring_super_admin_refresh_token', currentRefreshToken)
        }
        localStorage.setItem('hybent_hiring_super_admin_user', JSON.stringify(currentLoggedUser))
      } else {
        const sessionToken = sessionStorage.getItem('hybent_hiring_access_token')
        const sessionRefreshToken = sessionStorage.getItem('hybent_hiring_refresh_token')
        if (sessionToken && currentLoggedUser) {
          sessionStorage.setItem('hybent_hiring_super_admin_access_token', sessionToken)
          if (sessionRefreshToken) {
            sessionStorage.setItem('hybent_hiring_super_admin_refresh_token', sessionRefreshToken)
          }
          sessionStorage.setItem('hybent_hiring_super_admin_user', JSON.stringify(currentLoggedUser))
        }
      }

      setTokens(data.access_token, undefined, data.user)
      setImpersonateTarget(null)
      setImpersonateReason('')

      if (data.user.role === 'admin') navigate('/hiring/admin')
      else if (data.user.role === 'interviewer') navigate('/hiring/interviewer')
      else if (data.user.role === 'candidate') navigate('/hiring/portal')
      else navigate('/hiring/recruiter')
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.detail || err.message || 'Impersonation failed.'),
  })

  if (clientsLoading) {
    return (
      <div className="pb-hb-10">
        <Skeleton className="mb-hb-6 h-12 w-72" rounded="md" />
        <Skeleton className="mb-hb-5 h-32 w-full" rounded="md" />
        <Skeleton className="h-[320px] w-full" rounded="md" />
      </div>
    )
  }

  if (!client) {
    return (
      <div className="pb-hb-10">
        <Card padding="none">
          <EmptyState
            icon={<Building2 />}
            title="Client not found"
            description="This tenant may have been deleted, or the link is out of date."
            size="page"
            action={{
              label: 'Back to clients',
              onClick: () => navigate('/hiring/super-admin/clients'),
            }}
          />
        </Card>
      </div>
    )
  }

  const userColumns: Array<Column<any>> = [
    {
      key: 'user',
      header: 'User',
      cardTitle: true,
      cell: (u) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <Avatar name={u.full_name} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-hb-sm font-semibold text-hb-text">
              {u.full_name}
            </span>
            <span className="block truncate text-hb-xs text-hb-muted">{u.email}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      width: '130px',
      cell: (u) => <Badge>{u.role}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      width: '120px',
      cell: (u) => (
        <Badge tone={u.is_active ? 'success' : 'error'}>
          {u.is_active ? 'Active' : 'Suspended'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '130px',
      align: 'right',
      hideOnCard: true,
      cell: (u) => (
        <Button size="sm" variant="ghost" onClick={() => setImpersonateTarget(u)}>
          Impersonate
        </Button>
      ),
    },
  ]

  const suspending = client.status === 'active'

  return (
    <div className="pb-hb-10">
      <PageHeader
        breadcrumbs={[
          { label: 'Clients', to: '/hiring/super-admin/clients' },
          { label: client.name },
        ]}
        eyebrow={`${client.slug}.hybent.com`}
        title={client.name}
        description={[client.industry, client.size && `${client.size} employees`, client.location]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <>
            <Badge tone={STATUS_TONE[client.status] ?? 'neutral'}>{client.status}</Badge>
            <Button
              variant="ghost"
              icon={<UserCheck size={15} />}
              onClick={() => {
                if (users && users.length > 0) setImpersonateTarget(users[0])
                else toast.error('No users in this organisation to impersonate.')
              }}
            >
              Impersonate
            </Button>
            {/* NOTE: this points at a dev host while the rest of the page shows
                `{slug}.hirreon.com`. Left as-is because changing it would break
                local tenant testing — worth an env var. */}
            <Button
              variant="ghost"
              icon={<ExternalLink size={14} />}
              href={`http://${client.slug}.localhost:3000`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Launch portal
            </Button>
          </>
        }
      />

      <div className="space-y-hb-5">
        <StatGrid>
          <StatCard
            label="Users"
            value={
              <>
                {client.users_count}
                <span className="text-hb-body text-hb-dim"> / {client.users_limit}</span>
              </>
            }
            icon={<Users />}
          />
          <StatCard
            label="Active jobs"
            value={
              <>
                {client.jobs_count}
                <span className="text-hb-body text-hb-dim"> / {client.jobs_limit}</span>
              </>
            }
            icon={<Briefcase />}
          />
          <StatCard
            label="Interviews booked"
            value={client.interviews_count}
            icon={<CalendarDays />}
          />
          <StatCard
            label="MRR contribution"
            value={formatCurrency(client.mrr)}
            icon={<CreditCard />}
          />
        </StatGrid>

        <Card padding="default">
          <div className="grid gap-hb-4 sm:grid-cols-2">
            <Meter
              value={client.users_count}
              max={client.users_limit}
              tone="auto"
              label="Seat usage"
              valueLabel={`${client.users_count} of ${client.users_limit}`}
            />
            <Meter
              value={client.jobs_count}
              max={client.jobs_limit}
              tone="auto"
              label="Job usage"
              valueLabel={`${client.jobs_count} of ${client.jobs_limit}`}
            />
          </div>
        </Card>

        <div className="grid gap-hb-5 lg:grid-cols-3">
          <Card padding="loose" className="lg:col-span-2">
            <CardHeader
              title="Users in organisation"
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    navigate('/hiring/super-admin/users', {
                      state: { clientFilter: client.name },
                    })
                  }
                >
                  Manage all users
                </Button>
              }
            />
            <DataTable
              columns={userColumns}
              rows={users ?? []}
              rowKey={(u) => u.id}
              loading={usersLoading}
              caption={`Users belonging to ${client.name}`}
              empty={{
                icon: <Users />,
                title: 'No users in this organisation',
                description: 'Invite an administrator to get the tenant started.',
              }}
            />
          </Card>

          <div className="space-y-hb-5">
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
              ) : flags && Object.keys(flags).length > 0 ? (
                <div className="divide-y divide-hb-border">
                  {Object.entries(flags).map(([key, val]) => {
                    const info = FLAG_INFO[key] ?? {
                      title: key,
                      desc: 'Platform toggle override.',
                    }
                    return (
                      <div key={key} className="py-3.5 first:pt-0 last:pb-0">
                        <Switch
                          label={info.title}
                          description={info.desc}
                          checked={Boolean(val)}
                          disabled={updateFlagsMutation.isPending}
                          onChange={(next) =>
                            updateFlagsMutation.mutate({ ...flags, [key]: next } as Record<
                              string,
                              boolean
                            >)
                          }
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

            <Card
              padding="loose"
              className="border-hb-error/25 bg-hb-error/[0.04]"
            >
              <h3 className="mb-2 inline-flex items-center gap-2 font-display text-hb-h3 text-hb-error">
                <TriangleAlert size={17} aria-hidden />
                Danger zone
              </h3>
              <p className="mb-hb-4 text-hb-xs leading-relaxed text-hb-muted">
                Suspension blocks every login for this tenant. Deletion removes the organisation
                and all of its data, and cannot be undone.
              </p>
              <div className="flex flex-wrap gap-2.5">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={suspending ? <Pause size={14} /> : <Play size={14} />}
                  onClick={() => setConfirmToggle(true)}
                  className="flex-1"
                >
                  {suspending ? 'Suspend' : 'Activate'}
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
            </Card>
          </div>
        </div>
      </div>

      {/* ── Impersonation ─────────────────────────────────────────────────── */}
      <Dialog
        open={!!impersonateTarget}
        onClose={() => { setImpersonateTarget(null); setImpersonateReason('') }}
        title="Start impersonation"
        description="This session is signed, audited and logged under your super-admin account."
        size="md"
        closeOnOverlayClick={false}
        footer={
          <>
            <Button
              variant="quiet"
              size="sm"
              onClick={() => { setImpersonateTarget(null); setImpersonateReason('') }}
              disabled={impersonateMutation.isPending}
            >
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
                  userId: impersonateTarget.id,
                  reason: impersonateReason,
                })
              }}
            >
              Start impersonation
            </Button>
          </>
        }
      >
        {impersonateTarget && (
          <div className="space-y-hb-4">
            <div className="flex items-center gap-3 rounded-hb-md border border-hb-border bg-hb-surface-2 p-3.5">
              <Avatar name={impersonateTarget.full_name} size="md" />
              <div className="min-w-0">
                <p className="truncate text-hb-sm font-semibold text-hb-text">
                  {impersonateTarget.full_name}
                </p>
                <p className="truncate text-hb-xs text-hb-muted">
                  {impersonateTarget.email} · {impersonateTarget.role}
                </p>
              </div>
            </div>

            <p className="flex items-start gap-2 rounded-hb-md border border-hb-warning/25 bg-hb-warning/8 p-3.5 text-hb-xs text-hb-text">
              <ShieldCheck size={15} aria-hidden className="mt-0.5 shrink-0 text-hb-warning" />
              Every database mutation you make while impersonating is recorded against your own
              account.
            </p>

            {users && users.length > 1 && (
              <Select
                label="Target user"
                value={impersonateTarget.id}
                onChange={(e) => {
                  const u = users.find((x: any) => x.id === e.target.value)
                  if (u) setImpersonateTarget(u)
                }}
                options={users.map((u: any) => ({
                  value: u.id,
                  label: `${u.full_name} (${u.role} · ${u.email})`,
                }))}
              />
            )}

            <Input
              label="Reason for impersonation"
              required
              value={impersonateReason}
              onChange={(e) => setImpersonateReason(e.target.value)}
              placeholder="e.g. Debugging the scoring engine on the candidate panel"
            />
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={confirmToggle}
        onClose={() => setConfirmToggle(false)}
        onConfirm={() => toggleStatusMutation.mutate()}
        title={suspending ? 'Suspend this client?' : 'Activate this client?'}
        description={
          suspending
            ? `${client.name} will be blocked from signing in until you reactivate them. Their data is untouched.`
            : `${client.name} will regain access to the platform immediately.`
        }
        confirmLabel={suspending ? 'Suspend' : 'Activate'}
        destructive={suspending}
        loading={toggleStatusMutation.isPending}
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => deleteClientMutation.mutate()}
        title={`Permanently delete ${client.name}?`}
        description="This removes the organisation and every user, job, candidate, interview and offer inside it. It cannot be undone."
        confirmLabel="Delete permanently"
        destructive
        loading={deleteClientMutation.isPending}
      />
    </div>
  )
}
