import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { superAdminApi } from '@/api/superAdmin'
import { GlassIcon } from '@/components/common/GlassIcon'
import { Skeleton } from '@/components/ui/Skeleton'
import { useNavigate } from 'react-router-dom'
import { 
  Building2, 
  Users, 
  Briefcase, 
  CircleDollarSign, 
  Activity, 
  Clock, 
  Plus, 
  ArrowRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react'

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

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ['super-admin', 'health'],
    queryFn: () => superAdminApi.getHealth(),
  })

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val)
  }

  const clientLimitAlerts = React.useMemo(() => {
    if (!clients) return []
    return clients.filter(c => {
      const userRatio = c.users_count / c.users_limit
      const jobRatio = c.jobs_count / c.jobs_limit
      return (userRatio >= 0.85 || jobRatio >= 0.85) && c.status === 'active'
    })
  }, [clients])

  const roleDistribution = React.useMemo(() => {
    if (!dashboard?.role_distribution) return []
    const dist = dashboard.role_distribution
    const total = Object.values(dist).reduce((acc: number, val) => acc + (val as number), 0) || 1
    
    return [
      { name: 'Admin', count: dist.admin || 0, percentage: Math.round(((dist.admin || 0) / total) * 100), color: 'var(--violet)' },
      { name: 'Recruiter', count: dist.recruiter || 0, percentage: Math.round(((dist.recruiter || 0) / total) * 100), color: '#3b82f6' },
      { name: 'Interviewer', count: dist.interviewer || 0, percentage: Math.round(((dist.interviewer || 0) / total) * 100), color: '#ff6bc6' },
      { name: 'Candidate', count: dist.candidate || 0, percentage: Math.round(((dist.candidate || 0) / total) * 100), color: '#10b981' },
    ]
  }, [dashboard])

  return (
    <div className="space-y-8 pb-10 pt-6">
      {/* Header */}
      <header className="page-header flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-title text-[28px] font-black leading-tight text-[var(--text)]">Super Admin Dashboard</h1>
          <p className="page-subtitle text-[13px] text-[var(--text-light)]">Manage Hybent Hiring SaaS platform configurations, tenants, operations, and system health.</p>
        </div>
        <button
          onClick={() => navigate('/super-admin/clients', { state: { openWizard: true } })}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-bold text-white transition-all hover:scale-[1.02] active:scale-95 shadow-md self-start md:self-auto"
          style={{
            background: 'linear-gradient(135deg, var(--violet), var(--brand2, #ff6bc6))',
            boxShadow: '0 4px 14px rgba(108, 71, 255, 0.35)',
          }}
        >
          <Plus size={16} />
          Add Client
        </button>
      </header>

      {/* Resource limit Alerts */}
      {clientLimitAlerts.length > 0 && (
        <div className="space-y-2">
          {clientLimitAlerts.map(client => (
            <div 
              key={client.id}
              className="flex items-center justify-between gap-4 p-4 rounded-xl border"
              style={{
                background: 'rgba(251, 191, 36, 0.08)',
                borderColor: 'rgba(251, 191, 36, 0.25)',
              }}
            >
              <div className="flex items-center gap-3">
                <AlertCircle className="text-amber-500 flex-shrink-0" size={18} />
                <p className="text-[13px] font-medium text-[var(--text)]">
                  Client <strong className="font-bold text-[var(--violet)]">{client.name}</strong> is approaching their resource limit (Users: {client.users_count}/{client.users_limit}, Jobs: {client.jobs_count}/{client.jobs_limit}).
                </p>
              </div>
              <button 
                onClick={() => navigate(`/super-admin/clients`, { state: { selectedClientId: client.id } })}
                className="text-[12px] font-bold text-[var(--violet)] hover:underline flex-shrink-0"
              >
                Manage limits &rarr;
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {dashboardLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[130px] rounded-[20px]" />
          ))
        ) : (
          <>
            <div className="rounded-[20px] p-6 border transition-all duration-300 hover:shadow-md" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
              <div className="flex items-center justify-between mb-4">
                <GlassIcon icon="Building" variant="violet" size={42} iconSize={18} ghost />
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-emerald-500 bg-emerald-500/10">
                  {dashboard?.growth_metrics?.clients_delta || '+1 this month'}
                </span>
              </div>
              <p className="text-[34px] font-black leading-none mb-1 text-[var(--text)]">{dashboard?.total_clients ?? 0}</p>
              <p className="text-[11.5px] font-bold text-[var(--text-light)]">Total clients</p>
            </div>

            <div className="rounded-[20px] p-6 border transition-all duration-300 hover:shadow-md" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
              <div className="flex items-center justify-between mb-4">
                <GlassIcon icon="Users" variant="indigo" size={42} iconSize={18} ghost />
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-emerald-500 bg-emerald-500/10">
                  {dashboard?.growth_metrics?.users_delta || '+24 this week'}
                </span>
              </div>
              <p className="text-[34px] font-black leading-none mb-1 text-[var(--text)]">{dashboard?.total_users ?? 0}</p>
              <p className="text-[11.5px] font-bold text-[var(--text-light)]">Total users</p>
            </div>

            <div className="rounded-[20px] p-6 border transition-all duration-300 hover:shadow-md" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
              <div className="flex items-center justify-between mb-4">
                <GlassIcon icon="Briefcase" variant="blue" size={42} iconSize={18} ghost />
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-emerald-500 bg-emerald-500/10">
                  {dashboard?.growth_metrics?.jobs_delta || '+12 this week'}
                </span>
              </div>
              <p className="text-[34px] font-black leading-none mb-1 text-[var(--text)]">{dashboard?.total_jobs ?? 0}</p>
              <p className="text-[11.5px] font-bold text-[var(--text-light)]">Active jobs</p>
            </div>

            <div className="rounded-[20px] p-6 border transition-all duration-300 hover:shadow-md" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
              <div className="flex items-center justify-between mb-4">
                <GlassIcon icon="CreditCard" variant="emerald" size={42} iconSize={18} ghost />
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-emerald-500 bg-emerald-500/10">
                  {dashboard?.growth_metrics?.mrr_delta || '+5% vs last mo'}
                </span>
              </div>
              <p className="text-[34px] font-black leading-none mb-1 text-[var(--text)]">{formatCurrency(dashboard?.total_mrr ?? 0)}</p>
              <p className="text-[11.5px] font-bold text-[var(--text-light)]">Monthly Recurring Revenue (MRR)</p>
            </div>

            <div className="rounded-[20px] p-6 border transition-all duration-300 hover:shadow-md" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
              <div className="flex items-center justify-between mb-4">
                <GlassIcon icon="UserCheck" variant="pink" size={42} iconSize={18} ghost />
              </div>
              <p className="text-[34px] font-black leading-none mb-1 text-[var(--text)]">{dashboard?.total_candidates ?? 0}</p>
              <p className="text-[11.5px] font-bold text-[var(--text-light)]">Total candidates</p>
            </div>

            <div className="rounded-[20px] p-6 border transition-all duration-300 hover:shadow-md" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
              <div className="flex items-center justify-between mb-4">
                <GlassIcon icon="Calendar" variant="violet" size={42} iconSize={18} ghost />
              </div>
              <p className="text-[34px] font-black leading-none mb-1 text-[var(--text)]">{dashboard?.total_interviews ?? 0}</p>
              <p className="text-[11.5px] font-bold text-[var(--text-light)]">Total interviews</p>
            </div>

            <div className="rounded-[20px] p-6 border transition-all duration-300 hover:shadow-md" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
              <div className="flex items-center justify-between mb-4">
                <GlassIcon icon="Award" variant="emerald" size={42} iconSize={18} ghost />
              </div>
              <p className="text-[34px] font-black leading-none mb-1 text-[var(--text)]">{dashboard?.total_offers ?? 0}</p>
              <p className="text-[11.5px] font-bold text-[var(--text-light)]">Total offers</p>
            </div>

            <div className="rounded-[20px] p-6 border transition-all duration-300 hover:shadow-md" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
              <div className="flex items-center justify-between mb-4">
                <GlassIcon icon="Activity" variant="blue" size={42} iconSize={18} ghost />
              </div>
              <p className="text-[34px] font-black leading-none mb-1 text-[var(--text)]">{dashboard?.api_usage ?? 0}</p>
              <p className="text-[11.5px] font-bold text-[var(--text-light)]">Total API / AI Usage</p>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Clients Snippet Card */}
        <div className="lg:col-span-2 rounded-[24px] p-6 border flex flex-col" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[16px] font-black text-[var(--text)] flex items-center gap-2">
              <Building2 className="text-[var(--violet)]" size={18} />
              Recent Clients
            </h3>
            <button 
              onClick={() => navigate('/super-admin/clients')}
              className="text-[12px] font-bold text-[var(--violet)] hover:underline flex items-center gap-1"
            >
              All Clients <ArrowRight size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-x-auto">
            {clientsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : clients && clients.length > 0 ? (
              <div className="table-responsive">
<table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'rgba(108,71,255,0.06)' }}>
                    <th className="pb-3 text-[11px] font-black text-[var(--text-light)] uppercase tracking-wider">Client</th>
                    <th className="pb-3 text-[11px] font-black text-[var(--text-light)] uppercase tracking-wider">Plan</th>
                    <th className="pb-3 text-[11px] font-black text-[var(--text-light)] uppercase tracking-wider text-center">Users</th>
                    <th className="pb-3 text-[11px] font-black text-[var(--text-light)] uppercase tracking-wider text-center">Jobs</th>
                    <th className="pb-3 text-[11px] font-black text-[var(--text-light)] uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.slice(0, 4).map(client => (
                    <tr 
                      key={client.id}
                      onClick={() => navigate(`/super-admin/clients`, { state: { selectedClientId: client.id } })}
                      className="border-b last:border-0 hover:bg-[var(--sb-hover)] cursor-pointer transition-colors duration-150"
                      style={{ borderColor: 'rgba(108,71,255,0.04)' }}
                    >
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-[11px]" style={{ background: 'linear-gradient(135deg, var(--violet), var(--brand2, #ff6bc6))' }}>
                            {client.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-[13px] font-bold text-[var(--text)]">{client.name}</p>
                            <p className="text-[11px] text-[var(--text-light)]">{client.slug}.hirreon.com</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className="text-[12.5px] font-semibold text-[var(--text)]">{client.plan}</span>
                      </td>
                      <td className="py-3 text-center">
                        <span className="text-[12.5px] font-semibold text-[var(--text-mid)]">{client.users_count}</span>
                      </td>
                      <td className="py-3 text-center">
                        <span className="text-[12.5px] font-semibold text-[var(--text-mid)]">{client.jobs_count}</span>
                      </td>
                      <td className="py-3">
                        <span 
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background: client.status === 'active' ? 'rgba(16,185,129,0.1)' : client.status === 'pending' ? 'rgba(59,130,246,0.1)' : 'rgba(239,68,68,0.1)',
                            color: client.status === 'active' ? '#10b981' : client.status === 'pending' ? '#3b82f6' : '#ef4444'
                          }}
                        >
                          {client.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
</div>
            ) : (
              <div className="py-10 text-center text-[var(--text-light)] text-[12.5px]">No clients onboarded yet.</div>
            )}
          </div>
        </div>

        {/* Users by Role & Uptime Info */}
        <div className="space-y-6">
          {/* Role chart */}
          <div className="rounded-[24px] p-6 border" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <h3 className="text-[15px] font-black text-[var(--text)] mb-4 flex items-center gap-2">
              <Users className="text-[var(--violet)]" size={17} />
              Users by Role
            </h3>
            <div className="space-y-4.5">
              {roleDistribution.map(role => (
                <div key={role.name}>
                  <div className="flex items-center justify-between text-[11.5px] font-semibold text-[var(--text-mid)] mb-1">
                    <span>{role.name}</span>
                    <span>{role.count} ({role.percentage}%)</span>
                  </div>
                  <div className="h-2 w-full bg-[var(--search-bg)] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${role.percentage}%`, backgroundColor: role.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* System status widget */}
          <div className="rounded-[24px] p-6 border" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <h3 className="text-[15px] font-black text-[var(--text)] mb-4 flex items-center gap-2">
              <Activity className="text-[var(--violet)]" size={17} />
              Platform Status
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl text-emerald-500" style={{ background: 'rgba(16,185,129,0.06)' }}>
                <p className="text-[10px] font-black uppercase tracking-wider opacity-85">API Uptime</p>
                <p className="text-[20px] font-black mt-0.5 leading-none">{health?.api_uptime || '99.9%'}</p>
              </div>
              <div className="p-3.5 rounded-xl text-indigo-500" style={{ background: 'rgba(108,71,255,0.06)' }}>
                <p className="text-[10px] font-black uppercase tracking-wider opacity-85">Avg Latency</p>
                <p className="text-[20px] font-black mt-0.5 leading-none">{health?.avg_latency || '340ms'}</p>
              </div>
              <div className="p-3.5 rounded-xl text-amber-500" style={{ background: 'rgba(245,158,11,0.06)' }}>
                <p className="text-[10px] font-black uppercase tracking-wider opacity-85">Errors (24h)</p>
                <p className="text-[20px] font-black mt-0.5 leading-none">{health?.errors_24h ?? 0}</p>
              </div>
              <div className="p-3.5 rounded-xl text-slate-500" style={{ background: 'rgba(148,163,184,0.08)' }}>
                <p className="text-[10px] font-black uppercase tracking-wider opacity-85">DB Queries/s</p>
                <p className="text-[20px] font-black mt-0.5 leading-none">{health?.db_queries_sec ?? 0}</p>
              </div>
            </div>
            <button 
              onClick={() => navigate('/super-admin/health')}
              className="w-full text-center py-2.5 mt-4 text-[12px] font-bold border border-dashed rounded-xl text-[var(--violet)] hover:bg-[var(--sb-hover)] transition-colors"
              style={{ borderColor: 'rgba(108,71,255,0.2)' }}
            >
              Monitor health &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Recent Activity / Audit Log snippet */}
      <div className="rounded-[24px] p-6 border" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[16px] font-black text-[var(--text)] flex items-center gap-2">
            <ShieldCheck className="text-[var(--violet)]" size={18} />
            Recent Administrative Actions
          </h3>
          <button 
            onClick={() => navigate('/super-admin/audit')}
            className="text-[12px] font-bold text-[var(--violet)] hover:underline flex items-center gap-1"
          >
            Audit Log <ArrowRight size={14} />
          </button>
        </div>

        <div className="space-y-1">
          {logsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : logs?.logs && logs.logs.length > 0 ? (
            logs.logs.slice(0, 5).map((log: any, index: number) => (
              <div 
                key={index}
                className="flex items-start gap-4 py-3 border-b last:border-b-0"
                style={{ borderColor: 'rgba(108,71,255,0.04)' }}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: log.type === 'impersonation' ? 'rgba(108,71,255,0.08)' : 'rgba(16,185,129,0.08)' }}>
                  <ShieldCheck size={14} className={log.type === 'impersonation' ? 'text-[var(--violet)]' : 'text-emerald-500'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[var(--text)]">
                    <strong className="font-semibold">{log.actor}</strong>: <span dangerouslySetInnerHTML={{ __html: log.action }} />
                  </p>
                  <p className="text-[11px] text-[var(--text-light)] mt-0.5">{log.client} &middot; {log.time}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="py-10 text-center text-[var(--text-light)] text-[12.5px]">No recent audit logs.</div>
          )}
        </div>
      </div>
    </div>
  )
}
