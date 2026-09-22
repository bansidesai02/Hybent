import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { Key, MoreHorizontal, Pause, Play, Users } from 'lucide-react'

import { superAdminApi } from '@/api/superAdmin'
import {
  Avatar,
  Badge,
  Button,
  Card,
  type Column,
  ConfirmDialog,
  ContextMenu,
  DataTable,
  PageHeader,
  Pagination,
  Select,
  Toolbar,
  ToolbarSearch,
} from '@/components/hb'

/**
 * Every account on the platform, across every tenant.
 *
 * Rebuilt on the design system in phase 9. Beyond appearance:
 *
 * - The status cell was a `<button>` shaped exactly like the status badges
 *   everywhere else in the product, and clicking it suspended or reactivated
 *   the account. A control that looks like a label is a trap; the status is a
 *   `Badge` again and the two account actions live in the row menu.
 * - Suspension and password reset were both guarded by `window.confirm`,
 *   which cannot be styled and is suppressible by the browser.
 * - The pagination footer was hand-rolled Previous/Next buttons; it is the
 *   design system's `Pagination`, which also states the range.
 *
 * Known limitation, unchanged: the search box filters the current page of 50
 * rows in the browser, not the whole directory. The role and client filters
 * are the server-side ones.
 */

const ROLE_OPTIONS = [
  { value: 'all', label: 'All roles' },
  { value: 'Admin', label: 'Admin' },
  { value: 'Recruiter', label: 'HR / Recruiter' },
  { value: 'Interviewer', label: 'Interviewer' },
  { value: 'Candidate', label: 'Candidate' },
]

const PAGE_SIZE = 50

export default function UsersPage() {
  const queryClient = useQueryClient()
  const location = useLocation()

  const [filterRole, setFilterRole] = useState('all')
  const [filterClient, setFilterClient] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [menu, setMenu] = useState<{ at: { x: number; y: number }; user: any } | null>(null)
  const [confirmStatus, setConfirmStatus] = useState<any | null>(null)
  const [confirmReset, setConfirmReset] = useState<any | null>(null)

  const { data: usersResponse, isLoading } = useQuery({
    queryKey: ['super-admin', 'users', filterRole, filterClient, page],
    queryFn: () =>
      superAdminApi.getUsers({
        role: filterRole,
        client: filterClient,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      }),
  })

  const { data: clients } = useQuery({
    queryKey: ['super-admin', 'clients'],
    queryFn: () => superAdminApi.getClients(),
  })

  // Arriving from a client's detail page pre-filters to that tenant.
  useEffect(() => {
    if (location.state?.clientFilter) {
      setFilterClient(location.state.clientFilter)
      setPage(1)
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  useEffect(() => { setPage(1) }, [filterRole, filterClient])

  const updateStatusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      superAdminApi.updateUserStatus(userId, isActive),
    onSuccess: () => {
      toast.success('User status updated')
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'users'] })
      setConfirmStatus(null)
    },
    onError: (err: any) => toast.error(err.message || 'Failed to update user status.'),
  })

  const resetPasswordMutation = useMutation({
    mutationFn: (userId: string) => superAdminApi.resetUserPassword(userId),
    onSuccess: () => {
      toast.success('Password reset to the default: password123')
      setConfirmReset(null)
    },
    onError: (err: any) => toast.error(err.message || 'Failed to reset the password.'),
  })

  const filteredUsers = useMemo(() => {
    const list = usersResponse?.users || []
    if (!searchQuery.trim()) return list
    const q = searchQuery.toLowerCase()
    return list.filter(
      (u: any) => u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    )
  }, [usersResponse, searchQuery])

  const totalCount = usersResponse?.total || 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const columns: Array<Column<any>> = [
    {
      key: 'user',
      header: 'User',
      cardTitle: true,
      cell: (user) => (
        <span className="flex min-w-0 items-center gap-3">
          <span className="relative shrink-0">
            <Avatar name={user.full_name} size="sm" />
            {user.online && (
              <span
                title="Online"
                className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full border-2 border-hb-surface bg-hb-success"
              />
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-hb-sm font-semibold text-hb-text">
              {user.full_name}
            </span>
            <span className="block truncate text-hb-xs text-hb-muted">{user.email}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'client',
      header: 'Tenant',
      width: '190px',
      cell: (user) => <span className="text-hb-muted">{user.client}</span>,
    },
    {
      key: 'role',
      header: 'Role',
      width: '140px',
      cell: (user) => <Badge>{user.role}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      width: '120px',
      align: 'center',
      cell: (user) => (
        <Badge tone={user.is_active ? 'success' : 'error'}>
          {user.is_active ? 'Active' : 'Suspended'}
        </Badge>
      ),
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
        actions={!isLoading ? <Badge tone="info">{totalCount} accounts</Badge> : undefined}
      />

      <Toolbar>
        <ToolbarSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search this page…"
          aria-label="Search users on the current page by name or email"
        />
        <Select
          options={ROLE_OPTIONS}
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          aria-label="Filter by role"
          fieldClassName="w-auto"
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
      </Toolbar>

      <Card padding="none">
        <DataTable
          columns={columns}
          rows={filteredUsers}
          rowKey={(u) => u.id}
          loading={isLoading}
          caption="All user accounts on the platform"
          empty={{
            icon: <Users />,
            title: 'No users found',
            description: 'Try relaxing the filters or searching for something else.',
            size: 'page',
            action:
              searchQuery || filterRole !== 'all' || filterClient !== 'all'
                ? {
                    label: 'Clear filters',
                    onClick: () => {
                      setSearchQuery('')
                      setFilterRole('all')
                      setFilterClient('all')
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
            ? `${confirmStatus?.full_name} will no longer be able to sign in.`
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
        description={`${confirmReset?.email} will be set to the default password and must change it on their next sign-in.`}
        confirmLabel="Reset password"
        destructive
        loading={resetPasswordMutation.isPending}
      />
    </div>
  )
}
