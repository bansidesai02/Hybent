import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocation, useSearchParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { History, Key, MoreHorizontal, Pause, Pencil, Play, Send, UserPlus, Users } from 'lucide-react'

import api from '@/api/axios'
import { superAdminApi, type UserDirectoryParams } from '@/api/superAdmin'
import { useDebounce } from '@/components/chatbot/useDebounce'
import {
  Avatar,
  Badge,
  Button,
  Input,
  Card,
  type Column,
  ConfirmDialog,
  ContextMenu,
  DataTable,
  Dialog,
  PageHeader,
  Pagination,
  Select,
  type SortDirection,
  Toolbar,
  ToolbarSearch,
  ToolbarFilters,
} from '@/components/hb'
import { formatDate, formatDateTime, timeAgo } from '@/utils/formatters'
import ExportButton from '../components/ExportButton'
import LoginEventsTable from '../components/LoginEventsTable'

/**
 * Every account on the platform, across every tenant.
 *
 * Search, filters and sorting all run on the server, over the whole
 * directory (the search box used to filter only the 50 rows on screen).
 * Tenants are filtered by id, not by name, so two clients with the same name
 * no longer merge. "Sign-in history" shows the account's recorded attempts.
 */

const ROLE_OPTIONS = [
  { value: 'all', label: 'All roles' },
  { value: 'admin', label: 'Admin' },
  { value: 'recruiter', label: 'HR / Recruiter' },
  { value: 'interviewer', label: 'Interviewer' },
  { value: 'candidate', label: 'Candidate' },
  { value: 'super_admin', label: 'Super admin' },
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'Any status' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
]

const LAST_LOGIN_OPTIONS = [
  { value: 'all', label: 'Any last sign-in' },
  { value: '7d', label: 'Signed in, last 7 days' },
  { value: '30d', label: 'Signed in, last 30 days' },
  { value: 'stale_30d', label: 'Not signed in for 30+ days' },
  { value: 'never', label: 'Never signed in' },
]

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super admin',
  admin: 'Admin',
  recruiter: 'Recruiter',
  interviewer: 'Interviewer',
  candidate: 'Candidate',
}

const PAGE_SIZE = 50

type SortKey = NonNullable<UserDirectoryParams['sort']>

const TEAM_ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'recruiter', label: 'HR / Recruiter' },
  { value: 'interviewer', label: 'Interviewer' },
]
const isTeamRole = (role: string) => TEAM_ROLES.some((r) => r.value === role)

export default function UsersPage() {
  const queryClient = useQueryClient()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  const [filterRole, setFilterRole] = useState('all')
  const [filterClient, setFilterClient] = useState(searchParams.get('organization_id') ?? 'all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'suspended'>('all')
  const [filterLogin, setFilterLogin] = useState<NonNullable<UserDirectoryParams['last_login']>>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sort, setSort] = useState<{ key: string; direction: SortDirection }>({ key: 'created_at', direction: 'desc' })
  const [page, setPage] = useState(1)
  const [menu, setMenu] = useState<{ at: { x: number; y: number }; user: any } | null>(null)
  const [confirmStatus, setConfirmStatus] = useState<any | null>(null)
  const [confirmReset, setConfirmReset] = useState<any | null>(null)
  const [historyFor, setHistoryFor] = useState<any | null>(null)
  /* Add (no id) or edit (id) an account. */
  const [form, setForm] = useState<{ id?: string; organization_id: string; full_name: string; email: string; role: string; canChangeRole: boolean } | null>(null)

  const search = useDebounce(searchQuery.trim(), 300)

  const { data: usersResponse, isLoading, isError, refetch } = useQuery({
    queryKey: ['super-admin', 'users', filterRole, filterClient, filterStatus, filterLogin, search, sort, page],
    queryFn: () =>
      superAdminApi.getUsers({
        role: filterRole,
        organization_id: filterClient !== 'all' ? filterClient : undefined,
        status: filterStatus,
        last_login: filterLogin,
        q: search || undefined,
        sort: sort.key as SortKey,
        direction: sort.direction,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      }),
    placeholderData: (prev) => prev,
  })

  const { data: clients } = useQuery({
    queryKey: ['super-admin', 'clients'],
    queryFn: () => superAdminApi.getClients(),
  })

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['super-admin', 'user-logins', historyFor?.id],
    queryFn: () => superAdminApi.getUserLogins(historyFor.id),
    enabled: !!historyFor,
  })

  // Older links passed the tenant by name in navigation state.
  useEffect(() => {
    const byName = location.state?.clientFilter
    if (byName && clients) {
      const match = clients.find((c) => c.name === byName)
      if (match) setFilterClient(match.id)
      window.history.replaceState({}, document.title)
    }
  }, [location.state, clients])

  useEffect(() => {
    setPage(1)
    if (filterClient === 'all') searchParams.delete('organization_id')
    else searchParams.set('organization_id', filterClient)
    setSearchParams(searchParams, { replace: true })
  }, [filterRole, filterClient, filterStatus, filterLogin, search, sort])

  const updateStatusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      superAdminApi.updateUserStatus(userId, isActive),
    onSuccess: () => {
      toast.success('User status updated')
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'users'] })
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'client-overview'] })
      setConfirmStatus(null)
    },
    onError: (err: any) => toast.error(err.message || 'Failed to update user status.'),
  })

  const apiError = (err: any, fallback: string) => toast.error(err?.response?.data?.message || err?.message || fallback)
  const refreshUsers = () => queryClient.invalidateQueries({ queryKey: ['super-admin', 'users'] })

  const saveUserMutation = useMutation({
    mutationFn: async (f: NonNullable<typeof form>) => {
      const res = f.id
        ? await api.patch<any>(`/v1/super-admin/users/${f.id}`, {
            full_name: f.full_name,
            email: f.email,
            ...(f.canChangeRole ? { role: f.role } : {}),
          })
        : await api.post<any>('/v1/super-admin/users', {
            organization_id: f.organization_id,
            full_name: f.full_name,
            email: f.email,
            role: f.role,
          })
      return { created: !f.id, data: res.data }
    },
    onSuccess: ({ created, data }) => {
      if (created && data?.invite_sent === false) toast.error('Account created, but the invite email failed. Use Resend invite.')
      else toast.success(created ? 'Account created and invite sent' : 'Account updated')
      setForm(null)
      refreshUsers()
    },
    onError: (err: any) => apiError(err, 'Could not save the account.'),
  })

  const resendInviteMutation = useMutation({
    mutationFn: (userId: string) => api.post(`/v1/super-admin/users/${userId}/resend-invite`),
    onSuccess: () => toast.success('Invite sent'),
    onError: (err: any) => apiError(err, 'Could not send the invite.'),
  })

  const resetPasswordMutation = useMutation({
    mutationFn: (userId: string) => superAdminApi.resetUserPassword(userId),
    onSuccess: () => {
      toast.success('Password reset link emailed to the user')
      setConfirmReset(null)
    },
    onError: (err: any) => toast.error(err.message || 'Failed to reset the password.'),
  })

  const users = usersResponse?.users ?? []
  const totalCount = usersResponse?.total || 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const filtersActive = [filterRole, filterClient, filterStatus, filterLogin].filter((f) => f !== 'all').length

  const clearAll = () => {
    setSearchQuery('')
    setFilterRole('all')
    setFilterClient('all')
    setFilterStatus('all')
    setFilterLogin('all')
  }

  const columns: Array<Column<any>> = [
    {
      key: 'name',
      header: 'User',
      cardTitle: true,
      sortable: true,
      cell: (user) => (
        <span className="flex min-w-0 items-center gap-3">
          <span className="relative shrink-0">
            <Avatar name={user.full_name} size="sm" />
            {user.online && (
              <span
                title="Signed in within the last 15 minutes"
                className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full border-2 border-hb-surface bg-hb-success"
              />
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-hb-sm font-semibold text-hb-text">{user.full_name}</span>
            <span className="block truncate text-hb-xs text-hb-muted">{user.email}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'client',
      header: 'Tenant',
      width: '170px',
      cell: (user) => <span className="truncate text-hb-muted">{user.client}</span>,
    },
    {
      key: 'role',
      header: 'Role',
      width: '120px',
      cell: (user) => <Badge>{ROLE_LABEL[user.role] ?? user.role}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      width: '110px',
      cell: (user) => (
        <Badge tone={user.is_active ? 'success' : 'error'}>{user.is_active ? 'Active' : 'Suspended'}</Badge>
      ),
    },
    {
      key: 'last_login',
      header: 'Last sign-in',
      width: '150px',
      sortable: true,
      cell: (user) =>
        user.last_login ? (
          <span className="text-hb-sm text-hb-text" title={formatDateTime(user.last_login)}>
            {timeAgo(user.last_login)}
          </span>
        ) : (
          <span className="text-hb-sm text-hb-dim">Never</span>
        ),
    },
    {
      key: 'created_at',
      header: 'Joined',
      width: '120px',
      sortable: true,
      cell: (user) => <span className="text-hb-sm text-hb-muted">{formatDate(user.created_at)}</span>,
    },
    {
      key: 'actions',
      header: '',
      width: '60px',
      align: 'right',
      hideOnCard: true,
      cell: (user) => (
        <button
          type="button"
          aria-label={`Actions for ${user.full_name}`}
          onClick={(e) => {
            e.stopPropagation()
            const r = e.currentTarget.getBoundingClientRect()
            setMenu({ at: { x: r.right - 184, y: r.bottom + 4 }, user })
          }}
          className="grid h-8 w-8 place-items-center rounded-hb-sm text-hb-muted transition-colors duration-hb hover:bg-hb-surface-2 hover:text-hb-text focus-visible:outline-none focus-visible:shadow-hb-ring"
        >
          <MoreHorizontal size={16} aria-hidden />
        </button>
      ),
    },
  ]

  return (
    <div className="pb-hb-10">
      <PageHeader
        eyebrow="Platform"
        title="Users"
        description="Every administrator, recruiter, interviewer and candidate account across all tenants."
        actions={
          <>
            {!isLoading && <Badge tone="info">{totalCount} accounts</Badge>}
            <ExportButton kind="users" />
            <Button
              icon={<UserPlus size={15} />}
              onClick={() =>
                setForm({ organization_id: filterClient !== 'all' ? filterClient : '', full_name: '', email: '', role: 'recruiter', canChangeRole: true })
              }
            >
              Add user
            </Button>
          </>
        }
      />

      <Toolbar>
        <ToolbarSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search name or email…"
          aria-label="Search all users by name or email"
        />
        <ToolbarFilters activeCount={filtersActive} onReset={clearAll}>
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
          <Select
            options={ROLE_OPTIONS}
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            aria-label="Filter by role"
            fieldClassName="w-auto"
          />
          <Select
            options={STATUS_OPTIONS}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
            aria-label="Filter by account status"
            fieldClassName="w-auto"
          />
          <Select
            options={LAST_LOGIN_OPTIONS}
            value={filterLogin}
            onChange={(e) => setFilterLogin(e.target.value as typeof filterLogin)}
            aria-label="Filter by last sign-in"
            fieldClassName="w-auto"
          />
        </ToolbarFilters>
      </Toolbar>

      <Card padding="none">
        <DataTable
          columns={columns}
          rows={users}
          rowKey={(u) => u.id}
          loading={isLoading}
          sort={sort}
          onSortChange={setSort}
          caption="All user accounts on the platform"
          empty={
            isError
              ? {
                  icon: <Users />,
                  title: 'Could not load users',
                  description: 'The server did not respond as expected.',
                  size: 'page',
                  action: { label: 'Retry', onClick: () => refetch() },
                }
              : {
                  icon: <Users />,
                  title: 'No users found',
                  description: 'Try relaxing the filters or searching for something else.',
                  size: 'page',
                  action: searchQuery || filtersActive ? { label: 'Clear filters', onClick: clearAll } : undefined,
                }
          }
        />

        <Pagination
          page={page}
          pages={totalPages}
          total={totalCount}
          limit={PAGE_SIZE}
          onPage={setPage}
          noun="accounts"
          asCardFooter
        />
      </Card>

      <ContextMenu
        at={menu?.at ?? null}
        onClose={() => setMenu(null)}
        aria-label="User actions"
        items={
          menu
            ? [
                {
                  label: 'Edit account',
                  icon: <Pencil size={14} />,
                  onSelect: () =>
                    setForm({
                      id: menu.user.id,
                      organization_id: menu.user.organization_id,
                      full_name: menu.user.full_name,
                      email: menu.user.email,
                      role: menu.user.role,
                      canChangeRole: isTeamRole(menu.user.role),
                    }),
                },
                ...(isTeamRole(menu.user.role) && menu.user.is_active
                  ? [{
                      label: 'Resend invite',
                      icon: <Send size={14} />,
                      onSelect: () => resendInviteMutation.mutate(menu.user.id),
                    }]
                  : []),
                {
                  label: 'Sign-in history',
                  icon: <History size={14} />,
                  onSelect: () => setHistoryFor(menu.user),
                },
                {
                  label: menu.user.is_active ? 'Suspend account' : 'Activate account',
                  icon: menu.user.is_active ? <Pause size={14} /> : <Play size={14} />,
                  destructive: menu.user.is_active,
                  onSelect: () => setConfirmStatus(menu.user),
                },
                {
                  label: 'Reset password',
                  icon: <Key size={14} />,
                  onSelect: () => setConfirmReset(menu.user),
                },
              ]
            : []
        }
      />

      <Dialog
        open={!!historyFor}
        onClose={() => setHistoryFor(null)}
        title="Sign-in history"
        description={
          historyFor
            ? `${historyFor.full_name} · ${historyFor.email} · last signed in ${
                historyFor.last_login ? formatDateTime(historyFor.last_login) : 'never'
              }`
            : undefined
        }
        size="xl"
      >
        <LoginEventsTable
          events={history?.events ?? []}
          loading={historyLoading}
          showEmail={false}
          caption="Recorded sign-in attempts for this account"
        />
      </Dialog>

      <Dialog
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? 'Edit account' : 'Add a team member'}
        description={form?.id ? undefined : 'They get an email with a link to set their own password.'}
        size="md"
        footer={
          <>
            <Button variant="quiet" size="sm" onClick={() => setForm(null)} disabled={saveUserMutation.isPending}>
              Cancel
            </Button>
            <Button
              size="sm"
              loading={saveUserMutation.isPending}
              disabled={!form?.full_name.trim() || !form?.email.trim() || !form?.organization_id}
              onClick={() => form && saveUserMutation.mutate(form)}
            >
              {form?.id ? 'Save' : 'Create and invite'}
            </Button>
          </>
        }
      >
        {form && (
          <div className="space-y-hb-4">
            {!form.id && (
              <Select
                label="Client"
                value={form.organization_id}
                onChange={(e) => setForm({ ...form, organization_id: e.target.value })}
                options={[{ value: '', label: 'Choose a client' }, ...(clients ?? []).map((c) => ({ value: c.id, label: c.name }))]}
              />
            )}
            <Input label="Full name" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            <Input label="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            {form.canChangeRole && (
              <Select label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} options={TEAM_ROLES} />
            )}
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={!!confirmStatus}
        onClose={() => setConfirmStatus(null)}
        onConfirm={() =>
          confirmStatus &&
          updateStatusMutation.mutate({
            userId: confirmStatus.id,
            isActive: !confirmStatus.is_active,
          })
        }
        title={confirmStatus?.is_active ? 'Suspend this account?' : 'Activate this account?'}
        description={
          confirmStatus?.is_active
            ? `${confirmStatus?.full_name} will be signed out and won't be able to sign in. Their data is kept.`
            : `${confirmStatus?.full_name} will regain access immediately.`
        }
        confirmLabel={confirmStatus?.is_active ? 'Suspend' : 'Activate'}
        destructive={confirmStatus?.is_active}
        loading={updateStatusMutation.isPending}
      />

      <ConfirmDialog
        open={!!confirmReset}
        onClose={() => setConfirmReset(null)}
        onConfirm={() => confirmReset && resetPasswordMutation.mutate(confirmReset.id)}
        title="Reset this password?"
        description={`${confirmReset?.email} will be emailed a single-use link to set a new password. Their current password keeps working until they use it.`}
        confirmLabel="Reset password"
        destructive
        loading={resetPasswordMutation.isPending}
      />
    </div>
  )
}
