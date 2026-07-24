import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { superAdminApi } from '@/api/superAdmin'
import { Skeleton } from '@/components/ui/Skeleton'
import { 
  ShieldCheck, 
  Search, 
  ChevronDown,
  FileText
} from 'lucide-react'

export default function AuditLogsPage() {
  const [filterClient, setFilterClient] = React.useState('all')
  const [filterType, setFilterType] = React.useState('all')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [page, setPage] = React.useState(0)
  const PAGE_SIZE = 50

  // Queries
  const { data: logsResponse, isLoading } = useQuery({
    queryKey: ['super-admin', 'audit-logs', filterClient, filterType, page],
    queryFn: () => superAdminApi.getAuditLogs({
      client: filterClient !== 'all' ? filterClient : undefined,
      category: filterType !== 'all' ? filterType : undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE
    })
  })

  const { data: clients } = useQuery({
    queryKey: ['super-admin', 'clients'],
    queryFn: () => superAdminApi.getClients()
  })

  // Reset page when filters change
  React.useEffect(() => { setPage(0) }, [filterClient, filterType])

  // Filter logs on the client side for search
  const filteredLogs = React.useMemo(() => {
    const list = logsResponse?.logs || []
    if (!searchQuery.trim()) return list
    const q = searchQuery.toLowerCase()
    return list.filter((l: any) => 
      l.action?.toLowerCase().includes(q) || 
      l.actor?.toLowerCase().includes(q) ||
      l.client?.toLowerCase().includes(q)
    )
  }, [logsResponse, searchQuery])

  const totalCount = logsResponse?.total || 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <div className="space-y-8 pb-10 pt-6">
      {/* Header */}
      <header className="page-header">
        <h1 className="page-title text-[28px] font-black leading-tight text-[var(--text)]">Audit Logs</h1>
        <p className="page-subtitle text-[13px] text-[var(--text-light)]">Platform security audit trials. Track impersonation sessions, user actions, billing adjustments, and flag changes.</p>
      </header>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3.5 flex-wrap justify-between">
        <div className="flex items-center gap-3.5 flex-wrap">
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

          {/* Action Filter */}
          <div className="relative">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="appearance-none pr-8 pl-3 py-1.5 rounded-xl border border-[var(--input-border)] bg-[var(--search-bg)] text-[12.5px] font-bold text-[var(--text-mid)] focus:outline-none focus:border-[var(--violet)]"
            >
              <option value="all">All actions</option>
              <option value="impersonation">Impersonation</option>
              <option value="billing">Billing</option>
              <option value="user">User changes</option>
              <option value="job">Job postings</option>
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
            placeholder="Search logs..."
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
          ) : filteredLogs.length > 0 ? (
            <div className="table-responsive">
<table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b" style={{ borderColor: 'rgba(108,71,255,0.06)', background: 'rgba(108,71,255,0.01)' }}>
                  <th className="p-4 text-[11px] font-black text-[var(--text-light)] uppercase tracking-wider">Administrative Action</th>
                  <th className="p-4 text-[11px] font-black text-[var(--text-light)] uppercase tracking-wider">Tenant Client</th>
                  <th className="p-4 text-[11px] font-black text-[var(--text-light)] uppercase tracking-wider">Actor username</th>
                  <th className="p-4 text-[11px] font-black text-[var(--text-light)] uppercase tracking-wider">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log: any, index: number) => (
                  <tr
                    key={index}
                    className="border-b last:border-b-0 hover:bg-[var(--sb-hover)]/30 transition-colors"
                    style={{ borderColor: 'rgba(108,71,255,0.03)' }}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: log.type === 'impersonation' ? 'rgba(108,71,255,0.08)' : 'rgba(16,185,129,0.08)' }}>
                          <ShieldCheck size={14} className={log.type === 'impersonation' ? 'text-[var(--violet)]' : 'text-emerald-500'} />
                        </div>
                        <p className="text-[13px] font-bold text-[var(--text)]" dangerouslySetInnerHTML={{ __html: log.action }} />
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-[12.5px] font-semibold text-[var(--text-mid)]">{log.client}</span>
                    </td>
                    <td className="p-4">
                      <span className="text-[12.5px] font-semibold text-[var(--text-mid)]">{log.actor}</span>
                    </td>
                    <td className="p-4">
                      <span className="text-[12.5px] font-semibold text-[var(--text-light)]">{log.time}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
</div>
          ) : (
            <div className="py-20 text-center">
              <FileText className="mx-auto text-[var(--text-light)] opacity-20 mb-4" size={48} />
              <p className="text-[15px] font-bold text-[var(--text)]">No audit logs found</p>
              <p className="text-[12.5px] text-[var(--text-light)] mt-1">Try relaxing search or filter inputs.</p>
            </div>
          )}
        </div>
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t flex items-center justify-between" style={{ borderColor: 'rgba(108,71,255,0.06)' }}>
            <span className="text-[12px] font-semibold text-[var(--text-light)]">
              Showing {page * PAGE_SIZE + 1} to {Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount} logs
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
