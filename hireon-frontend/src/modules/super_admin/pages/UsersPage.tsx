import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { superAdminApi } from '@/api/superAdmin'
import { Skeleton } from '@/components/ui/Skeleton'
import { toast } from 'react-hot-toast'
import { useLocation } from 'react-router-dom'
import { 
  Users, 
  Search, 
  Key, 
  ToggleLeft,
  X,
  ChevronDown
} from 'lucide-react'

export default function UsersPage() {
  const queryClient = useQueryClient()
  const location = useLocation()

  // State
  const [filterRole, setFilterRole] = React.useState('all')
  const [filterClient, setFilterClient] = React.useState('all')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [page, setPage] = React.useState(0)
  const PAGE_SIZE = 50

  // Queries
  const { data: usersResponse, isLoading } = useQuery({
    queryKey: ['super-admin', 'users', filterRole, filterClient, page],
    queryFn: () => superAdminApi.getUsers({ role: filterRole, client: filterClient, limit: PAGE_SIZE, offset: page * PAGE_SIZE })
  })

  const { data: clients } = useQuery({
    queryKey: ['super-admin', 'clients'],
    queryFn: () => superAdminApi.getClients()
  })

  // Set client filter if navigated with location state
  React.useEffect(() => {
    if (location.state?.clientFilter) {
      setFilterClient(location.state.clientFilter)
      setPage(0)
      // clear state
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  // Reset page when filters change
  React.useEffect(() => { setPage(0) }, [filterRole, filterClient])

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) => 
      superAdminApi.updateUserStatus(userId, isActive),
    onSuccess: () => {
      toast.success('User status updated successfully!')
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'users'] })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update user status.')
    }
  })

  const resetPasswordMutation = useMutation({
    mutationFn: (userId: string) => superAdminApi.resetUserPassword(userId),
    onSuccess: () => {
      toast.success('User password reset to default: password123')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to reset user password.')
    }
  })

  // Filter logic on the client side for search
  const filteredUsers = React.useMemo(() => {
    const list = usersResponse?.users || []
    if (!searchQuery.trim()) return list
    const q = searchQuery.toLowerCase()
    return list.filter((u: any) => 
      u.full_name?.toLowerCase().includes(q) || 
      u.email?.toLowerCase().includes(q)
    )
  }, [usersResponse, searchQuery])

  const totalCount = usersResponse?.total || 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <div className="space-y-8 pb-10 pt-6">
      {/* Header */}
      <header className="page-header">
        <h1 className="page-title text-[28px] font-black leading-tight text-[var(--text)]">Users Directory</h1>
        <p className="page-subtitle text-[13px] text-[var(--text-light)]">Audit and manage all administrator, recruiter, interviewer, and candidate accounts across subdomains.</p>
      </header>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3.5 flex-wrap justify-between">
        <div className="flex items-center gap-3.5 flex-wrap">
          {/* Role Filter */}
          <div className="relative">
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="appearance-none pr-8 pl-3 py-1.5 rounded-xl border border-[var(--input-border)] bg-[var(--search-bg)] text-[12.5px] font-bold text-[var(--text-mid)] focus:outline-none focus:border-[var(--violet)]"
            >
              <option value="all">All roles</option>
              <option value="Admin">Admin</option>
              <option value="Recruiter">HR / Recruiter</option>
              <option value="Interviewer">Interviewer</option>
              <option value="Candidate">Candidate</option>
            </select>
            <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-light)] pointer-events-none" size={13} />
          </div>

          {/* Client Filter */}
          <div className="relative">
            <select
              value={filterClient}
              onChange={(e) => setFilterClient(e.target.value)}
              className="appearance-none pr-8 pl-3 py-1.5 rounded-xl border border-[var(--input-border)] bg-[var(--search-bg)] text-[12.5px] font-bold text-[var(--text-mid)] focus:outline-none focus:border-[var(--violet)]"
            >
              <option value="all">All clients</option>
              {clients?.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-light)] pointer-events-none" size={13} />
          </div>
        </div>

        {/* Search */}
        <div 
          className="flex items-center gap-2 rounded-xl px-3 py-1.5 bg-[var(--search-bg)] border border-[var(--input-border)] w-full sm:w-[240px]"
        >
          <Search size={16} className="text-[var(--text-light)] opacity-60" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users..."
            className="border-none bg-transparent text-[12.5px] outline-none w-full text-[var(--text)]"
          />
        </div>
      </div>

      {/* Main Table Card */}
      <div className="rounded-[24px] border overflow-hidden" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : filteredUsers.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b" style={{ borderColor: 'rgba(108,71,255,0.06)', background: 'rgba(108,71,255,0.01)' }}>
                  <th className="p-4 text-[11px] font-black text-[var(--text-light)] uppercase tracking-wider">User details</th>
                  <th className="p-4 text-[11px] font-black text-[var(--text-light)] uppercase tracking-wider">Workspace Tenant</th>
                  <th className="p-4 text-[11px] font-black text-[var(--text-light)] uppercase tracking-wider">Role profile</th>
                  <th className="p-4 text-[11px] font-black text-[var(--text-light)] uppercase tracking-wider text-center">Status</th>
                  <th className="p-4 text-[11px] font-black text-[var(--text-light)] uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user: any) => (
                  <tr
                    key={user.id}
                    className="border-b last:border-b-0"
                    style={{ borderColor: 'rgba(108,71,255,0.03)' }}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8.5 h-8.5 rounded-full flex items-center justify-center font-bold text-white text-[11px] relative" style={{ background: 'linear-gradient(135deg, var(--violet), var(--brand2, #ff6bc6))' }}>
                          {user.full_name.substring(0, 2).toUpperCase()}
                          {user.online && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-white dark:border-[var(--card-bg)]" />
                          )}
                        </div>
                        <div>
                          <p className="text-[13.5px] font-bold text-[var(--text)]">{user.full_name}</p>
                          <p className="text-[11px] text-[var(--text-light)]">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-[13px] font-semibold text-[var(--text-mid)]">{user.client}</span>
                    </td>
                    <td className="p-4">
                      <span className="text-[12.5px] font-semibold text-[var(--text-mid)] capitalize">{user.role}</span>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to ${user.is_active ? 'SUSPEND' : 'ACTIVATE'} this user account?`)) {
                            updateStatusMutation.mutate({ userId: user.id, isActive: !user.is_active })
                          }
                        }}
                        disabled={updateStatusMutation.isPending}
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full hover:opacity-80 transition-opacity`}
                        style={{
                          background: user.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                          color: user.is_active ? '#10b981' : '#ef4444'
                        }}
                      >
                        {user.is_active ? 'ACTIVE' : 'SUSPENDED'}
                      </button>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to reset password for user: ${user.email}?`)) {
                            resetPasswordMutation.mutate(user.id)
                          }
                        }}
                        disabled={resetPasswordMutation.isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-amber-200 text-amber-600 dark:border-amber-900/30 rounded-xl text-[11.5px] font-bold hover:bg-amber-500/10 transition-colors"
                      >
                        <Key size={13} />
                        Reset Credential
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-20 text-center">
              <Users className="mx-auto text-[var(--text-light)] opacity-20 mb-4" size={48} />
              <p className="text-[15px] font-bold text-[var(--text)]">No users found</p>
              <p className="text-[12.5px] text-[var(--text-light)] mt-1">Try relaxing filters or searching another string.</p>
            </div>
          )}
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t flex items-center justify-between" style={{ borderColor: 'rgba(108,71,255,0.06)' }}>
            <span className="text-[12px] font-semibold text-[var(--text-light)]">
              Showing {page * PAGE_SIZE + 1} to {Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount} users
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 rounded-xl border text-[12px] font-bold disabled:opacity-50 hover:bg-[var(--sb-hover)] transition-colors"
                style={{ borderColor: 'var(--input-border)', color: 'var(--text-mid)' }}
              >
                Previous
              </button>
              <span className="text-[12px] font-bold text-[var(--text)] mx-2">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 rounded-xl border text-[12px] font-bold disabled:opacity-50 hover:bg-[var(--sb-hover)] transition-colors"
                style={{ borderColor: 'var(--input-border)', color: 'var(--text-mid)' }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
