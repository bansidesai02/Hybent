import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { superAdminApi } from '@/api/superAdmin'
import { useAuthStore } from '@/store/authStore'
import { GlassIcon } from '@/components/common/GlassIcon'
import { Skeleton } from '@/components/ui/Skeleton'
import { toast } from 'react-hot-toast'
import { 
  Building2, 
  Users, 
  Briefcase, 
  Calendar, 
  CreditCard,
  ToggleLeft,
  AlertTriangle,
  Play,
  Pause,
  Trash2,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  X,
  FileText
} from 'lucide-react'

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user: currentLoggedUser, setTokens } = useAuthStore()

  // State
  const [selectedUserToImpersonate, setSelectedUserToImpersonate] = React.useState<any | null>(null)
  const [impersonateReason, setImpersonateReason] = React.useState('')
  const [isImpModalOpen, setIsImpModalOpen] = React.useState(false)

  // Query details
  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ['super-admin', 'clients'],
    queryFn: () => superAdminApi.getClients(),
  })

  const client = React.useMemo(() => {
    if (!clients || !id) return null
    return clients.find(c => c.id === id)
  }, [clients, id])

  // Get users for this client to list and allow impersonation
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['super-admin', 'users', client?.name],
    queryFn: () => superAdminApi.getUsers({ client: client?.name }),
    enabled: !!client?.name
  })

  // Get client flags
  const { data: flags, isLoading: flagsLoading } = useQuery({
    queryKey: ['super-admin', 'flags', id],
    queryFn: () => superAdminApi.getClientFlags(id!),
    enabled: !!id
  })

  // Mutations
  const updateFlagsMutation = useMutation({
    mutationFn: (updatedFlags: Record<string, boolean>) => superAdminApi.updateClientFlags(id!, updatedFlags),
    onSuccess: () => {
      toast.success('Feature flags overrides updated successfully!')
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'flags', id] })
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'clients'] })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update feature flags overrides.')
    }
  })

  const toggleStatusMutation = useMutation({
    mutationFn: () => {
      if (client?.status === 'active') {
        return superAdminApi.suspendClient(id!)
      } else {
        return superAdminApi.activateClient(id!)
      }
    },
    onSuccess: () => {
      toast.success(`Client ${client?.status === 'active' ? 'suspended' : 'activated'} successfully.`)
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'clients'] })
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'dashboard'] })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to toggle client status.')
    }
  })

  const deleteClientMutation = useMutation({
    mutationFn: () => superAdminApi.deleteClient(id!),
    onSuccess: () => {
      toast.success('Client permanently deleted.')
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'clients'] })
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'dashboard'] })
      navigate('/super-admin/clients')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete client.')
    }
  })

  const impersonateMutation = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) => 
      superAdminApi.impersonateUser(userId, reason),
    onSuccess: (data) => {
      toast.success('Impersonation token retrieved! Swapping session...')
      
      // Save current credentials to allow restore on exit
      const currentToken = localStorage.getItem('hireon_access_token')
      const currentRefreshToken = localStorage.getItem('hireon_refresh_token')
      
      if (currentToken && currentLoggedUser) {
        localStorage.setItem('hireon_super_admin_access_token', currentToken)
        if (currentRefreshToken) {
          localStorage.setItem('hireon_super_admin_refresh_token', currentRefreshToken)
        }
        localStorage.setItem('hireon_super_admin_user', JSON.stringify(currentLoggedUser))
      } else {
        const sessionToken = sessionStorage.getItem('hireon_access_token')
        const sessionRefreshToken = sessionStorage.getItem('hireon_refresh_token')
        if (sessionToken && currentLoggedUser) {
          sessionStorage.setItem('hireon_super_admin_access_token', sessionToken)
          if (sessionRefreshToken) {
            sessionStorage.setItem('hireon_super_admin_refresh_token', sessionRefreshToken)
          }
          sessionStorage.setItem('hireon_super_admin_user', JSON.stringify(currentLoggedUser))
        }
      }

      // Set target token
      setTokens(data.access_token, undefined, data.user)
      setIsImpModalOpen(false)
      setImpersonateReason('')

      // Redirect depending on user role
      if (data.user.role === 'admin') navigate('/admin')
      else if (data.user.role === 'interviewer') navigate('/interviewer')
      else if (data.user.role === 'candidate') navigate('/portal')
      else navigate('/recruiter')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || err.message || 'Impersonation failed.')
    }
  })

  const handleFlagChange = (flagKey: string, val: boolean) => {
    if (!flags) return
    const newFlags = { ...flags, [flagKey]: val }
    updateFlagsMutation.mutate(newFlags)
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val)
  }

  if (clientsLoading || !client) {
    return (
      <div className="space-y-6 pt-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-[300px] w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-10 pt-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-[12px] font-bold text-[var(--text-light)]">
        <button onClick={() => navigate('/super-admin/clients')} className="hover:text-[var(--text)] transition-colors">Clients</button>
        <span className="opacity-50">&rarr;</span>
        <span className="text-[var(--violet)]">{client.name}</span>
      </div>

      {/* Main details banner */}
      <div className="rounded-[24px] p-6 border flex flex-col md:flex-row md:items-start justify-between gap-6" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
        <div className="flex items-start gap-4.5">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-white text-[18px]" style={{ background: 'linear-gradient(135deg, var(--violet), var(--brand2, #ff6bc6))' }}>
            {client.name.substring(0, 2).toUpperCase()}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-[20px] font-black text-[var(--text)] leading-none">{client.name}</h1>
              <span
                className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
                style={{
                  background: client.status === 'active' ? 'rgba(16,185,129,0.1)' : client.status === 'pending' ? 'rgba(59,130,246,0.1)' : 'rgba(239,68,68,0.1)',
                  color: client.status === 'active' ? '#10b981' : client.status === 'pending' ? '#3b82f6' : '#ef4444'
                }}
              >
                {client.status.toUpperCase()}
              </span>
            </div>
            <p className="text-[12.5px] text-[var(--violet)] font-bold">{client.slug}.hirreon.com</p>
            <div className="flex flex-wrap gap-2 pt-1 text-[11px] font-bold text-[var(--text-light)]">
              {client.industry && <span className="px-2.5 py-1 bg-[var(--search-bg)] border border-[var(--input-border)] rounded-full">{client.industry}</span>}
              {client.size && <span className="px-2.5 py-1 bg-[var(--search-bg)] border border-[var(--input-border)] rounded-full">{client.size} employees</span>}
              {client.location && <span className="px-2.5 py-1 bg-[var(--search-bg)] border border-[var(--input-border)] rounded-full">{client.location}</span>}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 self-stretch md:self-auto">
          <button 
            onClick={() => {
              if (users && users.length > 0) {
                setSelectedUserToImpersonate(users[0])
                setIsImpModalOpen(true)
              } else {
                toast.error('No users found in this organization to impersonate.')
              }
            }}
            className="flex items-center justify-center gap-1.5 px-4 py-2 border border-[var(--violet)] rounded-xl text-[12.5px] font-bold text-[var(--violet)] hover:bg-[var(--violet)]/5 transition-all active:scale-95"
          >
            <UserCheck size={15} />
            Impersonate
          </button>
          <a
            href={`http://${client.slug}.localhost:3000`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 px-4 py-2 border rounded-xl text-[12.5px] font-bold text-[var(--text-mid)] hover:bg-[var(--sb-hover)] transition-all active:scale-95"
          >
            <ExternalLink size={14} />
            Launch Portal
          </a>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4.5">
        <div className="rounded-[20px] p-5 border flex flex-col justify-between" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
          <span className="text-[12px] font-bold text-[var(--text-light)] flex items-center gap-1.5"><Users size={14} /> Users count</span>
          <p className="text-[26px] font-black text-[var(--text)] mt-3 leading-none">{client.users_count} <span className="text-[12px] font-semibold text-[var(--text-light)]">/ {client.users_limit}</span></p>
          <div className="h-1.5 bg-[var(--search-bg)] rounded-full overflow-hidden mt-3.5">
            <div className="h-full bg-[var(--violet)]" style={{ width: `${Math.min((client.users_count / client.users_limit) * 100, 100)}%` }} />
          </div>
        </div>

        <div className="rounded-[20px] p-5 border flex flex-col justify-between" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
          <span className="text-[12px] font-bold text-[var(--text-light)] flex items-center gap-1.5"><Briefcase size={14} /> Active jobs</span>
          <p className="text-[26px] font-black text-[var(--text)] mt-3 leading-none">{client.jobs_count} <span className="text-[12px] font-semibold text-[var(--text-light)]">/ {client.jobs_limit}</span></p>
          <div className="h-1.5 bg-[var(--search-bg)] rounded-full overflow-hidden mt-3.5">
            <div className="h-full bg-blue-500" style={{ width: `${Math.min((client.jobs_count / client.jobs_limit) * 100, 100)}%` }} />
          </div>
        </div>

        <div className="rounded-[20px] p-5 border flex flex-col justify-between" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
          <span className="text-[12px] font-bold text-[var(--text-light)] flex items-center gap-1.5"><Calendar size={14} /> Interviews booked</span>
          <p className="text-[26px] font-black text-[var(--text)] mt-3 leading-none">{client.interviews_count}</p>
          <div className="h-1.5 bg-[var(--search-bg)] rounded-full overflow-hidden mt-3.5 opacity-0" />
        </div>

        <div className="rounded-[20px] p-5 border flex flex-col justify-between" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
          <span className="text-[12px] font-bold text-[var(--text-light)] flex items-center gap-1.5"><CreditCard size={14} /> MRR contribution</span>
          <p className="text-[26px] font-black text-[var(--text)] mt-3 leading-none">{formatCurrency(client.mrr)}</p>
          <div className="h-1.5 bg-[var(--search-bg)] rounded-full overflow-hidden mt-3.5 opacity-0" />
        </div>
      </div>

      {/* Detail splits */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Organization User List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-[24px] p-6 border" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <h3 className="text-[15px] font-black text-[var(--text)] mb-5 flex items-center justify-between">
              <span>Users in Organization</span>
              <button 
                onClick={() => navigate('/super-admin/users', { state: { clientFilter: client.name } })}
                className="text-[11.5px] font-bold text-[var(--violet)] hover:underline"
              >
                Manage all users
              </button>
            </h3>

            <div className="overflow-x-auto">
              {usersLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : users && users.length > 0 ? (
                <div className="table-responsive">
<table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'rgba(108,71,255,0.06)' }}>
                      <th className="pb-3 text-[11px] font-black text-[var(--text-light)] uppercase tracking-wider">User</th>
                      <th className="pb-3 text-[11px] font-black text-[var(--text-light)] uppercase tracking-wider">Role</th>
                      <th className="pb-3 text-[11px] font-black text-[var(--text-light)] uppercase tracking-wider">Status</th>
                      <th className="pb-3 text-[11px] font-black text-[var(--text-light)] uppercase tracking-wider"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u: any) => (
                      <tr 
                        key={u.id}
                        className="border-b last:border-0"
                        style={{ borderColor: 'rgba(108,71,255,0.04)' }}
                      >
                        <td className="py-3">
                          <p className="text-[13px] font-bold text-[var(--text)]">{u.full_name}</p>
                          <p className="text-[11px] text-[var(--text-light)]">{u.email}</p>
                        </td>
                        <td className="py-3">
                          <span className="text-[12.5px] font-semibold text-[var(--text-mid)] capitalize">{u.role}</span>
                        </td>
                        <td className="py-3">
                          <span 
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{
                              background: u.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                              color: u.is_active ? '#10b981' : '#ef4444'
                            }}
                          >
                            {u.is_active ? 'ACTIVE' : 'SUSPENDED'}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => {
                              setSelectedUserToImpersonate(u)
                              setIsImpModalOpen(true)
                            }}
                            className="text-[11px] font-bold text-[var(--violet)] px-2.5 py-1 rounded-lg border hover:bg-[var(--violet)]/5 transition-colors"
                            style={{ borderColor: 'rgba(108,71,255,0.2)' }}
                          >
                            Impersonate
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
</div>
              ) : (
                <div className="py-10 text-center text-[var(--text-light)] text-[12.5px]">No users in this organization.</div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Feature flags and Danger zone */}
        <div className="space-y-6">
          {/* Flags overrides */}
          <div className="rounded-[24px] p-6 border" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <h3 className="text-[15px] font-black text-[var(--text)] mb-4 flex items-center gap-2">
              <ToggleLeft className="text-[var(--violet)]" size={17} />
              Feature Flags Overrides
            </h3>

            <div className="divide-y" style={{ borderColor: 'rgba(108,71,255,0.06)' }}>
              {flagsLoading ? (
                <div className="space-y-3 py-3">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : flags ? (
                Object.entries(flags).map(([key, val]) => {
                  const labelMap: Record<string, { title: string; desc: string }> = {
                    ai: { title: 'AI Scoring Engine', desc: 'Screen resumes via AI.' },
                    video: { title: 'Video Interviews', desc: 'Allows recording video rounds.' },
                    bulk: { title: 'Bulk Candidate Import', desc: 'Sheet upload parser support.' },
                    domain: { title: 'Custom Subdomain', desc: 'Custom host URL routing.' },
                    analytics: { title: 'Advanced Export', desc: 'Downloads reports.' }
                  }
                  const info = labelMap[key] || { title: key, desc: 'Platform toggle override.' }
                  
                  return (
                    <div key={key} className="flex items-center justify-between py-3">
                      <div className="max-w-[70%]">
                        <p className="text-[12.5px] font-bold text-[var(--text)]">{info.title}</p>
                        <p className="text-[11px] text-[var(--text-light)] mt-0.5">{info.desc}</p>
                      </div>
                      <button
                        onClick={() => handleFlagChange(key, !val)}
                        disabled={updateFlagsMutation.isPending}
                        className={`w-9 h-[20px] rounded-full relative p-0.5 transition-colors duration-200 focus:outline-none ${val ? 'bg-[var(--violet)]' : 'bg-slate-300 dark:bg-slate-600'}`}
                      >
                        <div 
                          className={`w-[16px] h-[16px] bg-white rounded-full transition-transform duration-200 ${val ? 'translate-x-[16px]' : 'translate-x-0'}`} 
                        />
                      </button>
                    </div>
                  )
                })
              ) : (
                <div className="py-6 text-center text-[var(--text-light)] text-[12.5px]">No feature flags available.</div>
              )}
            </div>
          </div>

          {/* Danger zone */}
          <div className="rounded-[24px] p-6 border flex flex-col gap-4" style={{ background: 'rgba(239,68,68,0.04)', borderColor: 'rgba(239,68,68,0.2)' }}>
            <h3 className="text-[15px] font-black text-red-500 flex items-center gap-2">
              <AlertTriangle size={17} />
              Danger Zone
            </h3>
            <p className="text-[11.5px] text-red-600/80 leading-relaxed">
              Disruptive administrative controls. Proceed with extreme caution. Suspension blocks client logins; deletion is absolute.
            </p>
            <div className="flex gap-2.5 mt-2">
              <button
                onClick={() => {
                  if (confirm(`Are you sure you want to ${client.status === 'active' ? 'SUSPEND' : 'ACTIVATE'} this client organization?`)) {
                    toggleStatusMutation.mutate()
                  }
                }}
                disabled={toggleStatusMutation.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold border border-red-200 text-red-600 hover:bg-red-500/10 transition-colors"
              >
                {client.status === 'active' ? (
                  <><Pause size={14} /> Suspend</>
                ) : (
                  <><Play size={14} /> Activate</>
                )}
              </button>
              <button
                onClick={() => {
                  if (confirm('CRITICAL WARNING: This will permanently delete the organization and ALL its users, jobs, candidates, interviews, and tables! This action is irreversible. Are you absolutely sure?')) {
                    deleteClientMutation.mutate()
                  }
                }}
                disabled={deleteClientMutation.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Impersonate Modal Overlay */}
      {isImpModalOpen && selectedUserToImpersonate && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div 
            className="w-full max-w-[480px] rounded-[24px] overflow-hidden border flex flex-col shadow-2xl animate-scale-up"
            style={{ background: 'var(--modal-bg)', borderColor: 'var(--sidebar-border)' }}
          >
            {/* Modal Head */}
            <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: 'rgba(108,71,255,0.06)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--violet)]/10 flex items-center justify-center text-[var(--violet)]">
                  <UserCheck size={20} />
                </div>
                <div>
                  <h3 className="text-[16px] font-black text-[var(--text)]">Start Impersonation</h3>
                  <p className="text-[11.5px] text-[var(--text-light)]">Secure audit authentication session</p>
                </div>
              </div>
              <button 
                onClick={() => { setIsImpModalOpen(false); setImpersonateReason('') }}
                className="w-8 h-8 rounded-lg hover:bg-[var(--sb-hover)] flex items-center justify-center text-[var(--text-light)] hover:text-[var(--text)] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Selected User Display */}
              <div className="p-4 rounded-xl border flex items-center justify-between" style={{ borderColor: 'rgba(108,71,255,0.06)', background: 'var(--search-bg)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[var(--violet)]/10 flex items-center justify-center font-bold text-[var(--violet)] text-[12px]">
                    {selectedUserToImpersonate.full_name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-[var(--text)]">{selectedUserToImpersonate.full_name}</p>
                    <p className="text-[11px] text-[var(--text-light)]">{selectedUserToImpersonate.email} &middot; {selectedUserToImpersonate.role}</p>
                  </div>
                </div>
              </div>

              {/* Warnings alert */}
              <div className="p-3.5 rounded-xl text-amber-600 text-[12px] border bg-amber-50 dark:bg-amber-950/20 border-amber-200 flex gap-2">
                <ShieldCheck size={16} className="flex-shrink-0 mt-0.5" />
                <p>
                  This session will be fully signed, audited, and logged under your super admin username. All database mutation actions are logged.
                </p>
              </div>

              {/* User Selection if multiple available */}
              {users && users.length > 1 && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[var(--text-mid)]">Target Impersonator User</label>
                  <select
                    value={selectedUserToImpersonate.id}
                    onChange={(e) => {
                      const u = users.find((x: any) => x.id === e.target.value)
                      if (u) setSelectedUserToImpersonate(u)
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input-border)] bg-[var(--search-bg)] text-[13px] text-[var(--text)] focus:outline-none focus:border-[var(--violet)]"
                  >
                    {users.map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({u.role} &middot; {u.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Reason input */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[var(--text-mid)]">Reason for Impersonation *</label>
                <input
                  type="text"
                  value={impersonateReason}
                  onChange={(e) => setImpersonateReason(e.target.value)}
                  placeholder="e.g. Debugging scoring engine issue on candidate panel"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input-border)] bg-[var(--search-bg)] text-[13px] text-[var(--text)] focus:outline-none focus:border-[var(--violet)]"
                />
              </div>
            </div>

            {/* Modal Foot */}
            <div className="px-6 py-4 border-t flex justify-end gap-2.5" style={{ borderColor: 'rgba(108,71,255,0.06)' }}>
              <button
                onClick={() => { setIsImpModalOpen(false); setImpersonateReason('') }}
                className="px-4 py-2 border rounded-xl text-[12px] font-bold text-[var(--text-mid)] hover:bg-[var(--sb-hover)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!impersonateReason.trim()) {
                    toast.error('You must specify a reason for starting an impersonation session.')
                    return
                  }
                  impersonateMutation.mutate({ 
                    userId: selectedUserToImpersonate.id, 
                    reason: impersonateReason 
                  })
                }}
                disabled={impersonateMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold text-white transition-all active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, var(--violet), var(--brand2, #ff6bc6))',
                  opacity: impersonateMutation.isPending ? 0.65 : 1
                }}
              >
                {impersonateMutation.isPending ? 'Connecting...' : <><UserCheck size={14} /> Start Impersonation</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
